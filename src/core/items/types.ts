/**
 * Item type helpers — port of GameWorld.getItemType (L1401-1404) and
 * GameUser constants (L63-81).
 *
 * Spec: client-html5/docs/specs/editor.md §1; authoritative = AS3.
 */

export const ITEM_TYPE_AVATAR = 1;
export const ITEM_TYPE_BUILDING = 2;
export const ITEM_TYPE_RESTAURANT = 3;
export const ITEM_TYPE_INGREDIENT = 4;
export const ITEM_TYPE_RECIPE = 5;
export const ITEM_TYPE_PERK = 6;

/** Interior sub-types via id/10000 (GameUser.as L75-81, L1095-1115). */
export const RESTAURANT_ITEM_TYPE_MUSIC = 360;
export const RESTAURANT_ITEM_TYPE_OUTSIDE_AREA_SIZE = 390;
export const RESTAURANT_ITEM_TYPE_DELIVERY_BIKE = 391;

/** Integer item type from a numeric id string (GameWorld.as L1401-1404). */
export function getItemType(id: number | string): number {
  return Math.floor(Number(id) / 1000000);
}

/** Interior sub-type (id / 10000) — only meaningful for restaurant items. */
export function getRestaurantSubType(id: number | string): number {
  return Math.floor(Number(id) / 10000);
}

/**
 * Sell price rule — GameWorld.as L2604-2611:
 * cash items sell for cash*330; coin items for floor(cost/3).
 */
export function getItemSellPrice(config: { cash?: number | string | boolean; cost?: number | string }): number {
  const cash = typeof config.cash === 'number' ? config.cash : Number(config.cash ?? 0);
  if (cash > 0) {
    return cash * 330;
  }
  const cost = typeof config.cost === 'number' ? config.cost : Number(config.cost ?? 0);
  return Math.floor(cost / 3);
}

/** Gourmet points per sold item (GameWorld.GOURMET_POINTS_SELL_ITEM). */
export const GOURMET_POINTS_SELL_ITEM = 2;

/**
 * Rotation/usage packing (RoomItem.getUserItem L763-771, setUserItem
 * L338-348): data = rotation | usageCount<<4; both 4-bit fields.
 */
export function packRotationData(rotation: number, usageCount: number): number {
  return (rotation & 0x0f) | ((usageCount & 0x0f) << 4);
}

export function rotationFromData(data: number): number {
  return data & 0x0f;
}

export function usageCountFromData(data: number): number {
  return (data & 0xf0) >> 4;
}

/** Actor facing remap (WorldRestaurant.as L170, L375-378). */
export const ITEM_ROTATION_TO_ACTOR_DIRECTION_MAP = [1, 7, 5, 3] as const;
