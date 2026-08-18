import Phaser from 'phaser';
import { GameState, roomSizeAtLevel } from '../../core/state/game-state';
import { itemDrawPriority } from '../../core/iso/priorities';
import {
  FLOOR_COLOUR,
  ROOM_ORIGIN_X,
  ROOM_ORIGIN_Y,
  SCORE_POPUP_PRIORITY,
  TILE_HEIGHT_HALF,
  getScreenX,
  getScreenY,
  getTileIndexX,
  getTileIndexY,
} from '../../core/iso/math';
import { ITEM_TYPE_RESTAURANT, getItemType } from '../../core/items/types';
import { footprintFromConfig, itemScreenPosition } from '../../core/items/footprint';
import { pickDisplayFrame } from '../art';
import { ItemCatalog, type CatalogItem } from '../catalog';
import { RoomMap, type PlacedItem } from '../../systems/placement/room-map';
import { EditorState, type ItemTemplate } from '../../systems/placement/editor-state';
import { SaveProfileAuditSink } from '../../systems/placement/save-audit';
import { RpcClient } from '../../net/rpc-client';
import { buildSaveProfileBody } from '../../net/save-profile';
import { RpcReader } from '../../net/codec';
import { readIngredientMarketItem, readMail, readPlot, readProfile } from '../../net/profile';
import type { OwnedItem } from '../../net/profile';

const ZOOM_LEVELS = [1.4, 1, 0.6];
const SHOP_GROUPS = [
  'Decoration',
  'Table',
  'Chair',
  'Kitchen Appliance',
  'Functional',
  'Wall Decoration',
  'Door',
];

type RenderOwned = PlacedItem & { owned: OwnedItem };

/**
 * M2 restaurant view: interior floor + placed items at depth-sorted
 * painter's order, camera pan/zoom, and the editor slice
 * (buy/place/move/sell + save commit that survives reload).
 */
export class RestaurantScene extends Phaser.Scene {
  private state!: GameState;
  private catalog!: ItemCatalog;
  private rpc!: RpcClient;

  private roomContainer!: Phaser.GameObjects.Container;
  private zoomLevel = 1;
  private editing = false;

  private roomMap!: RoomMap;
  private editor: EditorState | null = null;
  private sink: SaveProfileAuditSink | null = null;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();

  private cursor: Phaser.GameObjects.Image | null = null;
  private grid: Phaser.GameObjects.Graphics | null = null;
  private toolbar: Phaser.GameObjects.Container | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;

  private shopGroupIndex = 0;
  private shopItemIndex = 0;
  private nextServerId = -1000;

  constructor() {
    super('restaurant');
  }

  create(): void {
    const state = this.registry.get('gameState') as GameState | undefined;
    const catalog = this.registry.get('catalog') as ItemCatalog | undefined;
    const rpc = this.registry.get('rpc') as RpcClient | undefined;
    if (!state || !catalog || !rpc) {
      this.add.text(380, 300, 'missing state — open /', { color: '#ff8a80' }).setOrigin(0.5);
      return;
    }
    this.state = state;
    this.catalog = catalog;
    this.rpc = rpc;

    this.cameras.main.setBackgroundColor(0xb8d8c0);
    this.roomContainer = this.add.container(ROOM_ORIGIN_X, ROOM_ORIGIN_Y);
    this.setZoom(this.zoomLevel);

    this.rebuildRoom();
    this.renderFloor();
    this.renderItems();
    this.drawChrome();
    this.setupCamera();
  }

  // ---------------------------------------------------------------- world

