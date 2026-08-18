# Documentation index

The docs describe **how to rebuild** Restaurant City 0.9.143a as an HTML5
client. They are the single source of decisions; agents must keep them in
sync with implementation (see `../AGENTS.md` and the `rc-docs-discipline`
skill).

| # | Doc | Answers |
|---|---|---|
| 01 | [charter](01-charter.md) | Why we're building, fidelity tiers, non-goals, risks |
| 02 | [architecture](02-architecture.md) | Runtime layers, module map, rendering & simulation model |
| 03 | [game-systems](03-game-systems.md) | Every gameplay system and its AS3 spec classes |
| 04 | [asset-pipeline](04-asset-pipeline.md) | SWF extraction -> atlases/audio/manifest |
| 05 | [network-protocol](05-network-protocol.md) | Binary RPC wire format and data files |
| 06 | [ui-hud](06-ui-hud.md) | Screen/panel/popup inventory |
| 07 | [testing-and-qa](07-testing-and-qa.md) | Test tiers, determinism, parity verification |
| 08 | [roadmap](08-roadmap.md) | Milestones M0-M6 and acceptance criteria |
| 09 | [conventions](09-conventions.md) | Code, git, doc discipline |
| 10 | [glossary](10-glossary.md) | Game vocabulary |
| 11 | [data-formats](11-data-formats.md) | The `bin-xml` data files and their readers |
| — | [adr/](adr/README.md) | Decision records (immutable; superseded by newer ADRs only) |
| — | [status.md](status.md) | Living progress tracker (updated every session) |
| — | [specs/](specs/README.md) | Derived behavior notes extracted from AS3 |

**Rule of thumb:** implementation questions -> `03`, `05`, `11` + the
referenced AS3 class; "how do I build/run" -> project `README.md`; "what's
the decision" -> `adr/`; "what's done" -> `status.md`.
