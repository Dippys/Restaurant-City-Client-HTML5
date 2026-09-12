# rpc-request-manager.md — the client's RPC batch, its retry, and its queue

`decompiled/game/scripts/com/playfish/games/cooking/rpc/RpcRequestManager.as`.

This is the client-side counterpart to `rpc-profile.md` (which is the wire layout
the HTML5 rebuild speaks): what the Flash client does with a batch of requests
once it has built one. It is written up because two defects here had
player-visible consequences, one of which created items.

## 1. The batch

- `addRequest(rpc)` appends to `rpcQueue` (`L72-80`), inserting ahead of any
  entry that must come last.
- `commit()` (`L295-311`) is the only way a queue is sent:
  - `rpcQueue.length > 0` → show `loadingPopUp` if set, push this manager onto
    the static `activeRequests`, and `doCommit()` **only if it is the first**
    (`activeRequests.length == 1`); otherwise it waits for `onComplete()` to hand
    over. That is the client's own serialization of batches.
  - empty queue → **`return false`** and do nothing at all. No request, no popup.
- `doCommit()` (`L205-228`) increments `retryCount`, attaches
  `onLastRpcSuccess`/`onLastRpcFail` **to the last entry only**, opens a batch,
  commits every entry, closes the batch, and calls `onLastRpcSuccess(null)` if
  nothing committed.

`retryCount` counts *commits*, not failures, and `maxRetryCount` defaults to
**2** (`L15`) — so a batch is sent at most three times.

## 2. Success clears the queue; failure did not (the defect)

| Path | Queue |
|---|---|
| `onLastRpcSuccess` (`L126-139`) | `clear()` → `rpcQueue.splice(0, length)`, removes the popup, dispatches `SUCCESS`, `onComplete()` |
| `onLastRpcFail`, retries left (`L166-169`) | `doCommit()` again — same queue, re-sent, which is the point of the retry |
| `onLastRpcFail`, retries exhausted, `retryText` set | retry popup; **queue kept on purpose**, because `onRetryOk` re-sends it |
| `onLastRpcFail`, retries exhausted, no `retryText` | `onComplete()` — **queue kept by omission** |
| `onRetryCancel` (`L272-279`) | `onComplete()` + callback — **queue kept by omission** |

Because the queue survived those two paths, the *next* `commit()` on the same
manager re-sent every unacknowledged request. That is a duplicate-send amplifier:
a request that timed out can have been **applied by the server anyway**, and the
protocol carries no idempotency key with which the client could tell a retry from
a first attempt. For an action that creates something server-side and costs the
sender nothing — the pre-ADR-0033 type-4 gift — the replay created the item again.

This is the most likely mechanism behind the 2026-09-06 rocket-ship duplication:
the server-side trace is one send per round trip at a steady few per second inside
a lagging period, which is what repeated replay of a small queue looks like, and
it is not what one send can produce (one RPC writes one mail row; `maxRetryCount`
is 2).

**Patched (ADR-0053).** A batch that will not be retried is dropped: the no-retry
give-up branch and `onRetryCancel` both `clear()` first. The retry-offered branch
is deliberately unchanged — `onRetryOk` re-sends by design, and that path is a
visible, deliberate player action. After the patch the only way a batch goes out
twice is a retry the player asked for.

## 3. What could still duplicate (not fixed)

- **`onRetryOk`.** A player who taps retry after a batch that the server already
  applied sends it again. Same missing idempotency key; the difference is that it
  is now a conscious choice rather than a silent replay.
- **Anything the caller re-commits itself.** The patch stops the *manager* from
  replaying a dead batch; a caller that builds a fresh queue from the same player
  intent (e.g. re-adding a gift) is a new send, which is correct.
- **No idempotency exists at the wire level.** If duplicate application ever needs
  to be impossible rather than unlikely, that is a protocol change and a separate
  decision, not a client patch.

## 4. The display fields, and why they matter to saving

`loadingPopUp`, `retryText`, `retryCancelCallBack` and `keepLoadingPopUpOnSuccess`
are attached by the *caller* before it commits, and are read back by the manager
when it sends or fails. `GameWorld.commitGlobalRpcs` (ADR-0031 serialization)
replaces `GameWorld.globalRpcs` with a fresh manager and, before ADR-0053, dropped
those fields — so a save queued behind an in-flight one ran on a manager whose
`loadingPopUp` was null and finished with no prompt at all. The editor's green
tick consequently looked dead. See `editor.md` §6 for that failure's full chain;
ADR-0053 carries the four fields onto the replacement manager.
