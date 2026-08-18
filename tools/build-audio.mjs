/**
 * Stage 3a: build-audio
 *
 * Exports the embedded MP3s from sound_asset.swf and copies them into
 * public/assets/generated/audio/. Formats: mp3 passthrough of the ORIGINAL
 * embedded assets (highest fidelity, browser-native; no ffmpeg on this
 * machine — see ADR-0009). Build-manifest registers them in manifest.json.
 *
 *   node tools/build-audio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffdec } from './lib/ffdec.mjs';
import { SWFS } from './lib/swf-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(HERE, '..', '..');
const WORK = path.join(HERE, '.work');
const OUT_DIR = path.resolve(HERE, '..', 'public', 'assets', 'generated', 'audio');

export function buildAudio() {
  const cfg = SWFS.sound_asset;
  const swfPath = path.join(WORKSPACE_ROOT, cfg.source);
  const workDir = path.join(WORK, 'sound_asset', 'sounds');
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const out = ffdec(['-export', 'sound', workDir, swfPath]);
  if (!/OK/.test(out.stdout + out.stderr)) {
    throw new Error(`sound export failed: ${out.stderr || out.stdout}`);
  }

  const tracks = [];
  const files = fs
    .readdirSync(workDir)
    .filter((f) => f.endsWith('.mp3'))
    .sort();
  if (files.length === 0) {
    throw new Error('sound export produced no mp3 files');
  }
  for (const f of files) {
    // FFDec names them <chid>_<ExportName>_<ClassName>.mp3
    const m = f.match(/^\d+_(.+?)_.+?\.mp3$/);
    if (!m) {
      throw new Error(`unexpected sound filename: ${f}`);
    }
    const id = m[1];
    const dest = path.join(OUT_DIR, `${id}.mp3`);
    fs.copyFileSync(path.join(workDir, f), dest);
    const kind = /^Music/i.test(id) ? 'music' : 'sfx';
    tracks.push({ id, file: `audio/${id}.mp3`, kind, bytes: fs.statSync(dest).size });
  }
  console.log(`audio: ${tracks.length} tracks from sound_asset.swf (${tracks.filter((t) => t.kind === 'music').length} music, ${tracks.filter((t) => t.kind === 'sfx').length} sfx)`);
  return tracks;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  buildAudio();
}
