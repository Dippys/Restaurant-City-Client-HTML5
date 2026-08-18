import { describe, expect, it } from 'vitest';
import { RpcReader, RpcWriter } from '../../src/net/codec';
import { readProfile } from '../../src/net/profile';
import { buildSaveProfileBody, writeAuditPayload, AUDIT } from '../../src/net/save-profile';
import { roomSizeAtLevel } from '../../src/core/state/game-state';

/**
 * Golden fixture: the first saveProfile request of the original client,
 * taken verbatim from server/logs.txt (332-byte request; the saveProfile
 * sub-body is 200 bytes after the batch envelope).
 */
const CAPTURED_SAVE_REQUEST_HEX =
  '00ff7a616c32654561616e61616962475442354f713643364f4e5733742e3046' +
  '5848655f713553384947746e6469556e33484e7a64765576756a337264753241' +
  '4b6a6b6e3139687a316263443139466c4a6d326d6461556d7469326e7447596f' +
  '6471576d6330336d744b596d7469326f647a74375a4d687652713772570202f9' +
  '00058148020a31313330353731353836849b8cce42066469707079738499400b' +
  '6a000001560113000000020000002500000000000000000000012c0000000100' +
  '00000000000001000000000000000e0000001c00000000000000000000000000' +
  '0000000000000000000001000000000000000001000000011712140900018e5a' +
  '0208000005020431303031876986eef4000300020431303032876a0002000204' +
  '31303033876b000200020431303034876c000100020a31313330353731353836' +
  '849b8cce4200010018008d70';

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Extracts the saveProfile sub-body from the captured batch envelope. */
function capturedSaveBody(): Uint8Array {
  const r = new RpcReader(fromHex(CAPTURED_SAVE_REQUEST_HEX));
  expect(r.readU8()).toBe(0); // encap
  expect(r.readU8()).toBe(255); // batch
  r.readString(); // session
  r.readU8(); // batchMode
  expect(r.readVarint()).toBe(2); // sub count
  expect(r.readU8()).toBe(249); // getServerTime
  expect(r.readBytes().length).toBe(0);
  expect(r.readU8()).toBe(5); // saveProfile
  const body = r.readBytes();
  expect(body.length).toBe(200);
  expect(r.isDone()).toBe(true);
  return body;
}

/** Reads a saveProfile body: header + audit batch (spec §8). */
function parseCapturedSaveBody(body: Uint8Array) {
  const r = new RpcReader(body);
  const id = r.readNetworkUid();
  const restaurantName = r.readString();
  const gourmetPoint = r.readVarint();
  const trashPoint = r.readVarint();
  const demandPoint = r.readVarint();
  const musicPlay = r.readVarint();
  const isInStreet = r.readBool();
  const hasAwards = r.readBool();
  const awards = hasAwards ? r.readBytes() : null;
  const userLevel = r.readU8();
  const activeFloorIndex = r.readU8();
  const saveVersion = r.readVarint();
  const timeOnClient = r.readVarint();
  const count = r.readVarint();
  const changes: { action: number; newCredits: number; creditsDelta: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const action = r.readU8();
    const newCredits = r.readVarint();
    const creditsDelta = r.readIntvar32();
    changes.push({ action, newCredits, creditsDelta });
  }
  return {
    id, restaurantName, gourmetPoint, trashPoint, demandPoint, musicPlay,
    isInStreet, awards, userLevel, activeFloorIndex, saveVersion, timeOnClient,
    count, changes, done: r.isDone(),
  };
}

