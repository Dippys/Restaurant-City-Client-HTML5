# ADR-0005 — Data files: ported readers at tool time, JSON at runtime

Status: accepted · Date: first session · Supersedes: none

## Decision

The `bin-xml` data files are parsed by **ported TypeScript readers that run
as tool-time code**; the pipeline emits typed JSON that the runtime loads.
The readers stay in `src/net/data/` with unit tests against the real file
bytes.

## Context

The original client parsed these files itself each boot. Porting the
readers is unavoidable either way; the only question is where they run.
Running them in the browser adds boot cost and duplicate parsing per
session; running them in the pipeline gives versioned, diffable JSON and a
single parse.

## Options

| Option | Verdict |
|---|---|
| Tool-time readers -> JSON at runtime | Chosen |
| Browser-side parsing at runtime | Rejected: redundant per-session cost, harder to test; kept as fallback if the server ever serves files not covered by the manifest. |
| Server-side JSON API | Rejected for now: requires backend surface changes (ADR-0002 discipline) for no client benefit. |

## Consequences

- `docs/11-data-formats.md` tracks per-file reader verification (M1).
- Any server-served data file the manifest doesn't cover must fail loudly,
  not parse silently.
