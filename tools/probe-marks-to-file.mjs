// probe-marks-to-file — load /game, wait for the world transitions, write the
// [RC-PERF] world marks to a file (avoids job-stream buffering).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen', 'marks-' + Date.now() + '.txt');
const BASE = process.env.RC_CAPTURE_BASE || 'http://localhost:8090';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.route('**/ruffle/ruffle.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body + '\n;window.RufflePlayer.config.renderer = "canvas";';
    await route.fulfill({ response, body: patched, headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(patched)) } });
  });
  const marks = [];
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[RC-PERF]')) marks.push(t);
  });
  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  await page.locator('.stage').waitFor({ state: 'visible', timeout: 20000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    await page.waitForTimeout(2000);
    const restaurant = marks.some((m) => m.includes('WorldRestaurantPlay.showNotify begin'));
    if (restaurant && Date.now() - t0 > 30000) break;
  }
  fs.writeFileSync(OUT, marks.join('\n'));
  console.log('wrote ' + OUT + ' (' + marks.length + ' marks)');
} finally {
  await browser.close();
}
