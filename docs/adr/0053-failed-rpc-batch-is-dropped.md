# ADR-0053 — A failed RPC batch is dropped, and a queued save keeps its prompt

Status: accepted · Date: 2026-09-12 · Extends the sanctioned AS3 patch set

## Context

Two defects in the shipped Flash client were found while investigating a banned
player's appeal (the 2026-09-06 rocket-ship duplication) and a support report
("I press the green tick to save and nothing happens"). Both are on **our** side:
the server behaved as written, and the client's own bookkeeping is what turned a
lost response into created items and a working save into a button that looks dead.

**Defect 1 — a failed batch is replayed by the next commit.**
`RpcRequestManager.doCommit()` sends every request in `rpcQueue` and registers its
outcome listeners on the last entry. `onLastRpcSuccess` calls `clear()`, which
splices the queue. `onLastRpcFail` retries up to `maxRetryCount` (2), and when it
gives up it does **not** clear:

```as3
if(retryCount > maxRetryCount)
{
   if(loadingPopUp != null) loadingPopUp.remove();
   retryCount = 0;
   if(hasEventListener(RpcEvent.FAIL)) dispatchEvent(new RpcEvent(RpcEvent.FAIL));
   if(retryText != null) { retry popup shown }   // queue kept, intentionally
   else { onComplete(); }                        // queue kept, by omission
}
```

`onRetryCancel` leaks it the same way (`onComplete()` then the callback, no
`clear()`). So after a batch fails, the unacknowledged requests sit in the queue,
and the **next** `commit()` on that manager re-sends them.

That matters because of *when* a batch fails: a timeout or a dropped connection
can arrive **after** the server has already applied the work. Re-sending then
duplicates it, and the protocol has no idempotency key with which the client could
tell the difference. For the one action that creates items server-side without a
debit — the pre-ADR-0033 type-4 gift — the duplicate was a duplicated item. The
server-side data is consistent with exactly that shape: sends arriving one per
round trip at a steady few per second, in the bursts a lagging server produces.

**Defect 2 — a save queued behind another save loses its prompt.**
ADR-0031 makes `GameWorld.commitGlobalRpcs()` serialize saves. When one is in
flight it takes this branch:

```as3
if(globalSaveInFlight) { globalSaveQueued = true; return true; }
```

The caller has, by then, attached its `"Saving..."` popup and retry text to
`GameWorld.globalRpcs` — and a *full* commit (the 60 s autosave of ADR-0036, most
likely) then does `globalRpcs = new RpcRequestManager()`, discarding the manager
that held them. The queued commit therefore runs on a manager whose
`loadingPopUp` is null: the save lands, the player sees no prompt, and because
`return true` told `WorldRestaurantEditor.playClicked` the click had been handled,
the editor does not close either. Reported exactly as "the animation of clicking
the green tick happens but nothing else".

## Decision

Two patches, both bounded and both additive to the sanctioned set.

1. **`rpc/RpcRequestManager.as`** — a batch that is *not* going to be retried is
   dropped. `onLastRpcFail`'s give-up branch with no retry text calls `clear()`
   before `onComplete()`, and `onRetryCancel()` calls `clear()` as well. The
   retry-offered branch is unchanged, because `onRetryOk` re-sends the queue by
   design — that path is a visible, deliberate player action. After the patch the
   only way a batch is sent twice is a retry the player asked for.
2. **`GameWorld.as`** — when `commitGlobalRpcs()` replaces `globalRpcs` while
   `globalSaveQueued` is set, it carries the outgoing manager's **display** fields
   (`loadingPopUp`, `retryText`, `retryCancelCallBack`,
   `keepLoadingPopUpOnSuccess`) onto the replacement. Only those four are copied;
   no request, version, fence or handler behaviour changes. The queued save then
   shows the prompt its caller asked for, and a transport failure on the editor
   path reaches the player as the retry prompt it already had the text for
   (`SaveDecorationRetryText`) instead of `onCommitFail`'s silent dead end.

Neither patch changes a wire byte, a save payload, a version fence, a balance or
an item quantity. Patch 1 removes sends; it never adds one.

## Consequences

- A slow or lossy connection can no longer turn one gift into many. This is the
  root cause of the incident that produced the round-95 gift-duplication repair,
  so future occurrences of that signature should be treated as a regression here,
  not as an exploit.
- A player whose batch genuinely failed is told (the retry prompt) instead of
  having the batch silently re-sent later.
- The restaurant editor's green tick again shows `"Saving..."` and closes, even
  when the click lands during an autosave.
- Cancelling a retry now discards that batch. Nothing in the client re-sends from
  a queue after FAIL — the FAIL handlers detach listeners or show UI — so no
  caller depended on the old behaviour.
- The two defects are independent; either patch is safe without the other.

## Evidence

- Server-side, the incident's timing is a steady one-mail-per-round-trip stream
  (180 mails spread across ~55 of 60 seconds on 2026-09-08 05:12, contiguous mail
  ids, nothing interleaved), which is what a lagging server plus client-side
  replay produces — and what a single send cannot (one RPC writes one mail row,
  and `maxRetryCount` is 2).
- The save-tick behaviour was reproduced from the code path and matched the
  player's report; the same pass found the editor's `onCommitFail` to be a no-op.
- Rebuilt SWF hash and the deployed revision are recorded in
  `client-html5/docs/status.md` for this round.
