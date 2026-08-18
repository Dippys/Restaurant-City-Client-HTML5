# ADR-0004 — Atlas format: WebP + Phaser multi-atlas JSON

Status: accepted · Date: first session · Supersedes: none

## Decision

Sprites ship as **WebP atlases (PNG fallback tier if a symbol proves lossy)
with Phaser multi-atlas JSON**, packed per source SWF. Audio ships as
ogg/webm + mp3 pairs.

## Context

The source is vector SWFs; the rebuild consumes raster atlases. Phaser's
multi-atlas format gives per-frame bounds, pivots, and animation metadata
directly to the engine with no custom loader. WebP keeps downloads small
(original SWF assets are ~4 MB total already; atlases at 1x/2x zoom tiers
are larger).

## Consequences

- Pipeline emits `{png,json}` multi-atlas pairs per SWF per scale tier; the
  loader validates keys against `manifest.json` (`docs/04-asset-pipeline.md`).
- Frame keys are a stable contract; renaming breaks scenes.
- Pivot/9-slice metadata must come from the extraction stage, or layouts
  drift from the original.
