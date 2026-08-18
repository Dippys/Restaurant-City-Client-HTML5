/**
 * GameState — the client's mirror of the profile payloads.
 *
 * Populated from getUserProfile/getAllFriends/getUsers (src/net/profile.ts)
 * and updated by the save audit flow (src/net/save-profile.ts). The
 * backend is authoritative; this state exists for the simulation and
 * rendering layers.
 *
 * Level table: GameWorld.LEVEL_THRESHOLDS (GameWorld.as L231-825).
 */
import type { IngredientMarketItem, ProfileInfo } from '../../net/profile';

export interface LevelConfig {
  readonly level: number;
  readonly points: number;
  readonly roomSizeX: number;
  readonly roomSizeY: number;
  readonly employees: number;
  readonly numDishes: number;
  readonly gardenPlots: number;
  readonly coinReward: number;
}

/** Room sizes per level, copied from LEVEL_THRESHOLDS (index = level-1). */
const ROOM_SIZES: ReadonlyArray<readonly [number, number]> = [
  [8, 8], [8, 8], [8, 8], // L1-3
  [9, 8], // L4
  [9, 9], [9, 9], // L5-6
  [10, 9], // L7
  [10, 10], [10, 10], // L8-9
  [11, 10], // L10
  [11, 11], [11, 11], // L11-12
  [12, 11], // L13
  [12, 12], [12, 12], // L14-15
  [13, 12], // L16
  [13, 13], [13, 13], // L17-18
  [14, 13], // L19
  [14, 14], // L20
  [15, 14], // L21
  [15, 15], [15, 15], // L22-23
  [16, 15], // L24
  [16, 16], [16, 16], // L25-26
  [17, 16], // L27
  [17, 17], [17, 17], // L28-29
  [18, 17], // L30
  [18, 18], [18, 18], // L31-32
  [19, 18], [19, 18], // L33-34
  [19, 19], // L35
];

/** Room size at a level (19x19 beyond the table). */
export function roomSizeAtLevel(level: number): { numTilesX: number; numTilesY: number } {
  const idx = Math.max(0, Math.min(level - 1, ROOM_SIZES.length - 1));
  const [numTilesX, numTilesY] = ROOM_SIZES[idx] ?? [19, 19];
  return { numTilesX, numTilesY };
}

export class GameState {
  profile: ProfileInfo | null = null;
  friends: ProfileInfo[] = [];
  ingredientMarket: IngredientMarketItem[] = [];
  cashBalance = 0;
  bookmarkCount = 0;
  serverTime = 0;
  saveVersion = 1;
  /** ms since init at the last save (RpcClient.as:554). */
  private timeOnClient = 0;

  get loggedIn(): boolean {
    return this.profile !== null;
  }

  get level(): number {
    return this.profile?.userLevel ?? 1;
  }

  get roomSize(): { numTilesX: number; numTilesY: number } {
    return roomSizeAtLevel(this.level);
  }

  /** Coins = the profile `credits` field (audit creditsDelta changes it). */
  get coins(): number {
    return this.coinsOverride ?? this.profile?.credits ?? 0;
  }

  /** Local coin mutation; persists through the next saveProfile audit. */
  spendCoins(amount: number): boolean {
    if (this.coins < amount) {
      return false;
    }
    this.coinsOverride = this.coins - amount;
    return true;
  }

  addCoins(amount: number): void {
    this.coinsOverride = this.coins + amount;
  }

  /** Coin delta accumulated locally since the last save (audit creditsDelta). */
  coinDelta(): number {
    return (this.coinsOverride ?? this.coins) - (this.profile?.credits ?? 0);
  }

  clearCoinOverride(): void {
    this.coinsOverride = null;
  }

  private coinsOverride: number | null = null;

  applyProfile(profile: ProfileInfo): void {
    this.profile = profile;
  }

  applyFriends(friends: ProfileInfo[]): void {
    this.friends = friends;
  }

  applyIngredientMarket(market: IngredientMarketItem[]): void {
    this.ingredientMarket = market;
  }

  applyCashBalance(balance: number): void {
    this.cashBalance = balance;
  }

  applyServerTime(epochSeconds: number): void {
    this.serverTime = epochSeconds;
  }

  /** Called after a successful saveProfile: adopt the echoed version +1. */
  onSaveAccepted(echoedVersion: number): void {
    this.saveVersion = echoedVersion + 1;
  }

  setTimeOnClient(ms: number): void {
    this.timeOnClient = ms;
  }

  getTimeOnClient(): number {
    return this.timeOnClient;
  }

  /** Owned items on a given room index (ROOM_INDEX_*), for rendering. */
  ownedItemsInRoom(roomIndex: number) {
    return (this.profile?.ownedItems ?? []).filter((i) => i.roomIndex === roomIndex);
  }
}
