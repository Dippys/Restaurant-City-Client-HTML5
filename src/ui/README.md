# src/ui

HUD and screen/popup layer.

Rules:

- Screens and popups are enumerated in `docs/06-ui-hud.md`; each has an
  original class reference (mostly `cooking/ui/*`).
- Prefer in-canvas rendering from atlas art to stay close to the original
  look; use DOM overlay only for native text inputs and where accessibility
  demands it (see ADR-0007).
- All user-visible strings come from the lang data (`lang_en.bin` port),
  never hardcoded — mirror `TextHandler`/`TextGroup`.

Planned contents (M2+):

- `hud/` — coin/gourmet/cash counters, level bar, zoom lever
- `screens/` — street, restaurant play/editor, recipe menu, hire, customize
- `popups/` — the ~40 original popup flows
