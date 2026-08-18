# M1 evidence — asset pipeline complete

Milestone: `docs/08-roadmap.md` M1. Acceptance items verified.

## 1. All atlas SWFs at 100% symbol coverage

| SWF | Symbols | Frames | Pages | Unique | Notes |
|---|---|---|---|---|---|
| ingredient_asset | 92/92 | 161 | 1 | 158 | frame dedup collapses 3 |
| perk_asset | 17/17 | 17 | 1 | 17 | |
| avatar_asset | 326/326 | 326 | 1 | 326 | import-script SWF handled |
| game_asset | 798/798 | 7184 | 340 | 5992 | HUD/panels; 2 oversized frames (road 3738x1963) |
| indoor_asset | 893/893 | 5286 | 12 | 4084 | 872 sprites + 21 bitmap symbols (BitsLossless2) |
| outdoor_asset | 350/350 | 3991 | 6 | 2932 | |
| preloader_asset | 5/5 | 204 | 182 | 185 | 181 oversized frames (2500x600 scene animation) |

`verify-pipeline.mjs` re-checks every SWF against its source: symbol sets
match, atlas PNG headers match JSON sizes, coverage = 100%.

## 2. Audio

- `sound_asset.swf` -> 18 original MP3s (7 music, 11 sfx), ids kept
  (`SfxCoinDrop`, `MusicStreet`, ...). ADR-0009 (mp3 passthrough).
- Boot scene decodes + plays the first SFX on click (Web Audio proof).

## 3. Data files

All `bin-xml` files converted to typed JSON (ADR-0008; readers in
`tools/lib/data/`): 8 ItemDatabase bins, challenges (20), newsletter,
lang_en (608 entries), lang_fr (34 entries — the file is a partial
translation). Excluded by design: model.bin (Collada 3D, ADR-0003),
resconfig.xml (replaced by manifest.json). Verified in
`tests/lib/data-readers.test.mjs` (E4X semantics + real files).

## 4. Reproducibility

Full pipeline rerun produces SHA-256-identical output for all 581
generated files (checked in `tools/.work/hashes-before.txt` vs the rerun).

## 5. Known follow-ups (recorded, not blocking)

- Generated assets total ~190 MB; game_asset dominates (340 pages of
  full-screen UI panel art at 1x). Splitting by screen / scale tiers and
  WebP are M3+ performance work (see `docs/07-testing-and-qa.md` budget).
- preloader_asset's 2500x600 animation frames each get their own page;
  the M2 preloader rebuild can crop to the 760x600 viewport.

## 6. Live probes through :5173 (dev proxy)

manifest.json, audio/SfxCoinDrop.mp3, data/ingredients.json,
lang_fr.json, game_asset.json + page PNGs — all HTTP 200.
