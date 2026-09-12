# ADR-0054 — A failed profile load is retried, then told — never a Dummy stand-in

Status: accepted · Date: 2026-09-13 · Extends the sanctioned AS3 patch set

## Context

The last known **fake save** in the shipped client. The server does the right
thing and the player is never told.

**What the player sees.** Their restaurant loads, they decorate it, they press
Save or wait for the autosave, and the client says **"Game Saved"**. None of it is
persisted, and the next load shows their real restaurant exactly as it was.

**What actually happens, end to end.**

1. `RpcGetUserProfile.getUserProfileFail()` — the fail callback for RPC 3, the
   startup profile read — substituted a throw-away profile in the release build
   (`decompiled/game/scripts/com/playfish/games/cooking/rpc/RpcGetUserProfile.as`
   pre-patch `:33-54`):

   ```as3
   public function getUserProfileFail() : void
   {
      Debug.out("getUserProfileFail");
      if(!Debug.NETWORK_ONLY)          // :36 — true in every release build (Debug.as:12)
      {
         userInfo = GameWorld.getDummyUserInfo(0);          // :38
         ingredientShops = new Array();
         ingredientShops[0] = new IngredientMarketItem();   // :39-48, three hardcoded rows
         ...
   ```

   `Debug.NETWORK_ONLY` and `Debug.DEBUG` are both `false` constants
   (`Debug.as:10,12`), so this branch is the *release* branch — the only one that
   ever ran in production.

2. `GameWorld.getDummyUserInfo(0)` (`GameWorld.as:1179-1229`) builds
   `NetworkUid(FACEBOOK, "0", 0)` with `firstName = "Dummy0"`,
   `fullName = "Dummy0 Tummy"`, `gourmetPoint = 10000`, level 11 and the two
   starter item sets (`WorldCustomiseBuilding.DEFAULT_BUILDING_ITEMS`,
   `WorldRestaurant.DEFAULT_RESTAURANT_ITEMS`). That is a **real, playable
   restaurant** — just not the player's.

3. Nothing stopped the boot. The startup batch is built in
   `GameInitLoader.rpcInitSuccess()` (`GameInitLoader.as` pre-patch `:251-295`,
   `getUserProfileRpc = rpcs.getUserProfile()` at `:261`) and its failure handler
   was a no-op in release (`:228-239`):

   ```as3
   private function onRpcsFail(param1:RpcEvent) : void
   {
      if(Debug.NETWORK_ONLY) { onInitError("onRpcsFail " + param1.toString()); }
      else { rpcsSuccess = true; onLoadSuccess(); }   // :236-237 — boot anyway
   }
   ```

   `onLoadSuccess()` (`:241-249`) then runs `initGameWorld()` → `GameWorld.init()`,
   which applies the profile at `GameWorld.as:2177`
   (`param1.getUserProfileRpc.applyData()` → `RpcGetUserProfile.applyData():62-92`
   → `GameWorld.setUserInfo(userInfo)`). The player is now playing Dummy0.

4. Every commit of that session is refused, correctly.
   `Fishy/fishy-profile/src/main/java/com/fishy/profile/store/SaveEngine.java:168-176`
   decides the shipped Dummy fallback first — the profile id is the literal `"0"`
   and the banner is `Dummy0` (`isDummyFallback`) — journals
   `fallback-blocked`, writes **nothing**, advances the fence, and answers
   `SaveOutcome.saved(version)`: status byte **0**, i.e. success.

5. The client cannot tell, and says so. `SaveProfileHandler.onSavePlayerProfileOk`
   (`SaveProfileHandler.as:651-731`) gates the apply half on bit 0
   (`:661 (param1 & RpcClient.STATUS_SAVE_FAIL) == 0`, `STATUS_SAVE_FAIL = 1`,
   `RpcClient.as:119`). The manual Save popup in `OverlaySetting.onGlobalRpcsSuccess`
   (`OverlaySetting.as:104-138`) compares the status byte for **equality with 1**
   (`:113`) and otherwise renders `GameWorld.textHandler.getTextFromId("GameSaved")`
   (`:131`) — so a byte of 0 shows "Game Saved". This is the shipped contract, not a
   bug in isolation: Fishy's own ADR-0024 inventory
   (`Fishy/docs/decisions/0024-stale-ack-version-echo.md:135`) records
   `fallback-blocked` as "Reported OK to advance the fence by design … **No.** the
   client cannot tell", and closes with "the remaining invisibility is a property
   of the 2010 client's contract, visible to the operator through
   `profile_save_fact` instead."

