// test-zoom — boot to the restaurant (deterministic build), drag the zoom
// lever on the right edge, and screenshot before/after to verify mouse input
// maps correctly in the 1067x600 stage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen');
const BASE = process.env.RC_CAPTURE_BASE || 'http://localhost:8090';
fs.mkdirSync(OUT, { recursive: true });

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

  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    if (marks.some((m) => m.includes('WorldRestaurantPlay.showNotify begin'))) break;
  }
  await page.waitForTimeout(18000);
  const box = await stage.boundingBox();
  console.log('stage box:', box && `${Math.round(box.width)}x${Math.round(box.height)}`);

  const shot = async (name) => { await stage.screenshot({ path: path.join(OUT, name) }); console.log('captured', name); };
  await shot('zoom-before.png');

  // Zoom lever: mc_zoom.x = Engine.getStageRight() - 16 (logical 1051 ->
  // screen ~1540), y around the bottom HUD. Drag upward to zoom in.
  const sx = Math.round(box.width * 0.985);
  const sy = Math.round(box.height * 0.93);
  const ey = Math.round(box.height * 0.62);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, ey, { steps: 15 });
  await page.mouse.up();
  console.log(`dragged zoom (${sx},${sy}) -> (${sx},${ey})`);
  await page.waitForTimeout(6000);
  await shot('zoom-after.png');

  const worldMarks = marks.filter((m) => m.includes('WorldRestaurantPlay.showNotify')).slice(-2);
  console.log('world marks:', worldMarks.join(' | '));
} finally {
  await browser.close();
}
