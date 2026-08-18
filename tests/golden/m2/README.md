# M2 evidence — core loop

Milestone: `docs/08-roadmap.md` M2. Wire-level acceptance proven end-to-end
against the live backend; scene rendering needs a human visual pass (see
"needs eyes" below).

## 1. RPC client + login flow

- `src/net/` codec + client: 96/96 tests; replay tests parse the REAL
  captured Flash traffic from `server/logs.txt` byte-exactly.
- `tests/net/e2e-boot.test.ts` (opt-in `RC_E2E=1`, backend on :8090):
  signs up / logs in, runs OUR handshake + 7-call main batch, and parses
  the seeded level-1 profile: version 5, 29 owned items, 2 floors x 800
  tiles, 3 starter recipes, 6+ NPC friends. **PASSES.**

## 2. GameState from getUserProfile

- Version-gated profile reader (`src/net/profile.ts`) round-trip tested
  (v2 friend + v5 full sections); live-verified in the e2e test.

## 3. saveProfile audit round-trip (persists across reloads)

- `buildSaveProfileBody` reproduces the ORIGINAL client's captured save
  200/200 bytes (golden test).
- e2e: our `saveOwnedItem` audit moved item 3020003 x7->x8 on the live
  backend; the reloaded profile shows x=8. **PERSISTENCE PROVEN.**

## 4. Scenes (street + restaurant + editor)

- Boot -> login redirect -> handshake -> main batch -> world assets ->
  street; street renders the player's building from owned building items
  (outdoor_asset art by `className`) + friend slots (default buildings
  until M5 getUsers details).
- Restaurant: iso floor (80x40 diamonds), walls, placed interior items
  depth-sorted by the ported drawPriority, camera pan with AS3 bounds,
  zoom 1.4/1.0/0.6 (wheel).
- Editor: group/item shop toolbar, pick -> validity grid (ported isValid),
  place (coin spend), move, sell, Play -> saveProfile audit commit ->
  reload -> re-render.

## 5. Needs eyes (human visual pass on http://localhost:5173)

- Street: buildings/portraits look right; own building clickable.
- Restaurant: floor/items positioned sanely; depth order plausible.
- Editor: pick/place/move/sell feel correct; save persists after refresh.
- Known deviations: item art anchors at tile bottom-center (no per-symbol
  pivot metadata yet); friend buildings are placeholder silhouettes.

## 6. Run it

```bat
cd server && npm start            REM backend :8090
cd client-html5 && npm run dev    REM client :5173 (proxied)
```
