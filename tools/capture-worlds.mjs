/**
 * capture-worlds — boot the original Flash game under Ruffle headlessly with
 * intro popups disabled (test branch): the street intro logo plays, the game
 * auto-enters the player's restaurant. Capture restaurant, then scan the
 * bottom toolbar for the "My Street" button to capture the clean street too.
 *
 *   node tools/capture-worlds.mjs <outdir> <label>
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

  const streetSeen = () => consoleLines.some((l) => l.includes('WorldStreet.showNotify begin'));
  const inRestaurant = () => consoleLines.some((l) => l.includes('WorldRestaurantPlay.showNotify begin'));

  for (let i = 0; i < 25 && !streetSeen(); i++) await page.waitForTimeout(3000);
  console.log('street seen:', streetSeen());
  // Capture the intro street while it is clean (popups are disabled on the
  // test branch; the logo overlay has not covered it yet).
  await page.waitForTimeout(1500);
  await stage.screenshot({ path: path.join(OUT, `${LABEL}-street.png`) });
  console.log('captured street (intro)');

  // The intro logo plays and the game auto-enters the restaurant.
  let entered = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(5000);
    if (inRestaurant()) { entered = true; break; }
  }
  console.log('auto-entered restaurant:', entered);

  if (entered) {
    await page.waitForTimeout(20000); // room load + fade-in
    await stage.screenshot({ path: path.join(OUT, `${LABEL}-restaurant.png`) });
    console.log('captured restaurant');

    // Scan the bottom toolbar for the "My Street" button (restaurant HUD
    // bottom bar); clicking it returns to the street with the toolbar up.
    const clickFrac = async (fx, fy) => {
      const x = Math.round(box.width * fx);
      const y = Math.round(box.height * fy);
      await stage.click({ position: { x, y } });
    };
    const streetCount = () => consoleLines.filter((l) => l.includes('WorldStreet.showNotify begin')).length;
    const before = streetCount();
    const scanXs = [0.8, 0.74, 0.86, 0.68, 0.92, 0.62, 0.56, 0.5, 0.44];
    for (const fx of scanXs) {
      if (streetCount() > before) break;
      await clickFrac(fx, 0.94);
      await page.waitForTimeout(5000);
    }
    if (streetCount() > before) {
      console.log('back on street (toolbar scan)');
      await page.waitForTimeout(8000);
      await stage.screenshot({ path: path.join(OUT, `${LABEL}-street.png`) });
      console.log('captured street');
    } else {
      console.log('could not return to street; capturing current view');
      await stage.screenshot({ path: path.join(OUT, `${LABEL}-post-restaurant.png`) });
    }
  } else {
    await stage.screenshot({ path: path.join(OUT, `${LABEL}-stuck.png`) });
  }

  const marks = consoleLines.filter((l) => l.includes('[RC-PERF]') && (l.includes('World') || l.includes('init'))).slice(-14);
  console.log('world marks:', marks.join(' | '));
} finally {
  await browser.close();
}
