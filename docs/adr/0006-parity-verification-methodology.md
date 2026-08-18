# ADR-0006 — Parity verification: AS3-as-spec + side-by-side

Status: accepted · Date: first session · Supersedes: none

## Decision

Behavioral correctness is judged against the **decompiled AS3 source** as
spec, with **side-by-side runs of the original client** (Ruffle at
`http://localhost:8090/game`) and the rebuild as evidence. Wiki/blog
knowledge is hints only.

## Context

The workspace uniquely contains a complete, recompilable decompilation of
the game and a backend that runs the original client — the strongest
possible parity harness. Balance numbers and flows exist in code; memory
and fan wikis disagree with each other.

## Consequences

- Every port cites its spec class (`docs/09-conventions.md`).
- Milestone closes require parity captures and (for net/save) traffic
  replay tests — `docs/07-testing-and-qa.md` defines the method.
- Where AS3 is ambiguous (decompiler artifacts), the running original
  client is the tiebreaker; record the finding in `docs/specs/`.
