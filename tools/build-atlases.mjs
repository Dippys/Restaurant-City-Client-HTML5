/**
 * Stage 2: build-atlases
 *
 * Packs the extracted frame PNGs of one SWF into one or more atlas PNGs
 * (pages) and a Phaser multi-atlas JSON listing every page as a texture.
 * Outputs (relative to client-html5/public/):
 *
 *   assets/generated/atlases/<swf>_<page>.png
 *   assets/generated/atlases/<swf>.json
 *
 *   node tools/build-atlases.mjs [swfName]
 *
 * Image format note (ADR-0004): PNG tier for M0/M1 (lossless, zero
 * dependencies beyond pngjs). WebP tier is a later pipeline upgrade.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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

  // Deduplicate byte-identical frames: timeline animations repeat identical
  // raster content constantly (game_asset alone has 7184 frames). Duplicate
  // keys share one atlas rect — the multi-atlas JSON allows it.
  const repByHash = new Map(); // hash -> first frame key
  const uniqueFrames = [];
  for (const f of frames) {
    const hash = createHash('sha256').update(fs.readFileSync(f.abs)).digest('hex').slice(0, 16);
    const rep = repByHash.get(hash);
    if (rep) {
      f.rep = rep;
    } else {
      repByHash.set(hash, f.key);
      uniqueFrames.push(f);
    }
  }
  if (uniqueFrames.length < frames.length) {
    console.log(
      `  dedup: ${frames.length - uniqueFrames.length}/${frames.length} frames identical to earlier frames`,
    );
  }

  // Clean previous outputs for this SWF before writing (regeneration).
  for (const stale of fs.readdirSync(OUT_DIR).filter(
    (f) => f.startsWith(`${swfName}_`) || f === `${swfName}.json` || f === `${swfName}.png`,
  )) {
    fs.unlinkSync(path.join(OUT_DIR, stale));
  }

  const { pages } = packFrames(uniqueFrames);
  const oversized = uniqueFrames.filter((f) => f.w + 4 > 2048 || f.h + 4 > 2048);
  if (oversized.length > 0) {
    console.log(
      `  note: ${oversized.length} oversized frame(s) get their own page, e.g. ` +
        `${oversized[0].key} (${oversized[0].w}x${oversized[0].h})`,
    );
  }
  const textures = [];
  pages.forEach((page, pageIndex) => {
    const byKey = new Map(page.placements.map((p) => [p.key, p]));
    const atlas = new PNG({ width: page.width, height: page.height });
    for (const f of uniqueFrames) {
      const p = byKey.get(f.key);
      if (!p) continue;
      const src = PNG.sync.read(fs.readFileSync(f.abs));
      PNG.bitblt(src, atlas, 0, 0, f.w, f.h, p.x, p.y);
    }
    const pageName = `${swfName}_${pageIndex}`;
    const pngFile = path.join(OUT_DIR, `${pageName}.png`);
    fs.writeFileSync(pngFile, PNG.sync.write(atlas, { colorType: 6, inputColorType: 6 }));

    textures.push({
      // Self-contained site-root-relative path (Phaser multiatlas resolves
      // textures[].image against loader.path, NOT the JSON directory).
      image: `assets/generated/atlases/${pageName}.png`,
      format: 'RGBA8888',
      size: { w: page.width, h: page.height },
      scale: 1,
      frames: frames
        .filter((f) => byKey.has(f.rep ?? f.key))
        .map((f) => {
          const p = byKey.get(f.rep ?? f.key);
          return {
            filename: f.key,
            rotated: false,
            trimmed: false,
            frame: { x: p.x, y: p.y, w: p.w, h: p.h },
            spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
            sourceSize: { w: p.w, h: p.h },
          };
        }),
    });
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const json = {
    textures,
    meta: {
      app: 'rc-html5-pipeline',
      version: '1.0',
      swf: swfName,
      image: `${swfName}_0.png`,
      size: { w: pages[0].width, h: pages[0].height },
    },
  };
  const jsonFile = path.join(OUT_DIR, `${swfName}.json`);
  fs.writeFileSync(jsonFile, `${JSON.stringify(json, null, 2)}\n`);

  console.log(
    `atlas: ${swfName} -> ${pages.length} page(s), ${frames.length} frames (${uniqueFrames.length} unique) ` +
      `(${path.relative(path.resolve(HERE, '..'), jsonFile)})`,
  );
  return {
    jsonFile,
    atlas: json,
    frameCount: frames.length,
    pages: pages.length,
    size: { width: pages[0].width, height: pages[0].height },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  buildAtlas(process.argv[2] ?? 'ingredient_asset');
}
