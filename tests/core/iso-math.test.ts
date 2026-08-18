import { describe, expect, it } from 'vitest';
import {
  FLOOR_COLOUR,
  FLOOR_DRAW_PRIORITY,
  GARDEN_TILE_X,
  GARDEN_TILE_Y,
  MAX_NUM_TILES_X,
  ROOM_ORIGIN_X,
  ROOM_ORIGIN_Y,
  TILE_HEIGHT,
  TILE_WIDTH,
  billboardTile,
  floorGeometry,
  gardenPlotTile,
  getScreenX,
  getScreenY,
  getTileDrawPriority,
  getTileIndex,
  getTileIndexX,
  getTileIndexY,
  getTileXFromTileIndex,
  getTileYFromTileIndex,
  isTileInOutsideArea,
  outsideAreaOrigin,
} from '../../src/core/iso/math';

describe('iso math (WorldRestaurant.as port)', () => {
  it('constants match the AS3', () => {
    expect(TILE_WIDTH).toBe(80);
    expect(TILE_HEIGHT).toBe(40);
    expect(MAX_NUM_TILES_X).toBe(20);
    expect(ROOM_ORIGIN_X).toBe(380);
    expect(ROOM_ORIGIN_Y).toBe(80);
    expect(FLOOR_COLOUR).toBe(15132390);
    expect(FLOOR_DRAW_PRIORITY).toBe(-1000002);
  });

  it('projects tiles to screen with the 2:1 formula', () => {
    expect(getScreenX(0, 0)).toBe(0);
    expect(getScreenY(0, 0)).toBe(0);
    expect(getScreenX(1, 0)).toBe(40);
    expect(getScreenY(1, 0)).toBe(20);
    expect(getScreenX(0, 1)).toBe(-40);
    expect(getScreenY(0, 1)).toBe(20);
    // Center of an 8x8 room: tile (4,4) -> (0, 160).
    expect(getScreenX(4, 4)).toBe(0);
    expect(getScreenY(4, 4)).toBe(160);
  });

  it('screen->tile inverts the projection (exact for tile centers)', () => {
    for (const [x, y] of [
      [0, 0],
      [3, 5],
      [7, 7],
      [12, 2],
      [19, 19],
    ]) {
      const sx = getScreenX(x, y);
      const sy = getScreenY(x, y);
      // The inverse maps tile CENTERS; integer-divide to recover the tile.
      expect(Math.floor(getTileIndexX(sx, sy))).toBe(x);
      expect(Math.floor(getTileIndexY(sx, sy))).toBe(y);
    }
  });

  it('depth priority sorts by row, then column, then height', () => {
    // (y*20+x)*256 — row dominates, column next.
    expect(getTileDrawPriority(0, 1)).toBeGreaterThan(getTileDrawPriority(19, 0));
    expect(getTileDrawPriority(1, 0)).toBe(getTileDrawPriority(0, 0) + 256);
    expect(getTileDrawPriority(0, 0) + 255).toBeLessThan(getTileDrawPriority(1, 0));
    // Round-trip through the flat index helpers.
    for (const [x, y] of [
      [0, 0],
      [19, 39],
      [7, 13],
    ]) {
      const idx = getTileIndex(x, y);
      expect(getTileXFromTileIndex(idx)).toBe(x);
      expect(getTileYFromTileIndex(idx)).toBe(y);
    }
  });

  it('floor geometry matches setRoomSize', () => {
    const g = floorGeometry(8, 8);
    expect(g.width).toBe(16 * 40);
    expect(g.height).toBe(16 * 20);
    expect(g.x).toBe(-8 * 40);
    expect(g.y).toBe(0);
  });

  it('outside area predicates and anchors match', () => {
    expect(isTileInOutsideArea(0, 8, 8, 7)).toBe(true);
    expect(isTileInOutsideArea(7, 8, 8, 7)).toBe(false); // x >= numOutsideTilesX
    expect(isTileInOutsideArea(1, 7, 8, 7)).toBe(false); // above the room
    const anchor = outsideAreaOrigin(8, 7);
    expect(anchor).toEqual({ x: getScreenX(0, 8) - 7 * 40, y: getScreenY(0, 8) });
  });

  it('garden plots form a 3x3 block 2 tiles apart (init layout)', () => {
    const plots = Array.from({ length: 9 }, (_, i) => gardenPlotTile(i));
    expect(plots[0]).toEqual({ x: GARDEN_TILE_X, y: GARDEN_TILE_Y + 4 });
    expect(plots[8]).toEqual({ x: GARDEN_TILE_X + 4, y: GARDEN_TILE_Y + 0 });
    const xs = new Set(plots.map((p) => p.x));
    const ys = new Set(plots.map((p) => p.y));
    expect(xs.size).toBe(3);
    expect(ys.size).toBe(3);
  });

  it('billboard anchors at tile (-4, numTilesY)', () => {
    expect(billboardTile(8)).toEqual({ x: -4, y: 8 });
  });
});
