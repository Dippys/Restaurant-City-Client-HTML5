# 07 — Testing & QA

## Test tiers

| Tier | Runner | Scope | Required for |
|---|---|---|---|
| Unit | Vitest (Node) | `src/core`, `src/net`: codec round-trips, data readers, economy math, cooking timers, pathfinding, seeded RNG | every PR-touching logic |
| Component | Vitest + jsdom | systems driven through scripted update loops with mocked net | state machines (customer lifecycle, cook queue) |
| Parity replay | Vitest (Node) | captured wire traffic decoded/encoded byte-identically; `saveProfile` audit round-trips | net layer, save system |
| Browser smoke | Playwright (add when M2 lands) | boot, login, first world render, no console errors | every milestone close |
| Visual parity | manual + captures | side-by-side original (Ruffle at `:8090/game`) vs rebuild; screenshot pairs stored in `tests/golden/` | P1 claims in milestone closes |
| Performance | manual + budget script | frame time under load (crowded restaurant, zoomed out) | M3+ |

## Determinism rules

- Simulation uses a fixed 25 Hz tick; render never mutates simulation state.
- All randomness flows through the seeded PRNG port of `utils/Random.as`;
  tests can pin seeds and assert exact sequences.
- Time is injectable everywhere (no direct `Date.now()` in `core`/`systems`).

## Parity method (the core QA loop)

1. Run the original client (`../server`, then `http://localhost:8090/game`)
   and the rebuild side by side on the same account/flow.
2. Diff observable behavior: screens, item states, RPC traffic (backend
   dashboard `/__dash` shows both clients' requests).
3. Record findings as `tests/golden/<milestone>/<flow>.md` with captures and
   the traffic excerpts.
4. P0 divergence = bug; P1 divergence = tracked decision or fix; P2 = noted,
   never blocking.

## Performance budget (P0 once M3 lands)

- 60 fps render on mid-range hardware at 1x zoom with a full restaurant;
  never below 30 fps at max zoom-out on the street.
- Atlases (no per-frame image swaps where timelines exist), pooled actors,
  culled off-screen items; a `BitmapBatch`-equivalent for static decor.
- Budget checks are part of milestone close; regressions reopen the
  milestone.

## Milestone gates (see `docs/08-roadmap.md`)

Every milestone closes only when: `npm run check` clean · unit/component
tests green · browser smoke pass · acceptance criteria demoed with captures ·
`docs/status.md` updated. Parity evidence is stored under `tests/golden/`,
not described in prose.

## Known Flash-specific pitfalls to test for

- Off-by-one tile footprints at area edges (original had tile rules).
- Timeline animation label misses (`BaseObject` button states had missing
  labels in the Flash resurrection — the rebuild must define tolerant
  fallbacks up front).
- Multibyte strings in the RPC varint char/byte distinction.
- Save field ordering (the Flash client reads profile fields in a strict
  order — the audit writer must emit the same order; replay tests enforce
  this).