describe('saveProfile golden fixture (original client capture)', () => {
  it('header decodes exactly as documented', () => {
    const body = capturedSaveBody();
    const parsed = parseCapturedSaveBody(body);
    expect(parsed.id).toEqual({ network: 2, networkUid: '1130571586', playfishUid: 1130571586 });
    expect(parsed.restaurantName).toBe('dippys');
    expect(parsed.gourmetPoint).toBe(68800);
    expect(parsed.trashPoint).toBe(11);
    expect(parsed.demandPoint).toBe(106);
    expect(parsed.musicPlay).toBe(0);
    expect(parsed.isInStreet).toBe(false);
    expect(parsed.userLevel).toBe(9);
    expect(parsed.activeFloorIndex).toBe(0);
    expect(parsed.awards).toHaveLength(86);
    expect(parsed.saveVersion).toBe(1);
    expect(parsed.timeOnClient).toBe(1882);
    expect(parsed.count).toBe(2);
    // The helper reads change prefixes only; 75 payload bytes remain
    // (68-byte employee payload + 4-byte second change).
    expect(parsed.done).toBe(false);
  });

  it('audit payload writers match the captured bytes', () => {
    const body = capturedSaveBody();
    // Action 8 updateEmployee with the 5 captured employees.
    const employees = [
      { id: { network: 2, networkUid: '1001', playfishUid: 1001 }, happiness: 14400000, task: 3, notify: false },
      { id: { network: 2, networkUid: '1002', playfishUid: 1002 }, happiness: 0, task: 2, notify: false },
      { id: { network: 2, networkUid: '1003', playfishUid: 1003 }, happiness: 0, task: 2, notify: false },
      { id: { network: 2, networkUid: '1004', playfishUid: 1004 }, happiness: 0, task: 1, notify: false },
      { id: { network: 2, networkUid: '1130571586', playfishUid: 1130571586 }, happiness: 0, task: 1, notify: false },
    ];
    const payload = writeAuditPayload(AUDIT.updateEmployee, { employees });
    // Locate the payload inside the captured body: after the two change
    // prefixes (action 8 + newCredits + delta) the payload runs until the
    // next action byte (24). Extract and compare.
    const r = new RpcReader(body);
    r.readNetworkUid();
    r.readString();
    for (let i = 0; i < 4; i += 1) r.readVarint();
    r.readBool();
    r.readBool();
    r.readBytes(); // awards
    r.readU8();
    r.readU8();
    r.readVarint(); // saveVersion
    r.readVarint(); // timeOnClient
    r.readVarint(); // count
    r.readU8(); // action 8
    r.readVarint(); // newCredits 0
    r.readIntvar32(); // delta 0
    const rest = r.rest();
    const idx24 = rest.indexOf(24);
    expect(idx24).toBeGreaterThan(0);
    const capturedPayload = rest.subarray(0, idx24);
    expect([...payload]).toEqual([...capturedPayload]);
    // Second change: action 24, newCredits 0, delta varint = zigzag(888)
    // (wire bytes 8d 70 — readIntvar32 decodes back to 888).
    const tail = new RpcReader(rest.subarray(idx24));
    expect(tail.readU8()).toBe(AUDIT.creditChangeOffLine);
    expect(tail.readVarint()).toBe(0);
    expect(tail.readIntvar32()).toBe(888);
    expect(tail.isDone()).toBe(true);
  });

  it('buildSaveProfileBody reproduces the captured 200 bytes exactly', () => {
    const employees = [
      { id: { network: 2, networkUid: '1001', playfishUid: 1001 }, happiness: 14400000, task: 3, notify: false },
      { id: { network: 2, networkUid: '1002', playfishUid: 1002 }, happiness: 0, task: 2, notify: false },
      { id: { network: 2, networkUid: '1003', playfishUid: 1003 }, happiness: 0, task: 2, notify: false },
      { id: { network: 2, networkUid: '1004', playfishUid: 1004 }, happiness: 0, task: 1, notify: false },
      { id: { network: 2, networkUid: '1130571586', playfishUid: 1130571586 }, happiness: 0, task: 1, notify: false },
    ];
    // Rebuild the captured awards blob by re-reading it from the fixture.
    const captured = capturedSaveBody();
    const r0 = new RpcReader(captured);
    r0.readNetworkUid();
    r0.readString();
    for (let i = 0; i < 4; i += 1) r0.readVarint();
    r0.readBool();
    r0.readBool();
    const awards = r0.readBytes();

    const body = buildSaveProfileBody(
      {
        id: { network: 2, networkUid: '1130571586', playfishUid: 1130571586 },
        restaurantName: 'dippys',
        gourmetPoint: 68800,
        trashPoint: 11,
        demandPoint: 106,
        musicPlay: 0,
        isInStreet: false,
        awards,
        userLevel: 9,
        activeFloorIndex: 0,
      },
      [
        {
          action: AUDIT.updateEmployee,
          newCredits: 0,
          creditsDelta: 0,
          payload: writeAuditPayload(AUDIT.updateEmployee, { employees }),
        },
        {
          action: AUDIT.creditChangeOffLine,
          newCredits: 0,
          creditsDelta: 888,
          payload: writeAuditPayload(AUDIT.creditChangeOffLine, {}),
        },
      ],
      1,
      1882,
    );
    expect(body.length).toBe(200);
    expect([...body]).toEqual([...captured]);
  });
});

