# ADR-0003 — 2D pre-rendered sprites; no live 3D

Status: accepted · Date: first session · Supersedes: none

## Decision

The world renderer is pure 2D isometric sprites. Away3D/Collada content is
**not** ported as live 3D. Avatar portraits are recomposed as layered 2D
sprites from the avatar part catalog.

## Context

The original used Away3D 2.x for the 3D avatar (`Avatar3D`,
`CachedAvatar3D`) and Collada models, but cached results into bitmaps
(`CacheAvatarPortraitQueueItem`) — i.e. gameplay already consumed 2D
images. Running a 3D engine adds a dependency and pixel-parity burden for
no P0 benefit.

## Consequences

- No three.js/Babylon dependency in the core client.
- The asset pipeline must extract avatar part sprites with their layering
  metadata so portraits compose identically (M5/M6 verification against
  reference captures).
- If a future milestone finds a 3D-only effect that cannot be faked with
  sprites, revisit via a new ADR with evidence.
