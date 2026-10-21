# Ramz Estet — Serverless implementation tracker

This file is the implementation ledger for the migration PR. It is intentionally evidence-based: a route is not marked ported merely because a similarly named endpoint exists.

## Existing Vercel route contract

The legacy dispatcher in `api/[...route].js` exposes the following route names. The old implementation remains authoritative until each route has a compatible Serverless implementation and staging evidence.

| Legacy route | Source module | Serverless target | Status |
|---|---|---|---|
| `start` | `lib/api/start.js` | Telegram command handler / admin entry | Not ported |
| `reset` | `lib/api/reset.js` | Admin endpoint/handler | Not ported |
| `cron-notify` | `lib/api/cron-notify.js` | Scheduled task(s) | Not ported |
| `telegram-status` | `lib/api/telegram-status.js` | Admin diagnostics endpoint | Not ported |
| `next` | `lib/api/next.js` | Admin endpoint | Not ported; source intentionally rejects client-side winner selection |
| `set-webhook` | `lib/api/set-webhook.js` | Platform webhook configuration/runbook | Platform-specific; not ported |
| `telegram-webhook` | `lib/api/telegram-webhook.js` | Flat Telegram update handlers | Not ported; full state machine must be preserved |
| `giveaways` | `lib/api/giveaways.js` | Admin endpoint | Not ported |
| `giveaway` | `lib/api/giveaway.js` | Admin endpoint | Not ported |
| `settings` | `lib/api/settings.js` | Admin settings endpoint | Not ported |
| `groups` | `lib/api/groups.js` | Group-management endpoint/handlers | Not ported |
| `admin-dashboard` | `lib/api/admin-dashboard.js` | Admin endpoint | Not ported |
| `state` | `lib/api/state.js` | Admin endpoint | Not ported |
| `watch` | `lib/api/watch.js` | `tgcloud/endpoints/watchGiveaway.js` | Partial; needs SDK/staging parity |
| `join` | `lib/api/join.js` | `tgcloud/endpoints/joinGiveaway.js` | Partial; legacy group-post edits and realtime publication not yet ported |
| `public-giveaway` | `lib/api/public-giveaway.js` | `tgcloud/endpoints/publicGiveaway.js` | Partial; needs response-contract and staging parity |
| `current-giveaway` | `lib/api/current-giveaway.js` | `tgcloud/endpoints/currentGiveaway.js` | Partial; needs response-contract and staging parity |
| `ably-token` | `lib/api/ably-token.js` | Compatible realtime authorization | Not ported; Ably replacement/contract required |
| `finish-round` | `lib/api/finish-round.js` | Winner settlement service + endpoint | Not ported; winner persistence, image rendering, announcements and group posts must be preserved |
| `winner-status` | `lib/api/winner-status.js` | `tgcloud/endpoints/winnerStatus.js` | Partial; needs response-contract and staging parity |
| `client-log` | `lib/api/client-log.js` | Logging endpoint | Not ported |
| `log-test` | `lib/api/log-test.js` | Diagnostics-only endpoint | Not ported; production exposure must be reviewed |
| `test-winner-image` | `lib/api/test-winner-image.js` | Diagnostics/image test endpoint | Not ported; production exposure must be reviewed |

## Update envelopes handled by the current webhook

The existing webhook processes:
- `message`: admin-only private conversation state machine, message cleanup, photo/poster upload, and group-specific commands.
- `callback_query`: giveaway creation/calendar/time/preview flow; giveaway list/detail/start/cancel/round management; settings; poster upload; inline post/group management.
- `inline_query`: admin-owned giveaway publishing with join/watch deep links and optional Telegram poster.
- `chosen_inline_result`: inline-message tracking.
- `my_chat_member`: restricted group auto-registration based on configured admin and actual bot membership.

A generic message handler must not be installed until the full private-chat state machine is ported. It could otherwise consume updates intended for title/description/round/date/time/poster entry.

## Acceptance requirements before marking a row complete

For each route or update envelope:
1. Preserve HTTP/method behavior, request/response shape, authorization, token scope and expiry.
2. Preserve database side effects, idempotency, audit logs and state transitions.
3. Replace external dependencies deliberately; do not silently remove Ably events, image generation, Telegram group post edits or cleanup.
4. Add tests for allowed/denied access, malformed input, duplicate delivery and relevant state transitions.
5. Validate the actual Serverless SDK API against a linked non-production bot and database.
6. Attach staging evidence to the PR before changing the row to complete.

## Known compatibility blockers

- The old application uses Neon/PostgreSQL SQL and runtime-created tables/columns. The proposed Serverless schema is not yet a proven 1:1 mapping.
- Existing handlers rely on Node packages and environment variables; Telegram Serverless isolated runtime restrictions mean each dependency and secret-access path must be confirmed.
- Ably, Sharp/fontkit, QR generation, and Vite admin frontend hosting need an explicit replacement or a supported architecture.
- PostgreSQL export/import, timestamp conversion, identifier precision, reconciliation and rollback have not been run.
- The current endpoint ports have not been exercised against a staging bot. Passing pure unit tests is necessary but not sufficient.

## Cutover policy

Do not switch the live webhook, import production data, run a production schema migration, or disable Vercel until every required feature is implemented, staging acceptance tests pass, backups and rollback are rehearsed, and production cutover is explicitly approved.
