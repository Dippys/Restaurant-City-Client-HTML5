# RPC profile spec — M2 wire layout (login + profile load + save)

Byte-exact reference for the HTML5 client's M2 net layer: how to frame
requests, parse responses, and emit `saveProfile` audit records for
`init` (1), `getAllFriends` (2), `getUserProfile` (3), `saveProfile` (5),
`getMails` (20), `readBookmarkCount` (44), `getPricepoints` (246),
`getCashBalance` (248), `getServerTime` (249), `getPurchasableItems` (250).

Source-of-truth order (server wins on bytes; AS3 wins on intent):

1. `server/src/rpc/codec.ts` — primitives + envelope parse.
2. `server/src/rpc/index.ts` — request→response dispatch (single + batch).
3. `server/src/rpc/responders.ts` — exact response write order.
4. `server/src/rpc/save-profile-parser.ts` — the audit format the client
   must **emit**.
5. `server/src/db/profile-store.ts`, `server/src/db/defaults.ts` — seeded
   profile shape and how audits map to DB.
6. AS3 request writers/readers under
   `decompiled/game/scripts/com/playfish/rpc/` and
   `com/playfish/games/cooking/rpc/`.
7. `server/logs.txt` — real original-client request captures (request
   bodies only; no response bodies are present in that file).

Also see `docs/05-network-protocol.md` (msgType table, endpoints).

---

## 1. Wire primitives (big-endian, both directions)

From `server/src/rpc/codec.ts` (server) and `RpcRequestBase.as` /
`RpcResponseBase.as` (client). The two sides agree byte-for-byte.

| Primitive | Encoding | Server writer | AS3 writer/reader |
|---|---|---|---|
| varint | base-128, MSB-first groups, continuation bit 0x80 on all but last; `value = (value<<7) \| (b & 0x7f)` | `writeVarint` codec.ts:131-145 | `writeUintvar32` RpcRequestBase.as:167-196 |
| intvar32 | zigzag in a varint: `v<0 ? (~v<<1\|1) : v<<1` | `writeIntvar32` codec.ts:147-150 | `writeIntvar32` RpcRequestBase.as:433-445; `readIntvar32` RpcResponseBase.as:226-234 |
| string | `varint(charCount)` + UTF-8 bytes; count is **characters**, not bytes | `writeString` codec.ts:152-155 (`[...value].length`) | `writeString` RpcRequestBase.as:347-351 (`param1.length`); `readString` RpcResponseBase.as:45-83 |
| u8 | one byte | `writeU8` codec.ts:166-168 | `writeUint8` RpcRequestBase.as:447-450; `readUint8` RpcResponseBase.as:191-198 |
| bool | one byte, `0`/`1` only | `writeBool` codec.ts:162-164 | `writeBoolean` RpcRequestBase.as:353-356; `readBoolean` RpcResponseBase.as:271-283 (throws on other values) |
| date | `varint(epochSeconds)`; `0` ⇒ null | `writeDate` codec.ts:170-172 | `writeDate` RpcRequestBase.as:377-380; `readDate` RpcResponseBase.as:39-43 (`*1000` to ms) |
| byteArray | `varint(byteLen)` + raw bytes | `writeByteArray` codec.ts:157-160 | `writeByteArray` RpcRequestBase.as:329-333; `readByteArray` RpcResponseBase.as:285-295 |
| array | `varint(count)` + elements | `writeArray` codec.ts:174-176 | `writeArray` RpcRequestBase.as:416-426; `readArray` RpcResponseBase.as:173-184 |
| networkUid | `varint(network)`; if network==0 nothing else; else `str(networkUid) · varint(playfishUid)` | `writeNetworkUid` codec.ts:178-184 | `writeNetworkUid` RpcRequestBase.as:144-156; `readNetworkUid` RpcResponseBase.as:259-269 (network 0 ⇒ `null`) |

Network constants: `NetworkUid.FACEBOOK = 2` (NetworkUid.as:6);
`FACEBOOK_NETWORK = 2` server-side (defaults.ts:1). `network == 0` is the
"no id / no employee" sentinel (e.g. owned items with no attached employee
are seeded with `employeeNetwork: 0`).

`readUintvar31` (RpcResponseBase.as:236-244) is `readUintvar32` plus a
throw if bit 31 is set; `writeUintvar31` (RpcRequestBase.as:158-165) throws
if the value has bit 31 set. They are byte-identical to varint for all
in-range values.

---

## 2. Framing (both directions)

### Request (client → server)

Parsed by `parseRequest` codec.ts:186-241.

- **Single:** `u8 encap(0) · u8 msgType · str sessionId · args…` — the args
  are everything after the session string, interpreted per call.
