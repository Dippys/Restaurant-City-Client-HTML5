// find-street-button — boot to the restaurant (deterministic build), scan a
// grid along the bottom HUD for the "My Street" button (its click returns to
// the street: a second WorldStreet.showNotify mark appears). Logs to a file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen');
const BASE = process.env.RC_CAPTURE_BASE || 'http://localhost:8090';
const OUTTXT = path.join(OUT, 'street-button-scan.txt');
const lines = [];
const log = (m) => { lines.push(m); fs.appendFileSync(OUTTXT, m + '\n'); };
fs.writeFileSync(OUTTXT, '--- scan ' + new Date().toISOString() + ' ---\n');

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
  page.on('console', (m) => { const t = m.text(); if (t.includes('[RC-PERF]')) marks.push(t); });
  const streetCount = () => marks.filter((m) => m.includes('WorldStreet.showNotify begin')).length;

  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    if (marks.some((m) => m.includes('WorldRestaurantPlay.showNotify begin'))) break;
  }
  await page.waitForTimeout(12000);
  const box = await stage.boundingBox();
  log('stage box: ' + Math.round(box.width) + 'x' + Math.round(box.height));
  log('street marks before scan: ' + streetCount());

  // Scan rows near the bottom HUD bar.
  const rows = [0.915, 0.94, 0.965];
  let found = false;
  for (const fy of rows) {
    if (found) break;
    for (let fx = 0.03; fx <= 0.97 && !found; fx += 0.05) {
      const x = Math.round(box.width * fx);
      const y = Math.round(box.height * fy);
      await stage.click({ position: { x, y } });
      await page.waitForTimeout(2200);
      if (streetCount() > 1) {
        log(`STREET BUTTON at (${fx.toFixed(2)}, ${fy.toFixed(2)}) -> (${x},${y})`);
        found = true;
        break;
      }
    }
    log(`row ${fy} done`);
  }

  if (found) {
    await page.waitForTimeout(10000);
    await stage.screenshot({ path: path.join(OUT, 'postintro-street.png') });
    log('captured postintro-street.png');
  } else {
    log('STREET BUTTON NOT FOUND');
    await stage.screenshot({ path: path.join(OUT, 'postintro-scan-fail.png') });
  }
  log('total street marks: ' + streetCount());
} finally {
  await browser.close();
}
