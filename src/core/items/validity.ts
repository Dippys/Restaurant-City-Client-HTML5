/**
 * Placement validity — port of WorldRestaurant.isValid (L1691-1799) and
 * isItemOutOfBound (L1801-1827).
 *
 * Spec: client-html5/docs/specs/editor.md §3; authoritative = AS3.
 * Wall tiles' item counts INCLUDE the wall itself (so a bare wall tile
 * has count 1 in the original's itemMap; the port models the wall
 * separately and stacks only non-wall items — see TileStack.count).
 */
import { isTileInOutsideArea } from '../iso/math';
import { coveredTiles, type Footprint } from './footprint';

export interface ItemPlacementFlags {
  readonly wallItem?: boolean;
  readonly wallDecorationItem?: boolean;
  readonly wallpaperItem?: boolean;
  readonly floorTileItem?: boolean;
  readonly outdoor?: boolean;
  readonly stackable?: boolean;
  readonly surface?: boolean;
}

export interface TileStack {
  /** Non-wall items on the tile (the wall is not counted here). */
  readonly count: number;
  /** Whether the top item is a surface (stack target). */
  readonly topSurface: boolean;
  /** Whether the item being placed is already in this tile's stack. */
  readonly containsSelf: boolean;
  /** When containsSelf: the surface flag of the item below the self. */
  readonly surfaceBelowSelf: boolean;
}

export interface PlacementContext {
  readonly numTilesX: number;
  readonly numTilesY: number;
  readonly numOutsideTilesX: number;
  readonly numOutsideTilesY: number;
  readonly wallAt: (x: number, y: number) => boolean;
  readonly stackAt: (x: number, y: number) => TileStack;
}

export interface PlacementItem extends Footprint, ItemPlacementFlags {}

/** WorldRestaurant.isItemOutOfBound (L1801-1827). */
export function isItemOutOfBound(item: PlacementItem, x: number, y: number, ctx: PlacementContext): boolean {
  if (item.wallItem || item.wallDecorationItem || item.wallpaperItem) {
    return !(x >= 0 && y >= 0 && x < ctx.numTilesX && y < ctx.numTilesY);
  }
  if (x < 1 || y < 1) {
    return true;
  }
  const x2 = x + item.numTilesX - 1;
  const y2 = y + item.numTilesY - 1;
  if (y2 >= ctx.numTilesY) {
    // Bottom row reaches into the outside-area zone.
    if (x2 >= ctx.numOutsideTilesX || y2 >= ctx.numTilesY + ctx.numOutsideTilesY) {
      return true;
    }
  } else if (x2 >= ctx.numTilesX || y2 >= ctx.numTilesY) {
    return true;
  }
  return false;
}

/** WorldRestaurant.isValid (L1691-1799). */
export function isValid(item: PlacementItem, x: number, y: number, ctx: PlacementContext): boolean {
  // Decoration-only grid (0x0 footprint) is always valid.
  if (item.numTilesX === 0 && item.numTilesY === 0) {
    return true;
  }
  if (isItemOutOfBound(item, x, y, ctx)) {
    return false;
  }
  if (item.outdoor && !isTileInOutsideArea(x, y, ctx.numTilesY, ctx.numOutsideTilesX)) {
    return false;
  }
  if (item.floorTileItem) {
    return !(x === 0 || y === 0); // wall rows can't be floor tiles
  }
  if (item.wallDecorationItem) {
    for (const t of coveredTiles(item, x, y)) {
      if (!ctx.wallAt(t.x, t.y) || ctx.stackAt(t.x, t.y).count > 0) {
        return false;
      }
    }
    return true;
  }
  if (ctx.wallAt(x, y)) {
    if (!(item.wallDecorationItem || item.wallpaperItem)) {
      return false;
    }
    if (item.wallDecorationItem && ctx.stackAt(x, y).count > 0) {
      return false;
    }
  } else {
    if (item.wallDecorationItem || item.wallpaperItem) {
      return false;
    }
    for (const t of coveredTiles(item, x, y)) {
      const stack = ctx.stackAt(t.x, t.y);
      // The AS3 allows the moved item itself as the top of the stack
      // (limit becomes 6) and looks at the item BELOW it as the surface.
      let limit = 5;
      if (stack.containsSelf) {
        limit += 1;
      }
      const topCount = stack.containsSelf ? stack.count - 1 : stack.count;
      const topSurface = stack.containsSelf ? stack.surfaceBelowSelf : stack.topSurface;
      if (topCount > 0 && (!item.stackable || !topSurface)) {
        return false;
      }
      if (stack.count > limit - 1) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Default wall map: walls run along the top (y==0) and left (x==0) edges
 * including the corner (WorldRestaurant.addDefaultWalls L979-1021).
 */
export function defaultWallAt(x: number, y: number): boolean {
  return x === 0 || y === 0;
}
