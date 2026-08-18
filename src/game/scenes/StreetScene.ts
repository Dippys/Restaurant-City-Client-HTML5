import Phaser from 'phaser';
import { GameState } from '../../core/state/game-state';
import { BUILDING_GAP, PORTRAIT_Y, streetSlots } from '../../core/street/layout';
import { ITEM_TYPE_BUILDING, getItemType, rotationFromData } from '../../core/items/types';
import { pickDisplayFrame } from '../art';
import { ItemCatalog } from '../catalog';
import type { OwnedItem, ProfileInfo } from '../../net/profile';

interface StreetPlayer {
  readonly profile: ProfileInfo;
  readonly owned: OwnedItem[];
}

/**
 * M2 street view: road + building slots rendered from saved profiles.
 * The player's building uses their owned building items (type 2, sorted by
 * facade group drawPriority); friends (scalar profiles from getAllFriends)
 * get a default building until getUsers details land in M5.
 */
export class StreetScene extends Phaser.Scene {
  private state!: GameState;
  private catalog!: ItemCatalog;

  constructor() {
    super('street');
  }

  create(): void {
    const state = this.registry.get('gameState') as GameState | undefined;
    const catalog = this.registry.get('catalog') as ItemCatalog | undefined;
    if (!state || !catalog) {
      this.add
        .text(380, 300, 'missing game state — open /', { color: '#ff8a80' })
        .setOrigin(0.5);
      return;
    }
    this.state = state;
    this.catalog = catalog;

    this.cameras.main.setBackgroundColor(0x99c2d9);
    const road = this.add.rectangle(0, 300, 8000, 500, 0x9aa7b4, 1);
    road.setScrollFactor(1);

    const profile = state.profile;
    if (!profile) {
      return;
    }
    const players: StreetPlayer[] = [
      { profile, owned: state.ownedItemsInRoom(0).filter((i) => getItemType(i.globalItemId) === ITEM_TYPE_BUILDING) },
      ...state.friends.map((f) => ({ profile: f, owned: [] })),
    ];
    const slots = streetSlots(players.length);

    let userIdx = 0;
    for (const slot of slots) {
      if (slot.kind === 'filler') {
        continue;
      }
      const player = players[userIdx];
      userIdx += 1;
      if (!player) {
        continue;
      }
      this.renderBuilding(slot.x, player, userIdx === 1);
    }

    // Center on the first real slot (the player's building).
    const firstUserX = BUILDING_GAP;
    this.cameras.main.setBounds(0, 0, 8000, 800);
    this.cameras.main.scrollX = Math.max(0, firstUserX - 380);
  }

  private renderBuilding(slotX: number, player: StreetPlayer, isOwn: boolean): void {
    const group = this.add.container(slotX, 300);

    // Portrait panel above the building.
    group.add(
      this.add
        .text(0, PORTRAIT_Y, `${player.profile.restaurantName || '?'}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );
    group.add(
      this.add
        .text(0, PORTRAIT_Y + 18, `Lv ${player.profile.userLevel} · ${player.profile.gourmetPoint} GP`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#d9e4ec',
        })
        .setOrigin(0.5),
    );

    if (isOwn && player.owned.length > 0) {
      const frames = this.textures.get('outdoor').getFrameNames();
      // Facade order: group drawPriority (Body 0, Tile 1, Roof/Window/Door 2, rest 3).
      const items = [...player.owned].sort((a, b) => {
        const da = this.catalog.get(a.globalItemId)?.groupDrawPriority ?? 0;
        const db = this.catalog.get(b.globalItemId)?.groupDrawPriority ?? 0;
        return da - db;
      });
      for (const item of items) {
        const entry = this.catalog.get(item.globalItemId);
        if (!entry || entry.className === '') {
          continue;
        }
        const frame = pickDisplayFrame(frames, { atlasKey: 'outdoor_asset', className: entry.className });
        if (!frame) {
          continue;
        }
        const sprite = this.add.sprite(
          Math.max(-200, Math.min(200, item.positionX)),
          Math.max(-240, Math.min(0, item.positionY)),
          'outdoor',
          frame,
        );
        sprite.setDepth(entry.groupDrawPriority);
        if (rotationFromData(item.data) % 2 === 1) {
          sprite.setFlipX(true);
        }
        group.add(sprite);
      }
      group.setSize(340, 560);
      group.setInteractive(
        new Phaser.Geom.Rectangle(-170, -320, 340, 560),
        Phaser.Geom.Rectangle.Contains,
      );
      group.on('pointerdown', () => {
        this.scene.start('restaurant');
      });
    } else {
      // Default building silhouette for scalar friend profiles.
      group.add(this.add.rectangle(0, -100, 260, 220, 0xc9b18c, 1));
      group.add(this.add.rectangle(0, -215, 290, 50, 0x8c6a4a, 1));
      group.add(
        this.add
          .text(0, -30, 'visits in M5', { fontSize: '11px', color: '#5a4a3a' })
          .setOrigin(0.5),
      );
    }
  }
}
