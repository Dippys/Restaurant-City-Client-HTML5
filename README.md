# Restaurant City HTML5 — client rebuild

An HTML5/TypeScript rebuild of the **Restaurant City 0.9.143a** game client
and assets (PlayFish, 2010). The original Flash game is fully decompiled in
this workspace and its local backend is operational, so this project rebuilds
only the **client and the asset pipeline** — no new server work is required.

Status: **M0 — scaffold and pipeline proof** (see `docs/status.md`).

## What exists around this folder

| Path | Role |
|---|---|
| `../decompiled/` | Decompiled AS3 sources (**behavioral spec** — read-only) and per-SWF asset extraction projects |
| `../server/` | Working local backend (HTTP, binary RPC, SQLite persistence, dashboard) on `:8090` |
| `../HANDOFF.md` | Full reverse-engineering handoff: protocol, toolchain, gotchas |
| `..\.agents/skills/` | Agent skills for this rebuild program |
| `../AGENTS.md` | Workspace-wide agent rules |

## Quick start

```bat
REM 1. backend (required for RPC and data files)
cd ..\server
npm start

REM 2. this client
cd ..\client-html5
npm install
npm run dev        REM http://localhost:5173  (proxies RPC/data to :8090)
```

Reference client for parity checks (original game under Ruffle):
`http://localhost:8090/game`.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server on `:5173` with backend proxy |
| `npm run check` | Strict TypeScript check |
| `npm test` | Vitest unit tests (core/net layers) |
| `npm run build` | Type-check + production bundle to `dist/` |

## Documentation

| Doc | Content |
|---|---|
| `docs/01-charter.md` | Mission, fidelity goals, non-goals, risks |
| `docs/02-architecture.md` | Runtime architecture and module map |
| `docs/03-game-systems.md` | Per-system specs mapped to AS3 classes |
| `docs/04-asset-pipeline.md` | SWF -> atlas/audio/data pipeline |
| `docs/05-network-protocol.md` | Binary RPC and data-file contracts |
| `docs/06-ui-hud.md` | Screens, HUD, popup inventory |
| `docs/07-testing-and-qa.md` | Test tiers and parity verification |
| `docs/08-roadmap.md` | Milestones M0-M6 with acceptance criteria |
| `docs/09-conventions.md` | Code, commit, and doc discipline |
| `docs/10-glossary.md` | Game-domain vocabulary |
| `docs/11-data-formats.md` | The `bin-xml` data files |
| `docs/adr/` | Architecture decision records |
| `docs/status.md` | Living progress tracker — agents update this |
| `docs/specs/` | Extracted behavior notes (derived from AS3) |
| `AGENTS.md` | Project-specific agent rules |

Domain references for gameplay details: the [Restaurant City Fandom wiki](https://restaurantcity.fandom.com/wiki/Restaurant_City)
and the [Gamezebo walkthrough](https://www.gamezebo.com/walkthroughs/restaurant-city-walkthrough/).
Where a wiki and the decompiled code disagree, **the decompiled code wins**.
