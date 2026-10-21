# Telegram Serverless port — implementation tracker

This tracker is intentionally explicit: a green CI build is not proof of feature parity. Do not switch the production bot, Mini App URL, or database until every required item below is implemented and tested on a separate test bot.

## Existing deployment (source of truth)

- Runtime: Vercel Node API routes (CommonJS), Node 24.
- Database: Neon PostgreSQL through `@neondatabase/serverless`.
- Admin UI: React + Vite in `admin-app/`.
- Public pages: `public/index.html`, `public/manage.html`, `public/watch.html`.
- Realtime: Ably.
- Image pipeline: `sharp`, `fontkit`, DejaVu fonts, `qrcode`.
- Bot update endpoint: `lib/api/telegram-webhook.js`.
- Source schema: `schema.sql`; candidate Serverless schema: `tgcloud/schema.js`.

## Route parity inventory

The following routes are present in `api/[...route].js`. Each needs a Serverless endpoint/handler and behavioral tests; don't replace them with generic success responses.

| Existing API route | Required parity |
| --- | --- |
| `start` | Initialize bot state and required database records |
| `reset` | Admin-only reset with explicit safety checks |
| `cron-notify` | Reminders, due auto-start/finish, cleanup queue |
| `telegram-status` | Telegram API health/status |
| `next` | Advance giveaway round safely |
| `set-webhook` | Secure webhook setup; secret never exposed |
| `telegram-webhook` | Message, callback, inline, membership and duplicate-update handling |
| `giveaways` | Admin listing and creation/edit behavior |
| `giveaway` | Giveaway detail/update behavior |
| `settings` | All settings and validation |
| `groups` | Group registration, permissions and giveaway roles |
| `admin-dashboard` | Dashboard data and admin authorization |
| `state` | Live giveaway state |
| `watch` | Viewer token validation and tracking |
| `join` | Join token validation and unique participant insertion |
| `public-giveaway` | Public giveaway details |
| `current-giveaway` | Current active giveaway |
| `ably-token` | Realtime auth and channel authorization |
| `finish-round` | Winner selection, persistence, announcement |
| `winner-status` | Winner/round status |
| `client-log` | Validated client diagnostics |
| `log-test` | Admin-only diagnostics; disable or protect in production |
| `test-winner-image` | Admin-only image pipeline test; disable or protect in production |

## Data model parity

Before importing any production data, compare every table and column in `schema.sql`, the dynamic DDL in `lib/api/_settings.js` and `lib/api/_groups.js`, and `tgcloud/schema.js`. Required known tables include:

- `giveaways`, `telegram_giveaway_participants`, `giveaway_viewers`, `giveaway_winners`, `giveaway_state`
- `admin_sessions`, `giveaway_notify_log`, `startapp_tokens`, `audit_logs`
- `telegram_chats`, `giveaway_chats`, `giveaway_chat_posts`, `giveaway_inline_posts`
- `bot_settings`, `bot_message_cleanup`, `telegram_processed_updates`, `bot_ui_state`

Preserve IDs, unique constraints, token hashes, update IDs, timestamps, JSON values, settings and pending cleanup jobs. Never commit production exports or secrets. The importer must be idempotent and report source/target row counts and important per-giveaway counts.

## Required runtime verification

The target SDK's documented APIs must be verified before writing imports. In particular, confirm:
- database transaction and conflict/unique insert semantics;
- webhook/update entrypoint and callback acknowledgement behavior;
- outbound Telegram API access and secret configuration;
- HTTP endpoint/static hosting API and Telegram Mini App authentication;
- scheduling/cron support and retry semantics;
- outbound network/realtime support;
- supported image/QR generation strategy.

Do not guess SDK names or use Node-only APIs if the runtime does not support them. If a capability has no supported equivalent, document and implement a compatible alternative rather than silently removing it.

## Release gates

- [ ] SDK APIs checked against official platform documentation and a minimal runtime smoke test.
- [ ] Every route above has an implementation or a documented, approved equivalent.
- [ ] Bot message/callback/inline update tests pass, including duplicate delivery.
- [ ] Mini App init-data authentication, join/watch token expiry and admin authorization tests pass.
- [ ] Giveaway create/start/round/finish/winner announcement tests pass.
- [ ] Group permissions, reminders, auto-start/finish, cleanup and audit logs pass.
- [ ] Winner image, QR, signature and stamp outputs are verified or replaced with parity-tested alternatives.
- [ ] Admin app and public pages work against the new endpoints.
- [ ] Export/import dry run has zero unexplained row-count or ID mismatches.
- [ ] Test bot passes end-to-end checks and rollback is rehearsed.
- [ ] Production cutover approved; old Vercel/Neon setup retained until verification is complete.

## Current status

This repository has a preliminary schema mapping and CI smoke checks. This file is a work tracker, not a claim that the full port is complete. Production remains on the existing deployment until the release gates above pass.
