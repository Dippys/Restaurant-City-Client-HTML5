/**
 * Item draw-priority assignment — port of WorldRestaurant.placeRoomItem
 * (L1353-1375) and the rotate sub-item rule (L434-443).
 *
 * Spec: client-html5/docs/specs/world.md §5; authoritative = AS3.
 */
import { FLOOR_DRAW_PRIORITY, SHADOW_DRAW_PRIORITY, getTileDrawPriority } from './math';

export type PlacedItemKind = 'floor' | 'door' | 'wall-decoration' | 'item';

export interface PlacedItemInput {
  readonly tileX: number;
  readonly tileY: number;
  /** Door rotation, 0 = the special case (AS3: rotation 0 vs other). */
  readonly rotation?: number;
  /** Stack height (number of items underneath) — RoomItem.curHeight. */
  readonly curHeight?: number;
  /** Full grid width used by wall-decoration anchoring. */
  readonly fullGridSizeX?: number;
}

/**
 * Priority for a placed room item.
 * - floor tile  -> FLOOR_DRAW_PRIORITY
 * - door rot 0  -> tileDrawPriority(tileX+1, tileY) - 1
 * - door other  -> tileDrawPriority(tileX-1, tileY+1)
 * - wall deco   -> tileDrawPriority(tileX + fullGridSizeX - 1, tileY)
 * - other       -> tileDrawPriority(tileX, tileY) + curHeight
 */
export function itemDrawPriority(kind: PlacedItemKind, item: PlacedItemInput): number {
  const h = item.curHeight ?? 0;
  switch (kind) {
    case 'floor':
      return FLOOR_DRAW_PRIORITY;
    case 'door':
      return item.rotation === 0
        ? getTileDrawPriority(item.tileX + 1, item.tileY) - 1
        : getTileDrawPriority(item.tileX - 1, item.tileY + 1);
    case 'wall-decoration':
      return getTileDrawPriority(item.tileX + (item.fullGridSizeX ?? 0) - 1, item.tileY);
    case 'item':
      return getTileDrawPriority(item.tileX, item.tileY) + h;
  }
}

export function shadowDrawPriority(): number {
  return SHADOW_DRAW_PRIORITY;
}

/**
 * Sorts drawable entries by ascending priority, stable (AS3 addObject
 * keeps insertion order for equal priorities).
 */
export function sortByDrawPriority<T extends { readonly drawPriority: number }>(
  entries: readonly T[],
): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.drawPriority - b.entry.drawPriority || a.index - b.index)
    .map(({ entry }) => entry);
}
