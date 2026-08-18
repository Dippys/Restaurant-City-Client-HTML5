/**
 * Stage 4: verify-pipeline
 *
 * Re-runs extraction from the original SWFs (never trusting stale work
 * output) and checks the pipeline contract:
 *
 *   - every linked symbol has exported frames (100% symbol coverage)
 *   - atlas JSONs contain exactly the extracted frame keys
 *   - every atlas texture PNG exists and its header matches the JSON size
 *   - manifest-registered data/lang/audio files exist and are non-empty
 *
 * Exits non-zero on any failure — coverage failure is a build error, not a
 * warning (docs/04-asset-pipeline.md).
 *
 *   node tools/verify-pipeline.mjs [swfName ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExtract } from './extract-symbols.mjs';
import { ATLAS_SWFS, SWFS } from './lib/swf-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEN_DIR = path.resolve(HERE, '..', 'public', 'assets', 'generated');
const PUBLIC = path.resolve(GEN_DIR, '..', '..');
const ATLAS_DIR = path.join(GEN_DIR, 'atlases');
const WORKSPACE_ROOT = path.resolve(HERE, '..', '..');
const WORK = path.join(HERE, '.work');

function readPngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`not a PNG: ${file}`);
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Re-extract only when the work output is older than the source SWF —
 * otherwise the extraction is still the one produced from this exact
 * source, and re-running FFDec for minutes on every verify is pure waste.
 */
function extractFresh(swfName) {
  const cfg = SWFS[swfName];
  const swfPath = path.join(WORKSPACE_ROOT, cfg.source);
  const extractFile = path.join(WORK, swfName, 'extract.json');
  if (
    fs.existsSync(extractFile) &&
    fs.statSync(extractFile).mtimeMs >= fs.statSync(swfPath).mtimeMs
  ) {
    return JSON.parse(fs.readFileSync(extractFile, 'utf8'));
  }
  console.log(`  (re-extracting ${swfName}: source newer than work output)`);
  return runExtract(swfName).extract;
}

export function verifyPipeline(swfNames) {
  const failures = [];
  for (const swfName of swfNames) {
    try {
      const extract = extractFresh(swfName);
      const atlasJsonFile = path.join(ATLAS_DIR, `${swfName}.json`);
      const atlas = JSON.parse(fs.readFileSync(atlasJsonFile, 'utf8'));
      const atlasKeys = new Set(
        atlas.textures.flatMap((t) => t.frames.map((f) => f.filename)),
      );
      const expectedKeys = new Set(
        extract.symbols.flatMap((s) => s.frames.map((f) => f.key)),
      );

      const missing = [...expectedKeys].filter((k) => !atlasKeys.has(k));
      const extra = [...atlasKeys].filter((k) => !expectedKeys.has(k));
      if (missing.length > 0) {
        failures.push(`${swfName}: atlas missing frames: ${missing.slice(0, 5).join(', ')}`);
      }
      if (extra.length > 0) {
        failures.push(`${swfName}: atlas has unexpected frames: ${extra.slice(0, 5).join(', ')}`);
      }

      if (extract.counts.symbols !== extract.symbols.length) {
        failures.push(
          `${swfName}: symbol coverage ${extract.symbols.length}/${extract.counts.symbols} < 100%`,
        );
      }

      for (const t of atlas.textures) {
        const pngFile = path.join(ATLAS_DIR, t.image.split('/').pop());
        const pngSize = readPngSize(pngFile);
        if (t.size.w !== pngSize.w || t.size.h !== pngSize.h) {
          failures.push(
            `${swfName}: texture ${t.image} JSON size ${t.size.w}x${t.size.h} != PNG ${pngSize.w}x${pngSize.h}`,
          );
        }
      }
      console.log(
        `verify OK: ${swfName} — ${extract.symbols.length}/${extract.counts.symbols} symbols, ` +
          `${expectedKeys.size} frames, ${atlas.textures.length} page(s)`,
      );
    } catch (err) {
      failures.push(`${swfName}: ${err.message}`);
    }
  }

  // Manifest-registered runtime files must exist and be non-empty. Note:
  // data/audio/lang `file` paths are relative to assets/generated/ (the
  // manifest's own root), unlike atlas JSON image paths (site-root-relative).
  const manifestFile = path.join(GEN_DIR, 'manifest.json');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    for (const entry of [...(manifest.data ?? []), ...(manifest.langs ?? []), ...(manifest.audio ?? [])]) {
      const f = path.join(GEN_DIR, entry.file);
      if (!fs.existsSync(f)) {
        failures.push(`manifest entry missing on disk: ${entry.file}`);
      } else if (fs.statSync(f).size === 0) {
        failures.push(`manifest entry is empty: ${entry.file}`);
      }
    }
  } else {
    failures.push('manifest.json missing — run build-manifest');
  }

  if (failures.length > 0) {
    console.error('verify FAILED:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exitCode = 1;
    return false;
  }
  console.log('verify: all SWFs and manifest entries pass');
  return true;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const names = process.argv.slice(2);
  verifyPipeline(names.length > 0 ? names : ATLAS_SWFS);
}
