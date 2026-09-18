# ADRs

Decision records for the HTML5 rebuild. Immutable once committed: change a
decision by adding a new ADR that supersedes this one.

| # | Title |
|---|---|
| [0001](0001-stack-vite-typescript-phaser.md) | Stack: Vite + TypeScript + Phaser 3 |
| [0002](0002-reuse-existing-backend-and-wire-format.md) | Reuse the existing backend and wire format unchanged |
| [0003](0003-2d-prerendered-sprites-no-live-3d.md) | 2D pre-rendered sprites; no live 3D |
| [0004](0004-atlas-format-webp-phaser-multiatlas.md) | Atlas format: WebP + Phaser multi-atlas JSON |
| [0005](0005-data-files-client-side-readers-json-runtime.md) | Data files: ported readers at tool time, JSON at runtime |
| [0006](0006-parity-verification-methodology.md) | Parity verification: AS3-as-spec + side-by-side |
| [0007](0007-canvas-ui-with-dom-overlay-exceptions.md) | Canvas-first UI with narrow DOM overlay exceptions |
| [0008](0008-data-readers-live-in-tools.md) | Data readers live in tools/lib/data (supersedes ADR-0005 placement) |
| [0009](0009-audio-mp3-passthrough.md) | Audio: mp3 passthrough of original embedded assets |
| [0010](0010-original-assets-layout.md) | Original assets consolidated under a single `original/` root |
| [0011](0011-server-self-contained-assets.md) | Server self-contained: assets ship in `server/public/` (supersedes ADR-0010 asset location) |
| [0012](0012-honor-get-users-item-context.md) | Honor the `getUsers` item-context mask |
| [0013](0013-price-pf-cash-purchases-from-game-data.md) | Price PF-cash purchases from game data |
| [0014](0014-transactional-inactive-account-purge.md) | Transactional inactive-account purge |
| [0015](0015-include-owner-in-friend-street-roster.md) | Include the owner in the friend-street roster |
| [0016](0016-street-rosters-return-facade-items.md) | Street rosters return facade placements only |
| [0017](0017-street-roster-selection-policy.md) | Street rosters + separate Hire RPC (supersedes ADR-0015 composition) |
| [0018](0018-sanitize-garden-plots-at-rpc-boundary.md) | Sanitize garden plots at the RPC boundary |
| [0019](0019-seed-starter-layout-on-profile-creation-only.md) | Seed starter layout on profile creation only |
| [0020](0020-internal-social-links.md) | Internal social links replace Facebook sharing |
| [0021](0021-select-only-renderable-garden-seeds.md) | Select only renderable garden seeds |
| [0022](0022-additive-social-link-service.md) | Additive social-link service and Ruffle bridge |
| [0023](0023-existing-flash-actions-open-browser-share-modal.md) | Existing Flash actions open the browser share modal (supersedes ADR-0022 generic creator menu) |
| [0024](0024-stable-placement-ids-and-transactional-trades.md) | Stable placement IDs and transactional ingredient trades |
| [0025](0025-recover-provably-overwritten-facade-slots.md) | Recover provably overwritten façade slots (narrowly supersedes ADR-0019/0024 missing-placement policy) |
| [0026](0026-recover-provably-overwritten-restaurant-door.md) | Recover a provably overwritten restaurant door (extends ADR-0025) |
| [0027](0027-normalize-owned-item-primary-keys-with-server-ids.md) | Normalize owned-item primary keys with server IDs (corrects ADR-0024 implementation) |
| [0028](0028-live-mail-over-existing-event-poll.md) | Live mail over the existing event poll |
| [0029](0029-incremental-live-mail-and-single-submit-trades.md) | Incremental live mail and single-submit trades (supersedes ADR-0028 live application) |
| [0030](0030-playfish-cash-credit-delivery.md) | Playfish Cash delivery over the type-7 Credit Delivery layout |
| [0031](0031-fenced-exactly-once-profile-saves.md) | Fenced, exactly-once profile saves |
| [0032](0032-daily-ingredient-market-and-discord-announcement.md) | Daily ingredient market and Discord announcement |
| [0033](0033-admin-daily-ingredient-force-sync.md) | Admin daily-ingredient force sync |
| [0034](0034-explainable-moderation-and-profile-rollback.md) | Explainable moderation, immutable profile rollback, and session control |
| [0035](0035-server-side-purchase-pricing.md) | Server-side purchase pricing from game data |
| [0036](0036-client-autosave-cadence-60s.md) | Client autosave cadence 60 s |
| [0037](0037-gourmet-street-scored-ranking.md) | Gourmet Street scored ranking (supersedes ADR-0017 gourmet clause) |
| [0038](0038-server-side-layout-enforcement.md) | Server-side layout enforcement and correct layout anomaly reporting |
| [0039](0039-owned-item-key-repair.md) | Repair and prevent OwnedItem primary-key/serverId drift |
| [0040](0040-admin-shop-control-item-overrides.md) | Admin shop control via item overrides (superseded by ADR-0041) |
| [0041](0041-db-backed-game-data-generation.md) | DB-backed game data: re-index assets, regenerate at serve time (supersedes ADR-0040) |
| [0044](0044-deterministic-anomaly-reporting.md) | Restrict anomaly reporting to deterministic evidence |
| [0045](0045-authoritative-sales-and-zero-ingredient-cleanup.md) | Authoritative item sales, zero-ingredient cleanup, and robust fallback recovery |
| [0046](0046-native-photo-download.md) | Native browser download replaces Facebook photo upload |
| [0050](0050-employee-food-save-audit-semantics.md) | Employee-food save-audit semantics (narrowly supersedes ADR-0035) |
| [0051](0051-throttle-automatic-save-checkpoints.md) | Throttle automatic pre-save checkpoints and define save-fact checkpoint anchors |
| [0052](0052-persistent-click-selected-item-rotation.md) | Persistent click-selected rotation in the Flash restaurant editor |
| [0054](0054-a-failed-profile-load-is-surfaced-not-substituted.md) | A failed profile load is retried, then told — never a Dummy stand-in |
| [0055](0055-street-renders-the-halloween-scene-with-the-halloween-shop.md) | The street renders the Halloween variant while the shop's Halloween decor is obtainable |
