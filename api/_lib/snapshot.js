// Builds the public, read-only snapshot shown in the UI (no personal data).

import { JVS_SECTORS } from './sources.js';
import { CAREER_ISCO, CAREER_SKILLS, ISCO2_BG, SKILL_ISCO_FALLBACK, WEF_2025 } from './catalog.js';
import { employmentTrendByIsco2 } from './pipeline.js';
import { METHODOLOGY_VERSION, WEIGHTS } from './scoring.js';
import { addDays, sofiaClock } from './util.js';

export const STALE_AFTER_HOURS = 36;

export async function buildSnapshot(store, now = new Date()) {
  const [sources, runs, skills, scores, jvs, lfs, forecasts, skillOcc] = await Promise.all([
    store.getSources(), store.getRuns(15), store.getSkills(), store.getLatestScores(), store.getStatSeries('jvs_q_nace2'),
    store.getStatSeries('lfsa_egai2d'), store.getForecasts(), store.getSkillOccupations(),
  ]);
  const today = sofiaClock(now).date;
  const history = await store.getDemandHistory('jobs_combined', addDays(today, -120));

  const lastSuccess = runs.find((r) => r.status === 'success' || r.status === 'partial') || null;
  const lastSuccessAt = lastSuccess?.finished_at || null;
  const ageHours = lastSuccessAt ? (now.getTime() - Date.parse(lastSuccessAt)) / 3600000 : null;

  const historyBySkill = new Map();
  for (const r of history) {
    if (!historyBySkill.has(r.skill_id)) historyBySkill.set(r.skill_id, []);
    historyBySkill.get(r.skill_id).push({ date: r.snapshot_date, share: Number(r.share), ads_total: r.ads_total });
  }
  const scoreById = new Map(scores.map((s) => [s.skill_id, s]));

  const series = new Map();
  for (const r of jvs) {
    const key = `${r.series_key}|${r.geo}`;
    if (!series.has(key)) series.set(key, { key: r.series_key, geo: r.geo, label: JVS_SECTORS[r.series_key.split('|')[1]] || r.label, unit: r.unit, points: [] });
    series.get(key).points.push({ period: r.period, value: Number(r.value) });
  }
  for (const s of series.values()) s.points.sort((a, b) => a.period.localeCompare(b.period));

  const occupationGroups = buildOccupationGroups(lfs, forecasts, skillsByIsco2(skills, skillOcc));
  const careers = buildCareers(occupationGroups, scoreById);

  return {
    configured: true,
    generatedAt: now.toISOString(),
    methodology: { version: METHODOLOGY_VERSION, weights: WEIGHTS, doc: 'https://github.com/blackseasquad/Future-Jobs/blob/main/docs/METHODOLOGY.md' },
    freshness: {
      lastSuccessfulRunAt: lastSuccessAt,
      lastRunStatus: runs[0]?.status || null,
      stale: ageHours === null ? true : ageHours > STALE_AFTER_HOURS,
      staleAfterHours: STALE_AFTER_HOURS,
    },
    sources: sources.map((s) => ({
      id: s.id, name: s.name, url: s.url, license: s.license, kind: s.kind, update_frequency: s.update_frequency,
      last_status: s.last_status || (s.kind === 'forecast' || s.kind === 'reference' ? 'manual' : null),
      last_success_at: s.last_success_at, last_attempt_at: s.last_attempt_at, last_error: s.last_error,
      data_period: s.data_period, source_updated_at: s.source_updated_at, records_last_run: s.records_last_run,
    })),
    runs: runs.map((r) => ({
      id: r.id, run_key: r.run_key, trigger: r.trigger, status: r.status, started_at: r.started_at, finished_at: r.finished_at,
      sources: Object.fromEntries(Object.entries(r.source_results || {}).map(([k, v]) => [k, v?.status || null])),
    })),
    skills: skills.map((s) => {
      const sc = scoreById.get(s.id) || null;
      return {
        id: s.id, label_bg: s.label_bg, label_en: s.label_en, categories: s.categories,
        esco: s.esco_uri ? { uri: s.esco_uri, label_bg: s.esco_label_bg, label_en: s.esco_label_en, synonyms: (s.esco_alt_labels || []).slice(0, 6) } : null,
        score: sc ? { value: sc.score, confidence: sc.confidence, coverage: Number(sc.coverage), components: sc.components, inputs: sc.inputs, computed_date: sc.computed_date } : null,
        wef: WEF_2025.bySkill[s.id] || null,
        history: (historyBySkill.get(s.id) || []).sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
    vacancies: { dataset: 'jvs_q_nace2', source: 'Eurostat', series: [...series.values()] },
    wef: { source: WEF_2025.source, url: WEF_2025.url, period: WEF_2025.period },
    occupationGroups,
    careers,
  };
}

/** Eurostat employment trend + latest level and Cedefop forecasts per ISCO-08 2-digit group. */
export function buildOccupationGroups(lfs, forecasts, skillMap = new Map()) {
  const codes = new Set([
    ...Object.values(CAREER_ISCO).flat(), ...forecasts.map((f) => f.isco2),
    ...lfs.map((r) => (/^OC\d\d$/.test(r.series_key) ? r.series_key.slice(2) : null)).filter(Boolean),
  ]);
  const trendEU = employmentTrendByIsco2(lfs, 'EU27_2020');
  const trendBG = employmentTrendByIsco2(lfs, 'BG');
  const latest = (code, geo) => lfs.filter((r) => r.series_key === `OC${code}` && r.geo === geo)
    .sort((a, b) => b.period.localeCompare(a.period))[0] || null;
  const out = {};
  for (const code of [...codes].sort()) {
    const eurostat = {};
    for (const [geo, trend] of [['EU27_2020', trendEU], ['BG', trendBG]]) {
      const t = trend.get(code);
      const l = latest(code, geo);
      if (t || l) {
        eurostat[geo] = {
          cagr_pct: t ? Math.round(t.cagr_pct * 100) / 100 : null, from: t?.from ?? null, to: t?.to ?? null,
          employed_thousands: l ? Number(l.value) : null, period: l?.period ?? null,
        };
      }
    }
    const cedefop = forecasts.filter((f) => f.isco2 === code)
      .map((f) => ({ geo: f.geo, annual_growth_pct: Number(f.annual_growth_pct), period: `${f.start_year}–${f.end_year}`, edition: f.edition }))
      .sort((a, b) => (a.geo === 'EU27_2020' ? -1 : 1) - (b.geo === 'EU27_2020' ? -1 : 1));
    out[code] = { isco2: code, label_bg: ISCO2_BG[Number(code)] || `ISCO ${code}`, eurostat, cedefop, skills: skillMap.get(code) || [] };
  }
  return out;
}

/** Tracked skills per ISCO group: ESCO links when available, otherwise the editorial fallback. */
export function skillsByIsco2(skills, skillOcc) {
  const out = new Map();
  const add = (code, id) => { if (!code) return; if (!out.has(code)) out.set(code, new Set()); out.get(code).add(id); };
  const withEsco = new Set();
  for (const r of skillOcc) if (r.isco2) { add(r.isco2, r.skill_id); withEsco.add(r.skill_id); }
  for (const s of skills) if (!withEsco.has(s.id)) (SKILL_ISCO_FALLBACK[s.id] || []).forEach((c) => add(c, s.id));
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** Real-data view of each catalogue career: related occupation groups + demand for its key skills. */
export function buildCareers(groups, scoreById) {
  const out = {};
  for (const [careerId, codes] of Object.entries(CAREER_ISCO)) {
    const skills = (CAREER_SKILLS[careerId] || []).map((id) => {
      const d = scoreById.get(id)?.inputs?.demand;
      return { id, share: d?.share ?? null, ads_matching: d?.ads_matching ?? null, ads_total: d?.ads_total ?? null, date: d?.date ?? null,
        score: scoreById.get(id)?.score ?? null };
    });
    out[careerId] = { isco2: codes, groups: codes.map((c) => groups[c]).filter(Boolean), skills };
  }
  return out;
}
