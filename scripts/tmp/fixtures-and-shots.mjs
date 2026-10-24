// TEMPORARY verification helper (removed before merge).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildSnapshot } from '../../api/_lib/snapshot.js';
import { buildRecommendations } from '../../api/_lib/recommend.js';
import { createSupabaseStore } from '../../api/_lib/store.js';

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const store = createSupabaseStore(anon);
const snap = await buildSnapshot(store);
const recs = buildRecommendations({ skills: await store.getSkills(), scores: await store.getLatestScores(), sources: await store.getSources(),
  profile: { knownSkills: ['python'], favoriteCareerIds: ['prompt-coach', 'carbon-engineer'], quizCategory: 'ai' } });
mkdirSync('shots', { recursive: true });
writeFileSync('shots/summary.json', JSON.stringify({
  freshness: snap.freshness,
  sources: snap.sources.map((s) => [s.id, s.last_status, s.last_error]),
  skillsWithScore: snap.skills.filter((s) => s.score?.value != null).map((s) => [s.id, s.score.value, s.score.confidence, s.score.inputs.long_term?.annual_growth_pct ?? null]),
  skillsWithoutScore: snap.skills.filter((s) => s.score?.value == null).map((s) => s.id),
  careers: Object.fromEntries(Object.entries(snap.careers).map(([k, c]) => [k, c.groups.map((g) => ({ isco2: g.isco2, eu: g.eurostat.EU27_2020, bg: g.eurostat.BG, cedefop: g.cedefop }))])),
  horizons: Object.fromEntries(Object.entries(recs).map(([k, h]) => [k, { available: h.available, items: h.items.map((i) => [i.skill_id, i.model.horizon_score]) }])),
}, null, 1));

const { chromium } = await import('playwright');
const market = JSON.stringify(snap);
const recBody = JSON.stringify({ configured: true, ready: true, computedDate: (await store.getLatestScores())[0]?.computed_date, horizons: recs, ai: null });
const browser = await chromium.launch();
const errors = [];
for (const [name, width] of [['desktop', 1366], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.route('**/api/market-data', (r) => r.fulfill({ contentType: 'application/json', body: market }));
  await page.route('**/api/recommendations', (r) => r.fulfill({ contentType: 'application/json', body: recBody }));
  await page.route('**/api/admin/refresh', (r) => r.fulfill({ contentType: 'application/json', body: '{"isAdmin":false}' }));
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${name}-catalog.png`, fullPage: true });
  await page.click('.card .btn--ghost >> nth=1');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${name}-career-modal.png`, fullPage: false });
  await page.keyboard.press('Escape');
  await page.click('.modal__close').catch(() => {});
  const nav = async (label) => {
    if (width < 768) { await page.click('.menu-toggle'); await page.click(`.mobile-menu__btn:has-text("${label}")`); }
    else await page.click(`.nav__btn:has-text("${label}")`);
  };
  await nav('Анализи');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${name}-analytics.png`, fullPage: true });
  await nav('Топ Умения');
  await page.waitForTimeout(800);
  await page.click('button:has-text("Покажи препоръки")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/${name}-skills.png`, fullPage: true });
  await page.close();
}
await browser.close();
writeFileSync('shots/errors.txt', errors.join('\n') || 'no page errors');
