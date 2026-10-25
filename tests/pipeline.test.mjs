// End-to-end tests of the refresh pipeline with an in-memory store and fake source adapters
// (the real sources are exercised by .github/workflows/data-integration.yml).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKILLS } from '../api/_lib/catalog.js';
import { runRefresh } from '../api/_lib/pipeline.js';
import { buildRecommendations } from '../api/_lib/recommend.js';
import { buildSnapshot } from '../api/_lib/snapshot.js';
import { createMemoryStore } from '../api/_lib/store-memory.js';

const quiet = { error: () => {} };

// Fake bundled ESCO map: every skill -> one own occupation (essential) + one shared (optional), ISCO 25.
const FAKE_MAP = {
  generatedAt: '2026-10-20T00:00:00.000Z',
  skills: Object.fromEntries(SKILLS.map((s) => [s.id, {
    uri: `esco:skill:${s.id}`, label_en: s.en, label_bg: null, alt_en: ['python 3 programming'],
    occupations: [{ uri: `esco:occ:${s.id}`, relation: 'essential' }, { uri: 'esco:occ:shared', relation: 'optional' }],
  }])),
  occupations: Object.fromEntries([...SKILLS.map((s) => `esco:occ:${s.id}`), 'esco:occ:shared']
    .map((uri) => [uri, { label_en: 'occ', label_bg: null, isco_code: '2512.4', isco2: '25' }])),
};
const run = (opts) => runRefresh({ escoMap: FAKE_MAP, ...opts });

function fakeJobs(source, n, extra = '') {
  const texts = ['python machine learning sql aws', 'react javascript typescript ux designer', 'solar renewable energy project management',
    'cybersecurity siem communication skills', 'data analysis power bi sql english'];
  return Array.from({ length: n }, (_, i) => ({
    source, id: `${source}:${i}`, title: `Job ${i}`, company: `${source}-co-${i}`, url: 'https://example.org',
    text: `${texts[i % texts.length]} ${extra}`,
  }));
}

function adapters(overrides = {}) {
  return {
    escoFindSkill: async (q) => ({ uri: `esco:skill:${q}`, title: q }),
    escoSkillDetails: async (uri) => ({
      uri, label_en: uri, label_bg: null, alt_en: ['python 3 programming'],
      occupations: [{ uri: `${uri}:occ1`, label_en: 'software developer', relation: 'essential' }, { uri: 'esco:occ:shared', label_en: 'analyst', relation: 'optional' }],
    }),
    escoOccupationDetails: async (uri) => ({ uri, label_en: 'occ', label_bg: null, isco_code: '2512.4', isco2: '25' }),
    fetchRemotiveJobs: async () => fakeJobs('remotive', 60),
    fetchArbeitnowJobs: async () => fakeJobs('arbeitnow', 80),
    fetchEurostatJobVacancies: async () => ({ rows: [
      { dataset: 'jvs_q_nace2', series_key: 'JVR|B-S', geo: 'EU27_2020', period: '2025-Q4', value: 2.1, unit: '%', label: 'x' },
      { dataset: 'jvs_q_nace2', series_key: 'JVR|B-S', geo: 'BG', period: '2025-Q4', value: 0.8, unit: '%', label: 'x' },
    ], updated: '2026-03-20T23:00:00+0100' }),
    fetchEurostatEmploymentByOccupation: async () => ({ rows: [
      { dataset: 'lfsa_egai2d', series_key: 'OC25', geo: 'EU27_2020', period: '2020', value: 7000, unit: 'THS_PER', label: 'ICT' },
      { dataset: 'lfsa_egai2d', series_key: 'OC25', geo: 'EU27_2020', period: '2025', value: 7900, unit: 'THS_PER', label: 'ICT' },
    ], updated: '2026-09-10T23:00:00+0200' }),
    ...overrides,
  };
}

const DAY1 = new Date('2026-10-24T03:30:00Z'); // 06:30 Sofia
const DAY2 = new Date('2026-10-25T04:30:00Z'); // 06:30 Sofia (winter time)

test('full run stores history, scores and run log', async () => {
  const store = createMemoryStore();
  const r = await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  assert.equal(r.status, 'success');
  assert.equal(r.runKey, '2026-10-24');
  const t = store._tables;
  // one snapshot per (source, skill) for remotive, arbeitnow and the combined view
  assert.equal(t.demand.size, SKILLS.length * 3);
  const py = t.demand.get('jobs_combined|python|2026-10-24');
  assert.equal(py.ads_total, 140);
  assert.equal(py.ads_matching, 28);
  assert.equal(t.stats.size, 4);
  assert.equal(t.scores.size, SKILLS.length);
  assert.ok([...t.scores.values()].some((s) => s.score !== null));
  assert.equal(t.runs[0].status, 'success');
  assert.equal(t.data_sources.get('remotive').last_status, 'ok');
  assert.equal(t.occupations.get('esco:occ:shared').isco2, '25');
  assert.equal(t.skill_occupations.size, SKILLS.length * 2);
  assert.equal(t.skills.get('python').esco_uri, 'esco:skill:python');
  // every skill gets a score once ESCO data is present (demand + breadth + trend + connectivity)
  assert.ok([...t.scores.values()].filter((s) => s.score !== null).length >= SKILLS.length * 0.8);
});

