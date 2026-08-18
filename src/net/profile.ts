/**
 * Profile payload readers — port of RpcResponse.readProfile and the
 * server's writeProfile (docs/specs/rpc-profile.md §5-7; authoritative =
 * ../server/src/rpc/responders.ts, which is byte-proven against the
 * original client).
 */
import { RpcReader } from './codec';

export interface NetworkUid {
  readonly network: number;
  readonly networkUid: string;
  readonly playfishUid: number;
}

export interface OwnedItem {
  readonly serverId: number;
  readonly globalItemId: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly data: number;
  readonly employeeId: NetworkUid;
  readonly roomIndex: number;
}

export interface Floor {
  readonly floorIndex: number;
  readonly tiles: number[];
}

export interface Employee {
  readonly id: NetworkUid;
  readonly happiness: number;
  readonly task: number;
  readonly notify: boolean;
  readonly clothes: OwnedItem[];
}

export interface IngredientState {
  readonly globalItemId: number;
  readonly isLocked: boolean;
  readonly number: number;
}

export interface InventoryItem {
  readonly globalItemId: number;
  readonly number: number;
  readonly isSelected: boolean;
}

export interface Plot {
  readonly plotId: number;
  readonly ingredientId: number;
  /** Seconds on the wire (the AS3 multiplies by 1000 into ms). */
  readonly plantWetTime: number;
  readonly timeToDry: number;
}

export interface IngredientMarketItem {
  readonly ingredientId: number;
  readonly price: number;
}

export interface ProfileInfo {
  readonly id: NetworkUid;
  readonly version: number;
  readonly offlineShard: boolean;
  readonly firstName: string;
  readonly fullName: string;
  readonly imageUrl: string;
  readonly profileUrl: string;
  readonly gender: number;
  readonly restaurantName: string;
  readonly credits: number;
  readonly playCount: number;
  readonly gourmetPoint: number;
  readonly nbVote: number;
  readonly totalMark: number;
  readonly trashPoint: number;
  readonly demandPoint: number;
  readonly musicPlay: number;
  readonly isInStreet: boolean;
  /** Seconds since last save on the wire (spec §11.1), not a timestamp. */
  readonly lastSave: number;
  readonly lastSurveyTime: number;
  readonly hasAwards: boolean;
  readonly awards: Uint8Array | null;
  readonly userLevel: number;
  readonly consecutionCount: number;
  readonly ownedItems: OwnedItem[];
  readonly activeFloorPresent: boolean;
  readonly activeFloorTiles: number[];
  readonly floors: Floor[];
  readonly activeFloorIndex: number;
  readonly employees: Employee[];
  readonly ingredients: IngredientState[];
  readonly gardenPresent: boolean;
  readonly garden: Plot[];
  readonly inventoryItems: InventoryItem[];
  readonly visitedFriends: NetworkUid[];
  readonly visitedFriendsToday: NetworkUid[];
}

export function readOwnedItem(r: RpcReader): OwnedItem {
  const serverId = r.readIntvar32();
  const globalItemId = r.readVarint();
  const positionX = r.readIntvar32();
  const positionY = r.readIntvar32();
  const data = r.readU8();
  const employeeId = r.readNetworkUid();
  const roomIndex = r.readU8();
  return { serverId, globalItemId, positionX, positionY, data, employeeId, roomIndex };
}

export function readFloor(r: RpcReader): Floor {
  const floorIndex = r.readVarint();
  const tiles = r.readArray((rr) => rr.readVarint());
  return { floorIndex, tiles };
}

export function readEmployee(r: RpcReader): Employee {
  const id = r.readNetworkUid();
  const happiness = r.readVarint();
  const task = r.readU8();
  const notify = r.readBool();
  const clothes = r.readArray(readOwnedItem);
  return { id, happiness, task, notify, clothes };
}

export function readIngredient(r: RpcReader): IngredientState {
  const globalItemId = r.readVarint();
  const isLocked = r.readBool();
  const number = r.readVarint();
  return { globalItemId, isLocked, number };
}

