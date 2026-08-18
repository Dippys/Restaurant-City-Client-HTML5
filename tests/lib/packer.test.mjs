import { describe, expect, it } from 'vitest';
import { packFrames } from '../../tools/lib/packer.mjs';

describe('packFrames', () => {
  it('places every frame once, inside its page bounds', () => {
    const frames = [
      { key: 'a', w: 10, h: 20 },
      { key: 'b', w: 30, h: 10 },
      { key: 'c', w: 5, h: 5 },
      { key: 'd', w: 40, h: 40 },
    ];
    const { pages } = packFrames(frames);
    const placements = pages.flatMap((p) => p.placements);
    expect(placements).toHaveLength(4);
    expect(new Set(placements.map((p) => p.key)).size).toBe(4);
    const byKey = new Map(placements.map((p) => [p.key, p]));
    for (const p of placements) {
      const page = pages.find((pg) => pg.placements.some((q) => q.key === p.key));
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(page.width);
      expect(p.y + p.h).toBeLessThanOrEqual(page.height);
      expect(byKey.get(p.key)).toBeDefined();
    }
  });

  it('never overlaps placed frames', () => {
    const frames = Array.from({ length: 50 }, (_, i) => ({
      key: `f${i}`,
      w: (i % 7) + 1,
      h: (i % 11) + 1,
    }));
    const { pages } = packFrames(frames);
    for (const page of pages) {
      const ps = page.placements;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          const overlap =
            a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlap, `overlap between ${a.key} and ${b.key}`).toBe(false);
        }
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
    const { pages } = packFrames(frames, { maxWidth: 250, maxHeight: 2048 });
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBeLessThanOrEqual(250);
    const byKey = Object.fromEntries(pages[0].placements.map((p) => [p.key, p]));
    expect(byKey.c.y).toBeGreaterThanOrEqual(byKey.a.y + byKey.a.h + 4);
    expect(pages[0].height).toBeGreaterThan(10);
  });

  it('pages when a page would exceed maxHeight', () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({
      key: `f${i}`,
      w: 500,
      h: 400,
    }));
    const { pages } = packFrames(frames, { maxWidth: 2048, maxHeight: 1024 });
    expect(pages.length).toBeGreaterThan(1);
    const total = pages.reduce((n, p) => n + p.placements.length, 0);
    expect(total).toBe(30);
    for (const page of pages) {
      expect(page.height).toBeLessThanOrEqual(1024 + 4);
    }
  });

  it('gives oversized frames their own page that fits them (regression)', () => {
    const frames = [
      { key: 'huge', w: 3000, h: 2000 },
      { key: 'small', w: 10, h: 10 },
    ];
    const { pages } = packFrames(frames, { maxWidth: 2048, maxHeight: 2048 });
    expect(pages.length).toBe(2);
    const huge = pages.find((p) => p.placements.some((q) => q.key === 'huge'));
    const p = huge.placements.find((q) => q.key === 'huge');
    expect(p.x + p.w).toBeLessThanOrEqual(huge.width);
    expect(p.y + p.h).toBeLessThanOrEqual(huge.height);
  });
});
