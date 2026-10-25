// Daily refresh pipeline: fetch -> validate -> normalize -> de-duplicate -> store history -> score.
// Each source is isolated: a failing source is logged and its previous data is kept.
// Re-running on the same day overwrites that day's rows (primary keys include the date),
// so repeated runs never duplicate data.

import { SKILL_ISCO_FALLBACK, SKILLS, SOURCES } from './catalog.js';
import { computeScores, MIN_ADS_FOR_DEMAND } from './scoring.js';
import * as defaultAdapters from './sources.js';
import ESCO_MAP from '../_data/esco-map.js';
import { addDays, buildMatcher, escoLabelToTerm, jobDedupKey, round, sofiaClock } from './util.js';

const MIN_ADS_PER_SOURCE = 20;
const STALE_RUN_MINUTES = 15;

export function catalogRows() {
  return SKILLS.map((s) => ({
    id: s.id, label_bg: s.bg, label_en: s.en, categories: s.categories, search_terms: s.terms,
    updated_at: new Date().toISOString(),
  }));
}

export function sourceRows() {
  return SOURCES.map(({ id, name, url, license, kind, update_frequency }) => ({ id, name, url, license, kind, update_frequency }));
}

/** Terms used to recognise a skill in job ads: curated synonyms + multi-word ESCO alternative labels. */
export function skillTerms(skillRow) {
  const terms = [...(skillRow.search_terms || [])];
  const extra = (skillRow.esco_alt_labels || [])
    .map(escoLabelToTerm)
    .filter((t) => t && t.includes(' '))
    .slice(0, 10);
  return [...new Set([...terms, ...extra])];
}

/** Counts skill mentions in a list of normalized jobs. */
export function analyzeJobs(jobs, skillRows) {
  const matchers = skillRows.map((s) => ({ id: s.id, test: buildMatcher(skillTerms(s)) }));
  const counts = new Map(skillRows.map((s) => [s.id, 0]));
  const cooc = new Map();
  for (const job of jobs) {
    const found = matchers.filter((m) => m.test(job.text)).map((m) => m.id);
    for (const id of found) counts.set(id, counts.get(id) + 1);
    for (const a of found) {
      for (const b of found) {
        if (a === b) continue;
        const key = `${a}|${b}`;
        cooc.set(key, (cooc.get(key) || 0) + 1);
      }
    }
  }
  return { total: jobs.length, counts, cooc };
}

/** Removes duplicate ads (same id, or same company + title across boards). */
export function dedupeJobs(jobs) {
  const seenIds = new Set();
  const seenKeys = new Set();
  const out = [];
  for (const j of jobs) {
    const key = jobDedupKey(j);
    if (seenIds.has(j.id) || (key !== '|' && seenKeys.has(key))) continue;
    seenIds.add(j.id);
    seenKeys.add(key);
    out.push(j);
  }
  return out;
}

