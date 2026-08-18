import { describe, expect, it } from 'vitest';
import { RpcReader, RpcWriter } from '../../src/net/codec';
import { readIngredientMarketItem, readProfile, type OwnedItem, type ProfileInfo } from '../../src/net/profile';
import { AUDIT, buildSaveProfileBody, writeAuditPayload } from '../../src/net/save-profile';
import { getItemType, ITEM_TYPE_RESTAURANT } from '../../src/core/items/types';

/**
 * End-to-end boot test against the LIVE local backend (:8090).
 * Opt-in: run with RC_E2E=1 and the backend started.
 * Creates a fresh account, runs our handshake + main batch, and asserts
 * the seeded level-1 profile parses (spec §10).
 */
const E2E = process.env.RC_E2E === '1';
const BASE = 'http://localhost:8090';

async function signup(): Promise<string> {
  // Reuse one fixed test account to avoid the backend's signup rate limit.
  const username = 'm2e2etest';
  const credentials = JSON.stringify({ username, firstName: 'Emm', lastName: 'Two', pin: '123456' });
  let response = await fetch(`${BASE}/__api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, pin: '123456' }),
  });
  if (response.status !== 200) {
    response = await fetch(`${BASE}/__api/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: credentials,
    });
    expect(response.status, await response.text()).toBe(201);
  }
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(cookie).not.toBe('');
  return cookie;
}

async function rpcPost(cookie: string, body: Uint8Array): Promise<Uint8Array> {
  const response = await fetch(`${BASE}/g/rpc/cooking`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', cookie },
    body,
  });
  expect(response.status).toBe(200);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchProfile(cookie: string): Promise<ProfileInfo> {
  const w = new RpcWriter();
  w.writeU8(0);
  w.writeU8(3);
  w.writeString('');
  const body = await rpcPost(cookie, w.bytes());
  const r = new RpcReader(body);
  r.readU8();
  expect(r.readU8()).toBe(3);
  return readProfile(r);
}

async function sendSaveProfile(cookie: string, body: Uint8Array): Promise<number> {
  const w = new RpcWriter();
  w.writeU8(0);
  w.writeU8(5);
  w.writeString('');
  w.writeRaw(body);
  const response = await rpcPost(cookie, w.bytes());
  const r = new RpcReader(response);
  r.readU8();
  expect(r.readU8()).toBe(5);
  const status = r.readU8();
  expect(status).toBe(0);
  return r.readVarint(); // echoed saveVersion
}

