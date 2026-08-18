# src/net

PlayFish binary RPC client for the browser, plus data-file readers.

Rules (see `docs/05-network-protocol.md`):

- Speak the **existing wire protocol byte-exactly**. The backend
  (`../server`) already implements the server side; the client side is the
  mirror of its `src/rpc/codec.ts` and of the ActionScript
  `com/playfish/rpc/share/*` readers/writers.
- Big-endian varint/string/date/bool/array primitives, batch envelope
  (msgType 255), and per-call response readers — see the protocol doc.
- No framework imports; unit-testable in Node.

Planned contents (M0+):

- `codec.ts` — primitive reader/writer port
- `rpc-client.ts` — session, batch, per-call request/response mapping
- `calls/` — one module per msgType (profile, friends, mails, saveProfile...)
- `data/` — typed runtime models for the generated data JSON
  (`public/assets/generated/data/*.json`). The bin-xml READERS live in
  `tools/lib/data/` (ADR-0008) and run at pipeline time, never in the
  browser.
