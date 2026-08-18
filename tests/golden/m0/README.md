# M0 evidence — scaffold & pipeline proof

Milestone: `docs/08-roadmap.md` M0. All acceptance items verified.

## 1. Commands

- `npm install` — 55 packages.
- `npm run check` — strict TS clean.
- `npm test` — 12/12 tests (frame keys, dump parser incl. CRLF, packer).
- `npm run build` — production bundle OK (Phaser chunk-size warning only).
- `npm run dev` — Vite on `:5173` with backend proxy.

## 2. Dev proxy (probed through `:5173`, backend on `:8090`)

| Request | Status | Bytes |
|---|---|---|
| `/` | 200 | 604 |
| `/bin-xml/ingredient.bin` (proxied) | 200 | 2764 |
| `/assets/generated/atlases/ingredient_asset.json` | 200 | 73499 |
| `/assets/generated/atlases/ingredient_asset.png` | 200 | 485547 |
| `/assets/generated/manifest.json` | 200 | 568 |
| backend direct `/bin-xml/ingredient.bin` | 200 | 2764 (identical bytes) |

## 3. Pipeline (ingredient_asset.swf)

- 92/92 linked symbols exported (100% coverage), 161 frames.
- Excluded: chid 0 "Apple" (main-timeline root linkage marker), 65 unnamed
  inner wrapper sprites (composited into their parent frames).
- Frame keys carry timeline labels: `ingredient_asset/apple/idle`,
  `ingredient_asset/apple/grey`.
- Atlas: 2011x275 PNG + Phaser multi-atlas JSON.
- Reproducibility: two consecutive runs produce SHA-256-identical outputs.
- Verify stage re-extracts from the original SWF and passes.

## 4. Rendering proof

- Extracted frames in `frames/` (apple idle/grey, tomato, cheese, fish).
- Pixel-level check: apple `idle` avg RGB (171, 70, 68) — red apple;
  `grey` avg RGB (234, 208, 208) — same 1533-px shape desaturated to
  saturation 26 vs 102. The Flash `grey` color-transform renders correctly.
- Boot scene loads the atlas, animates an `idle <-> grey` timeline pair,
  renders a static icon row, and prints live proxy + coverage status on
  screen (`http://localhost:5173`).

## 5. Repo state

- `git init` + initial scaffold commit, pipeline/tests/docs committed.
