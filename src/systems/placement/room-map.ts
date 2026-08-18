/**
 * Room placement map — the live tile occupancy model behind the editor.
 * Implements PlacementContext (validity.ts) for the current room.
 *
 * Spec: docs/specs/editor.md §2-3, world.md §3; authoritative = AS3
 * (WorldRestaurant itemMap/wallMap, RoomItem.setTilePosition).
 */
import { MAX_NUM_TILES_X, getTileIndex } from '../../core/iso/math';
import { defaultWallAt, type PlacementContext, type TileStack } from '../../core/items/validity';
import type { Footprint } from '../../core/items/footprint';

export interface PlacedItem extends Footprint {
  readonly id: string;
  readonly configId: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly rotation: number;
  readonly height: number;
  /** Economy values carried from the item config (sell price). */
  readonly cost: number;
  readonly cash: number;
  readonly surface: boolean;
  readonly stackable: boolean;
  readonly wallDecorationItem?: boolean;
  readonly wallpaperItem?: boolean;
  readonly floorTileItem?: boolean;
  readonly outdoor?: boolean;
  readonly wallItem?: boolean;
}

export interface RoomSize {
  readonly numTilesX: number;
  readonly numTilesY: number;
  readonly numOutsideTilesX: number;
  readonly numOutsideTilesY: number;
}

export class RoomMap {
  private readonly items = new Map<string, PlacedItem>();
  private readonly tiles = new Map<number, PlacedItem[]>();

  constructor(public readonly size: RoomSize) {}

  private tileKey(x: number, y: number): number {
    return getTileIndex(x, y);
  }

  wallAt(x: number, y: number): boolean {
    return defaultWallAt(x, y);
  }

  /** Items covering a tile, bottom-most first. */
  itemsAt(x: number, y: number): readonly PlacedItem[] {
    return this.tiles.get(this.tileKey(x, y)) ?? [];
  }

  /** Stack view for validity checks, optionally ignoring `selfId`. */
  stackAt(x: number, y: number, selfId?: string): TileStack {
    const stack = (this.tiles.get(this.tileKey(x, y)) ?? []).filter((i) => i.id !== selfId);
    const top = stack[stack.length - 1];
    const full = this.tiles.get(this.tileKey(x, y)) ?? [];
    const containsSelf = selfId !== undefined && full.some((i) => i.id === selfId);
    const withoutSelf = full.filter((i) => i.id !== selfId);
    const belowSelf = withoutSelf[withoutSelf.length - 1];
    return {
      count: full.length,
      topSurface: top?.surface ?? false,
      containsSelf,
      surfaceBelowSelf: belowSelf?.surface ?? false,
    };
  }

  context(selfId?: string): PlacementContext {
    const { size } = this;
    return {
      numTilesX: size.numTilesX,
      numTilesY: size.numTilesY,
      numOutsideTilesX: size.numOutsideTilesX,
      numOutsideTilesY: size.numOutsideTilesY,
      wallAt: (x, y) => this.wallAt(x, y),
      stackAt: (x, y) => this.stackAt(x, y, selfId),
    };
  }

  get(id: string): PlacedItem | undefined {
    return this.items.get(id);
  }

  all(): readonly PlacedItem[] {
    return [...this.items.values()];
  }

  /** Places (or re-places) an item, registering every covered tile. */
  place(item: PlacedItem): void {
    this.remove(item.id);
    this.items.set(item.id, item);
    for (let dx = 0; dx < item.numTilesX; dx += 1) {
      for (let dy = 0; dy < item.numTilesY; dy += 1) {
        const key = this.tileKey(item.tileX + dx, item.tileY + dy);
        const stack = this.tiles.get(key) ?? [];
        stack.push(item);
        this.tiles.set(key, stack);
      }
    }
  }

  remove(id: string): PlacedItem | undefined {
    const item = this.items.get(id);
    if (!item) {
      return undefined;
    }
    this.items.delete(id);
    for (let dx = 0; dx < item.numTilesX; dx += 1) {
      for (let dy = 0; dy < item.numTilesY; dy += 1) {
        const key = this.tileKey(item.tileX + dx, item.tileY + dy);
        const stack = (this.tiles.get(key) ?? []).filter((i) => i.id !== id);
        if (stack.length === 0) {
          this.tiles.delete(key);
        } else {
          this.tiles.set(key, stack);
        }
      }
    }
    return item;
  }

  clear(): void {
    this.items.clear();
    this.tiles.clear();
  }
}

export const MAX_TILES_STRIDE = MAX_NUM_TILES_X;