**Why it is on our side.** Fishy ADR-0036
(`Fishy/docs/decisions/0036-a-save-applies-everything.md:133-139`) keeps the block
and names the two missing halves: "Persisting it would overwrite a real layout with
a dummy one; **the fix belongs to the profile-LOAD path (why the client fell back)
and to the client (telling the player)**, not to the save boundary. One account
(`JEnderStar`) produced 385 in 24 h and is the case to start from."

**Scale.** Live series for that one account: 3 events on 2026-09-10, 382 on
2026-09-11, **none** on 2026-09-12 or since (Fishy `docs/status.md:1219-1226`).
The 2026-09-11 cluster is the incident this ADR closes; the mechanism, not the
rate, is what makes it worth fixing — one trigger is a server-side
`CannotGetJdbcConnectionException` burst of 30-140 per minute, which fails RPC 3
for every client that boots inside the window.

**A second, quieter loss in the same three lines.** `getUserProfileFail` assigned
unconditionally, so a *later* failed attempt overwrote a profile an *earlier*
attempt had already loaded: `RpcRequestManager` re-commits the whole startup batch
on its own retry (`RpcRequestManager.as:141-179`, `maxRetryCount = 2`), and a
profile that arrived on attempt 1 and failed on attempt 2 left the client holding
Dummy0. The same removal fixes that.

## Options considered

1. **Make the server say so on the wire** (set bit 0, or a new flag, on a
   `fallback-blocked` ack). Rejected: the server side of this is deliberately
   unchanged (a concurrent round is adding an operator alert, not a protocol
   change), and the fence-advance contract depends on reporting an accepted save.
   It would also be actively worse for the player: the only client handler that
   acts destructively on bit 0 quits the game (`OverlaySetting.as:113-116` →
   `GameWorld.error()` → `Engine.quit()`).
2. **Guard the lie instead of the cause** — e.g. `SaveProfileHandler` refusing to
   report success when the owner profile is the Dummy one. Rejected as incomplete:
   the player would still be decorating a throw-away restaurant; the session would
   still be worthless, only the final message would change. It also needs a
   heuristic on uid `"0"`/banner `Dummy0` rather than a real signal.
3. **Retry the read, then surface it and never start a world** — chosen, and
   bounded to the two places that create and admit the throw-away world.

## Decision

Two files, both additions to the sanctioned set. Neither changes a wire byte, a
save payload, a version fence, a balance, an item quantity, or server behaviour.
Line references into the two patched files are the **pre-patch** numbering, because
the patch itself moves them.

1. **`rpc/RpcGetUserProfile.as` — `getUserProfileFail()`.** The release
   substitution is removed: `userInfo` and `ingredientShops` are left unset, so a
   failed read stays visible to the caller and can no longer overwrite a profile an
   earlier attempt loaded. `applyData()` (`:62-92`) is already guarded by
   `if(userInfo)` and therefore does nothing while the profile is missing. The
   `RpcEvent.FAIL` dispatch is unchanged. Marker:
   `RC Reborn ADR-0054: profile read failed; keeping the real profile instead of
   standing in Dummy0`.

2. **`GameInitLoader.as` — the entry flow gates the boot on the profile.**
   `onRpcsSuccess()` and `onRpcsFail()`'s release branch now call a new
   `startupRpcsSettled()` instead of setting `rpcsSuccess = true; onLoadSuccess()`
   directly. `startupRpcsSettled()` is the boot gate:

   - profile present (`getUserProfileRpc.userInfo != null`) → `rpcsSuccess = true;
     onLoadSuccess()`, i.e. the shipped behaviour;
   - profile missing and fewer than two retries used → re-issue RPC 3 through the
     existing `getUserProfileRpc.commit()` with its existing callbacks, and resume
     the gate when it settles (`onProfileRetrySuccess` / `onProfileRetryFail`);
   - profile missing after two retries → `onInitError("Could not load your
     restaurant. Please reload the page.")` and **return**: the shipped
     `NetworkError` screen with the message (`GameInitLoader.as` pre-patch
     `:305-329`), and `initGameWorld()` is never reached, so no world is ever
     created.

   The retry is not new machinery: it is the shape `rpcInitFail()`
   (`GameInitLoader.as:163-182`) already uses for RPC 1 — a `>= 2` counter,
   re-issued from the failure path, no backoff, then the error surface. Markers:
   `RC Reborn ADR-0054: retrying the profile load after a failed read, attempt N`
   and `RC Reborn ADR-0054: profile load still failing; telling the player instead
   of entering the Dummy world`.

Nothing else reads the substituted value: `RpcGetUserProfile` is constructed in
exactly one place (`GameInitLoader.as:261`), consumed in exactly one place
(`GameWorld.as:2177`), and nothing else in the 798 classes reads
`RpcGetUserProfile.userInfo` before the world starts. `getDummyUserInfo`/
`getDummyUser` themselves are untouched: they are still the correct fallback for
*other* players (street rosters, `RpcGetAllFriends.as:26`,
`GameWorld.as:3192-3198`), just never for the owner's own profile.

