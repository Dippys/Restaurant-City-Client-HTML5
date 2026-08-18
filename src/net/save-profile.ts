/**
 * saveProfile audit writer — the byte-exact records the client must EMIT.
 *
 * Spec: docs/specs/rpc-profile.md §8; authoritative reader =
 * ../server/src/rpc/save-profile-parser.ts (byte-proven against the
 * original client's captured traffic).
 */
import { RpcWriter } from './codec';
import type { Floor, NetworkUid, OwnedItem } from './profile';

/** Audit action codes (AuditChangeAction.as ↔ save-profile-parser.ts). */
export const AUDIT = {
  creditShakeTree: 1,
  creditChangeBuyMeal: 2,
  purchaseInventoryItem: 3,
  sellOwnedItem: 4,
  fromGameToInventory: 5,
  fromInventoryToGame: 6,
  saveFloor: 7,
  updateEmployee: 8,
  lockIngredient: 9,
  hireEmployee: 17,
  fireEmployee: 18,
  sellInventoryItem: 19,
  openMail: 20,
  deleteMail: 21,
  purchaseOwnedItem: 22,
  saveOwnedItem: 23,
  creditChangeOffLine: 24,
  lvlUpdate: 25,
  purchasePerks: 32,
  addRecipe: 33,
  purchaseIngredient: 34,
  pickUpTrash: 35,
  creditOutRestaurant: 36,
  selectRecipe: 37,
  seedPlant: 38,
  waterPlant: 39,
  harvestPlant: 40,
  consumeItem: 41,
  creditFunctionalItem: 48,
  creditVisitFriend: 49,
  saveFloors: 50,
  moveInGameItemsToInventory: 51,
} as const;

/** Credit-only actions have no payload (save-profile-parser skipAuditPayload). */
const NO_PAYLOAD = new Set<number>([1, 2, 16, 24, 35, 36, 48]);

export interface AuditEmployee {
  readonly id: NetworkUid;
  readonly happiness: number;
  readonly task: number;
  readonly notify: boolean;
}

export interface AuditInventoryItem {
  readonly globalItemId: number;
  readonly number: number;
  readonly isSelected: boolean;
}

export interface SaveProfileHeader {
  readonly id: NetworkUid;
  readonly restaurantName: string;
  readonly gourmetPoint: number;
  readonly trashPoint: number;
  readonly demandPoint: number;
  readonly musicPlay: number;
  readonly isInStreet: boolean;
  readonly awards: Uint8Array | null;
  readonly userLevel: number;
  readonly activeFloorIndex: number;
}

export interface AuditChange {
  readonly action: number;
  readonly newCredits: number;
  readonly creditsDelta: number;
  readonly payload?: Uint8Array;
}

function writeNetworkUid(w: RpcWriter, uid: NetworkUid): void {
  w.writeVarint(uid.network);
  if (uid.network !== 0) {
    w.writeString(uid.networkUid);
    w.writeVarint(uid.playfishUid);
  }
}

function writeOwnedItem(w: RpcWriter, item: OwnedItem): void {
  w.writeIntvar32(item.serverId);
  w.writeVarint(item.globalItemId);
  w.writeIntvar32(item.positionX);
  w.writeIntvar32(item.positionY);
  w.writeU8(item.data);
  writeNetworkUid(w, item.employeeId);
  w.writeU8(item.roomIndex);
}

function writeEmployee(w: RpcWriter, e: AuditEmployee): void {
  writeNetworkUid(w, e.id);
  w.writeVarint(e.happiness);
  w.writeU8(e.task);
  w.writeBool(e.notify);
}

function writeEmployeeArray(w: RpcWriter, employees: readonly AuditEmployee[]): void {
  w.writeVarint(employees.length);
  for (const e of employees) {
    writeEmployee(w, e);
  }
}

function writeInventoryItem(w: RpcWriter, item: AuditInventoryItem): void {
  w.writeVarint(item.globalItemId);
  w.writeVarint(item.number);
  w.writeBool(item.isSelected);
}