test('re-running the same day is skipped, and a forced re-run does not duplicate rows', async () => {
  const store = createMemoryStore();
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const sizes = () => Object.fromEntries(Object.entries(store._tables).map(([k, v]) => [k, v.size ?? v.length]));
  const before = sizes();
  const again = await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  assert.equal(again.status, 'skipped');
  assert.equal(again.reason, 'already_completed_today');
  const forced = await run({ store, now: DAY1, adapters: adapters(), force: true, log: quiet });
  assert.equal(forced.status, 'success');
  const after = sizes();
  for (const k of Object.keys(before)) if (k !== 'runs') assert.equal(after[k], before[k], `table ${k} grew`);
  assert.equal(after.runs, 2); // the skipped call does not create a run
});

test('an unavailable source is logged and its previous data is kept', async () => {
  const store = createMemoryStore();
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const down = async () => { throw new Error('HTTP 503 for remotive.com/api/remote-jobs'); };
  const r = await run({ store, now: DAY2, adapters: adapters({ fetchRemotiveJobs: down }), log: quiet });
  assert.equal(r.status, 'partial');
  assert.equal(r.results.remotive.status, 'error');
  const src = store._tables.data_sources.get('remotive');
  assert.equal(src.last_status, 'error');
  assert.match(src.last_error, /503/);
  assert.ok(src.last_success_at, 'last success timestamp preserved');
  assert.ok(store._tables.demand.has('remotive|python|2026-10-24'), 'yesterday remotive snapshot kept');
  assert.ok(!store._tables.demand.has('remotive|python|2026-10-25'));
  assert.ok(store._tables.demand.has('arbeitnow|python|2026-10-25'));
});

test('if every source fails, the run is "failed" and the last valid data stays usable', async () => {
  const store = createMemoryStore();
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const boom = async () => { throw new Error('network down'); };
  const r = await run({ store, now: DAY2, log: quiet, escoMap: { skills: {} }, adapters: adapters({
    escoFindSkill: boom, escoSkillDetails: boom, escoOccupationDetails: boom, fetchRemotiveJobs: boom, fetchArbeitnowJobs: boom,
    fetchEurostatJobVacancies: boom, fetchEurostatEmploymentByOccupation: boom,
  }) });
  assert.equal(r.status, 'failed');
  assert.equal(r.results.jobs_combined.status, 'skipped');
  // scores are recomputed from the newest VALID snapshot (day 1), not wiped
  assert.equal(r.results.scores.demandDate, '2026-10-24');
  const latest = await store.getLatestScores();
  assert.ok(latest.some((s) => s.score !== null));
  const snap = await buildSnapshot(store, new Date('2026-10-25T05:00:00Z'));
  assert.equal(snap.freshness.lastRunStatus, 'failed');
  assert.ok(snap.freshness.lastSuccessfulRunAt);
});

test('a small source feeds only the combined sample; an empty one is an error', async () => {
  const store = createMemoryStore();
  const r = await run({ store, now: DAY1, log: quiet, adapters: adapters({ fetchRemotiveJobs: async () => fakeJobs('remotive', 5) }) });
  assert.equal(r.results.remotive.status, 'ok');
  assert.match(r.results.remotive.warning, /малка извадка/);
  assert.ok(!store._tables.demand.has('remotive|python|2026-10-24'), 'no per-source statistics from 5 ads');
  assert.equal(store._tables.demand.get('jobs_combined|python|2026-10-24').ads_total, 85);
  const empty = await run({ store, now: DAY2, log: quiet, adapters: adapters({ fetchRemotiveJobs: async () => [] }) });
  assert.equal(empty.results.remotive.status, 'error');
});

test('duplicate ads across boards are counted once', async () => {
  const store = createMemoryStore();
  const same = fakeJobs('x', 60).map((j) => ({ ...j, company: 'Same Co', title: `Same title ${j.id.split(':')[1]}` }));
  await run({ store, now: DAY1, log: quiet, adapters: adapters({
    fetchRemotiveJobs: async () => same.map((j) => ({ ...j, source: 'remotive', id: `remotive:${j.id}` })),
    fetchArbeitnowJobs: async () => same.map((j) => ({ ...j, source: 'arbeitnow', id: `arbeitnow:${j.id}` })),
  }) });
  assert.equal(store._tables.demand.get('jobs_combined|python|2026-10-24').ads_total, 60);
});

test('another run in progress blocks a concurrent start', async () => {
  const store = createMemoryStore();
  await store.startRun({ run_key: '2026-10-24', trigger: 'cron', status: 'running', started_at: new Date().toISOString() });
  const r = await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  assert.equal(r.reason, 'another_run_in_progress');
});

