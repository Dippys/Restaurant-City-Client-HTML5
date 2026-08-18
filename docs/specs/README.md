# docs/specs — derived behavior notes

Working notes extracted from the decompiled AS3 while implementing systems.
They are **derived**, not authoritative: `../decompiled/game/scripts/` is
the spec; when a note disagrees with the source, the source wins and the
note must be corrected.

Conventions:

- One file per system or data file (`cooking.md`, `data/ingredient.md`).
- Every claim cites the class path it came from.
- Balance values are copied with their constant names, not just numbers.
- Delete or merge notes once the behavior is implemented and tested — the
  implementation + tests become the durable record; keep only notes with
  ongoing reference value.

Planned: `ui-flow.md` (screen transition graph), `cooking.md`,
`customers.md`, `save-audit.md`, `data/*.md`.
