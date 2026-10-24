import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateExplanation } from '../api/_lib/ai.js';
import { parseCedefopCsv } from '../api/_lib/cedefop.js';
import { computeScores, demandChange, horizonScore } from '../api/_lib/scoring.js';
import { buildMatcher, decodeJsonStat, isDueInSofia, jobDedupKey, normalizeText, percentileRanks, sofiaClock } from '../api/_lib/util.js';

test('Sofia clock handles summer and winter time', () => {
  // EEST (UTC+3): 03:30 UTC = 06:30 Sofia
  assert.deepEqual(sofiaClock(new Date('2026-07-01T03:30:00Z')), { date: '2026-07-01', hour: 6 });
  assert.equal(isDueInSofia(new Date('2026-07-01T03:30:00Z')), true);
  // EET (UTC+2) after 25 Oct 2026: 03:30 UTC = 05:30 Sofia (skip), 04:10 UTC = 06:10 (run)
  assert.equal(isDueInSofia(new Date('2026-12-01T03:30:00Z')), false);
  assert.equal(isDueInSofia(new Date('2026-12-01T04:10:00Z')), true);
  // Calendar day follows Sofia, not UTC
  assert.equal(sofiaClock(new Date('2026-12-31T22:30:00Z')).date, '2027-01-01');
});

test('skill matcher uses whole words and handles symbols', () => {
  const java = buildMatcher(['java']);
  assert.equal(java('senior java developer'), true);
  assert.equal(java('javascript developer'), false);
  assert.equal(buildMatcher(['ux'])('luxury hotel'), false);
  assert.equal(buildMatcher(['ux'])('ux designer'), true);
  assert.equal(buildMatcher(['c#'])('we use c# and .net'), true);
  assert.equal(buildMatcher(['ci/cd'])('build ci/cd pipelines'), true);
  assert.equal(buildMatcher(['.net'])('c# .net core'), true);
  assert.equal(buildMatcher([])('anything'), false);
});

test('normalizeText strips html', () => {
  assert.equal(normalizeText('<p>Python &amp; <b>SQL</b></p>'), 'python & sql');
});

test('job de-duplication key ignores case, punctuation and (m/f/d)', () => {
  assert.equal(jobDedupKey({ company: 'ACME GmbH', title: 'Data Engineer (m/f/d)' }), jobDedupKey({ company: 'acme gmbh', title: 'data engineer' }));
});

test('JSON-stat decoding maps flat indexes to dimension codes', () => {
  const json = {
    id: ['geo', 'time'], size: [2, 2], updated: '2026-03-20T23:00:00+0100',
    dimension: {
      geo: { category: { index: { EU27_2020: 0, BG: 1 }, label: { EU27_2020: 'EU', BG: 'Bulgaria' } } },
      time: { category: { index: { '2025-Q3': 0, '2025-Q4': 1 } } },
    },
    value: { 0: 2.1, 1: 2.0, 3: 0.9 },
  };
  const { rows, updated } = decodeJsonStat(json);
  assert.equal(updated, '2026-03-20T23:00:00+0100');
  assert.deepEqual(rows, [
    { geo: 'EU27_2020', time: '2025-Q3', value: 2.1 },
    { geo: 'EU27_2020', time: '2025-Q4', value: 2.0 },
    { geo: 'BG', time: '2025-Q4', value: 0.9 },
  ]);
  assert.throws(() => decodeJsonStat({}), /Invalid JSON-stat/);
});

test('percentile ranks are 0–100 and share ties', () => {
  const r = percentileRanks([{ key: 'a', value: 1 }, { key: 'b', value: 3 }, { key: 'c', value: 3 }, { key: 'd', value: null }]);
  assert.equal(r.get('a'), 0);
  assert.equal(r.get('b'), 75);
  assert.equal(r.get('c'), 75);
  assert.equal(r.has('d'), false);
});

test('demand change needs a baseline and enough observations', () => {
  const hist = [];
  for (let d = 0; d <= 30; d += 5) hist.push({ date: `2026-10-${String(1 + d).padStart(2, '0')}`, share: 0.1 + d / 1000, ads_total: 500 });
  const ch = demandChange(hist, '2026-10-31', 30);
  assert.ok(ch);
  assert.equal(ch.from, '2026-10-01');
  assert.equal(ch.relative, 0.3);
  assert.equal(demandChange(hist.slice(-2), '2026-10-31', 30), null);
  assert.equal(demandChange(hist, '2026-10-31', 90), null);
});

