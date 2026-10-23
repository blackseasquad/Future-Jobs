// HTTP handler tests (need node_modules: run with `npm test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  return res;
}

const ENV_KEYS = ['CRON_SECRET', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'ADMIN_EMAILS'];
function withEnv(env, fn) {
  return async () => {
    const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    try { await fn(); } finally {
      ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
    }
  };
}

const { default: cron } = await import('../api/cron/daily-refresh.js');
const { default: admin } = await import('../api/admin/refresh.js');
const { default: marketData } = await import('../api/market-data.js');
const { isAuthorizedCron } = await import('../api/_lib/auth.js');

const SECRET = 'test-secret-0123456789abcdef';

test('cron endpoint fails closed when CRON_SECRET is not set', withEnv({}, async () => {
  const res = mockRes();
  await cron({ method: 'GET', headers: { authorization: 'Bearer anything' }, query: {} }, res);
  assert.equal(res.statusCode, 500);
}));

test('cron endpoint rejects missing or wrong secrets', withEnv({ CRON_SECRET: SECRET }, async () => {
  for (const authorization of [undefined, 'Bearer wrong', `Bearer ${SECRET}x`, SECRET]) {
    const res = mockRes();
    await cron({ method: 'GET', headers: { authorization }, query: {} }, res);
    assert.equal(res.statusCode, 401, `accepted ${authorization}`);
  }
}));

test('cron endpoint with a valid secret but no database reports 503 (no secret leakage)', withEnv({ CRON_SECRET: SECRET }, async () => {
  const res = mockRes();
  await cron({ method: 'GET', headers: { authorization: `Bearer ${SECRET}` }, query: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.ok(!JSON.stringify(res.body).includes(SECRET));
}));

test('short secrets are never accepted', () => {
  assert.equal(isAuthorizedCron({ headers: { authorization: 'Bearer short' } }, 'short'), false);
});

test('admin refresh refuses anonymous callers', withEnv({}, async () => {
  const get = mockRes();
  await admin({ method: 'GET', headers: {} }, get);
  assert.deepEqual(get.body, { isAdmin: false });
  const post = mockRes();
  await admin({ method: 'POST', headers: {} }, post);
  assert.equal(post.statusCode, 403);
}));

test('market-data reports "not configured" without a database', withEnv({}, async () => {
  const res = mockRes();
  await marketData({ method: 'GET', headers: {} }, res);
  assert.deepEqual(res.body, { configured: false });
}));
