// probe-ruffle — load /game headlessly and dump Ruffle element geometry:
// stage box, object/embed attrs, canvas size (render buffer), player attrs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 120)}`));

  await context.request.post(`${BASE}/__api/login`, { data: { username: 'm2e2etest', pin: '123456' } });
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(20000);

  const info = await page.evaluate(() => {
    const stage = document.querySelector('.stage');
    const inner = document.querySelector('.stage-inner');
    const obj = document.querySelector('object');
    const embed = document.querySelector('embed');
    const canvas = document.querySelector('.stage canvas');
    const player = document.querySelector('ruffle-player, ruffle-object');
    const box = (el) => el ? (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })() : null;
    const attrs = (el) => el ? Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])) : null;
    return {
      stageBox: box(stage),
      innerBox: box(inner),
      objectAttrs: attrs(obj),
      canvasBox: box(canvas),
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      canvasCss: canvas ? getComputedStyle(canvas).width + 'x' + getComputedStyle(canvas).height : null,
      playerBox: box(player),
      playerAttrs: attrs(player),
      playerTag: player ? player.tagName : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('console errors/warnings:', logs.slice(0, 8));
} finally {
  await browser.close();
}
