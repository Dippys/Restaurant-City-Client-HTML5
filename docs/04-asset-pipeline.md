# 04 — Asset pipeline

Converts the original SWF/`bin-xml` assets into web formats. Everything the
browser loads is **generated**; nothing is hand-drawn. Pipeline scripts live
in `tools/` (Node, run offline) and emit into `public/assets/generated/`.

## Source inventory

| SWF | Stage | fps | Kind | Content |
|---|---|---|---|---|
| `game.swf` | 760x600 | 25 | pure code | game logic (no assets) |
| `preloader.swf` | 760x600 | 25 | pure code | preloader logic |
| `preloader_asset.swf` | 640x700 | 25 | embed-swf | loading screen graphics, bookmark button |
| `game_asset.swf` | 640x700 | 25 | embed-swf | HUD, panels, buttons |
| `avatar_asset.swf` | 550x400 | 12 | import-script | avatar parts (hair, faces, clothes...) |
| `indoor_asset.swf` | 550x400 | 25 | embed-swf | furniture, appliances, decor |
| `outdoor_asset.swf` | 550x400 | 25 | embed-swf | scenery, pavement, fences, trees |
| `ingredient_asset.swf` | 550x400 | 12 | embed-swf | ingredient icons |
| `perk_asset.swf` | 550x400 | 12 | embed-swf | perk/power-up icons |
| `sound_asset.swf` | 550x400 | 12 | embed-mp3 | SFX + music |

(Source of this table and the FFDec invocation patterns:
`../decompiled/setup-all-swfs.ps1`.)

The per-asset projects under `../decompiled/<name>_asset/` already hold
rebuilt asset SWFs and `_assets/assets.swf` symbol libraries from the Flash
resurrection. The pipeline may consume those, but the **original root SWFs
remain the source of truth** — regeneration must always be possible from
them.

## Target formats

- **Sprites:** WebP (fallback PNG) atlases + Phaser multi-atlas JSON
  (`textures` + `frames`), one atlas per source SWF per scale tier. Power of
  two where practical; max 4096px.
- **Audio:** ogg/webm + mp3 dual-format with a per-track manifest
  (Web Audio via Phaser). Export from `sound_asset.swf`'s embedded MP3s.
- **Data:** typed JSON generated from the `bin-xml` files by the readers in
  `src/net/data/` (see doc 11). The client consumes the JSON at runtime.
- **Strings:** lang JSON per locale from `lang_en[1].bin` / `lang_fr[1].bin`.

## Pipeline stages

1. **extract** — FFDec CLI (`C:\Program Files (x86)\FFDec\ffdec-cli.exe`)
   exports symbols as frame images + placement/transform info, or script
   assets for `import-script` SWFs. Deterministic output naming.
2. **normalize** — apply 9-slice info, frame bounds, pivot points
   (registration), and animation timelines from the symbol data.
3. **atlas** — pack frames, emit WebP/PNG + multi-atlas JSON.
4. **audio** — demux embedded MP3 -> ogg/webm + mp3.
5. **manifest** — emit `manifest.json` (see contract below) and a coverage
   report comparing exported symbols against the SWF symbol list. **100%
   symbol coverage or the milestone fails.**

## Manifest contract

```jsonc
{
  "version": 1,
  "atlases": [
    { "id": "indoor", "file": "atlases/indoor.webp",
      "json": "atlases/indoor.json", "source": "indoor_asset.swf" }
  ],
  "audio": [ { "id": "music_main", "ogg": "audio/music_main.ogg",
               "mp3": "audio/music_main.mp3" } ],
  "data": [ { "id": "ingredients", "file": "data/ingredients.json",
              "source": "ingredient[1].bin" } ],
  "langs": [ { "code": "en", "file": "data/lang_en.json" } ]
}
```

The loader (`src/net`/game layer) validates manifest entries and fails with
actionable errors naming the missing file.

## Naming rules

- Frame keys: `<sourceSwf>/<symbol>/<frameName>` lowercased, no spaces.
- `frameName` defaults to timeline frame label; unnamed frames get numeric
  indexes padded to 3.
- Never rename symbols across regeneration runs — keys are a stable public
  contract for scenes and systems.

## Acceptance for M0/M1 (from the roadmap)

- M0: `ingredient_asset.swf` -> atlas -> one animated sprite renders in the
  Boot scene; coverage report green for that SWF.
- M1: all 9 asset SWFs exported at full coverage; audio exported; data JSONs
  for all `bin-xml` files; manifest loads in the dev server.

## Guardrails

- The pipeline writes only into `public/assets/generated/` and a scratch
  dir under `client-html5/tools/.work/`. It must **never write into
  `../decompiled/`** or modify original files.
- Regeneration is reproducible: same inputs -> byte-identical manifests.
- Coverage failures are build errors, not warnings.
