# 01 — Project charter

## Mission

Rebuild the **Restaurant City 0.9.143a** game client and its assets as a
browser-native HTML5/TypeScript application that runs against the existing
local backend in `../server`, recreating the original game loop, art, and
feel without Flash.

## What we start from

- The original `game.swf` (798 classes) is fully decompiled under
  `../decompiled/game/scripts/` and recompiles cleanly — it is the
  **behavioral spec** for every system.
- The asset SWFs (`*_asset.swf`) are intact at the workspace root and already
  have extraction projects under `../decompiled/<name>_asset/`.
- The backend answers the full binary RPC surface and persists profiles in
  SQLite; the original client boots against it.

## Fidelity tiers

Rebuild work is judged at three tiers, in priority order:

| Tier | Name | Meaning |
|---|---|---|
| P0 | **Gameplay parity** | Same mechanics, flows, timings, economy math, save format. A player who knew the original should not be able to tell the rules changed. |
| P1 | **Visual similarity** | Same art assets, layouts, animations, and UI structure, at 760x600 logical resolution with zoom. Minor rendering differences (filters, gradients) acceptable. |
| P2 | **Pixel parity** | Byte-identical rendering to the Flash renderer. Nice-to-have, never blocks P0/P1. |

Numeric balance values (cook times, coin rewards, level curves) are **never
invented** — they come from the AS3 constants and data files.

## Goals

1. A playable single-player restaurant sim: build, cook, serve, earn, level,
   decorate, garden, visit friends' restaurants, street ranking.
2. Full offline capability through the local backend and local accounts.
3. An automated asset pipeline that converts every original asset SWF and
   `bin-xml` data file into web formats.
4. Parity verification tooling (side-by-side original vs rebuild).

## Non-goals (explicit)

- No Facebook/Myspace/Bebo integration. Social features are replaced by the
  local backend's account system (already exists).
- No real-money payments. PlayFish Cash is an in-game local currency as the
  backend already models it.
- No server rewrite. Backend changes are allowed only when a missing surface
  blocks a milestone, must be additive/byte-compatible, and need an ADR.
- No new original art. We convert, not create, assets.

## Constraints

1. **AS3 is the spec.** Behavioral questions are settled by reading the
   decompiled source; wiki/blog memories are hints only.
2. **Wire compatibility.** The client speaks the existing binary RPC and
   `saveProfile` audit format unchanged (ADR-0002).
3. **760x600 @ 25fps logical frame** — the original stage size and tick rate.
4. **Read-only `../decompiled/` and original SWFs.** The rebuild never
   modifies them.

## Principles

- **Determinism:** fixed-timestep simulation, seeded RNG — testable and
  diffable against the original.
- **Port over reinvent:** where the AS3 has an algorithm (pathfinding,
  economy, dish logic), port it; where it has Flash-isms, reimplement the
  *behavior*.
- **Vertical slices:** every milestone ends in something playable, not a
  layer.
- **Evidence of done:** milestones close with parity evidence (side-by-side
  captures, traffic diffs), not "looks right".

## Top risks

| Risk | Mitigation |
|---|---|
| SWF vector/timeline fidelity in export | Prove the pipeline on the smallest asset SWF first (M0); spot-check symbols against the Ruffle reference |
| Away3D/Collada 3D pieces | Out of scope for the world renderer: pre-rendered sprites (ADR-0003) |
| Flash text/fonts | lang bins + web/system fonts, measured against reference |
| Binary RPC byte-exactness | Port the codec from the already-proven server implementation; replay real captured traffic in tests |
| Performance with many animated sprites | Atlas batching, pooling, culling; budget in `07-testing-and-qa.md` |
| Scope creep | Milestone gates in `08-roadmap.md`; non-goals above are binding |

## Success

The rebuild is done when M6 closes: a new player can sign up on the local
backend and play through the full loop — build, cook, serve, earn, decorate,
level, visit, rank — in a modern browser, with the original look and rules.