- **Batch (`msgType 255`):** `u8 0 · u8 255 · str sessionId · u8 batchMode ·
  varint subCount · subCount × (u8 subMsgType · varint subBodyLen · subBody)`.

The client assembles the header in `RpcRequestBase.init`
(RpcRequestBase.as:310-327): `writeUint8(0) · writeUint8(msgType) ·
writeString(sessionId)`; sub-requests are appended with
`writeSubRequest` (RpcRequestBase.as:358-363) as `u8 subMsgType · varint
subBodyLen · body`. Batch modes: `BATCHMODE_NONE 0`, `ASYNC 1`,
`INORDER 2`, `CONDITIONAL 3` (RpcClientBase.as:29-35).

### Response (server → client)

Built by `buildResponse` index.ts:14-52.

- **Single:** `u8 0 · u8 type(=msgType, or 0=ERROR) · body`. An error is
  `type 0` followed by a **reason byte** (see §3).
- **Batch:** `u8 0 · u8 255 · varint count · count × (u8 type · varint len ·
  body)`; a sub-error is `type 0, len 0`. **Order mirrors the request.**
  (index.ts:23-40)

The server's error envelopes are the three bytes `[0, 0, 0]` (type 0,
reason 0) — index.ts:20 and index.ts:51.

`buildResponse` dispatch order (index.ts:23-40): iterate the sub-requests
in order, look up `responders[subMsgType]`; a `null` body (unimplemented)
is emitted as sub-error `[0, 0]` (`type 0 · len 0`).

---

## 3. Error handling semantics (what the client does)

Client-side in `RpcRequestBase.completeHandler` (RpcRequestBase.as:220-287):

1. Read `encapsulationType = u8`, then `responseType = u8`.
2. If `responseType == 0` (ERROR): read one reason byte.
   - `reason == 1` (`ERROR_REASON_FORMAT`, RpcClientBase.as:81) **and not
     already `triedGet`** ⇒ retry the exact request as an HTTP GET
     (`retryRequestAsGet`, RpcRequestBase.as:295-308): URL is
     `client.url + "?msg=" + <bodyLength> + "-" + <hex of body>`, then
     re-`sendRequest` with no POST body.
   - otherwise ⇒ `errorCallback()`.
   - (reason constants: `ERROR_REASON_UNKNOWN 0`, `ERROR_REASON_FORMAT 1`,
     RpcClientBase.as:79-81.)
3. If `responseType != msgType` ⇒ `errorCallback()` (mismatch).
4. Any parse/exception, or the response handler returning with
   `isDone() == false` (reader did not land exactly at the declared body
   length — RpcResponseBase.as:92-99) ⇒ `errorCallback()`.

Network-level (RpcRequestBase.as:365-375): an `IOErrorEvent`/`SecurityError`
while `!triedGet` retries as GET (same hex-in-URL trick), else
`errorCallback()`. Timeout ⇒ `errorCallback()`
(RpcRequestBase.as:388-401).

Batch sub-responses (RpcClientBase.as:444-520): `responseCount` must equal
the number of sub-requests; each sub is `u8 type · varint len`; a sub-error
must have `len == 0` (otherwise the whole batch errors). A sub `type` must
equal the sub-request's `msgType` (or be `0`). All sub-callbacks are then
invoked in order.

> **Never emit error reason 1** server-side: it triggers the client's
> GET-retry loop. The HTML5 client may implement the same retry, but the
> backend never sends `[0,0,1]` (it only ever sends `[0,0,0]`).

---

## 4. Session / auth / handshake flow

### What the client sends first

`GameInitLoader` constructor (GameInitLoader.as:60-77) fires **batch 1** in
`BATCHMODE_INORDER` (2):

```
beginBatch(INORDER)
  getServerTime (249)     // empty body
  init (1)                // body = str(Capabilities.serverString) + str(fb_sig URL-encoded kv)
endBatch()
```

`RpcClientBase.init` (RpcClientBase.as:310-326) builds the init body:
`writeString(Capabilities.serverString)` then
`writeString(String(fb_sig params))`. The server's `initResponder`
(responders.ts:227-230) **ignores the body**, runs `initSession(account)`,
and replies `writeString('')`. The client's `initResponseHandler`
(RpcClientBase.as:407-416) only replaces its `sessionId` if the returned
string is non-empty — so with the TS backend the session string is carried
but never changed by init.

`initSession` (rpc-store.ts:124-134) increments `playCount` only when the
profile is past the tutorial gate (`playCount > 1 || employees >= 2 ||
gourmetPoint > 0 || userLevel > 1`); it never touches starter seeding.

On init success the client runs **batch 2** in `BATCHMODE_CONDITIONAL` (3)
(GameInitLoader.as:251-269):

