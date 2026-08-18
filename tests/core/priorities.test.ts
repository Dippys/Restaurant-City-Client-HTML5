import { describe, expect, it } from 'vitest';
import {
  FLOOR_DRAW_PRIORITY,
  SHADOW_DRAW_PRIORITY,
  getTileDrawPriority,
} from '../../src/core/iso/math';
import { itemDrawPriority, shadowDrawPriority, sortByDrawPriority } from '../../src/core/iso/priorities';

describe('item draw priorities (placeRoomItem port)', () => {
  it('floor tiles use the fixed floor priority', () => {
    expect(itemDrawPriority('floor', { tileX: 3, tileY: 4 })).toBe(FLOOR_DRAW_PRIORITY);
    expect(shadowDrawPriority()).toBe(SHADOW_DRAW_PRIORITY);
  });

  it('doors follow the rotation-specific rule', () => {
    // rotation 0: tileDrawPriority(tileX+1, tileY) - 1
    expect(itemDrawPriority('door', { tileX: 3, tileY: 4, rotation: 0 })).toBe(
      getTileDrawPriority(4, 4) - 1,
    );
    // other rotation: tileDrawPriority(tileX-1, tileY+1)
    expect(itemDrawPriority('door', { tileX: 3, tileY: 4, rotation: 2 })).toBe(
      getTileDrawPriority(2, 5),
    );
  });

  it('wall decorations anchor against the full grid width', () => {
    expect(
      itemDrawPriority('wall-decoration', { tileX: 2, tileY: 3, fullGridSizeX: 8 }),
    ).toBe(getTileDrawPriority(2 + 8 - 1, 3));
  });

  it('items add their stack height', () => {
    expect(itemDrawPriority('item', { tileX: 5, tileY: 6 })).toBe(
      getTileDrawPriority(5, 6),
    );
    expect(itemDrawPriority('item', { tileX: 5, tileY: 6, curHeight: 40 })).toBe(
      getTileDrawPriority(5, 6) + 40,
    );
  });

  it('sortByDrawPriority is stable for equal priorities', () => {
    const a = { id: 'a', drawPriority: 10 };
    const b = { id: 'b', drawPriority: 10 };
    const c = { id: 'c', drawPriority: 5 };
    expect(sortByDrawPriority([a, b, c]).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });
});
