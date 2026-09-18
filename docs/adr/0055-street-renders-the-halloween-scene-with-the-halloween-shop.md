# ADR-0055 — The street renders the Halloween variant while the shop's Halloween decor is obtainable

Status: accepted · Date: 2026-09-18 · Extends the sanctioned AS3 patch set

## Context

The live game's **shop** rotated from Valentine's to Halloween in round 108
(`_round108/valentine-to-halloween-rotation.md`): the 33 Halloween rows were made
obtainable and the 43 Valentine's rows were hidden (`invisible="true"`) without
removing anything, so every owner keeps what they own. The operator's second half
of that brief is this ADR: **the visible street must rotate too**, "on the same
schedule".

### What the shipped client actually does

`WorldStreet.init()` picks the street scene from a **client-side static** and
nothing else (`WorldStreet.as:226-237`, pre-patch):

```as3
if(curStreetType == STREET_TYPE_RANDOM)        _loc2_ = Engine.getMovieClip("RandomStreetViewScene");   // :228
else if(curStreetType == STREET_TYPE_GOURMET)  _loc2_ = Engine.getMovieClip("GourmetStreetViewScene");  // :232
else                                           _loc2_ = Engine.getMovieClip("StreetViewScene");         // :236
```

`curStreetType` is copied from `WorldStreet.streetType` (`:149`), a static set in
four places (`:187`, `:702`, `:1113`, `:1147`, `GameWorld.as:1401`). **There is no
seasonal branch, no date test, and no flag anywhere in the 798 classes** —
`grep -rn 'HalloWeen\|Halloween' decompiled/game/scripts/com/playfish/games/cooking/`
returns **0** matches, and `"HalloweenStreetViewScene"` appears **0 times** in the
inflated body of the live `game.swf` (`_round135/markers-before.txt`). Nothing
about scene selection crosses the wire.

### The Halloween street exists as complete, unused art

`game_asset.swf` exports `HalloweenStreetViewScene` (characterId 1966) with the
same five named children `WorldStreet.init():238-250` dereferences, **at the same
depths**, as the live default scene (`_round135/scene-names.txt`; identical
110-byte scene tags, identical name order `mc_sky < mc_cloud < mc_city <
mc_cityClose < mc_road`):

| scene | chid | `mc_sky` | `mc_cloud` | `mc_city` | `mc_cityClose` | `mc_road` |
|---|---|---|---|---|---|---|
| `StreetViewScene` (live) | 2592 | StreetSky 1940 | Clouds 760 | CityScape 727 | CityScapeClose 729 | SidewalkRoad 1965 |
| `HalloweenStreetViewScene` | 1966 | StreetSky 1940 | Clouds 760 | **HalloWeenCityScape 1961** | **HalloweenCityScapeClose 1963** | SidewalkRoad 1965 |

So the swap is a **one-symbol substitution** with no interface risk: the same
code reads the same five names from either symbol.

### The operator's premise, checked — and one part of it refuted

The brief says the street "still renders the Valentine's variant". **It does not
render a Valentine's variant — there is no seasonal variant of the default street
in this asset library at all**, and I could not find Valentine's artwork in it by
any measure I have:

