/**
 * Editor state machine — port of WorldRestaurantEditor flows
 * (docs/specs/editor.md §4, §6; authoritative = AS3).
 *
 * Pure logic: the scene feeds pointer events and economy callbacks; the
 * state machine calls the AuditSink, which the save layer implements with
 * saveProfile audit records (rpc-profile spec).
 */
import { isValid } from '../../core/items/validity';
import { rotateFootprint, type Footprint } from '../../core/items/footprint';
import { getItemSellPrice, GOURMET_POINTS_SELL_ITEM } from '../../core/items/types';
import { RoomMap, type PlacedItem } from './room-map';

export type EditorPhase = 'idle' | 'picking' | 'committing';

export interface ItemFlags {
  readonly numTilesX: number;
  readonly numTilesY: number;
  readonly surface: boolean;
  readonly stackable: boolean;
  readonly wallDecorationItem?: boolean;
  readonly wallpaperItem?: boolean;
  readonly floorTileItem?: boolean;
  readonly outdoor?: boolean;
  readonly wallItem?: boolean;
}

export interface ItemTemplate {
  readonly configId: string;
  readonly cost: number;
  readonly cash: number;
  readonly flags: ItemFlags;
}

export interface EditorDeps {
  /** Economy gate: can the player afford this item at their level? */
  canBuy: (template: ItemTemplate) => boolean;
  /** Deduct coins on purchase (false aborts the placement). */
  spendCoins: (amount: number) => boolean;
  /** Called with the sell credits (coins + gourmet). */
  creditSell: (coins: number, gourmet: number) => void;
  audit: AuditSink;
}

export interface AuditSink {
  addChangedItem(itemId: string, fromInventory: boolean): void;
  addSoldItem(itemId: string, count: number): void;
  addBoughtItem(itemId: string): void;
  saveFloor(roomIndex: number): void;
  moveAllInGameItemsToInventory(roomIndex: number): void;
  hasItemsChanged(): boolean;
}

export interface PickedItem {
  readonly id: string;
  readonly template: ItemTemplate;
  readonly fromInventory: boolean;
  readonly owned: boolean;
  tileX: number;
  tileY: number;
  rotation: number;
  height: number;
  valid: boolean;
  paid: boolean;
}

export class EditorState {
  phase: EditorPhase = 'idle';
  picked: PickedItem | null = null;
  private nextId = 1;

  constructor(
    public readonly roomMap: RoomMap,
    private readonly deps: EditorDeps,
    public readonly roomIndex = 0,
  ) {}

  /** Buy/pick: starts dragging an item (inventory item or fresh template). */
  pick(template: ItemTemplate, fromInventory: boolean, owned: boolean): boolean {
    if (this.phase === 'committing') {
      return false;
    }
    if (!owned && !this.deps.canBuy(template)) {
      return false;
    }
    const picked: PickedItem = {
      id: `picked-${this.nextId++}`,
      template,
      fromInventory,
      owned,
      tileX: 1,
      tileY: 1,
      rotation: 0,
      height: 0,
      valid: false,
      paid: false,
    };
    this.picked = picked;
    this.phase = 'picking';
    return true;
  }

  /** Updates the hover position + validity (returns the candidate state). */
  hover(tileX: number, tileY: number): PickedItem | null {
    if (!this.picked || this.phase !== 'picking') {
      return null;
    }
    const p = this.picked;
    p.tileX = tileX;
    p.tileY = tileY;
    p.valid = this.isPickedValid(p);
    return p;
  }

  private isPickedValid(p: PickedItem): boolean {
    const footprint = this.footprintOf(p);
    const flags = { ...p.template.flags, ...footprint };
    return isValid(flags, p.tileX, p.tileY, this.roomMap.context(p.id));
  }

  private footprintOf(p: PickedItem): Footprint {
    const base: Footprint = {
      numTilesX: p.template.flags.numTilesX,
      numTilesY: p.template.flags.numTilesY,
    };
    return p.rotation % 2 === 1 ? rotateFootprint(base) : base;
  }

