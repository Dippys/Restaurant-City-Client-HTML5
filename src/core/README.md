# src/core

Framework-independent game logic: simulation, state, math, data models.

Rules (see `docs/02-architecture.md` and `docs/09-conventions.md`):

- No Phaser imports. This layer must run under Vitest in Node.
- Ports of the original ActionScript logic (economy, cooking timers,
  pathfinding, RNG) live here, one module per original class family, with the
  source class referenced in the header comment, e.g.
  `// Spec: decompiled/game/scripts/com/playfish/games/cooking/Recipe.as`.
- Deterministic simulation: fixed timestep, seeded RNG (`Random.as` port).

Planned contents (M0+):

- `state/` — the `GameState` model mirroring the profile payloads
- `economy/` — coins, gourmet points, cash, purchases
- `cooking/` — recipes, dish levels, cook queues
- `pathfinding/` — `PathFinder` port
- `rng/` — seeded PRNG port of `com.playfish.games.cooking.utils.Random`
