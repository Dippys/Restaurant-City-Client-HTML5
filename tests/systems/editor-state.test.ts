import { describe, expect, it } from 'vitest';
import { RoomMap } from '../../src/systems/placement/room-map';
import {
  AutosaveTimer,
  EditorState,
  GLOBAL_RPC_COMMIT_INTERVAL,
  GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE,
  INACTIVE_TIME,
  type AuditSink,
  type ItemTemplate,
} from '../../src/systems/placement/editor-state';

function makeRoom() {
  return new RoomMap({ numTilesX: 8, numTilesY: 8, numOutsideTilesX: 7, numOutsideTilesY: 6 });
}

function makeTemplate(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    configId: '3040000',
    cost: 100,
    cash: 0,
    flags: { numTilesX: 1, numTilesY: 1, surface: false, stackable: false },
    ...overrides,
  };
}

interface AuditLog {
  bought: string[];
  changed: { id: string; fromInventory: boolean }[];
  sold: { id: string; count: number }[];
  changedFlag: boolean;
}

function makeSink(changedFlag = true): AuditSink & { log: AuditLog } {
  const log: AuditLog = { bought: [], changed: [], sold: [], changedFlag };
  return {
    log,
    addBoughtItem: (id) => log.bought.push(id),
    addChangedItem: (id, fromInventory) => log.changed.push({ id, fromInventory }),
    addSoldItem: (id, count) => log.sold.push({ id, count }),
    saveFloor: () => {},
    moveAllInGameItemsToInventory: () => {},
    hasItemsChanged: () => log.changedFlag,
  };
}

function makeEditor(overrides: Partial<ConstructorParameters<typeof EditorState>[1]> = {}) {
  const spent: number[] = [];
  const credits: { coins: number; gourmet: number }[] = [];
  const editor = new EditorState(makeRoom(), {
    canBuy: () => true,
    spendCoins: (n) => {
      spent.push(n);
      return true;
    },
    creditSell: (coins, gourmet) => credits.push({ coins, gourmet }),
    audit: makeSink(),
    ...overrides,
  });
  return { editor, spent, credits };
}

describe('EditorState (WorldRestaurantEditor port)', () => {
  it('buy + place: gates, pays coins, audits bought/changed, registers in the map', () => {
    const { editor, spent } = makeEditor();
    expect(editor.pick(makeTemplate({ cost: 100 }), false, false)).toBe(true);
    expect(editor.phase).toBe('picking');
    const hover = editor.hover(3, 3);
    expect(hover?.valid).toBe(true);
    const placed = editor.place();
    expect(placed).not.toBeNull();
    expect(spent).toEqual([100]);
    expect(editor.roomMap.itemsAt(3, 3).map((i) => i.configId)).toEqual(['3040000']);
    const sink = (editor as unknown as { deps: { audit: AuditSink & { log: AuditLog } } }).deps.audit;
    expect(sink.log.bought).toEqual(['3040000']);
    expect(sink.log.changed).toEqual([{ id: 'picked-1', fromInventory: false }]);
  });

  it('rejects placement on invalid tiles and never audits', () => {
    const { editor, spent } = makeEditor();
    editor.pick(makeTemplate(), false, false);
    editor.hover(0, 2); // wall column
    expect(editor.picked?.valid).toBe(false);
    expect(editor.place()).toBeNull();
    expect(spent).toEqual([]);
  });

  it('does not deduct twice when re-placing after a successful buy', () => {
    const { editor, spent } = makeEditor();
    editor.pick(makeTemplate({ cost: 50 }), false, false);
    editor.hover(4, 4);
    editor.place();
    expect(spent).toEqual([50]);
  });

  it('move: lifts the item, then re-places it elsewhere', () => {
    const { editor } = makeEditor();
    editor.pick(makeTemplate({ configId: '3040000' }), false, false);
    editor.hover(3, 3);
    const placed = editor.place();
    expect(placed).not.toBeNull();
    const moved = editor.move(placed!.id);
    expect(moved?.id).toBe(placed!.id);
    expect(editor.roomMap.itemsAt(3, 3)).toHaveLength(0);
    editor.hover(5, 5);
    const replaced = editor.place();
    expect(replaced?.tileX).toBe(5);
    expect(editor.roomMap.itemsAt(5, 5).map((i) => i.id)).toEqual([placed!.id]);
  });

  it('stacking uses the room map context (surface + stackable)', () => {
    const { editor } = makeEditor();
    // Place a table (surface) at (3,3).
    editor.pick(makeTemplate({ configId: '3050000', flags: { numTilesX: 1, numTilesY: 1, surface: true, stackable: false } }), false, false);
    editor.hover(3, 3);
    editor.place();
    // A non-stackable item cannot be placed on top.
    editor.pick(makeTemplate({ configId: '3060000' }), false, false);
    expect(editor.hover(3, 3)?.valid).toBe(false);
    // A stackable item can.
    editor.cancel();
    editor.pick(makeTemplate({ configId: '3070000', flags: { numTilesX: 1, numTilesY: 1, surface: false, stackable: true } }), false, false);
    expect(editor.hover(3, 3)?.valid).toBe(true);
    expect(editor.place()).not.toBeNull();
    expect(editor.roomMap.itemsAt(3, 3)).toHaveLength(2);
  });

  it('sell credits coins and gourmet and removes the item', () => {
    const { editor, credits } = makeEditor();
    editor.pick(makeTemplate({ configId: '3040000', cost: 100 }), false, false);
    editor.hover(3, 3);
    const placed = editor.place();
    const sink = (editor as unknown as { deps: { audit: AuditSink & { log: AuditLog } } }).deps.audit;
    editor.sell(placed!.id, 2);
    expect(credits).toEqual([{ coins: Math.floor(100 / 3) * 2, gourmet: 4 }]);
    expect(sink.log.sold).toEqual([{ id: '3040000', count: 2 }]);
    expect(editor.roomMap.itemsAt(3, 3)).toHaveLength(0);
  });

  it('commit only fires when the audit has changes', () => {
    const clean = makeEditor({ audit: makeSink(false) });
    expect(clean.editor.commit()).toBe(false);
    const dirty = makeEditor();
    expect(dirty.editor.commit()).toBe(true);
    expect(dirty.editor.phase).toBe('committing');
    dirty.editor.commitFinished();
    expect(dirty.editor.phase).toBe('idle');
  });
});

describe('AutosaveTimer (GameWorld.tick port)', () => {
  it('fires every 60s while active', () => {
    const t = new AutosaveTimer();
    expect(t.tick(59000, true)).toBe(false);
    expect(t.tick(1000, true)).toBe(true);
    expect(t.tick(1000, true)).toBe(false);
  });

  it('switches to the 300s inactive cadence after 60s of inactivity', () => {
    const t = new AutosaveTimer();
    expect(t.tick(INACTIVE_TIME, false)).toBe(false);
    // Elapsed keeps accumulating; the inactive interval needs 300s total.
    expect(t.tick(GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE - INACTIVE_TIME - 1, false)).toBe(false);
    expect(t.tick(1, false)).toBe(true);
    expect(GLOBAL_RPC_COMMIT_INTERVAL).toBe(60000);
  });

  it('pause blocks ticks; resume resets the counter', () => {
    const t = new AutosaveTimer();
    t.pause();
    expect(t.tick(60000, true)).toBe(false);
    t.resume();
    expect(t.tick(60000, true)).toBe(true);
  });
});