  /** Commits the hovered item on a valid tile (buy + audit). */
  place(): PlacedItem | null {
    const p = this.picked;
    if (!p || this.phase !== 'picking' || !p.valid) {
      return null;
    }
    if (!p.owned && !p.paid) {
      if (p.template.cash > 0) {
        return null; // cash items require the confirm popup flow (scene layer)
      }
      if (!this.deps.spendCoins(p.template.cost)) {
        return null;
      }
      p.paid = true;
      this.deps.audit.addBoughtItem(p.template.configId);
    }
    const footprint = this.footprintOf(p);
    const placed: PlacedItem = {
      id: p.id,
      configId: p.template.configId,
      tileX: p.tileX,
      tileY: p.tileY,
      rotation: p.rotation,
      height: p.height,
      cost: p.template.cost,
      cash: p.template.cash,
      numTilesX: footprint.numTilesX,
      numTilesY: footprint.numTilesY,
      surface: p.template.flags.surface,
      stackable: p.template.flags.stackable,
      wallDecorationItem: p.template.flags.wallDecorationItem,
      wallpaperItem: p.template.flags.wallpaperItem,
      floorTileItem: p.template.flags.floorTileItem,
      outdoor: p.template.flags.outdoor,
      wallItem: p.template.flags.wallItem,
    };
    this.roomMap.place(placed);
    this.deps.audit.addChangedItem(placed.id, p.fromInventory);
    this.picked = null;
    this.phase = 'idle';
    return placed;
  }

  /** Move: lifts a placed item back into the cursor (editor.md §Move). */
  move(itemId: string): PickedItem | null {
    if (this.phase === 'committing') {
      return null;
    }
    const item = this.roomMap.get(itemId);
    if (!item) {
      return null;
    }
    this.roomMap.remove(itemId);
    const picked: PickedItem = {
      id: item.id,
      template: this.templateFrom(item),
      fromInventory: false,
      owned: true,
      tileX: item.tileX,
      tileY: item.tileY,
      rotation: item.rotation,
      height: item.height,
      valid: false,
      paid: false,
    };
    this.picked = picked;
    this.phase = 'picking';
    return picked;
  }

  private templateFrom(item: PlacedItem): ItemTemplate {
    return {
      configId: item.configId,
      cost: item.cost,
      cash: item.cash,
      flags: {
        numTilesX: item.numTilesX,
        numTilesY: item.numTilesY,
        surface: item.surface,
        stackable: item.stackable,
        wallDecorationItem: item.wallDecorationItem,
        wallpaperItem: item.wallpaperItem,
        floorTileItem: item.floorTileItem,
        outdoor: item.outdoor,
        wallItem: item.wallItem,
      },
    };
  }

  rotate(): PickedItem | null {
    if (!this.picked || this.phase !== 'picking') {
      return null;
    }
    this.picked.rotation = (this.picked.rotation + 1) % 4;
    this.picked.valid = this.isPickedValid(this.picked);
    return this.picked;
  }

  cancel(): void {
    this.picked = null;
    this.phase = 'idle';
  }

  /** Sell: inventory + credits (editor.md §Sell). */
  sell(itemId: string, count = 1): boolean {
    const item = this.roomMap.get(itemId);
    if (!item || this.phase === 'committing') {
      return false;
    }
    const template = this.templateFrom(item);
    const price = getItemSellPrice({ cash: template.cash, cost: template.cost });
    this.deps.creditSell(price * count, GOURMET_POINTS_SELL_ITEM * count);
    this.deps.audit.addSoldItem(item.configId, count);
    this.roomMap.remove(itemId);
    return true;
  }

  /** Play button: only commits when something changed (editor.md §6). */
  commit(): boolean {
    if (this.deps.audit.hasItemsChanged()) {
      this.phase = 'committing';
      return true;
    }
    return false;
  }

  commitFinished(): void {
    this.phase = 'idle';
  }
}

/**
 * Autosave cadence — GameWorld.tick L2750-2767, constants L833-837.
 * Active: every 60s; inactive: every 300s; inactivity threshold 60s.
 */
export const GLOBAL_RPC_COMMIT_INTERVAL = 60000;
export const GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE = 300000;
export const INACTIVE_TIME = 60000;

export class AutosaveTimer {
  private elapsed = 0;
  private inactive = 0;
  private paused = false;

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.elapsed = 0;
  }

  /** Advance by dtMs; returns true when an autosave commit should fire. */
  tick(dtMs: number, active: boolean): boolean {
    if (this.paused) {
      return false;
    }
    this.elapsed += dtMs;
    this.inactive = active ? 0 : this.inactive + dtMs;
    const interval = this.inactive >= INACTIVE_TIME ? GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE : GLOBAL_RPC_COMMIT_INTERVAL;
    if (this.elapsed >= interval) {
      this.elapsed = 0;
      return true;
    }
    return false;
  }
}
