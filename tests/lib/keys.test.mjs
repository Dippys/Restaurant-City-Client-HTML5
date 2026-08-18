import { describe, expect, it } from 'vitest';
import { frameKey, splitKey } from '../../tools/lib/keys.mjs';

describe('frameKey', () => {
  it('lowercases swf and symbol, keeps label', () => {
    expect(frameKey('Ingredient_Asset', 'Apple', 'idle', 1)).toBe(
      'ingredient_asset/apple/idle',
    );
  });

  it('uses zero-padded 3-digit index when no label exists', () => {
    expect(frameKey('ingredient_asset', 'BeefA', null, 1)).toBe(
      'ingredient_asset/beefa/001',
    );
    expect(frameKey('ingredient_asset', 'BeefA', null, 12)).toBe(
      'ingredient_asset/beefa/012',
    );
  });

  it('lowercases labels defensively', () => {
    expect(frameKey('ingredient_asset', 'Wasabi', 'GREY', 2)).toBe(
      'ingredient_asset/wasabi/grey',
    );
  });

  it('round-trips through splitKey', () => {
    const key = frameKey('ingredient_asset', 'Tomato', 'idle', 1);
    expect(splitKey(key)).toEqual({
      swf: 'ingredient_asset',
      symbol: 'tomato',
      frame: 'idle',
    });
  });
});
