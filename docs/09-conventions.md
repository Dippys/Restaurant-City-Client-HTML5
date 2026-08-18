# 09 — Conventions

## Code

- TypeScript, ESM, `strict` + `noUncheckedIndexedAccess`. No `any` except
  with a comment naming the constraint.
- Files: kebab-case (`customer-order.ts`). Types/interfaces PascalCase,
  values camelCase. One exported concept per file unless tightly coupled.
- Dependency rule (see `02-architecture.md`): `ui -> game -> systems ->
  core/net`; `core`/`net` are Phaser-free and DOM-free.
- Every port of an AS3 algorithm carries a header comment:
  `// Spec: decompiled/game/scripts/com/playfish/games/cooking/.../<Class>.as`
  and divergences are named in a `## Divergences` section of the module's
  docs or inline `DEVIATION:` comments.
- Errors: typed results or exceptions at boundaries; user-facing failure is
  handled at the UI layer (mirror `ErrorDialog` behavior).
- State transitions live in `systems`, never in scenes. Scenes subscribe.
- No direct `Date.now()`/`Math.random()` in `core`/`systems` (inject time;
  use the seeded RNG).

## Git

- Repo: `client-html5/` is its own git repo (`git init` in M0).
- Commits: conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`,
  `test:`, `refactor:`) + system tag where useful
  (`feat(cooking): dish timers`).
- One logical change per commit; never commit generated assets twice —
  regenerate only, and only manifests/coverage reports that change are
  committed with the tooling change.
- Never commit changes to `../decompiled/`, the original SWFs, or
  `../server` unless an ADR covers it.

## Docs discipline

- `docs/` is the source of decisions. Implementation that contradicts a doc
  is a bug in one of the two — fix both in the same change.
- `docs/status.md` is updated at the end of **every working session**
  (what was done, what's next, blockers, evidence links).
- `docs/adr/` records are immutable once merged; a new decision that
  changes an old one is a new ADR that supersedes it.
- `docs/specs/` holds behavior notes extracted from AS3 (derived, working
  material). If a note disagrees with AS3, AS3 wins and the note is
  corrected.

## Change size & review

- Keep diffs scoped to one system/flow. A change touching `net` + a system
  + UI is usually three commits.
- Before finishing non-trivial work, run: `npm run check`, `npm test`,
  `npm run build`, and the affected manual/parity check.
- When delegating to subagents, each subagent gets: the milestone slice,
  the AS3 spec paths, the docs to read, and the definition of done.

## Naming & identifiers

- Atlas frame keys follow `04-asset-pipeline.md` naming rules exactly.
- Data field names mirror the wire/AS3 names (camelCase) so cross-referencing
  with `responders.ts` and `Rpc*.as` stays mechanical.
