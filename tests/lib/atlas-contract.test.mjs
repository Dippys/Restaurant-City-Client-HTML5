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
const atlasJson = path.join(GEN, 'atlases', 'ingredient_asset.json');
const atlasPng = path.join(GEN, 'atlases', 'ingredient_asset.png');
const manifestJson = path.join(GEN, 'manifest.json');
const present = fs.existsSync(atlasJson);

describe.skipIf(!present)('generated atlas contract', () => {
  const atlas = JSON.parse(fs.readFileSync(atlasJson, 'utf8'));

  it('uses the Phaser multi-atlas shape (textures array)', () => {
    expect(Array.isArray(atlas.textures)).toBe(true);
    expect(atlas.textures).toHaveLength(1);
  });

  it('image is site-root-relative and resolves under public/', () => {
    // Phaser multiatlas resolves textures[].image against loader.path
    // (empty), NOT against the JSON directory — the path must be
    // self-contained relative to public/ (see docs/04-asset-pipeline.md).
    const image = atlas.textures[0].image;
    expect(image).toBe('assets/generated/atlases/ingredient_asset.png');
    expect(
      fs.existsSync(path.resolve(GEN, '..', '..', image)),
      `public/${image} must exist`,
    ).toBe(true);
  });

  it('declares image size matching the PNG file', () => {
    const buf = fs.readFileSync(atlasPng);
    expect(buf.readUInt32BE(0)).toBe(0x89504e47);
    expect(atlas.textures[0].size).toEqual({
      w: buf.readUInt32BE(16),
      h: buf.readUInt32BE(20),
    });
  });

  it('has a frame entry for every frame with rect data', () => {
    const frames = atlas.textures[0].frames;
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) {
      expect(typeof f.filename).toBe('string');
      expect(f.frame).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
    }
  });

  it('contains at least one idle/grey two-frame symbol (M0 acceptance)', () => {
    const names = new Set(atlas.textures[0].frames.map((f) => f.filename));
    const pair = [...names].find(
      (k) => k.endsWith('/idle') && names.has(`${k.slice(0, -5)}/grey`),
    );
    expect(pair, 'expected a symbol with idle and grey frames').toBeTruthy();
  });

  it('manifest coverage is 100%', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestJson, 'utf8'));
    expect(manifest.coverage.ingredient_asset.pct).toBe(100);
    expect(manifest.coverage.ingredient_asset.exported).toBe(
      manifest.coverage.ingredient_asset.symbols,
    );
  });
});

if (!present) {
  console.warn(
    '[atlas-contract] generated atlas missing — run `npm run pipeline` for hard assertions',
  );
}
