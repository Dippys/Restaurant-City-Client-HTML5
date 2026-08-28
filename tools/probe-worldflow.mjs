// probe-worldflow — load /game and print the accumulated [RC-PERF] world
// marks every 10s, so we can see the actual street -> restaurant flow.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
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
    if (t.includes('[RC-PERF]') || t.includes('WorldStreet') || t.includes('WorldRestaurantPlay') || t.includes('Tutorial')) marks.push(t.slice(0, 150));
  });
  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  await page.locator('.stage').waitFor({ state: 'visible', timeout: 20000 });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(10000);
    console.log(`--- t=${(i + 1) * 10}s (${marks.length} marks) ---`);
    console.log(marks.slice(-8).join('\n'));
  }
} finally {
  await browser.close();
}