```
beginBatch(CONDITIONAL)
  getServerTime (249)     // empty
  getUserProfile (3)      // empty
  getAllFriends (2)       // empty
  getCashBalance (248)    // empty
  getReceivedMails (20)   // empty
  getPricepoints (246)    // body = str(countryOverride | "")
  readBookmarkCount (44)  // empty
endBatch()
```

`getPricepoints` writes `writeString(countryOverride == null ? "" : …)`
(RpcClientBase.as:600-605). On init failure it retries init up to 2 more
times (GameInitLoader.as:163-182).

### Empty / unauthenticated session

- The backend authenticates **only** via the HttpOnly cookie `rc_session`
  (session.ts:17, `accountFromRequest` session.ts:32-36).
- RPC paths (`/g/rpc/*`, `/g/billing/*`, `/g/fbfeed/*` —
  http-server.ts:462-464) hit `handleRpc` (http-server.ts:322-352): if
  `accountFromRequest` returns null the server answers
  **HTTP 401** with body `[0,0,0]` (http-server.ts:325-330). Otherwise it
  returns HTTP 200 with the binary envelope.
- HTML pages `/game`, `/account` redirect (HTTP 303) to
  `/login?next=<path>` when unauthenticated (http-server.ts:731-741).
- **HTML5 client rule:** treat an HTTP 401 (or a non-200) on the RPC POST
  as "not logged in" and redirect to `/login?next=…`. The envelope
  `sessionId` string is **not** an auth mechanism — it is ignored by the
  server and only preserved for byte-compatibility with the original
  client.

Auth endpoints (for the login screen): `POST /__api/login`,
`POST /__api/signup`, `POST /__api/logout`, `GET /__api/session`,
`PATCH /__api/account` (http-server.ts:178-240).

---

## 5. Response bodies, field-by-field

All response bodies below begin **after** the response envelope
(`u8 0 · u8 msgType`). Implement readers by mirroring these writers
field-for-field (ADR-0002 / `05-network-protocol.md`).

### 5.1 init (1)

`initResponder` responders.ts:227-230 → `str` (empty string; original could
return a new session id).

### 5.2 getServerTime (249)

responders.ts:707 → `date` (varint epoch seconds).

### 5.3 getCashBalance (248)

responders.ts:338-340 → `varint` (Playfish-cash balance). Client reads
`readUintvar31` (RpcClientBase.as:231-241).

### 5.4 readBookmarkCount (44)

responders.ts:243-249 →
`u8 status(0) · intvar32 count`. Client reads `u8 success · intvar32`
(RpcClient.as:439-451).

### 5.5 getMails (20)

responders.ts:306-309 → `array<Mail>`. `writeMail` responders.ts:133-144:

```
varint id
networkUid sender            // senderNetwork, senderNetworkUid, senderPlayfishUid
array<varint> itemIds        // mailItemIds(mail)
str message
bool read
date sendDate
u8 deleteTime
u8 type
```

Client `readMail` (RpcResponse.as:143-155) reads the same order
(`id, senderId, globalItemIds, message, read, sendDate, deleteTime, type`).

### 5.6 getPricepoints (246)

Request body: `str countryOverride` (RpcClientBase.as:600-605). Response
responders.ts:311-326:

```
bool isMaintenance(false)
array<Pricepoint>:
  varint productType
  varint payoutParameter
  varint paymentProvider
  varint price
  str currency
  varint currencyScale
  str clientData
  str token
```

Matches `readPricepoint` RpcResponseBase.as:128-139.

### 5.7 getPurchasableItems (250)

Response responders.ts:328-336 → `array<PurchasableItem>`:

```
varint skuId
varint price
str currency
str token
```

Matches `readPurchasableItem` RpcResponseBase.as:25-32.

### 5.8 getUserProfile (3)

`getUserProfile` responders.ts:217-225 returns
`writeProfile(profile, /*includeFullState*/ true)` followed by the
ingredient market array:

```
profile (see §6, version byte = 5)
array<IngredientMarketItem>: varint ingredientId · varint price
```

Client `getUserProfileResponseHandler` (RpcClient.as:425-437) reads
`readProfile()` then `readArray(readIngredientMarketItem)`.
`readIngredientMarketItem` RpcResponse.as:117-123.

### 5.9 saveProfile (5) — response

`saveProfile` responders.ts:251-270:

```
u8 status(0)              // SAVE_STATUS_OK
varint savedVersion       // echoes the client's audit.saveVersion (not +1)
array<Mail> ()            // empty
bool false                // "ingredients present" flag
varint 0                  // timeToMaintenance
array<Plot> ()            // empty
```

