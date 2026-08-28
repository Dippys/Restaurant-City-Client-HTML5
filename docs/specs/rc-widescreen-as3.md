# Widescreen support — original (AS3) client

Scope note for the **`widescreen-support` experiment** on the original Flash
client (`decompiled/game` branch `widescreen-support` + `Restaurant-City-Server`
branch `widescreen-support`). The goal is to make the *AS3 game* (played
through Ruffle) use widescreen monitors without the 4:3 letterbox — **not** the
HTML5 TypeScript rebuild.

Status: **branch scaffolded; no widescreen code changed yet.**

## Current geometry (source of truth)

The game's logical stage is a fixed 760x600, centralized in
`decompiled/game/scripts/com/playfish/games/cooking/Engine.as`:

| Constant / helper | Line | Behavior |
|---|---|---|
| `STAGE_WIDTH:int = 760` / `STAGE_HEIGHT:int = 600` | 39–41 | the game's logical size everywhere |
| static `stageWidth` / `stageHeight:uint` | 31, 35 | set from the constants in `init()` (610–611) |
| `gameOffsetX` / `gameOffsetY` | 75, 79 | `localToGlobal(new Point(0,0))` at init (612–614) — stage top-left |
| `getStageWidth()` / `getStageHeight()` | 354–361, 196–202 | fullscreen → safe-rect size; else 760 / 600 |
| `getStageX()` / `getStageY()` / `getStageRight()` / `getStageBottom()` | 95–102, ~140, 272–278, 124–131 | fullscreen → safe-rect edges minus offset; else 0 / 0 / 760 / 600 |
| `getSafeFullScreenSourceRect()` | 113–122 | null/zero rect → `Rectangle(offsetX, offsetY, 760, 600)` |
| `getBestFitFullScreenSourceRect()` | 326–341 | letterbox math preserving 760:600 |
| `setFullScreen()` | 436–474 | assigns best-fit rect + `StageScaleMode.SHOW_ALL`, or exits via the page bridge |
| `isObjectVisibleInView()` | 507–511 | display culling against 760x600 |

SWF header size comes from the compile flags, **not** the code:
`decompiled/game/build.bat` `-default-size 760 600` (line 42) and
`asconfig.json` `default-size` (760x600, lines 15–18).

The player page hardcodes the same numbers: `server/public/game.html`
`SWF_W = 760`, `SWF_H = 600` (301–302); `fit()` letterboxes with
`Math.min(availW/SWF_W, availH/SWF_H)` (345–384); `scale=showall` params
(325, 332); `.stage` CSS `aspect-ratio: 760 / 600` (43). In browser
fullscreen on a widescreen monitor the game keeps 760:600 and leaves black
bars left/right by design (comment at 344).

## Why a wider stage is plausible (the AS3 was built for it)

The original code already lays out against the stage-edge helpers instead of
hardcoding 760, so a wider `STAGE_WIDTH` propagates to most surfaces:

- `WorldStreet.as` — `bgSky.width = Engine.getStageWidth()` (530),
  `bgRoad.drawRect(Engine.getStageX(), …, Engine.getStageWidth(), …)` (562),
  `bgLayer.x = -Engine.getStageWidth()/2` (249, 533), building count
  `Math.floor(Engine.getStageWidth() / BUILDING_GAP) + 1` (965), right arrow at
  `Engine.getStageRight() - …` (539). The street **scales to fill the width**.
- `WorldHire.as` — sky width, right button, road rect all use the helpers
  (240, 243, 467); `USER_GAP = STAGE_WIDTH/3` (28).
- `WorldCustomiseBuilding.as` / `WorldCustomiseAvatar.as` — sky/parallax widths,
  road rects, drag-clamp against `STAGE_WIDTH` (127, 197, 284, 563–567, 673–687;
  675, 915).
- `WorldRecipeMenu.as` — full-width top/bottom dimmer rects (200–211), right
  buttons at `getStageRight()` (285–286).
- `WorldPopUp.as` (110) and `OverlaySetting.as` (119) — full-screen dimmer
  BitmapData over `getStageWidth()/getStageHeight()`.
- `ui/ToolTip.as` — clamps tooltips inside `getStageRight()` (88–99).
- `GameWorld.as` — fade BitmapData (3079), bottom panels at `STAGE_HEIGHT`
  (1367, 1374); `WorldRestaurantPlay.as` photo-capture rect (2336),
  `WorldRestaurantEditor.as` item-chooser below the stage (227).

Known hardcoded-risk areas to verify during the experiment: the restaurant
room art itself (`WorldRestaurant` / `WorldRestaurantPlay` draw the room as a
fixed-size clip — extra width may show empty margins left/right), camera
bounds, item-placement grid bounds, and anything reading `stage.stageWidth`
directly (Ruffle reports the SWF header size, so a wider SWF header changes
that too).

## Experiment plan (on the branches)

1. **Branch state:** `decompiled/game` → `widescreen-support` (from `main`
   9f2a003); `Restaurant-City-Server` → `widescreen-support` (from `main`
   4eab15c); `client-html5` → `widescreen-support` (docs only). The `server/`
   clone (older `Restaurant-City-0.9.143a.git`) is intentionally untouched.
2. **Try a wider logical stage:** bump `Engine.STAGE_WIDTH` to a widescreen
   value (e.g. 960 = 16:10 or 1067 = 16:9, keeping 600 tall), update
   `build.bat` / `asconfig.json` `-default-size` to the same width, rebuild
   with `decompiled/game/build.bat`, copy `bin/game.swf` →
   `Restaurant-City-Server/public/swf/game.swf`, update `game.html` `SWF_W`.
   Compare against the shipped build: street filling, HUD edges, restaurant
   room margins, culling, mouse↔world mapping (gameOffsetX/Y).
3. **Fallback experiment:** page-only `noBorder`/`exactFit` behavior to see
   whether the letterbox complaint is satisfied without any AS3 change.
4. Keep any AS3 change a **bounded, ADR-documented release patch** per
   `docs/release.md` convention; never touch `original/`.