describe.skipIf(!E2E)('e2e: live backend boot (RC_E2E=1)', () => {
  it('handshake + main batch parse the seeded level-1 profile', async () => {
    const cookie = await signup();

    // Handshake: [getServerTime, init] INORDER.
    const hs = new RpcWriter();
    hs.writeU8(0);
    hs.writeU8(255);
    hs.writeString('');
    hs.writeU8(2);
    hs.writeVarint(2);
    hs.writeU8(249);
    hs.writeVarint(0);
    hs.writeU8(1);
    hs.writeVarint(0);
    const hsResp = new RpcReader(await rpcPost(cookie, hs.bytes()));
    hsResp.readU8();
    expect(hsResp.readU8()).toBe(255);
    expect(hsResp.readVarint()).toBe(2);
    expect(hsResp.readU8()).toBe(249);
    const time = new RpcReader(hsResp.readBytes()).readDate();
    expect(time).toBeGreaterThan(1000000000);
    expect(hsResp.readU8()).toBe(1);
    expect(new RpcReader(hsResp.readBytes()).readString()).toBe('');

    // Main batch: 249, 3, 2, 248, 20, 246, 44 (CONDITIONAL).
    const main = new RpcWriter();
    main.writeU8(0);
    main.writeU8(255);
    main.writeString('');
    main.writeU8(3);
    main.writeVarint(7);
    const subs: Array<[number, number[]]> = [
      [249, []],
      [3, []],
      [2, []],
      [248, []],
      [20, []],
      [246, [0]],
      [44, []],
    ];
    for (const [t, body] of subs) {
      main.writeU8(t);
      main.writeVarint(body.length);
      for (const b of body) main.writeU8(b);
    }
    const mr = new RpcReader(await rpcPost(cookie, main.bytes()));
    mr.readU8();
    expect(mr.readU8()).toBe(255);
    const count = mr.readVarint();
    expect(count).toBe(7);
    let profile: ReturnType<typeof readProfile> | null = null;
    let friends = 0;
    for (let i = 0; i < count; i += 1) {
      const type = mr.readU8();
      const body = mr.readBytes();
      if (type === 3) {
        const pr = new RpcReader(body);
        profile = readProfile(pr);
        pr.readArray(readIngredientMarketItem);
      } else if (type === 2) {
        friends = new RpcReader(body).readArray(readProfile).length;
      }
    }
    expect(mr.isDone()).toBe(true);
    expect(profile).not.toBeNull();
    const p = profile as NonNullable<typeof profile>;
    // Seeded level-1 shape (rpc-profile spec §10).
    expect(p.version).toBe(5);
    expect(p.userLevel).toBe(1);
    expect(p.gourmetPoint).toBe(0);
    expect(p.credits).toBe(0);
    expect(p.demandPoint).toBe(120);
    expect(p.ownedItems.length).toBe(29);
    expect(p.floors.length).toBe(2);
    expect(p.floors[0]?.tiles.length).toBe(800);
    // Starter set = 7; the first-login daily bonus adds 2 more (server-side).
    expect(p.ingredients.length).toBeGreaterThanOrEqual(7);
    expect(p.ingredients.some((i) => i.globalItemId === 4000005)).toBe(true);
    expect(p.inventoryItems.length).toBe(3);
    // Fresh accounts start with 0 garden plots (the 9-plot block is the
    // layout capacity, planted over time).
    expect(p.garden.length).toBe(0);
    // 6 seeded NPCs + any real accounts in the local DB (>= 6).
    expect(friends).toBeGreaterThanOrEqual(6);
    console.log(
      `  e2e OK: ${p.ownedItems.length} owned items, ${p.floors.length} floors, ` +
        `${p.employees.length} employees, ${friends} friends`,
    );
  }, 30000);

  it('saveProfile audit round-trip persists a moved item across reloads', async () => {
    const cookie = await signup();
    const profile = await fetchProfile(cookie);
    expect(profile.ownedItems.length).toBeGreaterThan(0);

    // Pick an interior item with room to move (+1 on x, off the wall rows).
    const movable = profile.ownedItems.find(
      (i) =>
        getItemType(i.globalItemId) === ITEM_TYPE_RESTAURANT &&
        i.positionX >= 1 &&
        i.positionY >= 1 &&
        i.positionX < 18,
    ) as OwnedItem;
    expect(movable).toBeDefined();
    const moved: OwnedItem = { ...movable, positionX: movable.positionX + 1 };

    const change = {
      action: AUDIT.saveOwnedItem,
      newCredits: 0,
      creditsDelta: 0,
      payload: writeAuditPayload(AUDIT.saveOwnedItem, { item: moved }),
    };
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
      [change],
      1,
      0,
    );
    const echoed = await sendSaveProfile(cookie, body);
    expect(echoed).toBe(1);

    // Reload and verify the position persisted.
    const reloaded = await fetchProfile(cookie);
    const found = reloaded.ownedItems.find(
      (i) => i.serverId === movable.serverId && i.globalItemId === movable.globalItemId,
    );
    expect(found).toBeDefined();
    expect(found?.positionX).toBe(movable.positionX + 1);
    console.log(
      `  e2e save OK: item ${movable.globalItemId} moved x ${movable.positionX} -> ${found?.positionX}`,
    );
  }, 30000);
});
