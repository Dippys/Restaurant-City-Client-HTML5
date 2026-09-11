# Widescreen support — original (AS3) client

Scope note for the **`widescreen-support` experiment** on the original Flash
client (`decompiled/game` branch `widescreen-support` + `Restaurant-City-Server`
branch `widescreen-support`). The goal is to make the *AS3 game* (played
through Ruffle) use widescreen monitors without the 4:3 letterbox — **not** the
HTML5 TypeScript rebuild.

> **Status: REVERTED / ABANDONED (2026-09-11).** The operator reverted this
> experiment: the original client stays on its shipped **1:1 760×600** stage.
> The AS3 mutation never left the unmerged `decompiled/game`
> `widescreen-support` branch, so **no AS3 source revert was needed** — but the
> experiment's build leaked into the gitignored derived store
> `server/public/swf/game.swf`, which has been serving **1067×600** to the local
> `:8090` Ruffle page. See ["Round 5 — reverted"](#round-5--reverted-2026-09-11)
> at the end of this file. Everything below is the historical record of the
> experiment and is **not** a description of the shipped client.

Status at the time of the experiment: **branch scaffolded; no widescreen code changed yet.**

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

## Round 5 — reverted (2026-09-11)

Operator decision: the original (AS3/decompiled) client goes **back to its
shipped 1:1 760×600 stage**; the widescreen experiment is not pursued. This
section is the record of the revert and of the artifact that had to be found
to make it real.

### 1. What the widescreen mutation actually was (inventory)

All of it lives on the `decompiled/game` branch **`widescreen-support`**, which
was cut from `main`'s parent `9f2a003` and **was never merged into `main`**.
`git diff main widescreen-support --stat` = 7 files:

| File (branch `widescreen-support`) | Line(s) | Change | Kind |
|---|---|---|---|
| `scripts/com/playfish/games/cooking/Engine.as` | 39–42 | comment + `STAGE_WIDTH:int = 760` → `1067` (`STAGE_HEIGHT` stays 600) | widescreen |
| `scripts/com/playfish/games/cooking/GameWorld.as` | 111–114 | `CANVAS_WIDTH:int = 760` → `Engine.STAGE_WIDTH` | widescreen |
| `scripts/com/playfish/games/cooking/GameWorld.as` | 122–129 | `NETPROMOTER_POP_UP_CHANCE` `0.0005` → `0`; `EMAIL_PERMISSION_REMINDER_POP_UP_CHANCE` `0.5` → `0` | **test-only gameplay patch** |
| `scripts/com/playfish/games/cooking/WorldStreet.as` | 104–106 | `private var canvasWidth:int = 760` → `Engine.STAGE_WIDTH` | widescreen |
| `scripts/com/playfish/games/cooking/WorldStreet.as` | 116–119 | new `private var introTickCount:int = 0` | **test-only gameplay patch** |
| `scripts/com/playfish/games/cooking/WorldStreet.as` | 777 | `if(logoMovieClip.currentFrame >= logoMovieClip.totalFrames \|\| ++introTickCount > 150)` — force-completes the street intro after ~6 s | **test-only gameplay patch** |
| `scripts/com/playfish/games/cooking/WorldRestaurant.as` | 198–200 | `public var canvasWidth:Number = 760` → `Engine.STAGE_WIDTH` | widescreen |
| `build.bat` | 42 | `-default-size 760 600` → `1067 600` (SWF header) | widescreen |
| `asconfig.json` | 16–17 | `"width": 760` → `1067` | widescreen |
| `bin/game.swf` | — | rebuilt artifact: 521,779 → (c1b3f0d) 521,767 → (77662d8) 521,804 B | artifact |

Everything that widens the visible area is the single `STAGE_WIDTH` constant
plus the three `canvasWidth`/`CANVAS_WIDTH` fields that had to follow it, and
the compile-time `-default-size` that sets the SWF header RECT. No `scaleMode`,
viewport-offset, or stage-rectangle logic was touched anywhere — the shipped
`getStage*()`/`setFullScreen()` helpers already derive everything from
`STAGE_WIDTH`.

**Sanctioned patch in the same file — kept, and how it is separated.**
`Engine.as` also carries the sanctioned **"Fullscreen payout-loop safety"**
patch (`../../docs/release.md`): `getSafeFullScreenSourceRect()` at
`main:Engine.as` 104–122, whose fallback is
`new Rectangle(instance.gameOffsetX, instance.gameOffsetY, STAGE_WIDTH, STAGE_HEIGHT)`.
The widescreen branch did **not** edit a single line of it — but because that
fallback reads `STAGE_WIDTH`, widening the constant silently changed the
sanctioned patch's fallback rectangle from 760×600 to 1067×600. This is worth
naming: a one-constant "cosmetic" change can alter the behaviour of an
unrelated sanctioned patch without touching it, so constant-level diffs need a
call-site audit, not just a line diff. `git grep -n -e 1067 -e widescreen main`
is clean, so no such coupling survives on the release line.

### 2. Revert method — and why there was nothing to revert in the source

**Method: git-ancestry audit, not `git revert`.** The widescreen commits
(`bd260d1`, `c1b3f0d`, `77662d8`) are *not* ancestors of `main`, so there was
no hunk to undo:

- `git -C decompiled/game merge-base main widescreen-support` → `9f2a003`
  (`main` = `9f2a003` + the cherry-picked `28af3c2` "smal fix" = `a18b256`).
- `git log --oneline main` contains none of the three widescreen commits.
- `git diff 9f2a003 main --stat` = only `README.md` and
  `scripts/com/playfish/games/cooking/GameUser.as` (the sanctioned ADR-0042
  trade-safety patch) — no widescreen file appears.
- `git diff main widescreen-support -- scripts/.../GameUser.as` is **empty**,
  i.e. the sanctioned ADR-0042 patch is byte-identical on both lines and was
  not collateral damage of the experiment.
- Working tree: `build.bat` L42 `-default-size 760 600`, `asconfig.json` L16
  `"width": 760`, `Engine.as` L39 `STAGE_WIDTH: int = 760` — already 1:1.

Conclusion: **`decompiled/game` was already on the 1:1 release line; the
widescreen mutation never reached it.** Nothing was reconstructed by guesswork
and no pristine-copy restoration was needed (`original/` ships only the 2010
SWFs/data, no AS3 source, so guess-free restoration would not have been
possible anyway — the git history is what makes this revert exact).

The branch itself is left in place as the experiment's record (it is also
pushed to `origin/widescreen-support`); it must never be merged or built for
release. `git branch -D widescreen-support` only removes the local ref.

