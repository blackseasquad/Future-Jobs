#!/usr/bin/env node
// Real-data integration check against a (local or staging) Supabase database — NEVER production.
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY. Writes a JSON report.
//
//  1. full refresh with the real sources (ESCO, Eurostat, Remotive, Arbeitnow)
//  2. forced re-run on the same day -> no duplicated rows
//  3. re-run with one source unreachable -> run is "partial", previous data kept
//  4. public (anon) read of the snapshot + recommendations; anon writes are rejected by RLS
//  5. the cron HTTP handler: auth rejected / accepted

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { runRefresh } from '../api/_lib/pipeline.js';
import { buildRecommendations } from '../api/_lib/recommend.js';
import { buildSnapshot } from '../api/_lib/snapshot.js';
import { createSupabaseStore } from '../api/_lib/store.js';

const url = process.env.SUPABASE_URL;
if (!url || /supabase\.co/.test(url) && !process.env.ALLOW_REMOTE) {
  console.error('Refusing to run: SUPABASE_URL must point to a local/staging database (set ALLOW_REMOTE=1 for staging).');
  process.exit(1);
}
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const store = createSupabaseStore(service);
const report = { startedAt: new Date().toISOString(), checks: [] };
const check = (name, ok, details) => {
  report.checks.push({ name, ok: Boolean(ok), details });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, details ?? '');
  // GitHub Actions annotation, visible in the run summary without opening the logs
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error title=${name}::${JSON.stringify(details ?? null).slice(0, 900).replace(/[\r\n%]/g, ' ')}`);
};
process.on('unhandledRejection', (e) => { if (process.env.GITHUB_ACTIONS) console.log(`::error title=crash::${String(e?.stack || e).slice(0, 900).replace(/[\r\n%]/g, ' ')}`); process.exit(1); });

// Cache real HTTP responses so re-runs use identical data (and Remotive is called once, per its terms).
const cache = new Map();
const cachedFetch = async (u, init) => {
  if (!cache.has(u)) {
    const r = await fetch(u, init);
    cache.set(u, { status: r.status, ok: r.ok, body: await r.text() });
  }
  const c = cache.get(u);
  return { ok: c.ok, status: c.status, json: async () => JSON.parse(c.body), text: async () => c.body };
};

const TABLES = ['data_sources', 'skills', 'occupations', 'skill_occupations', 'skill_demand_snapshots', 'skill_cooccurrence', 'stat_series', 'skill_scores', 'refresh_runs'];
async function counts() {
  const out = {};
  for (const t of TABLES) {
    const { count, error } = await service.from(t).select('*', { count: 'exact', head: true });
    out[t] = error ? `error: ${error.message}` : count;
  }
  return out;
}

const now = new Date();

// 1) real run
const run1 = await runRefresh({ store, now, trigger: 'test', force: true, fetchImpl: cachedFetch });
report.run1 = run1;
const c1 = await counts();
report.countsAfterRun1 = c1;
for (const src of ['eurostat_jvs', 'eurostat_lfs', 'remotive', 'arbeitnow']) {
  check(`real source works: ${src}`, run1.results[src]?.status === 'ok', run1.results[src]);
}
check('demand history stored', c1.skill_demand_snapshots > 0, c1.skill_demand_snapshots);
check('Eurostat series stored', c1.stat_series > 0, c1.stat_series);
check('scores computed', run1.results.scores?.computed > 0, run1.results.scores);

const { data: sampleDemand } = await service.from('skill_demand_snapshots').select('skill_id, ads_matching, ads_total, share')
  .eq('source_id', 'jobs_combined').order('ads_matching', { ascending: false }).limit(10);
report.topDemand = sampleDemand;
const { data: jvs } = await service.from('stat_series').select('series_key, geo, period, value').eq('dataset', 'jvs_q_nace2')
  .eq('series_key', 'JVR|B-S').order('period', { ascending: false }).limit(6);
report.jvsSample = jvs;
const { data: occ } = await service.from('occupations').select('uri, label_en, isco_code, isco2').not('isco2', 'is', null).limit(5);
report.occupationSample = occ;
const { data: pyScore } = await service.from('skill_scores').select('inputs').eq('skill_id', 'python').order('computed_date', { ascending: false }).limit(1);
const occSource = pyScore?.[0]?.inputs?.occupation_source;
check('skills linked to occupation groups (bundled ESCO map or editorial fallback)',
  run1.results.esco?.status === 'ok' ? (occ || []).length > 0 && occSource === 'esco' : occSource === 'editorial',
  { esco: run1.results.esco, occupation_source: occSource });
const snapForCareers = await buildSnapshot(createSupabaseStore(service));
check('catalogue careers carry real Eurostat data', Object.values(snapForCareers.careers).every((c) => c.groups.some((g) => g.eurostat.EU27_2020?.cagr_pct != null)),
  Object.fromEntries(Object.entries(snapForCareers.careers).map(([k, c]) => [k, c.groups.map((g) => `${g.isco2}:${g.eurostat.EU27_2020?.cagr_pct}`)])));

// 2) idempotent re-run
const run2 = await runRefresh({ store, now, trigger: 'test', force: true, fetchImpl: cachedFetch });
const c2 = await counts();
report.countsAfterRun2 = c2;
const grew = TABLES.filter((t) => t !== 'refresh_runs' && t !== 'occupations' && c2[t] !== c1[t]);
check('re-run does not duplicate rows', grew.length === 0 && run2.status !== 'failed', { grew, c1, c2 });

// 3) unreachable sources (the main job board and Eurostat JVS)
const brokenFetch = async (u, init) => {
  if (String(u).includes('arbeitnow.com')) throw new TypeError('fetch failed: getaddrinfo ENOTFOUND www.arbeitnow.com');
  if (String(u).includes('jvs_q_nace2')) throw new TypeError('fetch failed: connect ETIMEDOUT ec.europa.eu');
  return cachedFetch(u, init);
};
const run3 = await runRefresh({ store, now, trigger: 'test', force: true, fetchImpl: brokenFetch });
const { data: arb } = await service.from('data_sources').select('last_status, last_error, last_success_at').eq('id', 'arbeitnow').single();
const c3 = await counts();
check('unreachable sources -> partial run, errors logged, previous data kept',
  run3.status === 'partial' && arb.last_status === 'error' && Boolean(arb.last_success_at)
  && c3.skill_demand_snapshots === c2.skill_demand_snapshots && c3.stat_series === c2.stat_series && c3.skill_scores === c2.skill_scores,
  { status: run3.status, arb, jobs_combined: run3.results.jobs_combined, demandRows: c3.skill_demand_snapshots, statRows: c3.stat_series });

// 4) public read + RLS
const anonStore = createSupabaseStore(anon);
const snap = await buildSnapshot(anonStore);
check('anon can read snapshot', snap.skills.length > 0 && snap.sources.length > 0, { skills: snap.skills.length, stale: snap.freshness.stale });
const { error: writeErr } = await anon.from('skills').insert({ id: 'hack', label_bg: 'x', label_en: 'x' });
check('anon cannot write (RLS)', Boolean(writeErr), writeErr?.message);
const { data: tampered, error: runErr } = await anon.from('refresh_runs').update({ error: 'tampered' }).neq('id', 0).select();
const { count: tamperedCount } = await service.from('refresh_runs').select('*', { count: 'exact', head: true }).eq('error', 'tampered');
check('anon cannot modify run log (RLS)', (runErr || (tampered || []).length === 0) && tamperedCount === 0, { runErr: runErr?.message, tamperedCount });
const recs = buildRecommendations({ skills: await anonStore.getSkills(), scores: await anonStore.getLatestScores(), sources: await anonStore.getSources(),
  profile: { knownSkills: ['python'], favoriteCareerIds: ['prompt-coach'], quizCategory: 'ai' } });
report.recommendations = Object.fromEntries(Object.entries(recs).map(([k, h]) => [k, { available: h.available, reason: h.reason,
  items: h.items.map((i) => ({ skill: i.skill_id, model: i.model, facts: i.facts.map((f) => f.text), next: i.next_skills.map((n) => n.id) })) }]));
check('recommendations built from real data', recs.short.available, report.recommendations.short);

// 4b) career forecast with the real data: create, store, reopen by token, e-mail (send mocked), anon cannot read reports
const { handleForecast } = await import('../api/forecast.js');
const { createSupabaseReports } = await import('../api/_lib/reports.js');
const fReports = createSupabaseReports(service);
const mkRes = () => { const r = { statusCode: 200 }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => {}; return r; };
const fDeps = { store, reports: fReports, getUser: async () => null, send: async () => ({ ok: true, id: 'mock' }) };
const fAnswers = { interests: ['tech', 'green'], style: 'analyse', known: ['python'], stage: 'student', time: 'mid', priority: 'growth', region: 'BG', ai: 'use' };
const fc = mkRes();
await handleForecast({ method: 'POST', headers: {}, body: { action: 'create', answers: fAnswers } }, fc, fDeps);
report.forecast = fc.body?.report ? { groups: fc.body.report.groups.map((g) => [g.isco2, g.label_bg, g.fit, g.data_percentile]),
  careers: fc.body.report.careers.map((c) => c.id), horizons: Object.fromEntries(Object.entries(fc.body.report.horizons).map(([k, h]) => [k, h.items.map((i) => i.skill_id)])),
  plan: fc.body.report.plan.text } : fc.body;
check('forecast built from real data and saved', fc.statusCode === 200 && fc.body.report.groups.length > 0 && fc.body.report.horizons.short.available, report.forecast);
const fo = mkRes();
await handleForecast({ method: 'GET', headers: {}, query: { token: fc.body?.token } }, fo, fDeps);
check('forecast reopened by token', fo.statusCode === 200 && fo.body.report.created_at === fc.body?.report?.created_at);
const fe = mkRes();
await handleForecast({ method: 'POST', headers: {}, body: { action: 'email', token: fc.body?.token, email: 'test@example.com', consent: true } }, fe, fDeps);
const { data: logRows } = await service.from('email_log').select('email_hash, status');
check('e-mail logged by hash only', fe.statusCode === 200 && logRows?.length === 1 && !JSON.stringify(logRows).includes('example.com'), logRows);
const { data: anonReports } = await anon.from('quiz_reports').select('token');
check('anon cannot read saved reports (RLS)', (anonReports || []).length === 0, anonReports?.length);

// 5) cron handler auth (real DB)
process.env.CRON_SECRET = 'integration-secret-0123456789';
const { default: cron } = await import('../api/cron/daily-refresh.js');
const mk = () => { const r = { statusCode: 200 }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => {}; return r; };
const bad = mk();
await cron({ method: 'GET', headers: { authorization: 'Bearer nope' }, query: {} }, bad);
check('cron handler rejects wrong secret', bad.statusCode === 401);
const good = mk();
await cron({ method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, good);
check('cron handler accepts the secret (runs or skips by Sofia time / once-per-day guard)', good.statusCode === 200 || good.statusCode === 502, good.body?.status || good.body);
report.cronResponse = { status: good.statusCode, body: { status: good.body?.status, reason: good.body?.reason, sofia: good.body?.sofia, durationMs: good.body?.durationMs } };
report.finishedAt = new Date().toISOString();
report.ok = report.checks.every((c) => c.ok);
writeFileSync(process.env.REPORT_PATH || 'integration-report.json', JSON.stringify(report, null, 2));
console.log(report.ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
process.exit(report.ok ? 0 : 1);
