// TEMPORARY CI helper (removed before merge): screenshots of the new UI with real-data fixtures.
import { chromium } from 'playwright';
const base = process.env.BASE_URL || 'http://localhost:4173';
const fx = process.env.UI_FIXTURES_DIR;
const { readFileSync, mkdirSync } = await import('node:fs');
const market = readFileSync(`${fx}/market-data.json`, 'utf8');
const recs = readFileSync(`${fx}/recommendations.json`, 'utf8');
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const [name, width] of [['desktop', 1366], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.route('**/api/market-data', (r) => r.fulfill({ contentType: 'application/json', body: market }));
  await page.route('**/api/recommendations', (r) => r.fulfill({ contentType: 'application/json', body: recs }));
  await page.route('**/api/admin/refresh', (r) => r.fulfill({ contentType: 'application/json', body: '{"isAdmin":false}' }));
  await page.goto(base);
  await page.evaluate(() => { localStorage.setItem('future_careers_favs', '["prompt-coach","carbon-engineer"]'); localStorage.setItem('future_jobs_quiz_category', 'ai'); });
  await page.reload();
  const nav = async (label) => {
    if (width < 768) { await page.click('.menu-toggle'); await page.click(`.mobile-menu__btn:has-text("${label}")`); }
    else await page.click(`.nav__btn:has-text("${label}")`);
  };
  await nav('Анализи');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${name}-analytics.png`, fullPage: true });
  await nav('Топ Умения');
  await page.waitForTimeout(800);
  await page.click('.chip:has-text("Python програмиране")');
  await page.click('button:has-text("Покажи препоръки")');
  await page.waitForTimeout(1200);
  await page.click('.data-table__row >> nth=0');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/${name}-skills.png`, fullPage: true });
  await page.close();
}
await browser.close();
const { writeFileSync } = await import('node:fs');
writeFileSync('shots/errors.txt', errors.join('\n') || 'no page errors');
console.log(errors.join('\n') || 'no page errors');
