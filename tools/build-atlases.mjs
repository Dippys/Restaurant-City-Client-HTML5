/**
 * Stage 2: build-atlases
 *
 * Packs the extracted frame PNGs of one SWF into a single atlas PNG and a
 * Phaser multi-atlas JSON. Outputs (relative to client-html5/public/):
 *
 *   assets/generated/atlases/<swf>.png
 *   assets/generated/atlases/<swf>.json
 *
 *   node tools/build-atlases.mjs [swfName]
 *
 * Image format note (ADR-0004): PNG tier for M0 (lossless, zero
 * dependencies beyond pngjs). WebP tier is a later pipeline upgrade.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { packFrames } from './lib/packer.mjs';
import { SWFS } from './lib/swf-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, '.work');
const OUT_DIR = path.resolve(HERE, '..', 'public', 'assets', 'generated', 'atlases');

export function buildAtlas(swfName) {
  const cfg = SWFS[swfName];
  if (!cfg) {
    throw new Error(`unknown SWF "${swfName}" — see tools/lib/swf-config.mjs`);
  }
  const work = path.join(WORK, swfName);
  const extract = JSON.parse(fs.readFileSync(path.join(work, 'extract.json'), 'utf8'));

  const frames = [];
  for (const symbol of extract.symbols) {
    for (const f of symbol.frames) {
      frames.push({ ...f, abs: path.join(work, f.file) });
    }
  }
  frames.sort((a, b) => a.key.localeCompare(b.key));

  const { width, height, placements } = packFrames(frames);
  const byKey = new Map(placements.map((p) => [p.key, p]));

  const atlas = new PNG({ width, height });
  for (const f of frames) {
    const src = PNG.sync.read(fs.readFileSync(f.abs));
    const p = byKey.get(f.key);
    if (!p) {
      throw new Error(`no placement for frame ${f.key}`);
    }
    PNG.bitblt(src, atlas, 0, 0, f.w, f.h, p.x, p.y);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pngFile = path.join(OUT_DIR, `${swfName}.png`);
  fs.writeFileSync(pngFile, PNG.sync.write(atlas, { colorType: 6, inputColorType: 6 }));

  const json = {
    textures: [
      {
        // Self-contained site-root-relative path (relative to public/).
        // Phaser's multiatlas loader resolves this against loader.path
        // (empty by default), NOT against the JSON file's directory —
        // see docs/04-asset-pipeline.md.
        image: `assets/generated/atlases/${swfName}.png`,
        format: 'RGBA8888',
        size: { w: width, h: height },
        scale: 1,
        frames: frames.map((f) => {
          const p = byKey.get(f.key);
          return {
            filename: f.key,
            rotated: false,
            trimmed: false,
            frame: { x: p.x, y: p.y, w: p.w, h: p.h },
            spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
            sourceSize: { w: p.w, h: p.h },
          };
        }),
      },
    ],
    meta: {
      app: 'rc-html5-pipeline',
      version: '1.0',
      swf: swfName,
      image: `${swfName}.png`,
      size: { w: width, h: height },
    },
  };
  const jsonFile = path.join(OUT_DIR, `${swfName}.json`);
  fs.writeFileSync(jsonFile, `${JSON.stringify(json, null, 2)}\n`);

  console.log(
    `atlas: ${swfName} -> ${width}x${height}, ${frames.length} frames (${path.relative(path.resolve(HERE, '..'), pngFile)})`,
  );
  return { pngFile, jsonFile, atlas: json, frameCount: frames.length, size: { width, height } };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  buildAtlas(process.argv[2] ?? 'ingredient_asset');
}
