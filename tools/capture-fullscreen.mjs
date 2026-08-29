// capture-fullscreen — boot the game, auto-enter the restaurant (deterministic
// test branch), then request browser fullscreen via a click-triggered gesture
// and screenshot the fullscreen view. Verifies the widescreen build fills the
// monitor in fullscreen with no letterbox.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '..', 'tests', '.tmp', 'widescreen');
const LABEL = process.argv[3] || 'fullscreen';
const BASE = process.env.RC_CAPTURE_BASE || 'http://localhost:8090';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--start-fullscreen'] });
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

  // Wait for the restaurant (intro auto-entry, deterministic build).
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    if (marks.some((m) => m.includes('WorldRestaurantPlay.showNotify begin'))) break;
  }
  await page.waitForTimeout(15000);

  // Enter fullscreen with a real user gesture: a click handler calls
  // requestFullscreen on the stage (same element the page fullscreens).
  await page.evaluate(() => {
    document.addEventListener('click', () => {
      const el = document.querySelector('.stage');
      if (el && !document.fullscreenElement) el.requestFullscreen?.();
    }, { once: true });
  });
  await page.mouse.click(300, 300);
  await page.waitForTimeout(4000);

  const fsState = await page.evaluate(() => ({
    fullscreen: !!document.fullscreenElement,
    stageBox: (() => { const r = document.querySelector('.stage').getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })(),
    innerSize: (() => { const el = document.querySelector('.stage-inner > *') || document.querySelector('.stage'); const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })(),
  }));
  console.log('fullscreen state:', JSON.stringify(fsState));

  await page.screenshot({ path: path.join(OUT, `${LABEL}-fullscreen.png`) });
  console.log('captured fullscreen screenshot');

  // Also capture the stage element itself.
  const stageBox = await stage.boundingBox();
  console.log('stage bounding box:', stageBox && `${Math.round(stageBox.width)}x${Math.round(stageBox.height)}`);
  await stage.screenshot({ path: path.join(OUT, `${LABEL}-stage.png`) });

  const worldMarks = marks.filter((m) => m.includes('WorldRestaurantPlay.showNotify') || m.includes('WorldStreet.showNotify')).slice(-4);
  console.log('world marks:', worldMarks.join(' | '));
} finally {
  await browser.close();
}