### 3. The actual leak: a gitignored derived artifact

Source discipline did **not** protect the thing players run. The widescreen
build was copied over the derived store (`client-html5/docs/status.md`,
2026-08-28 rows: "deployed to `server/public/swf/game.swf` +
`Restaurant-City-Server/public/swf/`"), and `server/public/swf` is
**gitignored** (`server/.gitignore:11`), so nothing recorded or repaired it.

Artifact truth table (stage parsed from the SWF header RECT; build time read
from the Flex `ProductInfo` tag 41 stamp, which is independent of file mtime):

| Artifact | Bytes | SHA-256 | Stage | Compiled (UTC) |
|---|---|---|---|---|
| `original/swf/game.swf` | 513,510 | `B10D6422D1E4496B2E2CC88781B2000CD1117BD64CF0949AD12877214EBF5CBB` | 760×600 @25 | 2010-02-10T17:34:43Z |
| `decompiled/game/bin/game.swf` (worktree) | 521,772 | `B96EA0C3ED4B528DDFAB9DCB6042016D96A5BD31B8FB7140353BB13D16298A98` | 760×600 | 2026-08-31T17:39:10Z |
| `Restaurant-City-Server/public/swf/game.swf` | 521,772 | `B96EA0C3…698A98` | 760×600 | 2026-08-31T17:39:10Z |
| `Maggie/assets/swf/game.swf` | 521,772 | `B96EA0C3…698A98` | 760×600 | 2026-08-31T17:39:10Z |
| **live `https://rc-reborn.uk/game.swf`** | 521,772 | `B96EA0C3…698A98` | 760×600 | 2026-08-31T17:39:10Z |
| **`server/public/swf/game.swf`** | **521,804** | **`6DA0467EB2DC034C8F78AE6B63C687366B2F15CE35FED0709B152BD1DCE291DB`** | **1067×600** | 2026-08-28T13:37:57Z |

`server/public/swf/game.swf` is **byte-identical to `git show
widescreen-support:bin/game.swf`** (same SHA-256), i.e. it is the branch-head
build from 2026-08-28 17:37:57 +04 — 11 minutes before `77662d8` was committed
at 17:48:55 +04. So the local `:8090` Ruffle page has been playing the
widescreen test build, and that build is not just wider: probing the inflated
ABC of that artifact shows the `introTickCount` symbol **present** and the
`0.0005` double **absent**, i.e. it carries both test-only gameplay patches
(forced intro completion; NetPromoter popup disabled). A same-path comparison
against the 760×600 release build is the reverse on both probes.

Answer to the drift question: the served copy is not "older", it is a different
*variant* — a leftover widescreen experiment build that was never restored
after the experiment ended. It matches no hash in the ADRs or
`../../docs/release.md` for exactly that reason: it was never a release build.

**Production was never widescreen.** `https://rc-reborn.uk/game.swf` serves
521,772 B / `B96EA0C3…` / 760×600 — the ADR-0046 release build. The widescreen
variant exists only in the workspace's own `server/public/swf/` and therefore
only ever affected the local dev page.

### 4. Verification of the 1:1 build

Rebuilt from the `decompiled/game` working tree (release line + the sanctioned
ADR-0046 photo patch) with the canonical flags, to a scratch output so the
released `bin/game.swf` was not disturbed:

```bat
java -jar C:\flex\lib\mxmlc.jar +flexlib="C:\flex\frameworks" -load-config= ^
  -source-path+="decompiled\game\scripts" ^
  -external-library-path+="C:\flex\frameworks\libs\player\25.0\playerglobal.swc" ^
  -target-player=25.0 -swf-version=25 -default-size 760 600 ^
  -default-frame-rate=25 -static-link-runtime-shared-libraries=true ^
  -includes+=away3d.events.BillboardEvent -warnings=false -debug=false ^
  -output="<scratch>\game.swf" -- "decompiled\game\scripts\com\playfish\games\cooking\Engine.as"
```

Exit code 0. The built artifact parses as **760×600 @ 25 fps** (RECT
`xmin=0 xmax=15200 ymin=0 ymax=12000` twips — byte-for-byte the same RECT as
`original/swf/game.swf`), 521,773 B / `3113497FB600899BD999100A5003F664C04DE1B919D8F0FD98FBD11E7E2E080E`.

**The rebuild is not byte-reproducible, but it is bytecode-identical.** Two
consecutive builds of unchanged source produce different bytes (521,773 B and
521,777 B), and inflating all of them shows the *body* is identical in length
(1,103,774 B) with exactly **4 differing bytes** at body offset 50–53 — inside
the Flex `ProductInfo` tag (SWF tag 41), whose last `UI64` field is the
**compile timestamp in ms**. Against the released `bin/game.swf` the same
4-byte delta is the only difference in the entire file: every ABC byte, every
class, and every constant is identical. So `B96EA0C3…` can never be reproduced
by rebuilding (its own stamp dates it to the 2026-08-31 build), and the correct
way to check a rebuild is to compare inflated bodies ignoring that stamp — not
to compare hashes.

**Artifact-level check — decompiled, not inferred.** FFDec 26.2.1
(`java -jar "C:\Program Files (x86)\FFDec\ffdec-cli.jar" -selectclass <class> -export script <dir> <swf>`)
on the rebuilt SWF and on the served widescreen SWF:

| Decompiled from | `Engine.STAGE_WIDTH` | `GameWorld.CANVAS_WIDTH` | `NETPROMOTER_POP_UP_CHANCE` | `EMAIL_PERMISSION_REMINDER_POP_UP_CHANCE` | `WorldStreet.canvasWidth` | `WorldStreet.introTickCount` |
|---|---|---|---|---|---|---|
| rebuilt SWF (this round) | `760` | `760` | `0.0005` (shipped) | `0.5` (shipped) | `760` | absent |
| `server/public/swf/game.swf` | `1067` | `Engine.STAGE_WIDTH` | `0` | `0` | `1067` | present (`++introTickCount > 150`) |

So the shipped values are confirmed in the *compiled code* of the rebuild, not
just in its header RECT — and the widescreen mutation, including both test-only
gameplay patches, is directly visible in the served build's compiled classes.
(`npm run check` — `tsc --noEmit` — also passes on the `client-html5` tree at
the commit that records this revert; the change is docs-only.)

What a rebuild does **not** prove, without a browser: Ruffle renders whatever
the SWF declares, so "the header is 760×600 and the bytecode matches the
released 1:1 build" is as far as static evidence goes. The letterbox-free
rendering the experiment's captures showed is a property of the page's `.stage`
box math plus the SWF header size; someone has to look at a real client to
confirm the shipped 1:1 behaviour is back end-to-end.

### 5. What to do to finish the revert (operator)

Replace the one wrong derived copy; everything else already matches the
release line:

```powershell
Copy-Item 'decompiled\game\bin\game.swf' 'server\public\swf\game.swf' -Force
```

Then reload `http://localhost:8090/game` (no server restart is needed —
`sendStaticFile` reads from disk per request). Expected after the copy:
521,772 B, `B96EA0C3ED4B528DDFAB9DCB6042016D96A5BD31B8FB7140353BB13D16298A98`,
760×600. Nothing needs to change on the box for the AS3 client: production,
`Maggie/assets/swf/`, and `Restaurant-City-Server/public/swf/` already serve
that build. `docs/release.md` records that **this widescreen mutation was never
part of the sanctioned patch set**.