function cagr(first, last, years) {
  if (!(first > 0) || !(last > 0) || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export function employmentTrendByIsco2(series, geo = 'EU27_2020', span = 5) {
  const byCode = new Map();
  for (const r of series) {
    if (r.geo !== geo) continue;
    if (!byCode.has(r.series_key)) byCode.set(r.series_key, []);
    byCode.get(r.series_key).push(r);
  }
  const out = new Map();
  for (const [code, rows] of byCode) {
    rows.sort((a, b) => a.period.localeCompare(b.period));
    const last = rows[rows.length - 1];
    const target = String(Number(last.period) - span);
    const first = rows.find((r) => r.period === target) || rows[0];
    const years = Number(last.period) - Number(first.period);
    const value = cagr(Number(first.value), Number(last.value), years);
    if (value !== null && years >= 3) out.set(code.replace(/^OC/, ''), { cagr_pct: value, from: first.period, to: last.period, geo });
  }
  return out;
}

export function forecastByIsco2(forecasts, preferredGeo = 'EU27_2020') {
  const out = new Map();
  const sorted = [...forecasts].sort((a, b) =>
    (a.geo === preferredGeo ? 0 : 1) - (b.geo === preferredGeo ? 0 : 1)
    || String(b.edition).localeCompare(String(a.edition))
    || (b.end_year - b.start_year) - (a.end_year - a.start_year));
  for (const f of sorted) if (!out.has(f.isco2)) out.set(f.isco2, { ...f, annual_growth_pct: Number(f.annual_growth_pct) });
  return out;
}

/**
 * @param {object} opts
 * @param {object} opts.store       see store.js
 * @param {Date}   [opts.now]
 * @param {string} [opts.trigger]   'cron' | 'manual' | 'test'
 * @param {boolean}[opts.force]     run even if today's run already succeeded
 * @param {object} [opts.adapters]  injectable source adapters (tests)
 * @param {object} [opts.escoMap]   ESCO mapping (defaults to the bundled api/_data/esco-map.js)
 */
export async function runRefresh({ store, now = new Date(), trigger = 'cron', force = false, adapters = defaultAdapters,
  fetchImpl, escoMap = ESCO_MAP, log = console } = {}) {
  const startedMs = Date.now();
  const { date: today } = sofiaClock(now);

  // Idempotency + concurrency guard
  const recent = await store.getRuns(20);
  const running = recent.find((r) => r.status === 'running'
    && Date.now() - Date.parse(r.started_at) < STALE_RUN_MINUTES * 60000);
  if (running) return { status: 'skipped', reason: 'another_run_in_progress', runKey: today };
  if (!force && recent.some((r) => r.run_key === today && (r.status === 'success' || r.status === 'partial') && r.trigger !== 'test')) {
    return { status: 'skipped', reason: 'already_completed_today', runKey: today };
  }

  const runId = await store.startRun({ run_key: today, trigger, status: 'running', started_at: new Date().toISOString() });
  const results = {};

  try {
  await store.upsertSources(sourceRows());
  await store.upsertSkills(catalogRows());
  let skills = await store.getSkills();

  const step = async (sourceId, fn) => {
    const attemptAt = new Date().toISOString();
    try {
      const info = await fn();
      if (info?.skipped) {
        results[sourceId] = { status: 'skipped', ...info };
        return;
      }
      results[sourceId] = { status: 'ok', ...info };
      await store.updateSource(sourceId, {
        last_attempt_at: attemptAt, last_success_at: new Date().toISOString(), last_status: 'ok', last_error: null,
        records_last_run: info.records ?? null, data_period: info.period ?? null, source_updated_at: info.sourceUpdated ?? null,
      });
    } catch (e) {
      const message = String(e?.message || e).slice(0, 300);
      log.error?.(`[refresh] ${sourceId} failed: ${message}`);
      results[sourceId] = { status: 'error', error: message };
      await store.updateSource(sourceId, { last_attempt_at: attemptAt, last_status: 'error', last_error: message });
    }
  };

  // 1) ESCO: load the bundled skill → occupation → ISCO mapping (api/_data/esco-map.js).
  // The ESCO API blocks Vercel's servers (HTTP 403), so the map is built in GitHub Actions.
  await step('esco', async () => {
    const map = escoMap;
    if (!map?.skills || !Object.keys(map.skills).length) {
      throw new Error('Речникът ESCO още не е генериран (ESCO API е недостъпно); използва се редакционна връзка умение → ISCO група');
    }
    const version = map.generatedAt;
    const due = skills.filter((s) => map.skills[s.id] && (!s.esco_checked_at || s.esco_checked_at < version || !s.esco_uri));
    if (due.length) {
      const occRows = Object.entries(map.occupations || {}).map(([uri, o]) => ({
        uri, label_en: o.label_en, label_bg: o.label_bg ?? null, isco_code: o.isco_code ?? null, isco2: o.isco2 ?? null, fetched_at: version,
      }));
      await store.upsertOccupations(occRows);
      for (const s of due) {
        const m = map.skills[s.id];
        const rels = m.occupations.filter((o) => map.occupations?.[o.uri]);
        await store.replaceSkillOccupations(s.id, rels.map((o) => ({ skill_id: s.id, occupation_uri: o.uri, relation: o.relation })));
        await store.updateSkill(s.id, {
          esco_uri: m.uri, esco_label_en: m.label_en, esco_label_bg: m.label_bg ?? null,
          esco_alt_labels: (m.alt_en || []).slice(0, 40), esco_checked_at: version,
        });
      }
    }
    return { records: due.length, skillsMapped: Object.keys(map.skills).length, period: `карта от ${version.slice(0, 10)}` };
  });
  skills = await store.getSkills();

  // 2) Job ads
  const jobsBySource = {};
  for (const [sourceId, fn] of [['remotive', adapters.fetchRemotiveJobs], ['arbeitnow', adapters.fetchArbeitnowJobs]]) {
    await step(sourceId, async () => {
      const jobs = dedupeJobs(await fn({ fetchImpl }));
      if (jobs.length === 0) throw new Error('no valid ads returned; keeping previous data');
      jobsBySource[sourceId] = jobs;
      if (jobs.length < MIN_ADS_PER_SOURCE) {
        // Valid response but too small for its own statistics: the ads still count in the combined sample.
        return { records: jobs.length, period: today, warning: `малка извадка (${jobs.length} обяви) — включени само в общата извадка` };
      }
      const a = analyzeJobs(jobs, skills);
      await store.upsertDemandSnapshots(skills.map((s) => ({
        source_id: sourceId, skill_id: s.id, snapshot_date: today, ads_total: a.total,
        ads_matching: a.counts.get(s.id), share: round(a.counts.get(s.id) / a.total, 6),
      })));
      return { records: jobs.length, period: today };
    });
  }
  const combined = dedupeJobs(Object.values(jobsBySource).flat());
  if (combined.length >= MIN_ADS_FOR_DEMAND) {
    const a = analyzeJobs(combined, skills);
    await store.upsertDemandSnapshots(skills.map((s) => ({
      source_id: 'jobs_combined', skill_id: s.id, snapshot_date: today, ads_total: a.total,
      ads_matching: a.counts.get(s.id), share: round(a.counts.get(s.id) / a.total, 6),
    })));
    await store.replaceCooccurrence(today, [...a.cooc].map(([key, n]) => {
      const [skill_id, other_skill_id] = key.split('|');
      return { snapshot_date: today, skill_id, other_skill_id, ads_count: n };
    }));
    results.jobs_combined = { status: 'ok', ads: combined.length, sources: Object.keys(jobsBySource) };
  } else {
    results.jobs_combined = { status: 'skipped', reason: `not enough ads today (${combined.length}); previous snapshot kept` };
  }

  // 3) Eurostat
  await step('eurostat_jvs', async () => {
    const { rows, updated } = await adapters.fetchEurostatJobVacancies({ fetchImpl });
    await store.upsertStatSeries(rows);
    const period = rows.map((r) => r.period).sort().pop();
    return { records: rows.length, period, sourceUpdated: updated ? new Date(updated).toISOString() : null };
  });
  await step('eurostat_lfs', async () => {
    const { rows, updated } = await adapters.fetchEurostatEmploymentByOccupation({ fetchImpl });
    await store.upsertStatSeries(rows);
    const period = rows.map((r) => r.period).sort().pop();
    return { records: rows.length, period, sourceUpdated: updated ? new Date(updated).toISOString() : null };
  });

  // 4) Scores (always recomputed from the newest valid data in the database)
  const scoreSummary = await recomputeScores(store, today);
  results.scores = { status: 'ok', ...scoreSummary };

  // ESCO is a bundled file, not fetched at run time, so it does not decide whether the run succeeded.
  const sourceStatuses = ['remotive', 'arbeitnow', 'eurostat_jvs', 'eurostat_lfs']
    .map((k) => results[k]?.status).filter((s) => s !== 'skipped');
  const okCount = sourceStatuses.filter((s) => s === 'ok').length;
  const status = okCount === sourceStatuses.length ? 'success' : okCount === 0 ? 'failed' : 'partial';
  await store.finishRun(runId, { status, finished_at: new Date().toISOString(), source_results: results });
  return { status, runId, runKey: today, durationMs: Date.now() - startedMs, results };
  } catch (e) {
    const message = String(e?.message || e).slice(0, 500);
    await store.finishRun(runId, { status: 'failed', finished_at: new Date().toISOString(), source_results: results, error: message })
      .catch(() => {});
    throw e;
  }
}

export async function recomputeScores(store, today) {
  const skills = await store.getSkills();
  const historyRows = await store.getDemandHistory('jobs_combined', addDays(today, -120));
  const demandHistory = new Map();
  for (const r of historyRows) {
    if (!demandHistory.has(r.skill_id)) demandHistory.set(r.skill_id, []);
    demandHistory.get(r.skill_id).push({ date: r.snapshot_date, share: Number(r.share), ads_total: r.ads_total, ads_matching: r.ads_matching });
  }
  const demandDate = historyRows.filter((r) => r.ads_total >= MIN_ADS_FOR_DEMAND).map((r) => r.snapshot_date).sort().pop() || null;

  const coocDate = await store.latestCooccurrenceDate();
  const cooccurrence = new Map();
  for (const r of coocDate ? await store.getCooccurrence(coocDate) : []) {
    if (!cooccurrence.has(r.skill_id)) cooccurrence.set(r.skill_id, new Map());
    cooccurrence.get(r.skill_id).set(r.other_skill_id, r.ads_count);
  }

  const so = await store.getSkillOccupations();
  const skillOccupations = new Map();
  const occupationCounts = new Map();
  for (const r of so) {
    if (!skillOccupations.has(r.skill_id)) skillOccupations.set(r.skill_id, []);
    skillOccupations.get(r.skill_id).push(r);
    const c = occupationCounts.get(r.skill_id) || { essential: 0, optional: 0 };
    c[r.relation] += 1;
    occupationCounts.set(r.skill_id, c);
  }

  // Skills without ESCO links fall back to the editorial ISCO mapping (trend/forecast only; breadth stays empty).
  const occupationSource = new Map();
  for (const sk of skills) {
    if (skillOccupations.get(sk.id)?.some((o) => o.isco2)) occupationSource.set(sk.id, 'esco');
    else if (SKILL_ISCO_FALLBACK[sk.id]) {
      skillOccupations.set(sk.id, SKILL_ISCO_FALLBACK[sk.id].map((isco2) => ({ skill_id: sk.id, relation: 'essential', isco2 })));
      occupationSource.set(sk.id, 'editorial');
    }
  }

  const forecastGrowth = forecastByIsco2(await store.getForecasts());
  const employmentTrend = employmentTrendByIsco2(await store.getStatSeries('lfsa_egai2d'));

  const scores = computeScores({ today, demandDate, skills, demandHistory, cooccurrence, skillOccupations, occupationCounts, forecastGrowth, employmentTrend });
  for (const sc of scores) sc.inputs.occupation_source = occupationSource.get(sc.skill_id) || null;
  await store.upsertScores(scores);
  return {
    computed: scores.length,
    withScore: scores.filter((s) => s.score !== null).length,
    demandDate,
    forecastsAvailable: forecastGrowth.size > 0,
  };
}
