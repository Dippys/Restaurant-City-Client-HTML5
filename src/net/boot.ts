/**
 * Boot sequence — port of GameInitLoader's two batches
 * (docs/specs/rpc-profile.md §4): handshake (INORDER) then the main data
 * batch (CONDITIONAL), populating GameState.
 */
import { GameState } from '../core/state/game-state';
import { RpcClient } from './rpc-client';
import { RpcReader, RpcWriter } from './codec';
import { readIngredientMarketItem, readProfile } from './profile';

export class BootResult {
  constructor(
    readonly serverTime: number,
    readonly friendsCount: number,
  ) {}
}

/** getPricepoints request body: str countryOverride ("" = none). */
function pricepointsRequest(countryOverride: string): Uint8Array {
  const w = new RpcWriter();
  w.writeString(countryOverride);
  return w.bytes();
}

export async function bootSession(rpc: RpcClient, state: GameState): Promise<BootResult> {
  const serverTime = await rpc.handshake();
  state.applyServerTime(serverTime);

  // Main batch (GameInitLoader.as L251-269): 249, 3, 2, 248, 20, 246, 44.
  const responses = await rpc.sendBatch([
    { type: 249, body: new Uint8Array(0) },
    { type: 3, body: new Uint8Array(0) },
    { type: 2, body: new Uint8Array(0) },
    { type: 248, body: new Uint8Array(0) },
    { type: 20, body: new Uint8Array(0) },
    { type: 246, body: pricepointsRequest('') },
    { type: 44, body: new Uint8Array(0) },
  ]);

  const [timeResp, profileResp, friendsResp, cashResp, , , bookResp] = responses;
  const required = [timeResp, profileResp, friendsResp, cashResp, bookResp];
  if (required.some((r) => r === undefined)) {
    throw new Error('main batch returned too few responses');
  }

  const time = new RpcReader(timeResp?.body ?? new Uint8Array(0)).readDate();
  state.applyServerTime(time);

  const profileReader = new RpcReader(profileResp?.body ?? new Uint8Array(0));
  const profile = readProfile(profileReader);
  const market = profileReader.readArray(readIngredientMarketItem);
  state.applyProfile(profile);
  state.applyIngredientMarket(market);

  const friendsReader = new RpcReader(friendsResp?.body ?? new Uint8Array(0));
  state.applyFriends(friendsReader.readArray(readProfile));

  const cash = new RpcReader(cashResp?.body ?? new Uint8Array(0)).readVarint();
  state.applyCashBalance(cash);

  const bookmark = new RpcReader(bookResp?.body ?? new Uint8Array(0));
  bookmark.readU8(); // status byte (spec §5.4)
  state.bookmarkCount = bookmark.readIntvar32();

  return new BootResult(time, state.friends.length);
}
