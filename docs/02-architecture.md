# 02 — Architecture

The rebuild mirrors the original client's structure (spec:
`../decompiled/game/scripts/com/playfish/games/cooking/`), translated from
Flash/Away3D into a layered TypeScript design.

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│ src/ui            screens, HUD, popups (Phaser scenes/UI)   │
├─────────────────────────────────────────────────────────────┤
│ src/game          Phaser glue: scenes, renderer, input,     │
│                   fixed-timestep loop, depth sorting        │
├─────────────────────────────────────────────────────────────┤
│ src/systems       gameplay systems over GameState           │
│                   (customers, employees, cooking, placement,│
│                    garden, save audit)                      │
├─────────────────────────────────────────────────────────────┤
│ src/core          state model, economy math, cooking rules, │
│                   pathfinding, seeded RNG  (no framework)   │
├─────────────────────────────────────────────────────────────┤
│ src/net           binary RPC client + bin data readers      │
│                   (no framework)                            │
└─────────────────────────────────────────────────────────────┘
        ▲ dependencies point downward only; core/net import nothing
```

Dependency rule: `ui -> game -> systems -> core/net`. Nothing in `core` or
`net` may import Phaser or DOM types; both layers run under Vitest in Node.

## Runtime flow

Ports the Flash boot sequence (`GameInitLoader.as`, `Engine.as`):

1. **Handshake** — `getServerTime` + `init` against `/g/rpc/cooking`
   (session from the backend cookie flow; dev proxy in `vite.config.ts`).
2. **Main batch** — `getUserProfile`, `getAllFriends`, `getCashBalance`,
   `getMails`, `getPricepoints`, `readBookmarkCount` -> populate `GameState`.
3. **Assets** — load `manifest.json`, then atlases/audio/data (lazy
   per-world where the original did the same).
4. **World** — street or restaurant (play/edit), then the game loop.

Scene flow (mirrors `GameWorld`/`BaseWorld` world classes):

```
Boot -> LoginState -> StreetWorld -> RestaurantPlayWorld
                    \-> RestaurantEditorWorld
                       (recipe menu, hire, customize, shops, popups as overlays)
```

## State model

`src/core/state/GameState` mirrors the profile payloads the backend already
persists (`UserInfo` and friends — see `server/src/rpc/responders.ts`):
scalars (level, gourmet, coins, cash, music, trash, demand, votes...), owned
item placements per floor, inventory, ingredients, garden, employees, mail,
visits, awards. The client treats the server as authoritative and mirrors the
original autosave cadence (`saveProfile` with audit change records).

Mutations run through systems that record audit deltas, exactly like the
Flash client's save payload — this keeps the backend and its `save-profile`
parser unchanged.

## Rendering model

- **Isometric world** rendered as depth-sorted sprites from atlases. Fixed
  iso view with zoom (original had zoom lever, no rotation).
- **Sorting key:** tile row first, then per-object base point, matching the
  original's painter's order (`WorldRestaurant`, `BaseObject`).
- **Grid:** the world is tile-based (interior floors, outside area); items
  are tile-anchored with footprint metadata (`RoomItem`, `BuildingItem`,
  `OutsideAreaSizeItem`).
- **Animation:** Phaser atlas animations for timelines
  (`AnimatedObject`-style states: idle/walk/cook/eat).
- **Portraits:** avatar portraits are pre-rendered composites from layered
  sprite parts (ADR-0003 replaces `Avatar3D`/`CachedAvatar3D`).
- **Culling and pooling** are required once M3 lands (sprite budget in
  `07-testing-and-qa.md`).

## Simulation loop

Fixed 25 Hz simulation tick (original frame rate) decoupled from render
frame; systems consume fixed `dt`, render interpolates. `src/core/rng/`
provides the seeded PRNG port of `utils/Random.as` so tests replay exact
sequences.

## Input

Phaser input events mapped onto the original interaction model: tap/pick an
item (or its occupant), drag-place in editor, context panels, hover tooltips.
Keyboard: original shortcuts where the AS3 defines them (`DebugPanel`,
editor hotkeys).

## Audio

Web Audio via Phaser; exported MP3s converted to ogg/webm with mp3 fallback.
`GameSound` port owns the music/one-shot policy (single music track,
cross-fade, mute/persist through `OverlaySetting`/`GameSettings`).

## Networking boundaries

All server traffic goes through `src/net`. Nothing else may `fetch` or open
sockets. The data files (`bin-xml`) load through the same layer as parsed
typed structures (ADR-0005, doc `11-data-formats.md`).

## Diagnostics

Keep a dev-only debug surface equivalent to the original `DebugPanel` and
`debug/*` classes (add coins/cash, show shop items, toggle gates) behind a
flag — invaluable for parity testing; it was already useful during the Flash
resurrection.
