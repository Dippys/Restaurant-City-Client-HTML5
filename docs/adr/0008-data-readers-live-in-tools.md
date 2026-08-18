# ADR-0008 — Data readers live in tools/lib/data (tool-time, plain ESM JS)

Status: accepted · Date: M1 session · Supersedes: ADR-0005 (placement detail only)

## Decision

The bin-xml readers (the code that parses the original data files into the
runtime JSON) live in `tools/lib/data/` as plain ESM JavaScript with JSDoc,
tested by Vitest. The runtime (`src/net`) consumes only the generated JSON.

## Context

ADR-0005 placed the readers in `src/net/data/`. Implementation surfaced a
toolchain reality: the readers must run from the pipeline (plain Node ESM
scripts under `tools/`), and running TypeScript there would require either
a build step or Node type-stripping with its constraints (erasable-only
syntax, `.ts` import extensions). All pipeline tooling is already plain
ESM; splitting readers across `src` and `tools` would create two mechanisms
for one job. The conversion logic is exactly the code vitest covers either
way.

## Consequences

- `tools/lib/data/` holds the readers; `tests/lib/data-readers.test.mjs`
  covers them (E4X-semantics unit tests + real-file checks).
- Runtime loads `public/assets/generated/data/*.json` through the manifest
  — `src/net/data/` keeps only the typed runtime models when systems need
  them.
- `rc-rpc-integration` skill updated to point at the real location.
