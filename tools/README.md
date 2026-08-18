# tools

Offline conversion tooling. Node scripts run with `node tools/<name>.mjs`;
they read from the workspace (never write into `decompiled/`) and emit into
`client-html5/public/assets/generated/`.

Pipeline overview: `docs/04-asset-pipeline.md`.

Implemented (M0, verified on `ingredient_asset.swf`):

| Script | Status | Notes |
|---|---|---|
| `pipeline.mjs` | done | runs extract -> atlas -> manifest -> verify |
| `extract-symbols.mjs` | done | FFDec: dumpSWF (frame labels), symbolClass CSV, sprite PNGs |
| `build-atlases.mjs` | done | shelf packer + pngjs compose + Phaser multi-atlas JSON |
| `build-manifest.mjs` | done | manifest.json + coverage report |
| `verify-pipeline.mjs` | done | re-extracts from original SWF; fails below 100% coverage |
| `lib/ffdec.mjs` | done | FFDec CLI wrapper (`FFDEC` env overrides the path) |
| `lib/swf-config.mjs` | done | per-SWF metadata (stage/fps/kind) for all 9 SWFs |
| `lib/dump-parse.mjs` | done | parses `-dumpSWF` tag tree for sprite frame labels |
| `lib/keys.mjs` | done | frame key rules (`<swf>/<symbol>/<frame>`) |
| `lib/packer.mjs` | done | deterministic shelf packer |
| `build-audio.mjs` | M1 | demux `sound_asset.swf` MP3s |

Planned (M1): `build-audio.mjs` plus applying the pipeline to the remaining
atlas SWFs (`perk_asset`, `avatar_asset`, `game_asset`, `indoor_asset`,
`outdoor_asset`, `preloader_asset`).

Usage:

```bat
node tools/pipeline.mjs ingredient_asset
```

Tooling ground truth: `decompiled/setup-all-swfs.ps1` shows the FFDec
invocations and per-SWF metadata (stage size, fps, embed type) already used
for the Flash rebuild.
