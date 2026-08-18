/**
 * preview-frames — extract individual frame images from a built atlas for
 * visual inspection / parity evidence.
 *
 *   node tools/preview-frames.mjs <swfName> <outDir> <frameKey...>
 *
 * Example:
 *   node tools/preview-frames.mjs ingredient_asset tests/golden/m0 \
 *     ingredient_asset/apple/idle ingredient_asset/apple/grey
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEN_DIR = path.resolve(HERE, '..', 'public', 'assets', 'generated', 'atlases');

const [swfName, outDir, ...keys] = process.argv.slice(2);
if (!swfName || !outDir || keys.length === 0) {
  console.error('usage: node tools/preview-frames.mjs <swfName> <outDir> <frameKey...>');
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(path.join(GEN_DIR, `${swfName}.json`), 'utf8'));

// frame key -> { rect, imageFile }
const framesByKey = new Map();
for (const t of json.textures) {
  const imageFile = path.join(GEN_DIR, t.image.split('/').pop());
  const atlasPng = PNG.sync.read(fs.readFileSync(imageFile));
  for (const f of t.frames) {
    framesByKey.set(f.filename, { rect: f.frame, atlasPng });
  }
}

fs.mkdirSync(outDir, { recursive: true });
let written = 0;
for (const key of keys) {
  const entry = framesByKey.get(key);
  if (!entry) {
    console.error(`frame not in atlas: ${key}`);
    process.exitCode = 1;
    continue;
  }
  const { rect, atlasPng } = entry;
  const out = new PNG({ width: rect.w, height: rect.h });
  PNG.bitblt(atlasPng, out, rect.x, rect.y, rect.w, rect.h, 0, 0);
  const safe = key.replace(/[^a-z0-9_\-]+/gi, '_');
  const file = path.join(outDir, `${safe}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log(`wrote ${file} (${rect.w}x${rect.h})`);
  written++;
}
if (written === 0) {
  process.exitCode = 1;
}
