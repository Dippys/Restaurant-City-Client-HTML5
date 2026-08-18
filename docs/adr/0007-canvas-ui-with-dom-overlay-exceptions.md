# ADR-0007 — Canvas-first UI with narrow DOM overlay exceptions

Status: accepted · Date: first session · Supersedes: none

## Decision

All game UI renders in-canvas from atlas art (Phaser). DOM overlays are
allowed only for: native text input (e.g. naming/chat-style entry the
original used `FullScreenTextFieldHandler` for), file pickers, and
accessibility fallbacks — and only after noting why canvas is insufficient.

## Context

The original is a fully vector/canvas UI; P1 similarity is easiest to reach
in-canvas, and canvas keeps the render/simulation loop and capture tooling
uniform. DOM text handling for 60+ popups would also fight the art style
for no P0 gain.

## Consequences

- `src/ui` components target Phaser containers; the popup base
  (`WorldPopUp` port) owns open/close/animation.
- Text-heavy panels must still meet the visual budget; if a panel proves
  unreadable in-canvas, convert it with a note in `docs/specs/ui-flow.md`.
- Screen-reader/a11y passes (M6+) may introduce DOM mirrors without
  changing the visual layer.
