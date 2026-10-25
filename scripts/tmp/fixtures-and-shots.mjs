// TEMPORARY verification helper (removed before merge).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildSnapshot } from '../../api/_lib/snapshot.js';
import { buildRecommendations } from '../../api/_lib/recommend.js';
import { createSupabaseStore } from '../../api/_lib/store.js';
import { handleForecast } from '../../api/forecast.js';
import { createSupabaseReports } from '../../api/_lib/reports.js';

const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const store = createSupabaseStore(service);
const snap = await buildSnapshot(store);
const fDeps = { store, reports: createSupabaseReports(service), getUser: async () => null, send: async () => ({ ok: true }) };
mkdirSync('shots', { recursive: true });

const { chromium } = await import('playwright');
const market = JSON.stringify(snap);
const browser = await chromium.launch();
const errors = [];
const apiRoutes = async (page) => {
  await page.route('**/api/market-data', (r) => r.fulfill({ contentType: 'application/json', body: market }));
  await page.route('**/api/admin/refresh', (r) => r.fulfill({ contentType: 'application/json', body: '{"isAdmin":false}' }));
  await page.route('**/api/recommendations', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const horizons = buildRecommendations({ skills: await store.getSkills(), scores: await store.getLatestScores(), sources: await store.getSources(), profile: body });
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ configured: true, ready: true, computedDate: snap.skills[0]?.score?.computed_date, horizons, ai: null }) });
  });
  await page.route('**/api/forecast**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await handleForecast({ method: req.method(), headers: {}, query: Object.fromEntries(url.searchParams), body: req.postData() ? JSON.parse(req.postData()) : {} }, res, fDeps);
    r.fulfill({ status: res.statusCode, contentType: 'application/json', body: JSON.stringify(res.body) });
  });
};
for (const [name, width] of [['desktop', 1366], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await apiRoutes(page);
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${name}-catalog.png`, fullPage: true });
  const nav = async (label) => {
    if (width < 768) { await page.click('.menu-toggle'); await page.click(`.mobile-menu__btn:has-text("${label}")`); }
    else await page.click(`.nav__btn:has-text("${label}")`);
  };
  // career forecast quiz
  await nav('Кариерна прогноза');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${name}-quiz-intro.png` });
  await page.click('button:has-text("Започни теста")');
  await page.click('.quiz__tile >> nth=0'); await page.click('.quiz__tile >> nth=1');
  await page.screenshot({ path: `shots/${name}-quiz-q1.png` });
  await page.click('button:has-text("Напред")');
  await page.click('.quiz__option >> nth=0');                       // style
  await page.click('.chip:has-text("Python програмиране")');          // known skills
  await page.screenshot({ path: `shots/${name}-quiz-skills.png`, fullPage: true });
  await page.click('button:has-text("Напред")');
  for (const n of [1, 1, 1, 0, 0]) await page.click(`.quiz__option >> nth=${n}`); // stage, time, priority, region, ai
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `shots/${name}-forecast.png`, fullPage: true });
  // reload: saved forecast shown without retaking
  await page.reload(); await page.waitForTimeout(1200);
  await nav('Кариерна прогноза'); await page.waitForTimeout(800);
  const savedShown = await page.isVisible('text=Вашата запазена прогноза');
  errors.push(`${name}: saved forecast shown after reload = ${savedShown}`);
  // simulator
  await nav('Един ден през 2035');
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) await page.click('.timeline__item--active .quiz__option >> nth=1');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/${name}-sim-day.png`, fullPage: true });
  await page.click('button:has-text("Виж пътя към тази професия")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${name}-sim-path.png`, fullPage: true });
  await page.close();
}
await browser.close();
writeFileSync('shots/errors.txt', errors.join('\n') || 'no page errors');
