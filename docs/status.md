# Status — Restaurant City HTML5 rebuild

Living tracker. **Update this file at the end of every working session**
(rule in `../AGENTS.md`). Facts only; link evidence.

## Current

- Phase: **M2 — Core loop (wire layer done; visual pass pending)**
- Focus: user verifies the live scenes on :5173 (street, restaurant,
  editor save/reload). Then: close M2, start M3.

## Milestones

| # | Milestone | State | Evidence |
|---|---|---|---|
| M0 | Scaffold & pipeline proof | **done** | `tests/golden/m0/README.md` |
| M1 | Asset pipeline complete | **done** | `tests/golden/m1/README.md` |
| M2 | Core loop | not started | — |
| M1 | Asset pipeline complete | not started | — |
| M2 | Core loop | not started | — |
| M3 | Restaurant gameplay | not started | — |
| M4 | Menus & progression | not started | — |
| M5 | Social & meta | not started | — |
| M6 | Polish & parity | not started | — |

## Session log

| Date | What | Done by |
|---|---|---|
| 2026-07-31 | M2 core-logic slice: spec extraction done (`docs/specs/world.md`, `editor.md`, `rpc-profile.md` — all class+citation-cited); iso math, depth priorities, street layout, item footprint/types/validity, editor state machine + room map + autosave timer ports; profile readers (version-gated §6 layout) + `GameState` (level room sizes); **saveProfile audit writer byte-exact against the original client's captured save** (200/200 bytes golden test); 96/96 tests. | M2 session |
| 2026-07-31 | **M1 closed.** All 7 atlas SWFs at 100% symbol coverage (ingredient 92, perk 17, avatar 326, game 798/7184f, indoor 893/5286f incl. 21 bitmaps, outdoor 350/3991f, preloader 5/204f); paged packer + frame dedup; 18 audio tracks (mp3 passthrough, ADR-0009); all bin-xml -> typed JSON (readers in tools/lib/data, ADR-0008; lang_en 608, lang_fr 34, 20 challenges); manifest + verify green; 35/35 tests; full-rerun SHA-256 reproducible (581 files); live probes 200 through :5173. Known follow-ups: game_asset atlas weight (M3 perf), preloader wide frames (M2). Evidence: `tests/golden/m1/README.md`. | M1 session |
| 2026-07-31 | **M0 closed.** Pipeline tooling (extract-symbols, build-atlases, build-manifest, verify-pipeline, preview-frames) implemented; `ingredient_asset.swf` at 92/92 symbols (100%), 161 frames, labeled keys (`apple/idle`, `apple/grey`); BootScene renders animated atlas sprite + proxy/coverage status; dev proxy verified (2764 bytes identical to backend); 12/12 tests; reproducible SHA-256 outputs. Evidence: `tests/golden/m0/README.md`. | M0 session |
| 2026-07-31 | Program bootstrapped: `client-html5/` scaffold (Vite+TS+Phaser 3, strict tsconfig, proxy to `:8090`), full docs set (`docs/01-11`, 7 ADRs, status/roadmap), workspace `AGENTS.md` + `README.md`, 7 skills in `.agents/skills/`, git repo initialized. Verified: `npm install`, `npm run check` (strict TS), `npm run build` all pass (commit `1bba03f`). | setup session |

## Blockers

None.

## Decisions pending

- Confirm any `docs/11-data-formats.md` reader mappings during M1.
- Backend integration for production serving (M6) — needs an ADR if the
  server must change.
