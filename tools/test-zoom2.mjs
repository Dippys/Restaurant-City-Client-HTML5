// test-zoom2 — boot to the restaurant (deterministic build), drag the zoom
// lever on the right edge, then compare the rendered room scale before/after
// via two small clip screenshots of the same region. Prints marks to a file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen');
const BASE = process.env.RC_CAPTURE_BASE || 'http://localhost:8090';
fs.mkdirSync(OUT, { recursive: true });
const marks = [];
const log = (m) => { marks.push(m); };

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
  page.on('console', (m) => { const t = m.text(); if (t.includes('[RC-PERF]')) log(t); });

  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  let inRest = false;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(3000);
    if (marks.some((m) => m.includes('WorldRestaurantPlay.showNotify begin'))) { inRest = true; break; }
  }
  log('inRestaurant: ' + inRest);
  await page.waitForTimeout(15000);
  const box = await stage.boundingBox();

  const clipShot = async (name, fx0, fy0, fx1, fy1) => {
    await stage.screenshot({
      path: path.join(OUT, name),
      clip: { x: Math.round(box.width * fx0), y: Math.round(box.height * fy0), width: Math.round(box.width * (fx1 - fx0)), height: Math.round(box.height * (fy1 - fy0)) },
    });
  };
  // Clip of the room's floor area (below the top HUD, above the bottom bar).
  await clipShot('zoom2-before.png', 0.2, 0.35, 0.8, 0.75);
  log('captured before');

  const sx = Math.round(box.width * 0.985);
  const sy = Math.round(box.height * 0.93);
  const ey = Math.round(box.height * 0.60);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, ey, { steps: 12 });
  await page.mouse.up();
  log(`dragged (${sx},${sy}) -> (${sx},${ey})`);
  await page.waitForTimeout(8000);
  await clipShot('zoom2-after.png', 0.2, 0.35, 0.8, 0.75);
  log('captured after');

  fs.writeFileSync(path.join(OUT, 'zoom2-marks.txt'), marks.join('\n'));
  console.log('wrote zoom2-marks.txt');
} finally {
  await browser.close();
}
