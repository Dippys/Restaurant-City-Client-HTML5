# Status — Restaurant City HTML5 rebuild

Living tracker. **Update this file at the end of every working session**
(rule in `../AGENTS.md`). Facts only; link evidence.

## Current

- Phase: **M1 — Asset pipeline complete**
- Focus: apply the proven pipeline to the remaining atlas SWFs
  (`perk_asset`, `avatar_asset`, `game_asset`, `indoor_asset`,
  `outdoor_asset`, `preloader_asset`), then `build-audio.mjs` and the
  `bin-xml` data readers.

## Milestones

| # | Milestone | State | Evidence |
|---|---|---|---|
| M0 | Scaffold & pipeline proof | **done** | `tests/golden/m0/README.md` |
| M1 | Asset pipeline complete | not started | — |
| M1 | Asset pipeline complete | not started | — |
| M2 | Core loop | not started | — |
| M3 | Restaurant gameplay | not started | — |
| M4 | Menus & progression | not started | — |
| M5 | Social & meta | not started | — |
| M6 | Polish & parity | not started | — |

## Session log

| Date | What | Done by |
|---|---|---|
| 2026-07-31 | **M0 closed.** Pipeline tooling (extract-symbols, build-atlases, build-manifest, verify-pipeline, preview-frames) implemented; `ingredient_asset.swf` at 92/92 symbols (100%), 161 frames, labeled keys (`apple/idle`, `apple/grey`); BootScene renders animated atlas sprite + proxy/coverage status; dev proxy verified (2764 bytes identical to backend); 12/12 tests; reproducible SHA-256 outputs. Evidence: `tests/golden/m0/README.md`. | M0 session |
| 2026-07-31 | Program bootstrapped: `client-html5/` scaffold (Vite+TS+Phaser 3, strict tsconfig, proxy to `:8090`), full docs set (`docs/01-11`, 7 ADRs, status/roadmap), workspace `AGENTS.md` + `README.md`, 7 skills in `.agents/skills/`, git repo initialized. Verified: `npm install`, `npm run check` (strict TS), `npm run build` all pass (commit `1bba03f`). | setup session |

## Blockers

None.

## Decisions pending

- Confirm any `docs/11-data-formats.md` reader mappings during M1.
- Backend integration for production serving (M6) — needs an ADR if the
  server must change.