/** Builds the payload bytes for one audit action (spec §8.3). */
export function writeAuditPayload(action: number, args: Record<string, unknown>): Uint8Array {
  const w = new RpcWriter();
  if (NO_PAYLOAD.has(action)) {
    return w.bytes();
  }
  switch (action) {
    case AUDIT.purchaseInventoryItem: {
      w.writeString(String(args.token ?? ''));
      w.writeVarint(Number(args.qty ?? 0));
      break;
    }
    case AUDIT.sellOwnedItem: {
      writeOwnedItem(w, args.item as OwnedItem);
      w.writeString(String(args.token ?? ''));
      break;
    }
    case AUDIT.fromGameToInventory:
    case AUDIT.fromInventoryToGame:
    case AUDIT.saveOwnedItem: {
      writeOwnedItem(w, args.item as OwnedItem);
      break;
    }
    case AUDIT.purchaseOwnedItem: {
      w.writeString(String(args.token ?? ''));
      writeOwnedItem(w, args.item as OwnedItem);
      break;
    }
    case AUDIT.saveFloor: {
      const tiles = args.tiles as readonly number[];
      w.writeVarint(tiles.length);
      for (const t of tiles) {
        w.writeVarint(t);
      }
      break;
    }
    case AUDIT.updateEmployee:
    case AUDIT.hireEmployee:
    case AUDIT.fireEmployee: {
      writeEmployeeArray(w, args.employees as readonly AuditEmployee[]);
      break;
    }
    case AUDIT.lockIngredient: {
      const ids = args.ingredientIds as readonly number[];
      w.writeVarint(ids.length);
      for (const id of ids) {
        w.writeVarint(id);
      }
      w.writeBool(Boolean(args.flag));
      break;
    }
    case AUDIT.sellInventoryItem: {
      w.writeString(String(args.token ?? ''));
      writeInventoryItem(w, args.item as AuditInventoryItem);
      break;
    }
    case AUDIT.openMail:
    case AUDIT.deleteMail: {
      const ids = args.mailIds as readonly number[];
      w.writeVarint(ids.length);
      for (const id of ids) {
        w.writeVarint(id);
      }
      break;
    }
    case AUDIT.lvlUpdate: {
      w.writeVarint(Number(args.level ?? 0));
      break;
    }
    case AUDIT.purchasePerks: {
      w.writeString(String(args.token ?? ''));
      w.writeVarint(Number(args.qty ?? 0));
      break;
    }
    case AUDIT.addRecipe: {
      w.writeString(String(args.token ?? ''));
      break;
    }
    case AUDIT.purchaseIngredient: {
      w.writeVarint(Number(args.itemId ?? 0));
      w.writeVarint(Number(args.qty ?? 0));
      break;
    }
    case AUDIT.selectRecipe: {
      w.writeVarint(Number(args.itemId ?? 0));
      w.writeBool(Boolean(args.flag));
      break;
    }
    case AUDIT.seedPlant:
    case AUDIT.waterPlant:
    case AUDIT.harvestPlant: {
      w.writeVarint(Number(args.plotId ?? 0));
      break;
    }
    case AUDIT.consumeItem: {
      w.writeVarint(Number(args.itemId ?? 0));
      break;
    }
    case AUDIT.creditVisitFriend: {
      writeNetworkUid(w, args.uid as NetworkUid);
      break;
    }
    case AUDIT.saveFloors: {
      const floors = args.floors as readonly Floor[];
      w.writeVarint(floors.length);
      for (const f of floors) {
        w.writeVarint(f.floorIndex);
        w.writeVarint(f.tiles.length);
        for (const t of f.tiles) {
          w.writeVarint(t);
        }
      }
      break;
    }
    case AUDIT.moveInGameItemsToInventory: {
      w.writeVarint(Number(args.floorIndex ?? 0));
      w.writeVarint(Number(args.itemTypeId ?? 0));
      break;
    }
    default:
      throw new Error(`unknown audit action ${action}`);
  }
  return w.bytes();
}

/**
 * Builds the complete saveProfile request body: profile header (§8.1)
 * then the audit batch (§8.2). creditsDelta/newCredits live on each
 * change (the client emits newCredits 0 — spec §11.3).
 */
export function buildSaveProfileBody(
  header: SaveProfileHeader,
  changes: readonly AuditChange[],
  saveVersion: number,
  timeOnClientMs: number,
): Uint8Array {
  const w = new RpcWriter();
  writeNetworkUid(w, header.id);
  w.writeString(header.restaurantName);
  w.writeVarint(header.gourmetPoint);
  w.writeVarint(header.trashPoint);
  w.writeVarint(header.demandPoint);
  w.writeVarint(header.musicPlay);
  w.writeBool(header.isInStreet);
  w.writeBool(header.awards !== null);
  if (header.awards !== null) {
    w.writeBytes(header.awards);
  }
  w.writeU8(header.userLevel);
  w.writeU8(header.activeFloorIndex);

  w.writeVarint(saveVersion);
  w.writeVarint(timeOnClientMs);
  w.writeVarint(changes.length);
  for (const change of changes) {
    w.writeU8(change.action);
    w.writeVarint(change.newCredits);
    w.writeIntvar32(change.creditsDelta);
    if (change.payload !== undefined) {
      // Audit payloads are RAW on the wire (no length prefix) — the server
      // reads payload fields directly after the 3-field prefix.
      w.writeRaw(change.payload);
    }
  }
  return w.bytes();
}