test('recommendations: three horizons, facts with sources, no long-term numbers without forecasts', async () => {
  const store = createMemoryStore();
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const horizons = buildRecommendations({
    skills: await store.getSkills(), scores: await store.getLatestScores(), sources: await store.getSources(),
    profile: { knownSkills: ['python'], favoriteCareerIds: ['prompt-coach'], quizCategory: 'ai' },
  });
  assert.deepEqual(Object.keys(horizons), ['short', 'medium', 'long']);
  assert.equal(horizons.short.available, true);
  const all = [...horizons.short.items, ...horizons.medium.items];
  assert.ok(all.every((i) => i.skill_id !== 'python'), 'known skills are not recommended');
  assert.ok(horizons.short.items[0].facts.every((f) => f.source && f.period));
  assert.ok(horizons.short.items[0].learning.length >= 2);
  assert.equal(horizons.long.available, false);
  assert.match(horizons.long.reason, /Cedefop/);
});

test('recommendations use imported Cedefop forecasts for the 5–10 year horizon', async () => {
  const store = createMemoryStore();
  await store.upsertForecasts([{ source_id: 'cedefop', edition: '2026', geo: 'EU27_2020', isco2: '25', start_year: 2023, end_year: 2035, annual_growth_pct: 1.7 }]);
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const horizons = buildRecommendations({
    skills: await store.getSkills(), scores: await store.getLatestScores(), sources: await store.getSources(), profile: { favoriteCareerIds: ['ai-ethics'] },
  });
  assert.equal(horizons.long.available, true);
  const f = horizons.long.items[0].forecasts.find((x) => x.source.startsWith('Cedefop'));
  assert.equal(f.period, '2023–2035');
});

test('ESCO map is loaded once per version and re-applied when it changes', async () => {
  const store = createMemoryStore();
  const r1 = await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  assert.equal(r1.results.esco.records, SKILLS.length);
  const r2 = await run({ store, now: DAY2, adapters: adapters(), log: quiet });
  assert.equal(r2.results.esco.status, 'ok');
  assert.equal(r2.results.esco.records, 0);
  const newer = structuredClone(FAKE_MAP);
  newer.generatedAt = '2026-11-01T00:00:00.000Z';
  newer.skills.python.occupations = [{ uri: 'esco:occ:shared', relation: 'essential' }];
  await run({ store, now: new Date('2026-11-02T05:00:00Z'), adapters: adapters(), escoMap: newer, log: quiet });
  const py = [...store._tables.skill_occupations.values()].filter((r) => r.skill_id === 'python');
  assert.deepEqual(py, [{ skill_id: 'python', occupation_uri: 'esco:occ:shared', relation: 'essential' }]);
});

test('snapshot exposes real data for catalogue careers', async () => {
  const store = createMemoryStore();
  await store.upsertForecasts([{ source_id: 'cedefop', edition: '2026', geo: 'EU27_2020', isco2: '25', start_year: 2023, end_year: 2035, annual_growth_pct: 1.7 }]);
  await run({ store, now: DAY1, adapters: adapters(), log: quiet });
  const snap = await buildSnapshot(store, new Date('2026-10-24T05:00:00Z'));
  const pc = snap.careers['prompt-coach'];
  assert.deepEqual(pc.isco2, ['25']);
  assert.equal(pc.groups[0].label_bg, 'Специалисти по информационни и комуникационни технологии');
  assert.equal(pc.groups[0].eurostat.EU27_2020.cagr_pct, 2.45);
  assert.equal(pc.groups[0].eurostat.EU27_2020.employed_thousands, 7900);
  assert.deepEqual(pc.groups[0].cedefop, [{ geo: 'EU27_2020', annual_growth_pct: 1.7, period: '2023–2035', edition: '2026' }]);
  assert.ok(pc.skills.find((s) => s.id === 'generative-ai'));
  assert.equal(snap.freshness.lastRunStatus, 'success');
  // groups without data are still listed (with empty facts), never invented
  assert.deepEqual(snap.occupationGroups['22'].cedefop, []);
});

test('without an ESCO map the run still succeeds and uses the editorial ISCO mapping', async () => {
  const store = createMemoryStore();
  // the same kind of data as in production: Cedefop top-10 export for Bulgaria
  await store.upsertForecasts([
    { source_id: 'cedefop', edition: '2026', geo: 'BG', isco2: '25', start_year: 2023, end_year: 2035, annual_growth_pct: 4 },
    { source_id: 'cedefop', edition: '2026', geo: 'BG', isco2: '21', start_year: 2023, end_year: 2035, annual_growth_pct: 0.9 },
  ]);
  const r = await run({ store, now: DAY1, adapters: adapters(), escoMap: { generatedAt: null, skills: {}, occupations: {} }, log: quiet });
  assert.equal(r.status, 'success');
  assert.equal(r.results.esco.status, 'error');
  assert.match(store._tables.data_sources.get('esco').last_error, /редакционна/);
  const py = store._tables.scores.get('python|2026-10-24');
  assert.equal(py.inputs.occupation_source, 'editorial');
  assert.equal(py.inputs.long_term.annual_growth_pct, 4);
  assert.equal(py.inputs.long_term.geo, 'BG');
  assert.ok(py.score !== null, 'python gets a score from demand + trend + forecast + connectivity');
  // human skills are not mapped and stay without a long-term component
  assert.equal(store._tables.scores.get('communication|2026-10-24').inputs.long_term, null);
});
