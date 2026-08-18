# tools

Offline conversion tooling. Node scripts run with `node tools/<name>.mjs`;
they read from the workspace (never write into `decompiled/`) and emit into
`client-html5/public/assets/generated/`.

Pipeline overview: `docs/04-asset-pipeline.md`.

Implemented (M0/M1, verified on all 7 atlas SWFs):

| Script | Status | Notes |
|---|---|---|
| `pipeline.mjs` | done | extract -> atlas -> audio -> data -> manifest -> verify (all atlas SWFs by default) |
| `extract-symbols.mjs` | done | FFDec: dumpSWF (frame labels), symbolClass CSV, sprite PNGs |
| `build-atlases.mjs` | done | paged shelf packer + pngjs compose + Phaser multi-atlas JSON |
| `build-audio.mjs` | done | FFDec `-export sound` -> 18 original MP3s (ADR-0009) |
| `build-data.mjs` | done | bin-xml (zlib XML) -> typed JSON via `lib/data/` readers (ADR-0008) |
| `build-manifest.mjs` | done | manifest.json (atlases/audio/data/langs/excluded/coverage) |
| `verify-pipeline.mjs` | done | re-extracts from originals; fails below 100% coverage |
| `preview-frames.mjs` | done | extracts frame PNGs from any built atlas for visual checks |
| `lib/ffdec.mjs` | done | FFDec CLI wrapper (`FFDEC` env overrides the path) |
| `lib/swf-config.mjs` | done | per-SWF metadata (stage/fps/kind) for all 9 SWFs |
| `lib/dump-parse.mjs` | done | parses `-dumpSWF` tag tree for sprite frame labels |
| `lib/keys.mjs` | done | frame key rules (`<swf>/<symbol>/<frame>`) |
| `lib/packer.mjs` | done | deterministic paged shelf packer (2048x2048 pages) |
| `lib/data/xml-bins.mjs` | done | E4X-semantics ports of ItemDatabase/TextGroup/ChallengeDatabase |
| `lib/data/data-config.mjs` | done | data-file inventory (docs/11) |

Usage:

```bat
node tools/pipeline.mjs                 REM all atlas SWFs + audio + data
node tools/pipeline.mjs ingredient_asset
```

Tooling ground truth: `decompiled/setup-all-swfs.ps1` shows the FFDec
invocations and per-SWF metadata (stage size, fps, embed type) already used
for the Flash rebuild.