describe('readProfile (spec §6 layout)', () => {
  it('round-trips a version-2 friend summary', () => {
    const w = new RpcWriter();
    w.writeVarint(2); // network
    w.writeString('1001');
    w.writeVarint(1001);
    w.writeU8(2); // version
    w.writeBool(false); // offlineShard
    w.writeString('Mia');
    w.writeString('Mia Cafe');
    w.writeString('http://img');
    w.writeString('http://large');
    w.writeU8(1); // gender
    w.writeString('Mia Cafe');
    w.writeVarint(5); // credits
    w.writeIntvar32(12); // playCount
    w.writeVarint(340); // gourmetPoint
    w.writeVarint(2); // nbVote
    w.writeVarint(30); // totalMark
    w.writeVarint(1); // trashPoint
    w.writeVarint(120); // demandPoint
    w.writeVarint(0); // musicPlay
    w.writeBool(true); // isInStreet
    w.writeVarint(45); // lastSave (seconds-since-save)
    w.writeVarint(0); // lastSurveyTime
    w.writeBool(false); // hasAwards
    w.writeU8(4); // userLevel
    w.writeU8(0); // consecutionCount
    const profile = readProfile(new RpcReader(w.bytes()));
    expect(profile.version).toBe(2);
    expect(profile.restaurantName).toBe('Mia Cafe');
    expect(profile.playCount).toBe(12);
    expect(profile.gourmetPoint).toBe(340);
    expect(profile.isInStreet).toBe(true);
    expect(profile.userLevel).toBe(4);
    expect(profile.ownedItems).toEqual([]);
    expect(profile.floors).toEqual([]);
  });

  it('round-trips a version-5 profile with all sections', () => {
    const w = new RpcWriter();
    w.writeVarint(2);
    w.writeString('1130571586');
    w.writeVarint(1130571586);
    w.writeU8(5);
    w.writeBool(false);
    w.writeString('A');
    w.writeString('A B');
    w.writeString('img');
    w.writeString('large');
    w.writeU8(0);
    w.writeString('Diner');
    w.writeVarint(0);
    w.writeIntvar32(1);
    w.writeVarint(0);
    w.writeVarint(0);
    w.writeVarint(0);
    w.writeVarint(0);
    w.writeVarint(120);
    w.writeVarint(0);
    w.writeBool(true);
    w.writeVarint(0);
    w.writeVarint(0);
    w.writeBool(false);
    w.writeU8(1);
    w.writeU8(0);
    // ownedItems: one item at (3,4), room 0
    w.writeVarint(1);
    w.writeIntvar32(-1);
    w.writeVarint(3030010);
    w.writeIntvar32(3);
    w.writeIntvar32(4);
    w.writeU8(0);
    w.writeVarint(0); // employee network 0
    w.writeU8(0); // roomIndex
    // version 4 sections
    w.writeBool(true); // activeFloorPresent
    w.writeVarint(800);
    for (let i = 0; i < 800; i += 1) w.writeVarint(0);
    w.writeVarint(1); // floors count
    w.writeVarint(0); // floorIndex
    w.writeVarint(0); // tiles
    w.writeU8(0); // activeFloorIndex
    w.writeVarint(0); // employees
    w.writeVarint(0); // ingredients
    w.writeBool(true); // gardenPresent
    w.writeVarint(1); // plots
    w.writeU8(0);
    w.writeVarint(4000005);
    w.writeVarint(60);
    w.writeVarint(30);
    // version 5 sections
    w.writeVarint(1); // inventory
    w.writeVarint(5000008);
    w.writeVarint(1);
    w.writeBool(true);
    w.writeVarint(0); // visitedFriends
    w.writeVarint(0); // visitedFriendsToday
    const profile = readProfile(new RpcReader(w.bytes()));
    expect(profile.version).toBe(5);
    expect(profile.ownedItems).toHaveLength(1);
    expect(profile.ownedItems[0]).toMatchObject({
      serverId: -1,
      globalItemId: 3030010,
      positionX: 3,
      positionY: 4,
      roomIndex: 0,
    });
    expect(profile.activeFloorTiles).toHaveLength(800);
    expect(profile.garden[0]).toEqual({ plotId: 0, ingredientId: 4000005, plantWetTime: 60, timeToDry: 30 });
    expect(profile.inventoryItems[0]).toEqual({ globalItemId: 5000008, number: 1, isSelected: true });
  });
});

describe('room sizes (GameWorld.LEVEL_THRESHOLDS port)', () => {
  it('grows 8x8 -> 19x19 per level', () => {
    expect(roomSizeAtLevel(1)).toEqual({ numTilesX: 8, numTilesY: 8 });
    expect(roomSizeAtLevel(4)).toEqual({ numTilesX: 9, numTilesY: 8 });
    expect(roomSizeAtLevel(7)).toEqual({ numTilesX: 10, numTilesY: 9 });
    expect(roomSizeAtLevel(13)).toEqual({ numTilesX: 12, numTilesY: 11 });
    expect(roomSizeAtLevel(35)).toEqual({ numTilesX: 19, numTilesY: 19 });
    expect(roomSizeAtLevel(99)).toEqual({ numTilesX: 19, numTilesY: 19 });
    expect(roomSizeAtLevel(0)).toEqual({ numTilesX: 8, numTilesY: 8 });
  });
});