## Retry-then-surface, and why a transient failure cannot lock anyone out

- **Retry first.** A profile read fails for ordinary reasons — a dropped
  connection, a server restart, a database blip (the live cause was a
  `CannotGetJdbcConnectionException` burst). The client therefore attempts RPC 3
  three times before giving up: the batch's own attempt, plus two retries. The
  session token and request bytes are identical, so a transient condition that has
  passed by the second attempt simply succeeds and the player never learns anything
  happened.
- **Nothing is a hard lock.** Nothing is written and nothing is consumed on the
  failure path; the only outcome is that no world starts and the player is told.
  Reloading the page (or retrying when the link is back) starts a fresh boot with a
  fresh counter, and the throw-away world is no longer reachable at all, so no
  session can accumulate work that the server will refuse.
- **The trade, stated plainly.** Three consecutive failures now end the boot with
  a message instead of a playable-but-lossy Dummy session. That is the intended
  direction of the operator's standing bar ("nothing should fake save"): a player
  who is told their restaurant could not be loaded loses nothing, while a player
  in a Dummy world loses everything they do and is told it saved. The retry keeps
  the window small so ordinary transients do not reach the message.
- **The residual is honest.** With the server unchanged, a `fallback-blocked` save
  is still answered with status byte 0. What this ADR removes is the client's
  ability to *create* that situation; the operator still sees any occurrence in
  `profile_save_fact`/`fallback-blocked`, which is now evidence of an older client
  or of a route into the Dummy world that does not come through RPC 3.

## Consequences

- A failed profile read can no longer put a player into another restaurant, so a
  whole session can no longer be silently discarded while the client says
  "Game Saved".
- A later failed profile read can no longer overwrite a profile an earlier attempt
  had already loaded (the batch-retry case).
- A client that cannot load a profile at all now ends at the shipped error screen
  with an explicit instruction ("Could not load your restaurant. Please reload the
  page.") instead of a playable Dummy world. Players who never hit the failure see
  no difference: the gate's success path is the old `rpcsSuccess = true;
  onLoadSuccess()`.
- Production `fallback-blocked` counts are expected to go to zero for the
  patched client. Any recurrence is a client built before this ADR.
- No server, schema, data-file, protocol, or Ruffle change. Rollback is one copy of
  `game.swf` (the previous build is kept beside it).

## Evidence

- Defect mechanism: the citations above; Fishy ADR-0024's outcome table and ADR-0036
  Consequences name `fallback-blocked` as the last fake save and place the fix on
  the profile-load path and the client.
- Build: `decompiled/game/build.bat release` (Flex 4.16.1 at `C:\flex`, Java 21) →
  `decompiled/game/bin/game.swf`, CWS 760×600, **522,213 B**, SHA-256
  `FDAB491A67A51082BC38A6B86871CDA2C3F72D201E0C34BC7D156D59501B94C6` (from 521,917 B
  / `E56A08E9…` at ADR-0053). Warning-enabled rebuilds before and after the patch
  report the same **7** pre-existing `away3d` warnings and none from either patched
  file (`_round104/base-build.txt`, `_round104/patched-build.txt`).
- Artifact: the deployed SWF's inflated body carries **3** `RC Reborn ADR-0054`
  markers (and keeps the 3 `RC Reborn ADR-0053` markers).
- Confinement: FFDec 26.x exported all **802** classes from the pre-patch and
  patched builds; exactly two decompiled files differ — `GameInitLoader.as` and
  `rpc/RpcGetUserProfile.as` (`_round104/decompiled-class-diff.txt`). In
  `RpcGetUserProfile.as` the `getDummyUserInfo` call is present in the pre-patch
  class and absent in the patched one.
- Deploy: installed to `/var/rc/maggie/assets/swf/game.swf` with the outgoing build
  kept at `/var/rc/fishy/backup-round104/game.swf-prev`; the content-addressed URL
  re-derived itself with no restart (`?v=fdab491a67a51082`, 200 / 522,213 B,
  `x-asset-source: store`, served bytes identical to the installed file).
  Details in `client-html5/docs/status.md` and `docs/release.md`.
- **Not verified:** the patched client actually running. The two patched branches
  run only when RPC 3 fails (or after the batch settles), so they are not exercised
  by a normal boot, and there is no browser/Ruffle harness attached to this box.
  The behavioural claim is established by reading every touched branch. Rollback is
  one `install` of `game.swf-prev`.
