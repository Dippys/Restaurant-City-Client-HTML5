# tools

Offline conversion tooling. Node scripts run with `node tools/<name>.mjs`;
they read from the workspace (never write into `decompiled/`) and emit into
`client-html5/public/assets/generated/`.

Pipeline overview: `docs/04-asset-pipeline.md`.

Planned scripts (M0/M1):

| Script | Input | Output |
|---|---|---|
| `extract-symbols.mjs` | original `*_asset.swf` (FFDec CLI) | per-symbol frames + transforms (workspace scratch dir) |
| `build-atlases.mjs` | extracted frames | WebP/PNG atlases + Phaser multi-atlas JSON |
| `build-audio.mjs` | `sound_asset.swf` MP3s | ogg/webm + mp3 + manifest |
| `build-manifest.mjs` | pipeline outputs | `manifest.json` + coverage report |
| `verify-pipeline.mjs` | manifest + original SWF symbol lists | coverage/pass-fail report |

Tooling ground truth: `decompiled/setup-all-swfs.ps1` shows the FFDec
invocations and per-SWF metadata (stage size, fps, embed type) already used
for the Flash rebuild.
