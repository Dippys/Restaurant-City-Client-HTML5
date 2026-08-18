# ADR-0009 — Audio ships as mp3 passthrough of the original embedded assets

Status: accepted · Date: M1 session · Supersedes: ADR-0004 (audio clause)

## Decision

Audio is exported from `sound_asset.swf` as **mp3 passthrough** — the exact
MP3 files embedded in the original game, no transcoding — with one manifest
entry per track under its linkage id. ogg/webm dual-format is deferred
until an encoder is available.

## Context

ADR-0004 specified ogg/webm + mp3 pairs. This machine has no ffmpeg, so
transcoding would add a heavyweight dependency for a fidelity *loss*: the
embedded MP3s are the game's original assets and every target browser
decodes MP3 natively (Web Audio `decodeAudioData`). `sound_asset.swf`
contains 18 embedded MP3s (SFX + music), all exportable via FFDec
`-export sound`.

## Consequences

- `tools/build-audio.mjs` copies the 18 MP3s to
  `public/assets/generated/audio/<id>.mp3`; the manifest lists them with
  `kind` (sfx/music).
- If broader codec support is ever needed (or ffmpeg arrives), add an
  encode stage behind the existing manifest contract — the entries are
  additive.