export function readInventoryItem(r: RpcReader): InventoryItem {
  const globalItemId = r.readVarint();
  const number = r.readVarint();
  const isSelected = r.readBool();
  return { globalItemId, number, isSelected };
}

export function readPlot(r: RpcReader): Plot {
  const plotId = r.readU8();
  const ingredientId = r.readVarint();
  const plantWetTime = r.readVarint();
  const timeToDry = r.readVarint();
  return { plotId, ingredientId, plantWetTime, timeToDry };
}

export function readIngredientMarketItem(r: RpcReader): IngredientMarketItem {
  const ingredientId = r.readVarint();
  const price = r.readVarint();
  return { ingredientId, price };
}

/** RpcResponse.readProfile (spec §6), version-gated. */
export function readProfile(r: RpcReader): ProfileInfo {
  const id = r.readNetworkUid();
  const version = r.readU8();
  const offlineShard = r.readBool();
  let firstName = '';
  let fullName = '';
  let imageUrl = '';
  let profileUrl = '';
  let gender = 0;
  if (version >= 1) {
    firstName = r.readString();
    fullName = r.readString();
    imageUrl = r.readString();
    profileUrl = r.readString();
    gender = r.readU8();
  }
  let restaurantName = '';
  let credits = 0;
  let playCount = 0;
  let gourmetPoint = 0;
  let nbVote = 0;
  let totalMark = 0;
  let trashPoint = 0;
  let demandPoint = 0;
  let musicPlay = 0;
  let isInStreet = false;
  let lastSave = 0;
  let lastSurveyTime = 0;
  let hasAwards = false;
  let awards: Uint8Array | null = null;
  let userLevel = 0;
  let consecutionCount = 0;
  if (version >= 2) {
    restaurantName = r.readString();
    credits = r.readVarint();
    playCount = r.readIntvar32();
    gourmetPoint = r.readVarint();
    nbVote = r.readVarint();
    totalMark = r.readVarint();
    trashPoint = r.readVarint();
    demandPoint = r.readVarint();
    musicPlay = r.readVarint();
    isInStreet = r.readBool();
    lastSave = r.readVarint();
    lastSurveyTime = r.readDate();
    hasAwards = r.readBool();
    if (hasAwards) {
      awards = r.readBytes();
    }
    userLevel = r.readU8();
    consecutionCount = r.readU8();
  }
  const ownedItems = version >= 3 ? r.readArray(readOwnedItem) : [];
  let activeFloorPresent = false;
  let activeFloorTiles: number[] = [];
  let floors: Floor[] = [];
  let activeFloorIndex = 0;
  let employees: Employee[] = [];
  let ingredients: IngredientState[] = [];
  let gardenPresent = false;
  let garden: Plot[] = [];
  if (version >= 4) {
    activeFloorPresent = r.readBool();
    if (activeFloorPresent) {
      activeFloorTiles = r.readArray((rr) => rr.readVarint());
    }
    floors = r.readArray(readFloor);
    activeFloorIndex = r.readU8();
    employees = r.readArray(readEmployee);
    ingredients = r.readArray(readIngredient);
    gardenPresent = r.readBool();
    if (gardenPresent) {
      garden = r.readArray(readPlot);
    }
  }
  const inventoryItems = version >= 5 ? r.readArray(readInventoryItem) : [];
  const visitedFriends = version >= 5 ? r.readArray((rr) => rr.readNetworkUid()) : [];
  const visitedFriendsToday = version >= 5 ? r.readArray((rr) => rr.readNetworkUid()) : [];
  return {
    id,
    version,
    offlineShard,
    firstName,
    fullName,
    imageUrl,
    profileUrl,
    gender,
    restaurantName,
    credits,
    playCount,
    gourmetPoint,
    nbVote,
    totalMark,
    trashPoint,
    demandPoint,
    musicPlay,
    isInStreet,
    lastSave,
    lastSurveyTime,
    hasAwards,
    awards,
    userLevel,
    consecutionCount,
    ownedItems,
    activeFloorPresent,
    activeFloorTiles,
    floors,
    activeFloorIndex,
    employees,
    ingredients,
    gardenPresent,
    garden,
    inventoryItems,
    visitedFriends,
    visitedFriendsToday,
  };
}
