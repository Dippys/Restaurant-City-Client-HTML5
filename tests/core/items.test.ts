import { describe, expect, it } from 'vitest';
import { footprintFromConfig, rotateFootprint, coveredTiles, itemScreenPosition } from '../../src/core/items/footprint';
import { getItemSellPrice, getItemType, getRestaurantSubType, packRotationData, rotationFromData, usageCountFromData } from '../../src/core/items/types';
import { defaultWallAt, isItemOutOfBound, isValid, type PlacementContext } from '../../src/core/items/validity';

/** 8x8 room, 7x6 outside area, default walls, no placed items. */
function makeContext(): PlacementContext {
  return {
    numTilesX: 8,
    numTilesY: 8,
    numOutsideTilesX: 7,
    numOutsideTilesY: 6,
    wallAt: defaultWallAt,
    stackAt: () => ({ count: 0, topSurface: false, containsSelf: false, surfaceBelowSelf: false }),
  };
}

describe('item types (GameWorld/GameUser port)', () => {
  it('maps ids to types and sub-types', () => {
    expect(getItemType('2060000')).toBe(2); // building
    expect(getItemType('3040000')).toBe(3); // restaurant
    expect(getItemType('4000010')).toBe(4); // ingredient
    expect(getRestaurantSubType('3900000')).toBe(390); // outside area size
    expect(getRestaurantSubType('3600001')).toBe(360); // music
  });

  it('computes sell prices (GameWorld L2604-2611)', () => {
    expect(getItemSellPrice({ cash: 2, cost: 100 })).toBe(660);
    expect(getItemSellPrice({ cost: 100 })).toBe(33);
    expect(getItemSellPrice({ cash: 0, cost: 0 })).toBe(0);
  });

  it('packs rotation/usage nibbles (RoomItem.getUserItem)', () => {
    expect(packRotationData(3, 7)).toBe(3 | (7 << 4));
    expect(rotationFromData(0x73)).toBe(3);
    expect(usageCountFromData(0x73)).toBe(7);
  });
});

describe('footprint (RoomItem constructor port)', () => {
  it('uses sizeX/sizeY and defaults to 1x1', () => {
    expect(footprintFromConfig({ sizeX: '1', sizeY: '2' })).toEqual({ numTilesX: 1, numTilesY: 2 });
    expect(footprintFromConfig({})).toEqual({ numTilesX: 1, numTilesY: 1 });
  });

  it('rotation swaps axes and coverage is the full rectangle', () => {
    const f = footprintFromConfig({ sizeX: '2', sizeY: '3' });
    expect(rotateFootprint(f)).toEqual({ numTilesX: 3, numTilesY: 2 });
    const tiles = coveredTiles(f, 3, 4);
    expect(tiles).toHaveLength(6);
    expect(tiles[0]).toEqual({ x: 3, y: 4 });
    expect(tiles[5]).toEqual({ x: 4, y: 6 });
  });

  it('anchors at screen(tile) minus height', () => {
    expect(itemScreenPosition(3, 4, 40)).toEqual({ x: (3 - 4) * 40, y: (3 + 4) * 20 - 40 });
  });
});

