/**
 * capture-reference — boots the ORIGINAL Flash game under Ruffle headlessly
 * (canvas renderer forced — wgpu stalls in headless Chrome), clicks through
 * the preloader, and screenshots the street and restaurant.
 *
 *   node tools/capture-reference.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'tests', 'golden', 'm2', 'refs');
const BASE = 'http://localhost:8090';

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 600 } });
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
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 160)}`);
  });

  const login = await context.request.post(`${BASE}/__api/login`, {
    data: { username: 'm2e2etest', pin: '123456' },
  });
  console.log('login:', login.status());
  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' });

  const stage = page.locator('.stage');
  await stage.waitFor({ state: 'visible', timeout: 20000 });
  const seen = new Set();
  let canvasSeen = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.waitForTimeout(8000);
    canvasSeen = (await page.locator('.stage canvas').count()) > 0;
    const shot = await stage.screenshot();
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(shot).digest('hex').slice(0, 12);
    console.log(`attempt ${attempt + 1}: canvas=${canvasSeen} frame=${hash}`);
    if (attempt === 0) {
      await stage.click({ position: { x: 380, y: 300 } });
    }
    if (canvasSeen && seen.has(hash)) {
      console.log('frame stable');
      break;
    }
    seen.add(hash);
  }
  await stage.screenshot({ path: path.join(OUT, 'original-street.png') });
  console.log('captured original-street.png');

  await stage.click({ position: { x: 380, y: 500 } });
  await page.waitForTimeout(12000);
  await stage.screenshot({ path: path.join(OUT, 'original-restaurant.png') });
  console.log('captured original-restaurant.png');
  console.log('ruffle warnings:', logs.length ? logs.slice(0, 4) : 'none');
} finally {
  await browser.close();
}
