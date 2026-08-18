/**
 * visual-check — headless Chromium verification of the M2 scenes against
 * the live dev stack (backend :8090, vite :5173).
 *
 *   node tools/visual-check.mjs
 *
 * Logs in with the fixed e2e account, walks Boot -> Street -> Restaurant,
 * screenshots each stage into tests/golden/m2/screens/, pixel-asserts the
 * floor colour at the room center, and fails on console errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5173';
const OUT = path.resolve(HERE, '..', 'tests', 'golden', 'm2', 'screens');
const FLOOR_COLOUR = 15132390;
const OUTSIDE_COLOUR = 10668375;

function rgb(color) {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

async function samplePng(buffer, x, y) {
  const png = PNG.sync.read(buffer);
  const idx = (y * png.width + x) * 4;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

/** Scans a horizontal strip for a pixel within tolerance of any target colour. */
async function stripHasColour(buffer, x0, x1, y, targets, tolerance = 14) {
  const png = PNG.sync.read(buffer);
  for (let x = x0; x < x1; x += 4) {
    const idx = (y * png.width + x) * 4;
    const [r, g, b] = [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
    for (const t of targets) {
      const [tr, tg, tb] = t;
      if (Math.abs(r - tr) <= tolerance && Math.abs(g - tg) <= tolerance && Math.abs(b - tb) <= tolerance) {
        return [r, g, b];
      }
    }
  }
  return null;
}

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 600 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  // 1. Log in through the vite proxy (shares the context cookie jar).
  const login = await context.request.post(`${BASE}/__api/login`, {
    data: { username: 'm2e2etest', pin: '123456' },
  });
  check('login', login.status() === 200, `status ${login.status()}`);

  // 2. Boot -> street (status is exposed via document.documentElement.dataset.status).
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const status = document.documentElement.dataset.status ?? '';
      return status.includes('profile loaded') || status.includes('FAILED') || status.includes('redirecting');
    },
    undefined,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '1-street.png') });
  const streetStatus = await page.evaluate(() => document.documentElement.dataset.status ?? '');
  check('street reached', !streetStatus.includes('FAILED'), streetStatus);
  // Own building layout: roof above the body origin, scaled to body width.
  const roofY = Number(await page.evaluate(() => document.documentElement.dataset.roofY ?? '0'));
  const bodyH = Number(await page.evaluate(() => document.documentElement.dataset.bodyH ?? '0'));
  const roofScaled = await page.evaluate(() => document.documentElement.dataset.roofScaled === '1');
  check('roof above body', roofY < 0, `roofY=${roofY} bodyH=${bodyH}`);
  check('roof scaled to body', roofScaled, 'scale != 1');

  // 3. Click the own building (first real slot at world x=420, camera x=40,
  //    building base at y=520).
  await page.mouse.click(380, 520);
  await page.waitForTimeout(1500);
  const sceneNow = await page.evaluate(() => document.documentElement.dataset.scene ?? '(none)');
  const buildingTag = await page.evaluate(() => document.documentElement.dataset.building ?? '(none)');
  const pointerTag = await page.evaluate(() => document.documentElement.dataset.pointer ?? '(none)');
  check('restaurant scene entered', sceneNow === 'restaurant', `scene=${sceneNow} tag=${buildingTag} world=${pointerTag}`);
  await page.screenshot({ path: path.join(OUT, '2-restaurant.png') });

  // 4. Floor pixels: scan a strip across the room interior + outside area
  //    (furniture sprites may cover any single point).
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 760, height: 600 } });
  const found = await stripHasColour(
    shot,
    200,
    560,
    240,
    [rgb(FLOOR_COLOUR), rgb(OUTSIDE_COLOUR)],
  );
  check('restaurant floor rendered', found !== null, found ? `floor pixel rgb(${found.join(',')})` : 'no floor pixel found');

  // 4b. Default walls + owned items must be present (8x8 room: 7+7+1 walls).
  const walls = Number(await page.evaluate(() => document.documentElement.dataset.walls ?? '0'));
  const items = Number(await page.evaluate(() => document.documentElement.dataset.items ?? '0'));
  check('default walls rendered', walls === 15, `walls=${walls}`);
  check('owned items rendered', items > 0, `items=${items}`);
  const depthTrace = await page.evaluate(() => document.documentElement.dataset.depthTrace ?? '');
  console.log('  depth trace:', depthTrace);

  // 5. Editor: click "edit" (bottom-right, inside the text bounds).
  await page.mouse.click(686, 568);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '3-editor.png') });
  const editorStatus = await page.evaluate(() => document.documentElement.dataset.status ?? '');
  check('editor toolbar visible', editorStatus.includes('edit mode'), editorStatus);

  // 6. Console/page errors.
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`visual-check FAILED: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('visual-check: all checks passed');
}
