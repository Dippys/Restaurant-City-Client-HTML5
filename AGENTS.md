# AGENTS.md — rc-html5-client project rules

Project-specific rules for agents working inside `client-html5/`. The
workspace-wide rules live in `../../AGENTS.md` (read that first); these
rules refine them for this codebase.

## Start here, in order

1. `docs/status.md` — what's done and what's next.
2. `docs/08-roadmap.md` — the milestone you're working on and its
   acceptance criteria.
3. The doc for your area: `03` systems, `05` protocol, `06` UI, `11` data.
4. The AS3 spec classes your area cites — under
   `../decompiled/game/scripts/`.

## Commands

```bat
npm run check   REM strict TS, must stay clean
npm test        REM Vitest unit/component/replay suites
npm run build   REM check + production bundle
npm run dev     REM dev server :5173 (backend ../server must be running)
```

Never commit with `check` or `test` red.

## Layout map

| Path | May contain | Rules |
|---|---|---|
| `src/core` | state, economy, cooking math, pathfinding, RNG | no Phaser/DOM; unit-tested |
| `src/net` | RPC codec/client, data readers | no Phaser/DOM; replay-tested |
| `src/systems` | gameplay systems over core state | no direct fetch; deterministic |
| `src/game` | Phaser scenes, renderer, loop, input | no game rules |
| `src/ui` | HUD, screens, popups | atlas art + lang strings only |
| `docs/` | decisions, specs, status | update in same change |
| `tools/` | pipeline scripts | never write to `../decompiled/` |
| `public/assets/generated/` | pipeline output | generated only; gitignored |
| `tests/` | fixtures, golden captures | committed except `.tmp/` |

## Hard rules

1. **AS3 is the spec.** Every port cites its class
   (`// Spec: decompiled/game/scripts/.../<Class>.as`). Balance numbers are
   read from code/data, never invented.
2. **Wire bytes are sacred.** Net changes must keep replay tests green and
   match `../server/src/rpc/` field-for-field.
3. **No backend changes without an ADR.** If a milestone needs a new server
   surface, stop and propose (additive + byte-compatible only).
4. **`../decompiled/` and original SWFs are read-only.** The pipeline
   consumes them; nothing writes into them.
5. **Generated assets are never hand-edited.** Fix the tool, regenerate.
6. **Determinism:** no `Date.now()`/`Math.random()` in `core`/`systems`;
   time is injected, randomness is the seeded PRNG.
7. **Definition of done** (per change): `check` + `test` green, `build`
   succeeds, docs/status updated, evidence linked where the change is
   user-visible.

## Session rhythm

- Open: read `docs/status.md` and the workspace `../../AGENTS.md` skill
  list; load the skills your task matches.
- Close: update `docs/status.md` (done / next / blockers), commit
  conventionally, summarize evidence.

## Useful skills (workspace `.agents/skills/`)

`rc-as3-reference`, `rc-asset-pipeline`, `rc-implement-system`,
`rc-rpc-integration`, `rc-verify-parity`, `rc-docs-discipline`,
`rc-code-review`.
