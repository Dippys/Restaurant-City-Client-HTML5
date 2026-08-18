# public

Runtime assets served at the site root during development.

- `assets/generated/` — atlas/audio/data output from `tools/` (gitignored;
  regenerated from the original SWFs and `bin-xml/`). See
  `docs/04-asset-pipeline.md` for the manifest contract.
- Anything checked in here must be produced by the pipeline, never edited by
  hand.
