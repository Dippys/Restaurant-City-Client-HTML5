/**
 * Isometric tile math — port of WorldRestaurant.as constants and helpers.
 *
 * Spec: decompiled/game/scripts/com/playfish/games/cooking/WorldRestaurant.as
 * (L128-168, L292-310, L355-383, L874-877) and
 * client-html5/docs/specs/world.md (derived, authoritative = AS3).
 *
 * Tiles are diamonds 80x40 (2:1): tile (0,0) is the north-west corner.
 *   screenX(x,y) = (x - y) * 40
 *   screenY(x,y) = (x + y) * 20
 * Depth key = (y * MAX_NUM_TILES_X + x) * 256 + heightInPx.
 */
export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 40;
export const TILE_WIDTH_HALF = TILE_WIDTH / 2; // 40
export const TILE_HEIGHT_HALF = TILE_HEIGHT / 2; // 20
export const MAX_NUM_TILES_X = 20;
export const MAX_NUM_TILES_Y = 40;

/** Room index constants (WorldRestaurant.as L142-144). */
export const ROOM_INDEX_MAIN = 0;
export const ROOM_INDEX_OUTSIDE_AREA = 1;

/** Draw priority constants (WorldRestaurant.as L132-136). */
export const SHADOW_DRAW_PRIORITY = -1000000;
export const FLOOR_DRAW_PRIORITY = -1000002;
export const SCORE_POPUP_PRIORITY = 1000000;

/** WorldRestaurant.as L292-295. */
export function getScreenX(tileX: number, tileY: number): number {
  return (tileX - tileY) * TILE_WIDTH_HALF;
}

/** WorldRestaurant.as L380-383. */
export function getScreenY(tileX: number, tileY: number): number {
  return (tileX + tileY) * TILE_HEIGHT_HALF;
}

/** WorldRestaurant.as L302-305: flat index used by the priority. */
export function getTileIndex(tileX: number, tileY: number): number {
  return tileY * MAX_NUM_TILES_X + tileX;
}

/** WorldRestaurant.as L297-300: painter's-order key. */
export function getTileDrawPriority(tileX: number, tileY: number): number {
  return getTileIndex(tileX, tileY) << 8;
}

/** WorldRestaurant.as L355-358. */
export function getTileXFromTileIndex(index: number): number {
  return index % MAX_NUM_TILES_X;
}

/** WorldRestaurant.as L360-363. */
export function getTileYFromTileIndex(index: number): number {
  return Math.floor(index / MAX_NUM_TILES_X);
}

/** WorldRestaurant.as L307-310: screen (room-local) -> tile column. */
export function getTileIndexX(screenX: number, screenY: number): number {
  return (screenX + 2 * screenY) / TILE_WIDTH;
}

/** WorldRestaurant.as L365-368: screen (room-local) -> tile row. */
export function getTileIndexY(screenX: number, screenY: number): number {
  return (2 * screenY - screenX) / (2 * TILE_HEIGHT);
}

/** WorldRestaurant.as L874-877: outside area zone predicate. */
export function isTileInOutsideArea(tileX: number, tileY: number, numTilesY: number, numOutsideTilesX: number): boolean {
  return tileY >= numTilesY && tileX < numOutsideTilesX;
}

/**
 * Floor layer geometry (WorldRestaurant.setRoomSize L1843-1895,
 * createFloorTileLayer L1285-1293): the floor bitmap spans
 * (w+h)*TILE_WIDTH_HALF x (w+h)*TILE_HEIGHT_HALF and is anchored at
 * screen position (-numTilesY * TILE_WIDTH_HALF, 0) inside the room,
 * whose own origin sits at (canvasWidth/2, TILE_HEIGHT*2).
 */
export interface FloorGeometry {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

export function floorGeometry(numTilesX: number, numTilesY: number): FloorGeometry {
  return {
    width: (numTilesX + numTilesY) * TILE_WIDTH_HALF,
    height: (numTilesX + numTilesY) * TILE_HEIGHT_HALF,
    x: -numTilesY * TILE_WIDTH_HALF,
    y: 0,
  };
}

/** Room origin (WorldRestaurant.init L520-521). */
export const ROOM_ORIGIN_X = 380; // canvasWidth / 2
export const ROOM_ORIGIN_Y = 80; // TILE_HEIGHT * 2

/** Main floor fill colour (WorldRestaurant.fillBaseArea L1244-1252). */
export const FLOOR_COLOUR = 15132390;
/** Room background fill (WorldRestaurant.init L457-461). */
export const ROOM_BACKGROUND_COLOUR = 11788396;

/** Outdoor area anchor (WorldRestaurant.init L730-731): outside floor sits
 *  at screenX(0, numTilesY) minus numOutsideTilesY*TILE_WIDTH_HALF. */
export function outsideAreaOrigin(numTilesY: number, numOutsideTilesY: number): { x: number; y: number } {
  return {
    x: getScreenX(0, numTilesY) - numOutsideTilesY * TILE_WIDTH_HALF,
    y: getScreenY(0, numTilesY),
  };
}

/** Garden plot block anchor (WorldRestaurant.init L138-140, L503-510). */
export const GARDEN_TILE_X = 3;
export const GARDEN_TILE_Y = -9;

/** Garden plot i (0..8) layout: every plot is 2x2 tiles apart. */
export function gardenPlotTile(i: number): { x: number; y: number } {
  return {
    x: GARDEN_TILE_X + Math.floor(i / 3) * 2,
    y: GARDEN_TILE_Y + 4 - (i % 3) * 2,
  };
}

/** Billboard tile anchor (WorldRestaurant.setRoomSize L1869). */
export function billboardTile(numTilesY: number): { x: number; y: number } {
  return { x: -4, y: numTilesY };
}
