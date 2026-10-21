# Telegram Serverless port — route-by-route implementation ledger

This file is the acceptance ledger for the migration. It intentionally distinguishes source discovery from a completed port. **No item is complete merely because the existing Vercel route builds.** Keep the current production webhook and Neon database in place until the test bot passes the acceptance checklist.

## Current source routes

The route dispatcher in `api/[...route].js` exposes the following handlers. Each target must have an equivalent Serverless handler or endpoint, and its existing authorization and response contract must be tested.

| Existing route | Responsibility to preserve | Target surface | Status |
|---|---|---|---|
| `start` | Initialize/reset giveaway flow and bot state | endpoint + bot handler as applicable | Not ported |
| `reset` | Reset state safely | endpoint/admin operation | Not ported |
| `cron-notify` | Reminders, scheduled start/finish and cleanup | platform-supported scheduled trigger or documented external scheduler | Blocked on scheduler compatibility |
| `telegram-status` | Telegram connection/status checks | endpoint | Not ported |
| `next` | Advance giveaway/round state | endpoint + callback handler | Not ported |
| `set-webhook` | Configure Telegram webhook securely | deployment/admin procedure; do not expose as a public arbitrary endpoint | Not ported |
| `telegram-webhook` | Message, callback, inline query, chosen inline result, group moderation | update handlers | Not ported |
| `giveaways` | Giveaway list/create operations | endpoint | Not ported |
| `giveaway` | Giveaway detail/update operations | endpoint | Not ported |
| `settings` | Persist admin settings | endpoint | Not ported |
| `groups` | Group registry and per-giveaway chat roles | endpoint + `my_chat_member`/chat update handler as needed | Not ported |
| `admin-dashboard` | Admin dashboard data and actions | authenticated endpoint | Not ported |
| `state` | Live round state | endpoint | Not ported |
| `watch` | Resolve/record viewer access | endpoint with token checks | Not ported |
| `join` | Join participant with duplicate protection | endpoint with token checks | Not ported |
| `public-giveaway` | Public giveaway view | endpoint; determine supported public access pattern | Not ported |
| `current-giveaway` | Current giveaway lookup | endpoint | Not ported |
| `ably-token` | Scoped realtime token issuance | endpoint; preserve channel scoping or replace realtime deliberately | Blocked on realtime compatibility |
| `finish-round` | Finish round and persist winner | endpoint + callback handler | Not ported |
| `winner-status` | Winner/round status | endpoint | Not ported |
| `client-log` | Client-side diagnostic logging | endpoint with payload limits/redaction | Not ported |
| `log-test` | Diagnostic test route | omit from production or lock behind admin authorization | Security review required |
| `test-winner-image` | Winner image test | replace with a test-only route or supported image pipeline | Blocked on image compatibility |

## Shared modules that need explicit replacements

- `_db.js`: replace Neon/PostgreSQL calls with the platform DB API; don't mechanically translate SQL without checking query semantics.
- `_auth.js`, `_telegram-auth.js`, `_security.js`: preserve admin authorization, Telegram Mini App init-data validation, webhook secret validation, token expiry and constant-time secret comparisons where supported.
- `_audit.js`: preserve audit events without logging bot tokens, init data, opaque access tokens or personal data unnecessarily.
- `_settings.js`, `_groups.js`: preserve all dynamically created tables and setting keys; reconcile them against `schema.sql` and production migrations.
- `_telegram.js`: port Telegram Bot API calls using the Serverless SDK's supported API client or `fetch`; preserve error handling and Telegram rate-limit behavior.
- `_winner-image.js`: existing `sharp`, `fontkit`, font assets and QR package usage must not be imported into the isolated runtime unless explicitly supported. Define and test a replacement before removing the feature.
- Ably: preserve participant/viewer realtime behavior or make a reviewed product decision for an alternative. Do not silently degrade to polling.
- Scheduling: port reminders, auto-start, auto-finish and cleanup only after confirming a supported recurring trigger. A normal endpoint is not a scheduler.
- Existing Vercel/Neon production code remains the rollback path until all tests pass.

## Database parity — known gaps to verify

Compare every column, default, index, uniqueness rule and dynamically created table in `schema.sql`, `lib/api/_settings.js`, `lib/api/_groups.js` and any runtime SQL with `tgcloud/schema.js`. Specifically verify:

- `giveaways`: the Serverless schema has `panel_token` and `duration_ms`; confirm these columns exist in the actual deployed source schema/migrations and preserve their semantics.
- `giveaway_state`: the Serverless schema contains `participant_user_ids`; the base SQL includes it via an ALTER migration. Confirm SQLite uniqueness on non-null `giveaway_id` matches the PostgreSQL partial unique index.
- `giveaway_winners`: preserve `first_name` and the unique `(giveaway_id, round)` constraint.
- Settings/dynamic tables: enumerate every name and column in the helpers, not just the initial SQL file.
- Group/chat cleanup queues, inline post mapping, UI state and processed-update deduplication: confirm every table is created, used and imported consistently.
- Timestamp units: schema timestamp-mode integers are Unix seconds; raw PostgreSQL epoch milliseconds/seconds and integer-valued `start_at` must not be mixed.
- IDs: Telegram chat/user IDs may exceed signed 32-bit ranges. Verify the target integer representation safely handles current values.
- SQLite has no foreign keys in this runtime; enforce consistency in application logic and run orphan checks after import.

## Required acceptance tests

1. Admin-only bot commands reject non-admin users and preserve the multi-step creation flow (title, description, optional poster, 1–50 winners, Tashkent date/time).
2. Every callback payload and inline result ID used by the current bot still routes correctly.
3. Join/watch tokens are opaque, hashed at rest, expire correctly, and cannot be replayed for another giveaway/action.
4. Telegram Mini App init data is verified by the platform or cryptographically validated; client-supplied user IDs are never trusted alone.
5. Duplicate Telegram updates and duplicate participant joins are idempotent under concurrent requests.
6. Giveaway create/start/advance/finish, winner selection, winner history and state restoration survive a runtime restart.
7. Group registration, role-specific posts, moderation (including bounty/баунти text and captions in the configured group), permissions and message cleanup work.
8. Settings, audit logs, reminders, auto-start/finish and cleanup work with their real trigger source.
9. Realtime participant/viewer updates and winner image/QR/signature/stamp behavior have explicit passing tests.
10. Export/import is repeatable and idempotent. Verify row counts, primary IDs, uniqueness, timestamps, participants/winners per giveaway and representative records before any cutover.
11. Frontend screens call the target endpoint API and preserve loading, errors, auth and empty states; the existing admin frontend's REST calls cannot be assumed compatible with Mini App Serverless calls.
12. Test-bot rollout and rollback are rehearsed; the live webhook URL and Neon database are not changed until sign-off.

## Safe order of execution

1. Complete source-schema and route inventory.
2. Implement shared DB/auth/Telegram primitives and schema parity tests.
3. Port handlers/endpoints in small reviewed batches.
4. Adapt Mini App/admin frontend and integrations.
5. Build a private export/import tool that never commits production data or secrets.
6. Run tests against a separate test bot and empty test database; then test import into a disposable target database.
7. Compare behavior and data, rehearse rollback, then schedule cutover.

**Current result:** inventory/acceptance criteria only. This document does not claim the runtime port, data migration or deployment is complete.