- **Cross-build comparison.** `StreetViewScene`, `CityScape`, `CityScapeClose` and
  `SidewalkRoad` render **byte-identical** (SHA-256 of FFDec's render) in the
  0.9.143a library and in the late-June-2010 build in `check/builds/june-29-2010/`
  (`_round135/` — 4 months and one whole season later, no event running):
  `B52879EA869B834D`, `169C829D5D1EA1A8`, `3DF8A30E865042F8`, `F703405DFF1D7257`.
  Playfish did **not** reskin the default street for Valentine's; the same art
  served both seasons.
- **Colour census.** The default street's own layers contain no saturated
  red/pink at all — `CityScape` 727: cyan 99.81 % / blue 0.16 % / grey 0.03 %;
  `CityScapeClose` 729: cyan 94.60 % / green 5.23 %. The only rose in the frame is
  a uniform band on the **shared** `SidewalkRoad` 1965 (`#c99e9b` = 7.30 %,
  a full-width 25-px strip, not shaped), and it is present in the Halloween scene
  too, because both scenes use the same road sprite
  (`_round135/hue-layers.txt`, `_round135/rose-road.txt`).
- **What the season actually is.** The client's own newsletter data ends at
  **09/02/2010** (`server/public/data/newsletter[1].xml`, editions 19–20) — the
  build is from the Valentine's *window*, which is why the theme reads as
  "Valentine's" to a player, but the street art is the generic day street.

**The conclusion this changes:** the rotation cannot be made by swapping art or
data — the Halloween art is a *second symbol* that only code can select. The patch
below is the correct lever; the premise that a Valentine's street needs replacing
is not supported.

## Options considered

1. **Calendar window on the server clock** (`Engine.instance.startServerTime`,
   the shipped convention — `GameWorld.getShopWeek`/`getWeekCount`,
   `GameWorld.as:1958-1962,2105-2110,2826-2829`). Playfish's own Halloween window
   is citable (`newsletter.xml` editions 2/3/4: 13/10/2009 "New spooktacular decor
   items … in 3 weeks you won't be able to unlock the Halloween dishes any more",
   27/10/2009 "this is the last week", 03/11/2009 "the Halloween dishes have been
   removed"). **Rejected**: that window is 13 Oct – 3 Nov, it is *not* active on
   2026-09-18, and the operator's shop is already Halloween — a calendar gate would
   leave the street on the default scene and fail the request. Widening the window
   to cover today would require inventing dates, which standing rule 3 forbids.
2. **A server-side flag (config, or a FlashVar in the play page)** — the shipped
   `Engine.instance.getParameter("pf_user_country")` convention
   (`WorldStreet.as:305`) could carry one. **Rejected**: the page and the asset
   route are served by Maggie (`Maggie/src/app/[…asset]/route.ts`,
   `src/app/play/page.tsx`), `server/` is read-only evidence for this program, and
   a concurrent round is editing that same Maggie route. It would also be *new*
   protocol-adjacent surface for a display decision.
3. **Two builds (Halloween / default), switched by install.** **Rejected** as the
   default: it makes the street hardcoded for the whole life of a build, which the
   brief explicitly disallows.
4. **Follow the shop's own seasonal signal, in the data the client already
   loads** — chosen.

## Decision

One file, `decompiled/game/scripts/com/playfish/games/cooking/WorldStreet.as`,
added to the sanctioned patch set. Three additions, no other change:

1. One constant beside the existing item-id constants (`:36-44`):

   ```as3
   private static const HALLOWEEN_STREET_ITEM_ID:int = 2040052;
   ```

   `2040052 Scary Tree` (`className="Ground53"`, group **Street Decoration** in
   the shipped `front.xml`) is one of the Halloween rows the round-108 rotation
   *unhid*. It is a street decoration, so its obtainability **is** the shop's
   Halloween state for the street.

2. One private helper, the whole predicate:

   ```as3
   private function halloweenStreetEnabled() : Boolean
   {
      var _loc1_:Object = itemDatabase == null ? null : itemDatabase.getItemFromId(HALLOWEEN_STREET_ITEM_ID);
      var _loc2_:Boolean = _loc1_ != null && !_loc1_.invisible;
      Debug.out("RC Reborn ADR-0055: halloween street=" + _loc2_ + " seasonal street item=" + HALLOWEEN_STREET_ITEM_ID);
      return _loc2_;
   }
   ```

   `itemDatabase` is `GameWorld.buildingItemDatabase` (`:224`), i.e. the served
   `front.bin` the client already loads at boot (`GameWorld.as:2112-2114`).
   `!cfg.invisible` is the shipped idiom for exactly this test —
   `WorldRecipeMenu.isRecipeAvailable` (`:782-793`) ends `return !param1.invisible`.
   `ItemDatabase.load()` turns the XML attribute `"true"` into a real Boolean
   (`ItemDatabase.as:84-91`), so an unhidden row is `undefined` and the `!` is
   `true`.

3. One changed line, the `else` branch only — the **FRIENDS street**, the one
   every player sees on login:

   ```as3
   _loc2_ = Engine.getMovieClip(halloweenStreetEnabled() ? "HalloweenStreetViewScene" : "StreetViewScene");
   ```

`Random` and `Gourmet` are deliberately untouched: they have their own road sprite
(`SidewalkRoadRandom` 2412, `SidewalkRoadGourmet` 1942) and the Halloween scene
carries the **FRIENDS** road (1965), so pointing them at it would change their
pavement as well — more than the operator asked for.

## What drives the flag, and why this is "the same schedule"

The street is Halloween **exactly while the Halloween street decoration is on sale
in the shop**, because it reads the same attribute the rotation writes. The
operator's lever is unchanged: hiding the Halloween rows (and unhiding the
Valentine's ones) flips the shop *and* the street in the same admin action, with no
rebuild. Verified live before the deploy
(`_round135/verify-pre-deploy.txt`): the served `front.xml` **and** the
`front.bin` the client actually loads inflate to identical bytes, and in them
`2040052 Scary Tree` carries **no** `invisible` while the Valentine's counterpart
`2030072 Golden Heart` carries `invisible="true"` — so the live game selects the
Halloween street today, and reverts by itself when the operator rotates back.

## Consequences

- **Display-only.** No RPC byte, save payload, version fence, balance, item
  quantity, catalog row, or server behaviour changes. The only new code reads one
  already-loaded config row; it writes nothing.
- **Confinement measured, not asserted.** FFDec exported all **802** classes from
  the pre-patch and post-patch builds; exactly **one** decompiled file differs —
  `WorldStreet.as` (`_round135/class-diff.txt`). The exported diff is the whole
  semantic change: the constant, the helper, the one changed call.
- **The Halloween scene has never rendered in a client.** It is dead art (Playfish
  shipped it for the Oct 2009 event and the code no longer selected it). Its
  interface is proven (above), its framing is software-rendered and reviewed in
  `_round135/render/`, and its appearance in a real client is **not** verified —
  see the ADR's evidence section. Rollback is one `install` of the previous
  `game.swf`.
- **Bare `/game.swf` keeps a stale cache entry**; players are unaffected because
  the play page stamps the content revision (`?v=<sha256[:16]>`, ADR-0019,
  `Maggie/src/lib/swf-url.ts`, `src/lib/assets.ts:118-151`), which changed with the
  bytes.
- **Recurrence cost.** A future seasonal street needs one more symbol and one more
  branch, or the same trick with different rows; the pattern is now documented
  rather than rediscovered.

## Addendum — one visible side effect worth naming: the skyline repeat period changes

Not a defect and not a break, but a reviewer should know it before looking at the
street. `ui/BackgroundLayer.addLayer` (`:21-41`) does not stretch a background
clip: it instantiates `ceil(GameWorld.CANVAS_WIDTH / clip.width) + 2` copies side
by side (`:27-35`) and `setX()` parallax-wraps them by `param1 / divider %
mcWidth`. The two scenes share four of their five background layers — `mc_sky`
(StreetSky 1940), `mc_cloud` (Clouds 760) and `mc_road` (SidewalkRoad 1965) are
identical character ids, and the road is the widest of them at 640 px — but the
mid layer differs in width: **`CityScape` 727 is 873 px wide and
`HalloWeenCityScape` 1961 is 700 px**, so its tile count changes from `ceil(760 /
873) + 2 = 3` to `ceil(760 / 700) + 2 = 4` and the skyline repeats every 700 px
instead of every 873 px. The silhouette is the intended change; the tighter repeat
is a consequence of the art being narrower, and it is the one thing about this
patch that a human should look at first.

## Evidence

- AS3 citation (original behaviour): `decompiled/game/scripts/com/playfish/games/cooking/WorldStreet.as:226-237`
  (pre-patch), scene children `:238-250`; `WorldStreet.streetType` `:26-32,149`;
  the shipped `!invisible` idiom `ui/WorldRecipeMenu.as:782-793`;
  `ItemDatabase.load` booleans `ItemDatabase.as:84-91`; server-clock convention
  `GameWorld.as:1958-1962,2105-2110,2826-2829`.
- Scene-symbol contract: `_round135/scene-names.txt` (all five `mc_*` present in
  both scene tags, same offsets), `_round135/scene-report-served.txt`.
- Premise check: `_round135/ffdec-june2010/` vs `_round108/render/raw/` render
  hashes; `_round135/hue-layers.txt`; `_round135/rose-road.txt`.
- Build: `decompiled/game/build.bat release` (Flex at `C:\flex`, Java 21) →
  `decompiled/game/bin/game.swf`, CWS 760×600, **522,344 B**, SHA-256
  `F669D5B9170EA5E32A2D15A79E3DC430B26D4A15E1C395DE43C3BDA176044194` (from 522,213 B /
  `FDAB491A67A51082…`, the ADR-0054 build). `_round135/build.out.txt`.
- Artifact markers: the built body carries **1** `RC Reborn ADR-0055` marker and
  **1** `HalloweenStreetViewScene` literal (0 of both before), keeping the 3
  ADR-0054 and 3 ADR-0053 markers — `_round135/markers-before.txt`,
  `_round135/markers-after.txt`.
- Deploy: installed to `/var/rc/maggie/assets/swf/game.swf` atomically (staged in
  the same directory, `cmp` verified, mode 644, root); the outgoing build is kept
  byte-identical at `/var/rc/fishy/backup-round135/game.swf`
  (`fdab491a67a51082…`, 522,213 B). No service, nginx, or Maggie config was touched
  and no process restarted. `_round135/deploy.txt`, `_round135/post-deploy.txt`.
- Live verification: the content-addressed play URL
  `https://rc-reborn.uk/game.swf?account=1&v=f669d5b9170ea5e3` → HTTP 200,
  `content-type: application/x-shockwave-flash`, 522,344 B, sha256 identical to the
  built artifact, `cmp` identical; the downloaded live bytes re-exported by FFDec
  differ from the built artifact in **0 of 802 classes**.
- Shop/ownership invariant (the operator's explicit requirement), measured on the
  live DB before and after: all **43** Valentine's rows still present in the served
  catalogs, all 43 still `invisible="true"`, all 43 still carrying `cost`/`cash`
  (sell prices preserved: 3070010 → 3960, 3110004 → 1650, 3050054 → 13), and
  holdings unchanged at **684 profiles / 4,416 placed rows** plus **448 profiles /
  6,118 stored units**. `unknown-item-placed` still 0 all-time; the saves in the
  five minutes after the swap were **517/517 `saved`** with 0
  `skipped-unpriceable`. `_round135/verify-pre-deploy.txt`,
  `_round135/final-census.txt`.
- **Not verified:** the street as a player sees it on the live box. A real session
  needs a player login, and this round is forbidden to touch player accounts, so
  no browser ever loaded the new build. What is proven is the served bytes, the
  class-level identity of those bytes with the build, the scene-symbol contract,
  and the predicate evaluating to `true` against the live data. A five-minute
  Ruffle check of `/play` is the remaining step, and it is a human one.
