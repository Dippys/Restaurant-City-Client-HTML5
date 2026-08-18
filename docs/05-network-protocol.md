# 05 — Network protocol & data access

The client reuses the existing backend and speaks its wire formats exactly.
Server-side truth: `../server/src/rpc/codec.ts` (primitives), `index.ts`
(envelope), `responders.ts` (bodies), `save-profile-parser.ts` (audit).
Client-side spec: `../decompiled/game/scripts/com/playfish/rpc/`.

## Endpoints

| Path | Purpose |
|---|---|
| `POST /g/rpc/cooking` | Main binary RPC endpoint |
| `/g/billing/*`, `/g/fbfeed/*` | Billing/feed paths (legacy; handled same envelope) |
| `/bin-xml/<name>` | Data files (fuzzy-matched by the backend) |
| asset paths | At runtime the client uses its own generated `public/assets/` |

Dev: Vite proxies the first three to `http://localhost:8090` so session
cookies work through a single origin (`vite.config.ts`).

## Binary primitives (big-endian)

- **varint** — base-128, MSB-first groups: `value = (value<<7) | (b&0x7f)`
  while `b & 0x80` (continuation bit on all but the last byte).
- **string** — `varint(charCount)` then UTF-8 bytes; count is **characters**.
- **date** — `varint(epochSeconds)`; `0` = null.
- **bool** — one byte.
- **array** — `varint(count)` then elements.

## Request framing

Single call: `u8 encapsulation(0) · u8 msgType · str sessionId · args...`.
Batch (`msgType 255`): header, then `u8 batchMode · varint subCount ·
subCount × (u8 subMsgType · varint subBodyLen · subBody)`.

## Response framing (what the client parses)

Single: `u8 encapsulation · u8 responseType(=msgType, or 0=ERROR) · body`.
Batch: `u8 0 · u8 255 · varint count · count × (u8 type · varint len ·
body)`; sub-errors are `type 0, len 0`. **Order mirrors the request.**

**Byte-exactness:** after every response body the client must be at exactly
the declared length (the Flash client calls `isDone()`; a mismatch fails the
whole batch). Ports of the response readers must therefore match the
server's writers field-for-field — implement against `responders.ts`, not
from memory of the AS3 alone, and add replay tests from captured traffic.

## Call table (msgType)

Shared: 0 ERROR · 1 init · 246 getPricepoints · 247 pollEvents ·
248 getCashBalance · 249 getServerTime · 250 getPurchasableItems ·
251 recordGameEvent · 253 getTimeToken0 · 254 ping · 255 batchOperation.

Cooking: 2 getAllFriends · 3 getUserProfile · 4 getUsers · 5 saveProfile ·
17 swapIngredient · 19 sendMail · 20 getMails · 25 quizzReply ·
32 buyMystryBox · 34 storeImage · 35 rankRestaurant ·
36 firstTimeVisitFriend · 37 getRandomStreetUsers · 38 getGourmetStreetUsers ·
40 purchaseCoinsWithPfCash · 41 purchaseCashItem ·
42 purchaseCashItemIngredients · 43 waterFriendGarden · 44 readBookmarkCount ·
45 writeBookmarkCount · 46 sendNotification.

All are implemented server-side (see `../server/README.md`). Client work is
request building + response parsing, never server changes.

## Session & auth

The backend issues an HttpOnly session cookie via its login flow; the client
just carries cookies (works through the dev proxy). Session expiry shows the
login screen. Do not implement a parallel auth scheme.

## Data files

The original client parsed the `bin-xml` files itself (`ResourceHandler.as`
and the data classes). The rebuild ports those readers once, in
`src/net/data/`, and the pipeline pre-converts files to typed JSON at build
time (ADR-0005). Runtime only loads JSON; readers are tool-time code plus
tests. File inventory and reader mapping: `docs/11-data-formats.md`.

## Testing

- Replay tests: capture real request/response pairs from the backend
  dashboard (`http://localhost:8090/__dash`) or `../server/logs.txt`, and
  assert our codec decodes/encodes them byte-identically.
- Property round-trips for varint/string edges (multibyte, empty, lengths
  at 7-bit boundaries).
- `saveProfile` audit round-trips against fixtures from the real client.
