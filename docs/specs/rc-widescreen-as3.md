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

## Experiment result (2026-08-28, branch `widescreen-support`)

**Changes applied** (commits `bd260d1` on `decompiled/game`,
`95cb792` on `Restaurant-City-Server`, docs on `client-html5`):

- `Engine.STAGE_WIDTH` 760 → **1067** (16:9 at the shipped 600 height);
  `STAGE_HEIGHT` stays 600. All `getStage*` helpers, `getSafeFullScreenSourceRect`
  fallback, culling and `stageWidth/stageHeight` statics follow automatically.
- `GameWorld.CANVAS_WIDTH` → `Engine.STAGE_WIDTH` (street actors, hire/scroll
  panels, background tiling stay proportional; `CANVAS_HEIGHT`/`CANVAS_CENTER_Y`
  unchanged).
- `WorldStreet.canvasWidth` and `WorldRestaurant.canvasWidth` →
  `Engine.STAGE_WIDTH` (street scene width; restaurant camera/centering).
- `build.bat` + `asconfig.json` `default-size` → 1067x600 (SWF header).
- `game.html` (both checkouts): `SWF_W` 760 → 1067, `.stage` `aspect-ratio`
  → 1067/600, `@media (max-height: 720px)` ratio 1.2667 → 1.7783.

**Verification (headless Chromium + Ruffle, viewport 1920x1080, account
m2e2etest, captures in `client-html5/tests/.tmp/widescreen/`):**

- Rebuilt `game.swf` = 521,779 B; SWF header parses as **1067x600** (was
  760x600). Served from `server/public/swf/game.swf` (no restart needed —
  `sendStaticFile` reads from disk per request).
- Game boots and plays: full RPC startup (init, getUserProfile,
  getAllFriends, getMails, getPricepoints…), all 7 asset SWFs + 14 data files
  load, `pollEvents` loop runs; only pre-existing 404s are the missing
  `/news0-2.png` newsletter images (same in the 760 baseline) and the dev.db
  `SQLITE_CORRUPT` background-event writes (pre-existing torn DB; game reads
  and gameplay unaffected).
- **Letterbox removed:** column-variance profiles of the 1564x879 player box
  show the 760 baseline leaves ~225px uniform margins per side (content
  ~1060px), while the 1067 build renders street content **edge-to-edge**
  (1564px, no uniform margins) — the widescreen fill works for the street.
- Street layout code (`WorldStreet` sky/road/building-count, `GameWorld`
  canvas width) makes the street genuinely wider, not stretched.
- Restaurant: `WorldRestaurant.canvasWidth = 1067` keeps the room centered
  (`room.x = canvasWidth/2`) and the camera clamps still contain it; the room
  clip itself is the shipped size, so the wider stage shows the stage
  background at the sides. Visual restaurant capture still pending (the
  scripted click did not navigate into the room; click target depends on the
  live street layout).
- Rollback: `git -C decompiled/game checkout main -- bin/game.swf`, rebuild
  page values back to 760, copy SWF to `server/public/swf/game.swf`.

**Open questions for the next round:** restaurant interior visual check;
fullscreen path (browser fullscreen → `getBestFitFullScreenSourceRect` with
the 1067 rect); mouse↔world mapping in the wider stage; whether to keep 1067
or tune to another width (960 = 16:10); HUD spread (economy bar, bottom
panels anchor via the stage-edge helpers and will sit at the new edges by
design).

## Round 3 — restaurant verified in widescreen (2026-08-28)

**Two test-only patches were needed for deterministic headless capture**
(commits `c1b3f0d`, `77662d8` on `decompiled/game` — revert before release):

- `GameWorld.EMAIL_PERMISSION_REMINDER_POP_UP_CHANCE` 0.5 → 0 and
  `NETPROMOTER_POP_UP_CHANCE` 0.0005 → 0. The email popup stopped the intro
  logo 50% of the time, freezing the street intro (the popup's tick/cancel
  is the only way to resume; headless clicks missed it). With popups
  disabled the intro runs to completion.
- `WorldStreet.tick`: `++introTickCount > 150` forces the intro logo
  completion after ~6s as a safety net (the logo stalled under Ruffle in
  some runs; with popups gone it completes naturally).

**Verified with the deterministic build (521,804 B, served at :8090):
`[RC-PERF]` marks prove the world flow** — `WorldStreet.showNotify begin
intro=true` at +4.4s, then `WorldRestaurantPlay constructor begin
visitMode=false` → `WorldRestaurant.loadRoom end placedItems=33` →
`WorldRestaurantPlay.init end chairs=3 kitchens=1` →
`WorldRestaurantPlay.showNotify begin` at ~+8.7s: the **player's restaurant
loads in the 1067x600 build with no crash**.

**Captures (1920x1080 viewport, `client-html5/tests/.tmp/widescreen/`):**

- `widescreen-r6-street.png` — clean intro street (sky, buildings, road,
  bottom toolbar): **edge-to-edge content**, no letterbox (colprofile all
  `#`).
- `widescreen-r6-restaurant.png` — the restaurant interior: **edge-to-edge**
  too; 16.7% pixel similarity to the street capture (distinct scenes).
- `baseline-street.png` (760 SWF, same box) — ~220px uniform margins per
  side: the letterbox the 1067 build removes.

**Tooling:** `tools/capture-worlds.mjs` (deterministic street+restaurant
capture), `tools/probe-marks-to-file.mjs` (world marks to file),
`tools/probe-worldflow.mjs`, `tools/strip-shot.cjs`, `tools/ascii-shot.cjs`,
`tools/colprofile.cjs` committed on `client-html5` for repeatable
verification.

**Remaining follow-ups:** mouse↔world mapping in the wider stage (clicks
work — the game navigated and loaded — but a click-to-place/select parity
check is pending); fullscreen-mode visual; width tuning (1067 vs 960); the
"back to street" toolbar navigation for a post-intro street capture.

## Round 4 — fullscreen + input mapping verified; width decision (2026-08-28)

- **Fullscreen fills the screen.** Gesture-triggered browser fullscreen
  (same code path the page's `rcToggleFullscreen` uses): the `.stage` box
  becomes 1920x1080 and the Ruffle element 1920x1079; the fullscreen
  screenshot's column profile is content edge-to-edge across the whole
  width — **no letterbox bars in fullscreen** with the 1067x600 build
  (`fs-r1-fullscreen.png`).
- **Mouse input maps correctly in the wider stage.** Dragging at the exact
  code-predicted zoom-lever position (`mc_zoom.x = getStageRight() - 16` =
  logical 1051 → screen x 1540.6 in the 1564px box) produced a coherent
  camera response — the diff-map between before/after shows one large
  changed region (room pan/zoom), not scattered animation (`zoom2-before/
  after.png`, 29% pixel similarity). Ruffle's screen→logical coordinate
  mapping is proportional, so the wider stage changes nothing about input
  mapping.
- **Width decision: keep 1067 (16:9).** Fit math across common resolutions:
  1067x600 fills 1920x1080/2560x1440/1366x768 with 0–1px bars (16:10 screens
  get a 61px top/bottom bar); 960x600 (16:10) leaves 96–128px side bars on
  the dominant 16:9 monitors. 1067 is the right widescreen choice.

**All main views are now verified in the 1067x600 build:** street (in-page),
restaurant (in-page), fullscreen, and input interaction. Open cosmetics:
post-intro street via the toolbar button (positions are baked in the
`RoomUiButton`/`StreetViewButtonLayer2` art), and the user's own play-test
at http://localhost:8090/game (the widescreen build is live).
