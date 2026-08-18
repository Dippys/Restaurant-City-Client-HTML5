import { describe, expect, it } from 'vitest';
import { packFrames } from '../../tools/lib/packer.mjs';

describe('packFrames', () => {
  it('places every frame once, inside the atlas bounds', () => {
    const frames = [
      { key: 'a', w: 10, h: 20 },
      { key: 'b', w: 30, h: 10 },
      { key: 'c', w: 5, h: 5 },
      { key: 'd', w: 40, h: 40 },
    ];
    const { width, height, placements } = packFrames(frames);
    expect(placements).toHaveLength(4);
    expect(new Set(placements.map((p) => p.key)).size).toBe(4);
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(width);
      expect(p.y + p.h).toBeLessThanOrEqual(height);
    }
  });

  it('never overlaps placed frames', () => {
    const frames = Array.from({ length: 50 }, (_, i) => ({
      key: `f${i}`,
      w: (i % 7) + 1,
      h: (i % 11) + 1,
    }));
    const { placements } = packFrames(frames);
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        const overlap =
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlap, `overlap between ${a.key} and ${b.key}`).toBe(false);
      }
    }
  });

  it('is deterministic for identical input', () => {
    const frames = [
      { key: 'x', w: 12, h: 8 },
      { key: 'y', w: 8, h: 12 },
    ];
    expect(packFrames(frames)).toEqual(packFrames([...frames]));
  });

  it('respects maxWidth by wrapping to new rows', () => {
    const frames = [
      { key: 'a', w: 100, h: 10 },
      { key: 'b', w: 100, h: 10 },
      { key: 'c', w: 100, h: 10 },
    ];
    const { width, height, placements } = packFrames(frames, { maxWidth: 250 });
    expect(width).toBeLessThanOrEqual(250);
    // a and b share a row; c wraps below them.
    const byKey = Object.fromEntries(placements.map((p) => [p.key, p]));
    expect(byKey.c.y).toBeGreaterThanOrEqual(byKey.a.y + byKey.a.h + 4);
    expect(height).toBeGreaterThan(10);
  });
});