  private renderFloor(): void {
    const { numTilesX, numTilesY } = this.roomMap.size;
    const g = this.add.graphics();
    const diamond = (x: number, y: number, color: number) => {
      const sx = getScreenX(x, y);
      const sy = getScreenY(x, y);
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(sx, sy - TILE_HEIGHT_HALF);
      g.lineTo(sx + 40, sy);
      g.lineTo(sx, sy + TILE_HEIGHT_HALF);
      g.lineTo(sx - 40, sy);
      g.closePath();
      g.fillPath();
    };
    for (let y = 0; y < numTilesY; y += 1) {
      for (let x = 0; x < numTilesX; x += 1) {
        diamond(x, y, FLOOR_COLOUR);
      }
    }
    for (let y = numTilesY; y < numTilesY + 6; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        diamond(x, y, 0x9ccd9c);
      }
    }
    for (let y = 0; y < numTilesY; y += 1) {
      diamond(0, y, 0xb0a48f);
    }
    for (let x = 0; x < numTilesX; x += 1) {
      diamond(x, 0, 0xb0a48f);
    }
    this.roomContainer.add(g);
  }

  private roomTileY(item: OwnedItem): number {
    return item.roomIndex === 1 ? item.positionY + this.roomMap.size.numTilesY : item.positionY;
  }

  private renderItems(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();

    const frames = this.textures.get('indoor').getFrameNames();
    for (const item of this.roomMap.all()) {
      const render = item as RenderOwned;
      const entry = this.catalog.get(item.configId);
      if (!entry || entry.className === '') continue;
      const frame = pickDisplayFrame(frames, { atlasKey: 'indoor_asset', className: entry.className });
      if (!frame) continue;
      const flags = entry.flags;
      const kind = flags.floorTileItem
        ? ('floor' as const)
        : flags.wallDecorationItem
          ? ('wall-decoration' as const)
          : ('item' as const);
      const sprite = this.add.sprite(0, 0, 'indoor', frame);
      sprite.setOrigin(0.5, 1);
      const pos = itemScreenPosition(item.tileX, item.tileY, item.height);
      sprite.setPosition(pos.x, pos.y + TILE_HEIGHT_HALF);
      if (item.rotation % 2 === 1) {
        sprite.setFlipX(true);
      }
      sprite.setDepth(itemDrawPriority(kind, { tileX: item.tileX, tileY: item.tileY, curHeight: item.height }));
      sprite.setData('itemId', item.id);
      sprite.setData('owned', render.owned);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerdown', () => {
        if (this.editing && this.editor) {
          this.pickUpItem(item.id);
        }
      });
      this.sprites.set(item.id, sprite);
      this.roomContainer.add(sprite);
    }
    // Phaser containers sort children by depth; nothing else to do.
  }

  private rebuildRoom(): void {
    const size = roomSizeAtLevel(this.state.level);
    const roomMap = new RoomMap({
      numTilesX: size.numTilesX,
      numTilesY: size.numTilesY,
      numOutsideTilesX: 7,
      numOutsideTilesY: 6,
    });
    for (const owned of this.state.profile?.ownedItems ?? []) {
      if (getItemType(owned.globalItemId) !== ITEM_TYPE_RESTAURANT) continue;
      const entry = this.catalog.get(owned.globalItemId);
      const flags = entry?.flags;
      const item: RenderOwned = {
        id: `owned-${owned.serverId}-${owned.globalItemId}-${owned.positionX}-${owned.positionY}`,
        configId: String(owned.globalItemId),
        tileX: owned.positionX,
        tileY: this.roomTileY(owned),
        rotation: owned.data & 0x0f,
        height: 0,
        cost: Number(entry?.config.cost ?? 0),
        cash: Number(entry?.config.cash ?? 0),
        surface: flags?.surface ?? false,
        stackable: flags?.stackable ?? false,
        wallDecorationItem: flags?.wallDecorationItem ?? false,
        wallpaperItem: flags?.wallpaperItem ?? false,
        floorTileItem: flags?.floorTileItem ?? false,
        outdoor: flags?.outdoor ?? false,
        wallItem: flags?.wallItem ?? false,
        numTilesX: footprintFromConfig(entry?.config ?? {}).numTilesX,
        numTilesY: footprintFromConfig(entry?.config ?? {}).numTilesY,
        owned,
      };
      roomMap.place(item);
    }
    this.roomMap = roomMap;
  }

  // ---------------------------------------------------------------- chrome

  private drawChrome(): void {
    this.add
      .text(20, 560, '‹ street', { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('street'));
    this.add
      .text(700, 560, this.editing ? 'play' : 'edit', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.editing) {
          void this.commitAndSave();
        } else {
          this.enterEditor();
        }
      });
    this.add
      .text(700, 20, this.editing ? 'edit mode' : `${this.state.coins} coins`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffe082',
      })
      .setOrigin(1, 0);
    this.statusText = this.add
      .text(380, 540, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9fd8e8' })
      .setOrigin(0.5);
  }

  private setStatus(text: string, color = '#9fd8e8'): void {
    this.statusText?.setText(text).setColor(color);
  }

  // --------------------------------------------------------------- camera

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, 8000, 8000);
    const clampCamera = () => {
      const scale = ZOOM_LEVELS[this.zoomLevel] ?? 1;
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 760 - 1100 * scale, 1450 * scale);
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 600 - 1200 * scale, 550 * scale);
    };
    cam.scrollX = 0;
    cam.scrollY = 0;
    clampCamera();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.editing) {
        cam.scrollX -= pointer.x - pointer.prevPosition.x;
        cam.scrollY -= pointer.y - pointer.prevPosition.y;
        clampCamera();
      }
      if (this.editing && this.editor?.picked) {
        this.updateCursor(pointer);
      }
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.editing && this.editor?.picked) {
        this.placePicked(pointer);
      }
    });
    this.input.on('wheel', (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
      this.setZoom(this.zoomLevel + (dy > 0 ? 1 : -1));
    });
  }

  private setZoom(level: number): void {
    this.zoomLevel = Phaser.Math.Clamp(level, 0, ZOOM_LEVELS.length - 1);
    this.roomContainer?.setScale(ZOOM_LEVELS[this.zoomLevel] ?? 1);
  }

  /** Pointer world -> room-local tile coordinates. */
  private pointerTile(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const local = this.roomContainer
      .getWorldTransformMatrix()
      .applyInverse(pointer.worldX, pointer.worldY);
    return {
      x: Math.round(getTileIndexX(local.x, local.y)),
      y: Math.round(getTileIndexY(local.x, local.y)),
    };
  }

  // ---------------------------------------------------------------- editor

  private enterEditor(): void {
    this.editing = true;
    this.sink = new SaveProfileAuditSink();
    for (const item of this.roomMap.all()) {
      this.sink.recordExistingItem(item.id, (item as RenderOwned).owned);
    }
    this.editor = new EditorState(this.roomMap, {
      canBuy: (t) => this.state.coins >= t.cost,
      spendCoins: (n) => this.state.spendCoins(n),
      creditSell: (coins) => this.state.addCoins(coins),
      audit: this.sink,
    });
    this.shopGroupIndex = 0;
    this.shopItemIndex = 0;
    this.drawToolbar();
    this.setStatus('edit mode: pick an item from the toolbar');
  }

  private exitEditor(): void {
    this.editing = false;
    this.editor = null;
    this.sink = null;
    this.cursor?.destroy();
    this.cursor = null;
    this.grid?.clear();
    this.toolbar?.destroy();
    this.toolbar = null;
    this.setStatus('');
  }

  private shopItems(): readonly CatalogItem[] {
    const name = SHOP_GROUPS[this.shopGroupIndex] ?? SHOP_GROUPS[0];
    return this.catalog.itemsOfGroup(name ?? '').filter((i) => i.className !== '');
  }

  private drawToolbar(): void {
    this.toolbar?.destroy();
    const bar = this.add.container(380, 566);
    bar.add(this.add.rectangle(0, 0, 760, 48, 0x22303a, 0.95));
    const items = this.shopItems();
    const groupName = SHOP_GROUPS[this.shopGroupIndex] ?? '';
    const current = items[this.shopItemIndex % Math.max(1, items.length)];

    const groupLabel = this.add
      .text(-340, 0, `group: ${groupName} (${this.shopGroupIndex + 1}/${SHOP_GROUPS.length})`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    groupLabel.on('pointerdown', () => {
      this.shopGroupIndex = (this.shopGroupIndex + 1) % SHOP_GROUPS.length;
      this.shopItemIndex = 0;
      this.drawToolbar();
    });
    bar.add(groupLabel);

    const itemLabel = this.add
      .text(-120, 0, `item: ${current ? String(current.config.name ?? current.id) : '—'} ` +
        `(${this.shopItemIndex + 1}/${items.length}) cost ${current ? current.config.cost ?? 0 : 0}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffe082',
        wordWrap: { width: 300 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    itemLabel.on('pointerdown', () => {
      if (items.length > 0) {
        this.shopItemIndex = (this.shopItemIndex + 1) % items.length;
        this.drawToolbar();
      }
    });
    bar.add(itemLabel);

    const pickBtn = this.add
      .text(250, 0, 'pick', { fontFamily: 'monospace', fontSize: '13px', color: '#7ddb8a' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    pickBtn.on('pointerdown', () => {
      if (current) {
        this.pickFromShop(current);
      }
    });
    bar.add(pickBtn);

    const sellBtn = this.add
      .text(310, 0, 'sell picked', { fontFamily: 'monospace', fontSize: '12px', color: '#ff8a80' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    sellBtn.on('pointerdown', () => {
      const picked = this.editor?.picked;
      if (picked) {
        this.editor?.sell(picked.id, 1);
        this.sprites.get(picked.id)?.destroy();
        this.sprites.delete(picked.id);
        this.editor?.cancel();
        this.cursor?.destroy();
        this.cursor = null;
        this.grid?.clear();
        this.setStatus(`sold — coins now ${this.state.coins}`);
      }
    });
    bar.add(sellBtn);
    this.toolbar = bar;
  }

  private templateFrom(catalogItem: CatalogItem): ItemTemplate {
    const config = catalogItem.config;
    const footprint = footprintFromConfig(config);
    return {
      configId: String(catalogItem.id),
      cost: Number(config.cost ?? 0),
      cash: Number(config.cash ?? 0),
      flags: {
        numTilesX: footprint.numTilesX,
        numTilesY: footprint.numTilesY,
        surface: catalogItem.flags.surface,
        stackable: catalogItem.flags.stackable,
        wallDecorationItem: catalogItem.flags.wallDecorationItem,
        wallpaperItem: catalogItem.flags.wallpaperItem,
        floorTileItem: catalogItem.flags.floorTileItem,
        outdoor: catalogItem.flags.outdoor,
        wallItem: catalogItem.flags.wallItem,
      },
    };
  }

  private pickFromShop(catalogItem: CatalogItem): void {
    if (!this.editor) return;
    const picked = this.editor.pick(this.templateFrom(catalogItem), false, false);
    if (!picked) {
      this.setStatus('cannot afford / not unlocked yet', '#ff8a80');
      return;
    }
    this.ensureCursor();
    this.setStatus(`placing ${String(catalogItem.config.name ?? catalogItem.id)} — move to a valid tile`);
  }

  private pickUpItem(itemId: string): void {
    if (!this.editor) return;
    const picked = this.editor.move(itemId);
    if (!picked) return;
    this.sprites.get(itemId)?.setVisible(false);
    this.ensureCursor();
    this.setStatus('moving item — click a valid tile');
  }

  private ensureCursor(): void {
    const picked = this.editor?.picked;
    if (!picked) return;
    const entry = this.catalog.get(picked.template.configId);
    if (!entry) return;
    const frames = this.textures.get('indoor').getFrameNames();
    const frame = pickDisplayFrame(frames, { atlasKey: 'indoor_asset', className: entry.className });
    if (!frame) return;
    this.cursor?.destroy();
    this.cursor = this.add.image(0, 0, 'indoor', frame);
    this.cursor.setOrigin(0.5, 1);
    this.cursor.setAlpha(0.75);
    this.cursor.setDepth(SCORE_POPUP_PRIORITY);
    this.roomContainer.add(this.cursor);
  }

  private updateCursor(pointer: Phaser.Input.Pointer): void {
    if (!this.editor) return;
    const picked = this.editor.picked;
    if (!picked || !this.cursor) return;
    const tile = this.pointerTile(pointer);
    const pos = itemScreenPosition(tile.x, tile.y, 0);
    this.cursor.setPosition(pos.x, pos.y + TILE_HEIGHT_HALF);
    const hover = this.editor.hover(tile.x, tile.y);
    this.drawValidityGrid(tile, hover?.valid === true);
  }

  private drawValidityGrid(tile: { x: number; y: number }, valid: boolean): void {
    this.grid?.clear();
    this.grid ??= this.add.graphics();
    this.roomContainer.add(this.grid);
    const sx = getScreenX(tile.x, tile.y);
    const sy = getScreenY(tile.x, tile.y);
    const color = valid ? 0x37e63c : 0xe6393c;
    this.grid.lineStyle(2, color, 1);
    this.grid.strokePoints(
      [
        new Phaser.Geom.Point(sx, sy - TILE_HEIGHT_HALF),
        new Phaser.Geom.Point(sx + 40, sy),
        new Phaser.Geom.Point(sx, sy + TILE_HEIGHT_HALF),
        new Phaser.Geom.Point(sx - 40, sy),
      ],
      true,
    );
  }

  private placePicked(pointer: Phaser.Input.Pointer): void {
    const picked = this.editor?.picked;
    if (!picked || !this.editor || !this.sink) return;
    const tile = this.pointerTile(pointer);
    this.editor.hover(tile.x, tile.y);
    if (!picked.valid) {
      this.setStatus('invalid tile', '#ff8a80');
      return;
    }
    // Record the wire payload BEFORE place() (the audit fires inside).
    this.sink.recordPlacedItem(picked.id, {
      globalItemId: Number(picked.template.configId),
      positionX: tile.x,
      positionY: tile.y >= this.roomMap.size.numTilesY ? tile.y - this.roomMap.size.numTilesY : tile.y,
      data: this.sink.rotationData(picked.rotation),
      roomIndex: tile.y >= this.roomMap.size.numTilesY ? 1 : 0,
      serverId: this.nextServerId--,
    });
    const placed = this.editor.place();
    if (placed) {
      this.sprites.get(placed.id)?.setVisible(true);
      this.sprites.get(placed.id)?.destroy();
      this.sprites.delete(placed.id);
      this.renderItems();
      this.cursor?.destroy();
      this.cursor = null;
      this.grid?.clear();
      this.setStatus(`placed — coins now ${this.state.coins}`);
    }
  }

  // ------------------------------------------------------------------ save

  private async commitAndSave(): Promise<void> {
    if (!this.sink || !this.editor) return;
    if (!this.editor.commit()) {
      this.exitEditor();
      return;
    }
    const profile = this.state.profile;
    if (!profile) return;
    this.setStatus('saving…', '#ffe082');

    const creditsDelta = this.state.coinDelta();
    const changes = [...this.sink.changes];
    // Coin purchases/sales ride a creditChangeOffLine-equivalent delta:
    // the server applies creditsDelta per change; we attach it to the last
    // change (or a standalone one) so the coin balance persists.
    if (creditsDelta !== 0) {
      changes.push({
        action: 24,
        newCredits: 0,
        creditsDelta,
        payload: new Uint8Array(0),
      });
    }
    const body = buildSaveProfileBody(
      {
        id: profile.id,
        restaurantName: profile.restaurantName,
        gourmetPoint: profile.gourmetPoint,
        trashPoint: profile.trashPoint,
        demandPoint: profile.demandPoint,
        musicPlay: profile.musicPlay,
        isInStreet: profile.isInStreet,
        awards: profile.awards,
        userLevel: profile.userLevel,
        activeFloorIndex: profile.activeFloorIndex,
      },
      changes,
      this.state.saveVersion,
      this.state.getTimeOnClient(),
    );
    try {
      const response = await this.rpc.sendSingle(5, body);
      const r = new RpcReader(response);
      const status = r.readU8();
      if (status !== 0) {
        throw new Error(`save status ${status}`);
      }
      const savedVersion = r.readVarint();
      r.readArray(readMail);
      r.readBool();
      r.readVarint();
      r.readArray(readPlot);
      this.state.onSaveAccepted(savedVersion);
      this.state.clearCoinOverride();

      // Reload the profile to prove persistence.
      const profileBody = await this.rpc.sendSingle(3, new Uint8Array(0));
      const pr = new RpcReader(profileBody);
      const fresh = readProfile(pr);
      this.state.applyProfile(fresh);
      this.state.applyIngredientMarket(pr.readArray(readIngredientMarketItem));

      this.exitEditor();
      this.rebuildRoom();
      this.renderItems();
      this.setStatus(`saved (version ${this.state.saveVersion}) and reloaded`, '#7ddb8a');
    } catch (err) {
      this.setStatus(`save FAILED: ${err instanceof Error ? err.message : String(err)}`, '#ff8a80');
    }
  }
}
