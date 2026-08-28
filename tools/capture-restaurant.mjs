/**
 * capture-restaurant — boot the original Flash game under Ruffle headlessly,
 * dismiss any intro popup (EmailPermissionReminder has a 50% chance and stops
 * the logo animation), then let the intro logo finish — the game auto-enters
 * the player's restaurant. Screenshot street + restaurant.
 *
 *   node tools/capture-restaurant.mjs <outdir> <label>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen');
const LABEL = process.argv[3] || 'shot';
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

  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(m.text()));

  const login = await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  console.log('login:', login.status());
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  const box = await stage.boundingBox();
  console.log('stage box:', box && `${Math.round(box.width)}x${Math.round(box.height)}`);

  const seenStreet = () => consoleLines.some((l) => l.includes('WorldStreet.showNotify begin'));
  const inRestaurant = () => consoleLines.some((l) => l.includes('WorldRestaurantPlay.showNotify begin'));

  for (let i = 0; i < 25 && !seenStreet(); i++) await page.waitForTimeout(3000);
  console.log('street seen:', seenStreet());
  await page.waitForTimeout(9000); // let any intro popup render

  const clickFrac = async (fx, fy) => {
    const x = Math.round(box.width * fx);
    const y = Math.round(box.height * fy);
    await stage.click({ position: { x, y } });
    console.log(`clicked (${fx},${fy})`);
  };

  // Dismiss any intro popup: its tick/cancel buttons sit near screen center.
  for (const [fx, fy] of [[0.5, 0.52], [0.5, 0.6], [0.5, 0.44], [0.42, 0.52], [0.58, 0.52]]) {
    if (inRestaurant()) break;
    await clickFrac(fx, fy);
    await page.waitForTimeout(2000);
  }
  await stage.screenshot({ path: path.join(OUT, `${LABEL}-street.png`) });
  console.log('captured street');

  // Intro logo now plays; when it ends the game auto-enters the restaurant.
  let entered = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(5000);
    if (inRestaurant()) { entered = true; break; }
  }
  console.log('auto-entered restaurant:', entered);
  if (entered) {
    await page.waitForTimeout(18000); // room load + fade
    await stage.screenshot({ path: path.join(OUT, `${LABEL}-restaurant.png`) });
    console.log('captured restaurant');
  } else {
    await stage.screenshot({ path: path.join(OUT, `${LABEL}-no-restaurant.png`) });
  }

  const marks = consoleLines.filter((l) => l.includes('[RC-PERF]')).slice(-10);
  console.log('last perf marks:', marks.join(' | '));
} finally {
  await browser.close();
}