Client `savePlayerProfileResponseHandler` (RpcClient.as:280-307) reads
`u8 success · varint savedVersion · array<Mail> mails · [bool?] array<Ingredient>
ingredients · varint timeToMaintenance · array<Plot> garden`, then the
caller does `saveVersion = returnedVersion + 1` (SaveProfileHandler.as:660).

---

## 6. getUserProfile body — `writeProfile` / `readProfile` exact order

Server writer `writeProfile` responders.ts:146-198; client reader
`readProfile` RpcResponse.as:26-96. They agree field-for-field. The first
field after the networkUid is a **version byte** that gates which sections
follow: the server writes **5** for full state and **2** for friend
summaries (`writeU8(includeFullState ? 5 : 2)` responders.ts:151).

### Section 0 (always)

| # | Field | Encoding | Server | AS3 read |
|---|---|---|---|---|
| 1 | id | networkUid | responders.ts:150 | `readNetworkUid` RpcResponse.as:30 |
| 2 | version byte | u8 (5 full / 2 friend) | responders.ts:151 | `readUint8` RpcResponse.as:31 |
| 3 | offlineShard | bool (always `false`) | responders.ts:152 | `readBoolean` RpcResponse.as:32 |

### Section 1 (`version >= 1`)

| # | Field | Encoding |
|---|---|---|
| 4 | firstName | str |
| 5 | fullName | str |
| 6 | imageUrl | str |
| 7 | profileUrl | str — **server writes `largeImageUrl` here** (responders.ts:156) while the client names the slot `profileUrl` (RpcResponse.as:38). Byte-identical position; field-name mismatch only. |
| 8 | gender | u8 |

### Section 2 (`version >= 2`)

