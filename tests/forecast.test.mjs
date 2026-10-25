import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKILLS } from '../api/_lib/catalog.js';
import { renderForecastEmail } from '../api/_lib/email.js';
import { buildForecast, profileFromAnswers } from '../api/_lib/forecast.js';
import { runRefresh } from '../api/_lib/pipeline.js';
import { QUESTIONS, validateAnswers } from '../api/_lib/quiz-data.js';
import { createMemoryReports, emailHash, isValidEmail, LIMITS } from '../api/_lib/reports.js';
import { createMemoryStore } from '../api/_lib/store-memory.js';
import { handleForecast, loadForecastInputs } from '../api/forecast.js';

const quiet = { error: () => {} };
const ids = new Set(SKILLS.map((s) => s.id));
const ANSWERS = { interests: ['tech', 'green'], style: 'analyse', known: ['python', 'sql'], stage: 'student', time: 'mid', priority: 'growth', region: 'BG', ai: 'use' };

function jobs(source, n) {
  const texts = ['python machine learning sql aws', 'solar renewable energy project management', 'data analysis power bi sql', 'cybersecurity siem communication skills'];
  return Array.from({ length: n }, (_, i) => ({ source, id: `${source}:${i}`, title: `Job ${i}`, company: `${source}-${i}`, text: texts[i % texts.length] }));
}
const adapters = {
  fetchRemotiveJobs: async () => jobs('remotive', 30),
  fetchArbeitnowJobs: async () => jobs('arbeitnow', 90),
  fetchEurostatJobVacancies: async () => ({ rows: [{ dataset: 'jvs_q_nace2', series_key: 'JVR|B-S', geo: 'BG', period: '2025-Q4', value: 0.8, unit: '%', label: 'x' }], updated: null }),
  fetchEurostatEmploymentByOccupation: async () => ({
    rows: ['21', '25', '31', '24', '22', '74'].flatMap((c, i) => ['EU27_2020', 'BG'].flatMap((geo) => [
      { dataset: 'lfsa_egai2d', series_key: `OC${c}`, geo, period: '2020', value: 1000, unit: 'THS_PER', label: c },
      { dataset: 'lfsa_egai2d', series_key: `OC${c}`, geo, period: '2025', value: 1000 * (1 + 0.04 * (i + 1)), unit: 'THS_PER', label: c },
    ])),
    updated: null,
  }),
};

async function seededStore() {
  const store = createMemoryStore();
  await store.upsertForecasts([{ source_id: 'cedefop', edition: '2026', geo: 'BG', isco2: '25', start_year: 2023, end_year: 2035, annual_growth_pct: 4 }]);
  await runRefresh({ store, now: new Date('2026-10-26T05:00:00Z'), adapters, escoMap: { generatedAt: null, skills: {}, occupations: {} }, log: quiet });
  return store;
}

