import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Conformance checks: the generated data JSONs (machine-local, skip when
 * the pipeline hasn't run) must match the runtime model shapes in
 * src/net/data/types.ts.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(HERE, '..', '..', 'public', 'assets', 'generated', 'data');
const present = fs.existsSync(path.join(DATA_DIR, 'ingredients.json'));

describe.skipIf(!present)('generated data JSONs match runtime models', () => {
  const read = (id: string) =>
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${id}.json`), 'utf8')) as unknown;

  it('itemDatabase files have groups with items and defaults', () => {
    for (const id of ['ingredients', 'perks', 'recipes', 'quiz', 'avatars', 'front', 'restaurants', 'appointments']) {
      const json = read(id) as { groups: { name: string | null; items: Record<string, unknown>[] }[] };
      expect(Array.isArray(json.groups)).toBe(true);
      expect(json.groups.length).toBeGreaterThan(0);
      for (const g of json.groups) {
        expect(typeof g.name).toBe('string');
        expect(Array.isArray(g.items)).toBe(true);
        for (const item of g.items) {
          expect(typeof item).toBe('object');
          // cash/cost: 0 when absent, attribute string when present (AS3 port).
          for (const key of ['cash', 'cost'] as const) {
            const value = item[key];
            if (value !== undefined) {
              expect(['number', 'string']).toContain(typeof value);
            }
          }
        }
      }
    }
  });

  it('lang files have entries with id/body', () => {
    for (const code of ['en', 'fr']) {
      const json = read(`lang_${code}`) as {
        langCode: string;
        entries: { id: string | null; body: string }[];
      };
      expect(json.langCode).toBe(code);
      expect(json.entries.length).toBeGreaterThan(0);
      for (const e of json.entries.slice(0, 20)) {
        expect(typeof e.id).toBe('string');
        expect(typeof e.body).toBe('string');
      }
    }
  });

  it('challenges have serve/reward arrays', () => {
    const json = read('challenges') as { challenges: Record<string, unknown>[] };
    expect(json.challenges.length).toBeGreaterThan(0);
    for (const c of json.challenges) {
      expect(typeof c.id).toBe('string');
      expect(Array.isArray(c.serve)).toBe(true);
      expect(Array.isArray(c.rewards)).toBe(true);
    }
  });
});

if (!present) {
  console.warn('[data-models] generated data missing — run `npm run pipeline` for hard assertions');
}