| # | Field | Encoding | Notes |
|---|---|---|---|
| 9 | restaurantName | str | |
| 10 | credits | varint (unsigned) | AS3 `readUintvar32` RpcResponse.as:44 |
| 11 | playCount | intvar32 (zigzag) | AS3 `readIntvar32` RpcResponse.as:45 |
| 12 | gourmetPoint | varint (unsigned) | AS3 `readUintvar32` RpcResponse.as:46 |
| 13 | nbVote | varint | AS3 `readUintvar31` RpcResponse.as:47 |
| 14 | totalMark | varint | AS3 `readUintvar32` RpcResponse.as:48 |
| 15 | trashPoint | varint | AS3 `readUintvar31` RpcResponse.as:49 |
| 16 | demandPoint | varint | AS3 `readUintvar31` RpcResponse.as:50 |
| 17 | musicPlay | varint | AS3 `readUintvar31` RpcResponse.as:51 |
| 18 | isInStreet | bool | |
| 19 | lastSave | varint | **AMBIGUOUS** — server writes *elapsed seconds since last save* (`elapsedSinceLastSave(profile.lastSave)` responders.ts:168, computed responders.ts:208-215), not the stored timestamp. AS3 names it `lastSave` and treats it as the client-side `lastSave` value (RpcResponse.as:53). See §10. |
| 20 | lastSurveyTime | date | |
| 21 | hasAwards | bool | |
| 22 | awards | byteArray (only if #21 true) | bit-packed awards + settings blob |
| 23 | userLevel | u8 | server clamps to 1..99 |
| 24 | consecutionCount | u8 | |

Friends (`version == 2`, `includeFullState == false`) stop here —
responders.ts:176-178. `getAllFriends` therefore returns **only the scalar
block** (§6.0–6.2). The owned items / floors / employees / avatar layout of
a friend are fetched separately via **`getUsers` (msgType 4)** (§7.2),
which returns full (`version 5`) profiles.

### Section 3 (`version >= 3`)

| # | Field | Encoding |
|---|---|---|
| 25 | ownedItem | array<OwnedItem> (§6.7) |

### Section 4 (`version >= 4`)

| # | Field | Encoding |
|---|---|---|
| 26 | activeFloorPresent | bool |
| 27 | floor | array<varint> (active floor's tile ids) — only if #26 true |
| 28 | floors | array<Floor> (§6.7) |
| 29 | activeFloorIndex | u8 |
| 30 | employees | array<Employee> (§6.7) |
| 31 | ingredients | array<Ingredient> (§6.7) |
| 32 | gardenPresent | bool (server always `true`) |
| 33 | garden | array<Plot> (§6.7) |

### Section 5 (`version >= 5`)

| # | Field | Encoding |
|---|---|---|
| 34 | inventoryItem | array<InventoryItem> (§6.7) |
| 35 | visitedFriend | array<networkUid> |
| 36 | visitedFriendsToday | array<networkUid> |

### 6.7 Nested record layouts (getUserProfile + getUsers + getAllFriends shared)

**OwnedItem** — `writeOwnedItem` responders.ts:70-80, `readOwnedItem`
RpcResponse.as:13-24, `writeOwnedItem` RpcRequest.as:42-51:

```
intvar32 serverId
varint   globalItemId
intvar32 positionX
intvar32 positionY
u8       data
networkUid employeeId     // network 0 ⇒ none
u8       roomIndex
```

**Floor** — responders.ts:98-103, RpcResponse.as:109-115:

```
varint floorIndex
array<varint> tiles       // 20×40 = 800 tile ids; 0 = empty
```

**Employee** — responders.ts:105-113, RpcResponse.as:98-107:

```
networkUid id
varint happiness          // actually remaining work time in ms (§10)
u8 task
bool notify
array<OwnedItem> clothes  // server always writes empty array
```

**Ingredient** — responders.ts:90-96, RpcResponse.as:125-132:

```
varint globalItemId
bool isLocked
varint number
```

**InventoryItem** — responders.ts:82-88, RpcResponse.as:134-141:

```
varint globalItemId
varint number
bool isSelected
```

**Plot** — responders.ts:119-131, RpcResponse.as:157-165:

```
u8 plotId
varint ingredientId
varint plantWetTime   // seconds (client ×1000 → ms)
varint timeToDry      // seconds (client ×1000 → ms)
```

The plot `plantWetTime`/`timeToDry` on the wire are **seconds**; the AS3
reader multiplies by 1000 (`readUintvar32() * 1000`). The server computes
them as `base + elapsedSincePlanted` / `base − elapsedSinceWatered`
(responders.ts:119-131).

---

## 7. Friends & adjacent profile structures

### 7.1 getAllFriends (2)

Request: empty. Response responders.ts:232-235 → `array<UserInfo>` where
each element is `writeProfile(profile, false)` — i.e. **version byte 2** and
only §6.0–§6.2 fields (id, offlineShard, firstName, fullName, imageUrl,
profileUrl/largeImageUrl, gender, restaurantName, credits, playCount,
gourmetPoint, nbVote, totalMark, trashPoint, demandPoint, musicPlay,
isInStreet, lastSave, lastSurveyTime, awards, userLevel, consecutionCount).

Client: `getAllFriendsResponseHandler` = `readArray(readProfile)`
(RpcClient.as:453-463). `RpcGetAllFriends.applyData` wraps each in a
`GameUser` (RpcGetAllFriends.as:42-64).

Server-side the friend set is "every real account + 6 seeded NPCs, minus
the caller and reserved uids" (profile-store.ts:179-190).

### 7.2 getUsers (4) — friend details (avatar/restaurant layout)

`getAllFriends` does **not** carry items/floors. The original client loads a
friend's full profile on demand via `getUsers` with an item context mask
(`RpcGetFriendsDetails` → `RpcClient.getUsers`).

Request body (`RpcClient.getUsers` RpcClient.as:589-595):

```
u8 itemContext                // RpcClient.ITEM_CONTEXT_* bitmask
array<networkUid> uids
```

Server `readRequestedUserIds` (responders.ts:650-679) skips the leading u8
(pos starts at 1), reads the networkUid array, and returns **full profiles
(`version 5`)** — `getUsers` responders.ts:237-241 → `array<UserInfo>`
via `writeProfile(profile, true)`. Same shape as `getUserProfile` but
**without** the ingredient-market array appended.

`ITEM_CONTEXT` values (RpcClient.as:47-49, 171-177): `1` clothes,
`2` restaurant facade, `4` restaurant inside, `8` ingredient. The server
ignores the mask and always returns the whole profile.

---

## 8. saveProfile (5) — request body the client must EMIT

Authoritative reader: `parseSaveProfile` save-profile-parser.ts:58-123 and
`readAuditChanges` save-profile-parser.ts:125-362. The AS3 writer is
`RpcClient.savePlayerProfile` (RpcClient.as:551-560) →
`RpcRequest.writeProfile` (RpcRequest.as:53-69) +
`writeAuditChangeBatch` (RpcRequest.as:156-161). The two agree exactly
(verified against the captured log in §9).

### 8.1 Profile header (writeProfile, RpcRequest.as:53-69)

```
networkUid id
str restaurantName
varint gourmetPoint          // unsigned
varint trashPoint
varint demandPoint
varint musicPlay
bool isInStreet
bool hasAwards
byteArray awards             // only if hasAwards
u8 userLevel
u8 activeFloorIndex
```

Note: **credits are not sent** — the server recomputes them from the audit
(`audit.newCredits ?? current.credits + audit.creditDelta`,
profile-store.ts:256).

### 8.2 Audit batch (writeAuditChangeBatch, RpcRequest.as:156-161)

```
varint saveVersion
varint timeOnClient          // ms since init (RpcClient.as:554)
array<AuditChange> auditChanges
```

`timeOnClient = getTimer() - INIT_TIME` (RpcClient.as:554), i.e.
milliseconds since the first save.

### 8.3 AuditChange record (writeAuditChange, RpcRequest.as:71-148)

Every record begins with a fixed 3-field prefix:

```
u8 action                    // AuditChangeAction code
varint newCredits            // absolute balance after credit change; client always writes 0 (§10)
intvar32 creditsDelta        // signed delta applied to credits
```

…then a per-action payload. Action codes
(AuditChangeAction.as:6-70 ↔ save-profile-parser.ts:26-51):

| Code | Name | Payload (after the 3-field prefix) |
|---|---|---|
| 1 | creditShakeTree | *(none)* |
| 2 | creditChangeBuyMeal | *(none)* |
| 3 | purchaseInventoryItem | `str token · varint qty` |
| 4 | sellOwnedItem | `OwnedItem · str token` |
| 5 | fromGameToInventory | `OwnedItem` |
| 6 | fromInventoryToGame | `OwnedItem` |
| 7 | saveFloor | `array<varint> tiles` (single floor; no floorIndex) |
| 8 | updateEmployee | `array<Employee>{ networkUid id · varint happiness · u8 task · bool notify }` |
| 9 | lockIngredient | `array<varint> ingredientIds · bool flag` |
| 16 | manageMails | *(none — never written by client)* |
| 17 | hireEmployee | `array<Employee>` (same shape as 8) |
| 18 | fireEmployee | `array<Employee>` (same shape as 8) |
| 19 | sellInventoryItem | `str token · InventoryItem{ varint id · varint number · bool isSelected }` |
| 20 | openMail | `array<varint> mailIds` |
| 21 | deleteMail | `array<varint> mailIds` |
| 22 | purchaseOwnedItem | `str token · OwnedItem` |
| 23 | saveOwnedItem | `OwnedItem` |
| 24 | creditChangeOffLine | *(none)* |
| 25 | lvlUpdate | `varint level` |
| 32 | purchasePerks | `str token · varint qty` |
| 33 | addRecipe | `str token` |
| 34 | purchaseIngredient | `varint itemId · varint qty` |
| 35 | pickUpTrash | *(none)* |
| 36 | creditOutRestaurant | *(none)* |
| 37 | selectRecipe | `varint itemId · bool flag` |
| 38 | seedPlant | `varint plotId` |
| 39 | waterPlant | `varint plotId` |
| 40 | harvestPlant | `varint plotId` |
| 41 | consumeItem | `varint itemId` |
| 48 | creditFunctionalItem | *(none)* |
| 49 | creditVisitFriend | `networkUid` |
| 50 | saveFloors | `array<Floor>{ varint floorIndex · array<varint> tiles }` |
| 51 | moveInGameItemsToInventory | `varint floorIndex · varint itemTypeId` |

Server-side handling: actions 1, 2, 16, 24, 35, 36, 48 have no payload and
are credit-only (the reader's `default`/`skipAuditPayload` consumes nothing
— save-profile-parser.ts:340-342, 436-480). Action 5 removes the owned item
and `+1`s its inventory; action 6 upserts the owned item and `−1`s its
inventory (save-profile-parser.ts:162-177). `readOwnedItem`
(save-profile-parser.ts:364-395) and `readEmployee` (410-424) and
`readFloor` (426-434) mirror the writers byte-for-byte.

### 8.4 How audits map to DB state

`savePlayerProfile` profile-store.ts:253-425 applies, in order: profile
scalars (restaurantName, gourmet/trash/demand/music, isInStreet, awards,
userLevel, activeFloorIndex, credits from `newCredits ?? credits+delta`,
`saveVersion = audit.saveVersion + 1`, `lastSave = now`) → remove owned
items → upsert owned items → inventory deltas → bulk inventory moves →
ingredient deltas → ingredient locks → garden changes → floor upserts →
employee upserts/removals → open/delete mail → visit upserts.

The client's audit is **state-delta only**; the server owns all
authoritative state transitions. The client must therefore emit the exact
byte layout above; it does not need to know the server's reconciliation
rules.

---

## 9. Fixtures from `server/logs.txt`

`server/logs.txt` is a request-only replay of the original client (three
`/game.swf` loads). Format per entry:

```
POST /g/rpc/cooking  ->  HTTP 200  [RPC]
time: <iso>
headers: (…)
body: <N> bytes
body.hex:   <hex, truncated at 2000 chars when long>
body.base64:
body.ascii:
```

There are **no response bodies** in this file — response layouts above are
taken from `responders.ts`.

### 9.1 Handshake batch 1 — `getServerTime` + `init` (INORDER)

logs.txt:23-49 (body 1133 bytes). Decoded envelope:

```
u8 0 · u8 255 · str session("zal2eEaanaaib…Rq7rW", 122 chars)
u8 batchMode = 2 (INORDER)
varint count = 2
  u8 249 · varint 0                       // getServerTime, empty
  u8 1 · varint 1001 · <init body 1001>   // init
```

Init body (1001 bytes):
`81 3c` varint = 188 → `Capabilities.serverString` (188 chars
`A=t&SA=t&…&WD=f`); `86 29` varint = 809 → fb_sig string (809 chars
`fb%5Fsig%5Fsession%5Fkey=…`). (The long init hex is truncated in the log
file; the two leading varints above are the reliable framing.)

### 9.2 Handshake batch 2 — 7 startup calls (CONDITIONAL)

logs.txt:53-79 (body 142 bytes), full hex:

```
00ff7a616c32654561616e61616962475442354f713643364f4e5733742e30465848655f713553384947
746e6469556e33484e7a64765576756a3372647532414b6a6b6e3139687a316263443139466c4a6d326d
6461556d7469326e7447596f6471576d6330336d744b596d7469326f647a74375a4d6876527137725703
07f90003000200f8001400f601002c00
```

Decoded: `0 · 255 · str(session 122) · batchMode 3 (CONDITIONAL) ·
count 7` then the sub-requests `249,0 · 3,0 · 2,0 · 248,0 · 20,0 ·
246,1 body=00 (getPricepoints with empty country) · 44,0`.

### 9.3 saveProfile (first save of the session)

logs.txt:554-580 (body 332 bytes), full hex:

```
00ff7a616c32654561616e61616962475442354f713643364f4e5733742e30465848655f713553384947
746e6469556e33484e7a64765576756a3372647532414b6a6b6e3139687a316263443139466c4a6d326d
6461556d7469326e7447596f6471576d6330336d744b596d7469326f647a74375a4d6876527137725702
02f900058148
020a31313330353731353836849b8cce42066469707079738499400b6a00000156011300000002000000
2500000000000000000000012c000000010000000000000001000000000000000e0000001c0000000000
000000000000000000000000000000000001000000000000000001000000011712140900018e5a0208
000005020431303031876986eef4000300020431303032876a000200020431303033876b0002000204
31303034876c000100020a31313330353731353836849b8cce4200010018008d70
```

Decoded against §8 (verified: reader lands exactly at the 200-byte body
boundary):

```
networkUid      {network:2, networkUid:"1130571586", playfishUid:1130571586}
restaurantName  "dippys"
gourmetPoint    68800   (varint 84 99 40)
trashPoint      11
demandPoint     106
musicPlay       0
isInStreet      false
hasAwards       true    (86-byte awards blob follows: 01 13 00 00 00 02 …)
userLevel       9
activeFloorIndex 0
saveVersion     1
timeOnClient    1882    (ms since init)
audit count     2
  [0] action 8 updateEmployee, newCredits 0, creditsDelta 0,
      employees (5):
        {2,"1001",1001}  happiness 14400000 task 3 notify false
        {2,"1002",1002}  happiness 0       task 2 notify false
        {2,"1003",1003}  happiness 0       task 2 notify false
        {2,"1004",1004}  happiness 0       task 1 notify false
        {2,"1130571586",1130571586} happiness 0 task 1 notify false
  [1] action 24 creditChangeOffLine, newCredits 0, creditsDelta 888
```

`14400000` ms = 4 h = the server's `EMPLOYEE_MAX_WORK_TIME_MS`
(responders.ts:62). Later saves in the log show the same employee id with
`happiness` decreasing (remaining work time), `saveVersion` incrementing
1→2→3…, and `timeOnClient` growing (1882 → 1400 → 59970 → 120010 → …).

---

## 10. Seeded profile shape (new level-1 player)

`defaults.ts` + `profile-store.ts`. A fresh account (or the `'0'` default
player) is created by `ensureProfile` (profile-store.ts:435-521) with
`seedStarterItems: true`.

- `network = 2` (FACEBOOK_NETWORK defaults.ts:1); `credits 0`, `playCount
  1`, `userLevel 1`, `gourmetPoint 0`, `trashPoint 0`, `demandPoint
  DEFAULT_NEW_PLAYER_DEMAND = 120` (defaults.ts:96), `musicPlay 0`,
  `gender 0`.
- **Owned items** = `STARTER_BUILDING_ITEMS` (11, defaults.ts:59-71) +
  `STARTER_RESTAURANT_ITEMS` (18, defaults.ts:73-92) = 29 items, seeded
  with **negative `serverId`** `-(index+1)` (`seedOwnedItems`
  profile-store.ts:541-557) and `employeeNetwork 0`, `roomIndex 0`.
  Notable: building base 2060000, roof 2020001, door 2010012, banner
  2070000, windows 2000014 ×2, wall 2050008, flower beds 2040002 ×2, menu
  board 2040017, trashcan 2040011; stove 3070000, door 3010000, windows
  3000011 ×2, chairs 3040001 ×3, tables 3030010 ×3, wall tiles 3060016 ×2,
  achievement panel 3200000, letter box 3300000, menu holder 3100000,
  bushes 3020003 ×3.
- **Recipes** (inventory items where `number` = recipe level):
  `5000008` Garden Salad, `5100003` Burger and Fries, `5200000` Fruit
  Selection — level 1, `isSelected true` (defaults.ts:104-108,
  profile-store.ts:559-566).
- **Ingredients**: 4000005 Beef×1, 4000013 Egg×2, 4000031 Potato×1,
  4000034 Salad×2, 4000036 Strawberry×1, 4000040 Tomato×2, 4000047 Apple×1
  (defaults.ts:114-122).
- **Floors**: indexes `[0, 1]`, each `20×40 = 800` tiles, all `0`
  (profile-store.ts:127-128, 577-583, 785-787).
- **Friends**: 6 seeded NPCs `1001..1006`, same fresh level-1 state,
  differing by name/gender (defaults.ts:128-152).

Ingredient market (getUserProfile tail) seeds 3 items at price 1000:
4000000, 4000001, 4000002 (rpc-store.ts:92-96).

---

## 11. AMBIGUITIES & gotchas (AS3 vs TS server)

1. **`lastSave` (getUserProfile field #19).** Server writes *elapsed
   seconds since last save* (`elapsedSinceLastSave`, responders.ts:168,
   208-215) — a countdown, not a timestamp. The AS3 reader names the slot
   `lastSave` (RpcResponse.as:53) and the original likely sent an absolute
   "seconds since save" value for offline-earnings. Treat as "seconds since
   last save" on the wire; do not assume it is an epoch timestamp.

2. **`profileUrl` vs `largeImageUrl` (field #7).** Server DB/writer uses
   `largeImageUrl` (responders.ts:156); the AS3 reader stores it in
   `UserInfo.profileUrl` (RpcResponse.as:38) and leaves `largeImageUrl`
   unpopulated. Byte position is identical; only the semantic name differs.
   The HTML5 client should store whatever the server sends at slot #7.

3. **`newCredits` in every AuditChange.** The client writes the varint but
   `SaveProfileHandler` never sets it (so it is always `0`; `NaN` coerces
   to 0 in `writeUintvar31`). The server only honors `> 0`
   (save-profile-parser.ts:153-155). Always emit `0` unless you have a
   deliberate absolute-balance reset.

4. **`saveFloor` (action 7) has no floor index.** AS3 `writeAuditChange`
   for `saveFloor` writes only `array<varint> tiles` (RpcRequest.as:92-94);
   the server hard-codes `floorIndex: 0` (save-profile-parser.ts:308-314).
   Use `saveFloors` (50) to carry a per-floor index.

5. **Employee `happiness` is remaining work time in ms.** The AS3
   `Employee.happiness` field actually holds `workTime` ms
   (SaveProfileHandler.getEmployees, SaveProfileHandler.as:601-617). The
   server clamps it to `[0, 4h]` (responders.ts:62, 115-117) and stores it
   as-is. Captured value `14400000` = 4 h.

6. **`saveVersion` off-by-one.** The server echoes the client's
   `saveVersion` unchanged (responders.ts:264) but stores
   `audit.saveVersion + 1` (profile-store.ts:277); the client increments
   after each save (`saveVersion = returned + 1`). The server never
   validates it, so the drift is cosmetic — but do not expect the echoed
   value to be the stored value.

7. **Plot time units.** `plantWetTime`/`timeToDry` are **seconds** on the
   wire and in the DB; the client multiplies by 1000 into ms
   (RpcResponse.as:162-163). `ingredientId` is a varint; `plotId` is u8.

8. **`getUsers` context byte.** The request's leading `u8 itemContext` is
   written by the client but ignored by the server (responders.ts:650-652).
   Still emit it for byte-compatibility.

9. **init body is ignored.** The server's `initResponder` discards the
   `Capabilities.serverString` + fb_sig body and returns an empty string;
   the client only adopts a non-empty returned session id. The envelope
   session string is otherwise carried, not validated.