function mockRes() {
  const res = { statusCode: 200, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

test('answers are validated against the question definitions', () => {
  assert.ok(validateAnswers(ANSWERS, ids).answers);
  assert.match(validateAnswers({ ...ANSWERS, interests: [] }, ids).error, /от 1 до 3/);
  assert.match(validateAnswers({ ...ANSWERS, interests: ['tech', 'green', 'health', 'design'] }, ids).error, /от 1 до 3/);
  assert.ok(validateAnswers({ ...ANSWERS, style: 'nope' }, ids).error);
  assert.deepEqual(validateAnswers({ ...ANSWERS, known: ['python', 'not-a-skill'] }, ids).answers.known, ['python']);
  // every option points only to tracked skills
  for (const q of QUESTIONS) for (const o of q.options || []) for (const s of o.skills || []) assert.ok(ids.has(s), `${q.id}/${o.id}: ${s}`);
});

test('profile reflects the answers', () => {
  const p = profileFromAnswers(ANSWERS);
  assert.equal(p.topCategory, 'ai');
  assert.ok(p.answerSkills.has('data-analysis'));
  assert.ok(p.isco.get('25') >= 1);
});

test('forecast: groups with real data, careers, 3 horizons, known skills excluded', async () => {
  const store = await seededStore();
  const inputs = await loadForecastInputs(store);
  const r = buildForecast({ answers: ANSWERS, snapshot: inputs, now: new Date('2026-10-26T06:00:00Z') });
  assert.ok(r.groups.length >= 1 && r.groups.length <= 3);
  assert.equal(r.groups[0].isco2, '25'); // tech interest + BG forecast
  assert.ok(r.groups[0].eurostat.BG.cagr_pct !== null);
  assert.deepEqual(r.groups[0].cedefop[0], { geo: 'BG', annual_growth_pct: 4, period: '2023–2035', edition: '2026' });
  assert.ok(r.careers.some((c) => c.category === 'ai'));
  assert.deepEqual(Object.keys(r.horizons), ['short', 'medium', 'long']);
  const recommended = Object.values(r.horizons).flatMap((h) => h.items.map((i) => i.skill_id));
  assert.ok(!recommended.includes('python') && !recommended.includes('sql'));
  assert.ok(recommended.length > 0);
  assert.match(r.plan.text, /5 ч\. седмично/);
  assert.equal(r.summary.length, QUESTIONS.length);
});

test('API: create -> open by token -> list for owner; bad input rejected', async () => {
  const store = await seededStore();
  const reports = createMemoryReports();
  const user = { id: 'u1' };
  const deps = { store, reports, getUser: async (req) => (req.headers.authorization ? user : null), send: async () => ({ ok: true }) };

  const bad = mockRes();
  await handleForecast({ method: 'POST', headers: {}, body: { action: 'create', answers: { ...ANSWERS, region: 'Mars' } } }, bad, deps);
  assert.equal(bad.statusCode, 400);

  const created = mockRes();
  await handleForecast({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { action: 'create', answers: ANSWERS } }, created, deps);
  assert.equal(created.statusCode, 200);
  const { token } = created.body;
  assert.match(token, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(reports._reports.get(token).user_id, 'u1');

  const open = mockRes();
  await handleForecast({ method: 'GET', headers: {}, query: { token } }, open, deps);
  assert.equal(open.body.report.version, 'forecast-1');

  const missing = mockRes();
  await handleForecast({ method: 'GET', headers: {}, query: { token: 'A'.repeat(22) } }, missing, deps);
  assert.equal(missing.statusCode, 404);

  const mine = mockRes();
  await handleForecast({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { mine: '1' } }, mine, deps);
  assert.equal(mine.body.reports[0].token, token);
  const anon = mockRes();
  await handleForecast({ method: 'GET', headers: {}, query: { mine: '1' } }, anon, deps);
  assert.equal(anon.statusCode, 401);
});

test('API: e-mail needs consent and a valid address, is rate-limited and never stores the address', async () => {
  const store = await seededStore();
  const reports = createMemoryReports();
  const sent = [];
  const deps = { store, reports, getUser: async () => null, send: async (m) => { sent.push(m); return { ok: true }; } };
  const c = mockRes();
  await handleForecast({ method: 'POST', headers: {}, body: { action: 'create', answers: ANSWERS } }, c, deps);
  const token = c.body.token;
  const email = (extra) => { const r = mockRes(); return handleForecast({ method: 'POST', headers: {}, body: { action: 'email', token, email: 'Ana@Example.com', consent: true, ...extra } }, r, deps).then(() => r); };

  assert.equal((await email({ consent: false })).statusCode, 400);
  assert.equal((await email({ email: 'not-an-email' })).statusCode, 400);
  for (let i = 0; i < LIMITS.perAddressPerDay; i++) assert.equal((await email()).statusCode, 200);
  assert.equal((await email()).statusCode, 429);
  assert.equal(sent.length, LIMITS.perAddressPerDay);
  assert.ok(sent[0].html.includes(`?report=${token}`));
  const logged = JSON.stringify(reports._log);
  assert.ok(!logged.toLowerCase().includes('ana@example.com'));
  assert.equal(reports._log[0].email_hash, emailHash('ana@example.com'));

  const notConfigured = mockRes();
  await handleForecast({ method: 'POST', headers: {}, body: { action: 'email', token, email: 'b@example.com', consent: true } }, notConfigured,
    { ...deps, send: async () => ({ ok: false, notConfigured: true }) });
  assert.equal(notConfigured.statusCode, 503);
});

test('e-mail HTML escapes content and links back to the report', () => {
  const { html, text, subject } = renderForecastEmail({
    created_at: '2026-10-26T06:00:00Z', data_date: '2026-10-26', top_category_label: '<script>x</script>',
    groups: [{ isco2: '25', label_bg: 'ИКТ', eurostat: { EU27_2020: { cagr_pct: 4.2, from: '2020', to: '2025' } }, cedefop: [] }],
    careers: [], horizons: { short: { label: '6–12 месеца', available: false, reason: 'Няма данни', items: [] } },
    plan: { text: 'План', tip: 'Съвет' }, limitations: ['Ограничение'],
  }, 'TOKEN_abcdefghijklmnop');
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('?report=TOKEN_abcdefghijklmnop'));
  assert.match(text, /ИКТ/);
  assert.match(subject, /кариерна прогноза/);
  assert.equal(isValidEmail('a@b.bg'), true);
  assert.equal(isValidEmail('a@b'), false);
});
