/**
 * Item footprint & anchor model — port of RoomItem constructor math
 * (L180-199, L192-247) and setTilePosition (L544-560).
 *
 * Spec: client-html5/docs/specs/editor.md §2; authoritative = AS3.
 *
 * The item data carries `sizeX`/`sizeY` (tiles); when absent the original
 * derived the footprint from the art bounds — the rebuild always uses the
 * data attributes (1x1 fallback).
 */
import { TILE_HEIGHT, TILE_WIDTH_HALF, getScreenX, getScreenY } from '../iso/math';

export interface Footprint {
  readonly numTilesX: number;
  readonly numTilesY: number;
}

export function footprintFromConfig(config: Record<string, unknown> | null | undefined): Footprint {
  const sx = config && config.sizeX !== undefined && config.sizeX !== null ? Number(config.sizeX) : NaN;
  const sy = config && config.sizeY !== undefined && config.sizeY !== null ? Number(config.sizeY) : NaN;
  return {
    numTilesX: Number.isFinite(sx) && sx >= 1 ? Math.round(sx) : 1,
    numTilesY: Number.isFinite(sy) && sy >= 1 ? Math.round(sy) : 1,
  };
}

/** Rotation swaps the footprint axes (RoomItem.rotate L425-500). */
export function rotateFootprint(f: Footprint): Footprint {
  return { numTilesX: f.numTilesY, numTilesY: f.numTilesX };
}

/** Tiles covered by an item placed at origin (tileX, tileY). */
export function coveredTiles(
  f: Footprint,
  tileX: number,
  tileY: number,
): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < f.numTilesX; dx += 1) {
    for (let dy = 0; dy < f.numTilesY; dy += 1) {
      tiles.push({ x: tileX + dx, y: tileY + dy });
    }
  }
  return tiles;
}

/**
 * Screen anchor of an item at its origin tile (RoomItem.setTilePosition):
 * x = screenX(tile), y = screenY(tile) - curHeight.
 */
export function itemScreenPosition(tileX: number, tileY: number, curHeight = 0): { x: number; y: number } {
  return { x: getScreenX(tileX, tileY), y: getScreenY(tileX, tileY) - curHeight };
}

/**
 * Visual item height in px (RoomItem L194):
 * itemHeight = -bounds.top + (tileHeight * numTilesY - bounds.bottom).
 * The rebuild does not have art bounds, so height is derived from the
 * footprint: tileHeight * numTilesY (documented deviation — revisit when
 * per-item bounds come from the atlas pipeline).
 */
export function itemVisualHeight(f: Footprint): number {
  return TILE_HEIGHT * f.numTilesY;
}

/** Half-width used by some placements (mirrors tileWidthHalf constant). */
export const ITEM_TILE_WIDTH_HALF = TILE_WIDTH_HALF;