function scoringInput(overrides = {}) {
  const skills = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const today = '2026-10-23';
  const demandHistory = new Map([
    ['a', [{ date: today, share: 0.2, ads_total: 500, ads_matching: 100 }]],
    ['b', [{ date: today, share: 0.05, ads_total: 500, ads_matching: 25 }]],
  ]);
  return {
    today, skills, demandHistory,
    cooccurrence: new Map([['a', new Map([['b', 20]])], ['b', new Map([['a', 20]])]]),
    skillOccupations: new Map([['a', [{ isco2: '25', relation: 'essential' }]], ['b', [{ isco2: '21', relation: 'essential' }]]]),
    occupationCounts: new Map([['a', { essential: 10, optional: 5 }], ['b', { essential: 2, optional: 1 }], ['c', { essential: 1, optional: 0 }]]),
    forecastGrowth: new Map(),
    employmentTrend: new Map([['25', { cagr_pct: 4, from: '2020', to: '2025', geo: 'EU27_2020' }], ['21', { cagr_pct: 1, from: '2020', to: '2025', geo: 'EU27_2020' }]]),
    ...overrides,
  };
}

test('score renormalises missing components and refuses thin data', () => {
  const scores = computeScores(scoringInput());
  const a = scores.find((s) => s.skill_id === 'a');
  const c = scores.find((s) => s.skill_id === 'c');
  // a: demand, occupationTrend, breadth, connectivity available (0.25+0.10+0.15+0.10 = 0.60)
  // ranks: demand 100, occupationTrend 100, breadth 100, connectivity 0 (b co-occurs more per ad)
  assert.equal(a.coverage, 0.6);
  assert.equal(a.score, Math.round((0.25 * 100 + 0.10 * 100 + 0.15 * 100 + 0.10 * 0) / 0.6));
  assert.equal(a.components.longTerm.percentile, null);
  assert.equal(a.methodology, 'fss-1.0');
  // c: only breadth (0.15) -> below 0.5 coverage -> no score
  assert.equal(c.score, null);
  assert.equal(c.confidence, 'insufficient');
  // with forecasts, coverage grows and the long-term component is filled
  const withForecast = computeScores(scoringInput({ forecastGrowth: new Map([['25', { annual_growth_pct: 1.5, start_year: 2023, end_year: 2035, edition: '2026', geo: 'EU27_2020' }]]) }));
  assert.equal(withForecast.find((s) => s.skill_id === 'a').inputs.long_term.period, '2023–2035');
});

test('horizon scores require their key component', () => {
  const [a] = computeScores(scoringInput());
  assert.ok(horizonScore(a, 'short') !== null);
  assert.equal(horizonScore(a, 'long'), null); // no forecasts imported
});

test('AI explanations containing numbers are rejected', () => {
  assert.equal(validateExplanation('Умението е търсено и полезно.'), 'Умението е търсено и полезно.');
  assert.equal(validateExplanation('Търсенето е нараснало с 40%.'), null);
  assert.equal(validateExplanation('3D моделирането е полезно.', ['3D']), '3D моделирането е полезно.');
  assert.equal(validateExplanation(''), null);
});

test('Cedefop CSV parser accepts template and label-based exports', () => {
  const template = 'geo,isco2,occupation,start_year,end_year,annual_growth_pct\nEU27_2020,25,ICT professionals,2023,2035,1.8\nBG,21,,2023,2035,"0,6"\n';
  const a = parseCedefopCsv(template);
  assert.equal(a.errors.length, 0);
  assert.deepEqual(a.rows[1], { geo: 'BG', isco2: '21', occupation_label: 'Science and engineering professionals', start_year: 2023, end_year: 2035, annual_growth_pct: 0.6 });

  const exportLike = 'Occupation;Employment growth (%)\nInformation and communications technology professionals;1.9\nUnknown job;2\n';
  const b = parseCedefopCsv(exportLike, { geo: 'EU-27', start_year: 2023, end_year: 2035 });
  assert.equal(b.rows.length, 1);
  assert.equal(b.rows[0].isco2, '25');
  assert.equal(b.rows[0].geo, 'EU27_2020');
  assert.equal(b.errors.length, 1);

  assert.ok(parseCedefopCsv('a,b\n1,2').errors.length > 0);
});