describe('placement validity (isValid/isItemOutOfBound port)', () => {
  it('rejects out-of-bound open-tile items (walls at x<1 or y<1)', () => {
    const ctx = makeContext();
    const item = { numTilesX: 1, numTilesY: 1 };
    expect(isItemOutOfBound(item, 0, 2, ctx)).toBe(true);
    expect(isItemOutOfBound(item, 2, 0, ctx)).toBe(true);
    expect(isItemOutOfBound(item, 1, 1, ctx)).toBe(false);
    expect(isItemOutOfBound(item, 8, 1, ctx)).toBe(true); // x beyond room
  });

  it('wall items may sit on wall tiles only (0..numTiles bounds)', () => {
    const ctx = makeContext();
    const wall = { numTilesX: 1, numTilesY: 1, wallDecorationItem: true };
    expect(isItemOutOfBound(wall, 0, 0, ctx)).toBe(false);
    expect(isItemOutOfBound(wall, -1, 0, ctx)).toBe(true);
    expect(isValid(wall, 0, 2, ctx)).toBe(true);
    expect(isValid(wall, 3, 3, ctx)).toBe(false); // not on a wall
  });

  it('open tiles reject wall decoration and wallpaper', () => {
    const ctx = makeContext();
    expect(isValid({ numTilesX: 1, numTilesY: 1, wallpaperItem: true }, 3, 3, ctx)).toBe(false);
  });

  it('floor tiles are invalid on wall rows, valid elsewhere', () => {
    const ctx = makeContext();
    const floor = { numTilesX: 1, numTilesY: 1, floorTileItem: true };
    expect(isValid(floor, 0, 3, ctx)).toBe(false);
    expect(isValid(floor, 3, 0, ctx)).toBe(false);
    expect(isValid(floor, 3, 3, ctx)).toBe(true);
  });

  it('outdoor items must be in the outside area (origin tile check)', () => {
    const ctx = makeContext();
    const outdoor = { numTilesX: 1, numTilesY: 1, outdoor: true };
    expect(isValid(outdoor, 3, 3, ctx)).toBe(false); // inside the room
    expect(isValid(outdoor, 3, 8, ctx)).toBe(true); // first outside row
    expect(isValid(outdoor, 9, 8, ctx)).toBe(false); // beyond numOutsideTilesX
  });

  it('multi-tile items respect the outside-area bottom bound', () => {
    const ctx = makeContext();
    const big = { numTilesX: 2, numTilesY: 2 };
    // Interior edge: (6,6) ends at (7,7) — inside the 8x8 room.
    expect(isItemOutOfBound(big, 6, 6, ctx)).toBe(false);
    // Outside zone: (5,8) ends at (6,9) — within 7x6 outside area.
    expect(isItemOutOfBound(big, 5, 8, ctx)).toBe(false);
    // (7,7) ends at (8,8): x2 == numOutsideTilesX -> out.
    expect(isItemOutOfBound(big, 7, 7, ctx)).toBe(true);
    // (7,13) ends at (8,14): y2 == numTilesY + numOutsideTilesY -> out.
    expect(isItemOutOfBound(big, 7, 13, ctx)).toBe(true);
  });

  it('enforces the stack rules (max 5 others, stackable onto surface)', () => {
    const ctx = makeContext();
    const table = { numTilesX: 1, numTilesY: 1, surface: true };
    // Empty tile: fine.
    expect(isValid(table, 3, 3, ctx)).toBe(true);
    // One surface item on the tile: a stackable item is allowed on top.
    const ctxWithSurface: PlacementContext = {
      ...ctx,
      stackAt: () => ({ count: 1, topSurface: true, containsSelf: false, surfaceBelowSelf: false }),
    };
    const stackable = { numTilesX: 1, numTilesY: 1, stackable: true };
    expect(isValid(stackable, 3, 3, ctxWithSurface)).toBe(true);
    // Non-stackable item cannot go on top of a surface.
    const plain = { numTilesX: 1, numTilesY: 1 };
    expect(isValid(plain, 3, 3, ctxWithSurface)).toBe(false);
    // Stackable onto a NON-surface top is rejected.
    const ctxNonSurface: PlacementContext = {
      ...ctx,
      stackAt: () => ({ count: 1, topSurface: false, containsSelf: false, surfaceBelowSelf: false }),
    };
    expect(isValid(stackable, 3, 3, ctxNonSurface)).toBe(false);
    // Five others already there -> full.
    const ctxFull: PlacementContext = {
      ...ctx,
      stackAt: () => ({ count: 5, topSurface: true, containsSelf: false, surfaceBelowSelf: false }),
    };
    expect(isValid(stackable, 3, 3, ctxFull)).toBe(false);
  });

  it('a moved item already in the stack uses the below-self surface and limit 6', () => {
    // count includes self: 4 others + self = 5 -> allowed (limit 6).
    const ctx: PlacementContext = {
      ...makeContext(),
      stackAt: () => ({ count: 5, topSurface: false, containsSelf: true, surfaceBelowSelf: true }),
    };
    const item = { numTilesX: 1, numTilesY: 1, stackable: true };
    expect(isValid(item, 3, 3, ctx)).toBe(true);
    // 5 others + self = 6 -> over the limit even for the self case.
    const ctxFull: PlacementContext = {
      ...makeContext(),
      stackAt: () => ({ count: 6, topSurface: false, containsSelf: true, surfaceBelowSelf: true }),
    };
    expect(isValid(item, 3, 3, ctxFull)).toBe(false);
  });
});
