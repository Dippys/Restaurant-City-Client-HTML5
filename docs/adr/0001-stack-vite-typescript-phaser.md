# ADR-0001 — Stack: Vite + TypeScript + Phaser 3

Status: accepted · Date: first session · Supersedes: none

## Decision

Build the client with **Vite + strict TypeScript + Phaser 3** (WebGL
renderer), unit tests with Vitest.

## Context

The game is a 2D isometric sprite sim (760x600, 25fps) with heavy UI,
timeline animations, audio, and depth-sorted tile worlds. The workspace
already contains a Node/TypeScript backend; agent-driven development
benefits from one well-documented framework with scene/tween/audio/input
batteries included.

## Options

| Option | Verdict |
|---|---|
| Phaser 3 + Vite | Chosen — scene model matches the original world/popup structure, built-in atlases/tweens/audio, huge documentation surface for agents. |
| PixiJS | Lower level; we would reimplement scene/audio/input plumbing. Kept in mind for hot-loop extraction if Phaser overhead ever dominates. |
| Custom canvas engine | Maximum control, maximum schedule risk; rejected for P0/P1 timeline. |
| Ruffle (SWF emulation) | Not a rebuild; rejected by charter. |
| Godot / Unity Web | Engine mismatch for a DOM/TypeScript ecosystem; rejected. |

## Consequences

- All rendering goes through Phaser scenes; `core`/`net` stay Phaser-free.
- If profiling later shows Phaser scene overhead in the world loop, extract
  hot rendering to a PixiJS overlay behind an interface — a future ADR, not
  a silent rewrite.
