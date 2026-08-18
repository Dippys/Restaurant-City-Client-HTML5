# ADR-0002 — Reuse the existing backend and wire format unchanged

Status: accepted · Date: first session · Supersedes: none

## Decision

The client speaks the **existing PlayFish binary RPC** and the existing
`saveProfile` audit format, against the existing backend in `../server`,
byte-exactly. No parallel API is introduced.

## Context

The backend already implements the full call table (28 cooking + shared
calls), persists profiles in SQLite, serves the data files, and is proven
against the original client. Rewriting or adding a second API duplicates
risk and splits effort.

## Consequences

- `src/net` is a byte-exact client-side port (primitive readers/writers,
  batch envelope, per-call bodies), mirroring `../server/src/rpc/`.
- Backend changes remain possible but must be additive, byte-compatible,
  and recorded in a new ADR (e.g. static-serving the production bundle at
  M6).
- Replay tests against captured traffic are mandatory (see
  `docs/05-network-protocol.md`).
