/**
 * capture-widescreen — boots the ORIGINAL Flash game under Ruffle headlessly
 * at a 1920x1080 viewport and screenshots the street and restaurant, for
 * comparing the shipped 760x600 SWF vs the RC Reborn widescreen test SWF.
 *
 *   node tools/capture-widescreen.mjs <outdir> [label]
 *
 * Login uses the existing m2e2etest/123456 account (same as capture-reference).
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
  // Force Ruffle's canvas renderer (wgpu-webgl stalls headless).
  await page.route('**/ruffle/ruffle.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body + '\n;window.RufflePlayer.config.renderer = "canvas";';
    await route.fulfill({
      response,
      body: patched,
      headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(patched)) },
    });
  });

  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });

  const login = await context.request.post(`${BASE}/__api/login`, {
    data: { username: 'm2e2etest', pin: '123456' },
  });
  console.log('login:', login.status());
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });

  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });

  // Record the actual stage box geometry so we can verify it is 16:9.
  const box = await stage.boundingBox();
  console.log('stage box:', box && `${Math.round(box.width)}x${Math.round(box.height)}`);

  const seen = new Set();
  let canvasSeen = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(8000);
    canvasSeen = (await page.locator('.stage canvas').count()) > 0;
    const shot = await stage.screenshot();
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(shot).digest('hex').slice(0, 12);
    console.log(`attempt ${attempt + 1}: canvas=${canvasSeen} frame=${hash}`);
    if (attempt === 0) {
      await stage.click({ position: { x: Math.round((box?.width || 760) / 2), y: Math.round((box?.height || 600) / 2) } });
    }
    if (canvasSeen && seen.has(hash)) {
      console.log('frame stable');
      break;
    }
    seen.add(hash);
  }
  await stage.screenshot({ path: path.join(OUT, `${LABEL}-street.png`) });
  console.log(`captured ${LABEL}-street.png`);

  // Click near the bottom to enter the restaurant, then capture.
  await stage.click({ position: { x: Math.round((box?.width || 760) / 2), y: Math.round((box?.height || 600) * 0.82) } });
  await page.waitForTimeout(14000);
  await stage.screenshot({ path: path.join(OUT, `${LABEL}-restaurant.png`) });
  console.log(`captured ${LABEL}-restaurant.png`);
  console.log('ruffle warnings:', logs.length ? logs.slice(0, 6) : 'none');
} finally {
  await browser.close();
}
