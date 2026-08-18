import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Pipeline output contract test (guards what the Phaser multiatlas loader
 * consumes — see docs/04-asset-pipeline.md). The generated files are
 * gitignored, so when the pipeline hasn't been run yet the test skips with
 * a warning; run `npm run pipeline` first to get the hard assertions.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEN = path.resolve(HERE, '..', '..', 'public', 'assets', 'generated');
const PUBLIC = path.resolve(GEN, '..', '..');
const atlasJson = path.join(GEN, 'atlases', 'ingredient_asset.json');
const manifestJson = path.join(GEN, 'manifest.json');
const present = fs.existsSync(atlasJson);

describe.skipIf(!present)('generated atlas contract', () => {
  const atlas = JSON.parse(fs.readFileSync(atlasJson, 'utf8'));

  it('uses the Phaser multi-atlas shape (textures array)', () => {
    expect(Array.isArray(atlas.textures)).toBe(true);
    expect(atlas.textures.length).toBeGreaterThanOrEqual(1);
  });

  it('every texture image is site-root-relative and resolves under public/', () => {
    // Phaser multiatlas resolves textures[].image against loader.path
    // (empty), NOT against the JSON directory — paths must be
    // self-contained relative to public/ (see docs/04-asset-pipeline.md).
    for (const t of atlas.textures) {
      expect(t.image).toMatch(/^assets\/generated\/atlases\/ingredient_asset_\d+\.png$/);
      expect(fs.existsSync(path.join(PUBLIC, t.image)), `public/${t.image} must exist`).toBe(
        true,
      );
    }
  });

  it('declares image sizes matching the PNG files', () => {
    for (const t of atlas.textures) {
      const buf = fs.readFileSync(path.join(PUBLIC, t.image));
      expect(buf.readUInt32BE(0)).toBe(0x89504e47);
      expect(t.size).toEqual({
        w: buf.readUInt32BE(16),
        h: buf.readUInt32BE(20),
      });
    }
  });

  it('has a frame entry for every frame with rect data', () => {
    const frames = atlas.textures.flatMap((t) => t.frames);
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) {
      expect(typeof f.filename).toBe('string');
      expect(f.frame).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
      });
    }
  });

  it('contains at least one idle/grey two-frame symbol (M0 acceptance)', () => {
    const names = new Set(atlas.textures.flatMap((t) => t.frames.map((f) => f.filename)));
    const pair = [...names].find(
      (k) => k.endsWith('/idle') && names.has(`${k.slice(0, -5)}/grey`),
    );
    expect(pair, 'expected a symbol with idle and grey frames').toBeTruthy();
  });

  it('manifest coverage is 100% for every atlas SWF', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestJson, 'utf8'));
    expect(Object.keys(manifest.coverage).length).toBeGreaterThan(0);
    for (const [name, c] of Object.entries(manifest.coverage)) {
      expect(c.pct, `${name} coverage`).toBe(100);
      expect(c.exported, `${name} exported`).toBe(c.symbols);
    }
  });

  it('manifest registers data, langs, and audio with existing files', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestJson, 'utf8'));
    for (const entry of [...manifest.data, ...manifest.langs, ...manifest.audio]) {
      // data/audio/lang `file` paths are relative to assets/generated/.
      expect(fs.existsSync(path.join(GEN, entry.file)), `${entry.file} must exist`).toBe(true);
    }
  });
});

if (!present) {
  console.warn(
    '[atlas-contract] generated atlas missing — run `npm run pipeline` for hard assertions',
  );
}
