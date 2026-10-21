# Telegram Serverless migration — Ramz Estet

## Goal

Move the existing Ramz Estet giveaway bot, its database, Mini App and admin UI to Telegram Serverless while preserving behavior. This branch is a foundation, not a production cutover. It does not replace the live Vercel/PostgreSQL app or change the production webhook.

## Current architecture and features

The project currently uses Vercel Node.js API routes, Neon/PostgreSQL and a React/Vite admin app. Checked-in code indicates these features must remain intact:
- Admin-only bot menu and multi-step giveaway creation: title, description, optional poster, 1–50 winners, Tashkent date/time.
- Inline giveaway posting, participant and viewer tracking, winner history, round/state management and realtime UI.
- Opaque start/watch tokens, admin panel capabilities, Telegram Mini App authentication.
- Scheduled reminders, auto-start/auto-finish, cleanup queue, admin settings and duplicate-update protection.
- Telegram group registration, per-giveaway chat roles, audit logs and winner image/QR/signature/stamp options.
- Ably realtime integration and the Vite admin frontend.

## Target layout

- `tgcloud/schema.js`: SQLite schema mapping for known PostgreSQL tables.
- `tgcloud/handlers/`: one handler per update type, including message, callback_query, inline_query, chosen_inline_result and my_chat_member.
- `tgcloud/endpoints/`: Mini App/admin operations called with `Telegram.WebApp.Serverless.call`.
- `tgcloud/lib/`: shared authorization, giveaway services, tokens, time helpers and integrations.
- Vite frontend builds to `dist/`; `tgcloud.jsonc` configures static hosting.

## Data preservation rules

1. Do not point production users to Serverless until schema and behavior parity tests pass.
2. Export PostgreSQL tables to private JSON/CSV files with a table-by-table row count. Never commit production data or secrets.
3. Convert PostgreSQL TIMESTAMPTZ values to Unix seconds (the schema uses `integer(..., { mode: 'timestamp' })`), JSONB to JSON values and PostgreSQL booleans to booleans.
4. Preserve primary IDs and composite uniqueness. Check SQLite auto-increment behavior after importing explicit IDs.
5. Import parent records first, then participants, viewers, winners, tokens, chat mappings, cleanup queues and logs.
6. Compare source/target row counts, ID ranges, participant/winner counts per giveaway and sample timestamps before cutover.
7. Keep Neon as a read-only rollback snapshot until post-cutover verification is complete. Do not delete or modify the source database as part of deployment.

## Runtime compatibility risks

- Serverless modules run in an isolated V8 runtime: no Node filesystem, `process.env`, `Buffer`, arbitrary npm runtime packages or direct PostgreSQL client. Use `sdk` imports and outbound `fetch`.
- Existing crypto code uses Node `crypto`; token generation/verification needs a compatible implementation using supported Web Crypto APIs.
- Winner image rendering uses package-dependent font/image work (including `sharp`, `fontkit`, QR generation). Each path needs a compatibility test and an intentional replacement if unsupported.
- Ably realtime must be checked against outbound fetch/WebSocket constraints. Do not silently remove realtime behavior.
- Scheduled reminders, auto-start/finish and cleanup need a supported scheduling strategy confirmed from Serverless docs before replacing Vercel cron.
- PayX or any other external payment webhook needs a supported inbound path. Do not assume arbitrary public webhook endpoints are available unless the platform explicitly supports them.

## Cutover checklist

- [ ] Inventory every route in `api/[...route].js` and every table created dynamically by helpers.
- [ ] Port every bot update type and preserve callback data values, inline result IDs and admin-only authorization.
- [ ] Port each REST operation to a named Serverless endpoint; update both Mini App and admin app calls.
- [ ] Port scheduled jobs, Ably realtime and winner image generation.
- [ ] Build a private, idempotent export/import tool and row-count verification report.
- [ ] Test authorization, init data, token expiry, duplicate updates, participant uniqueness, start/finish, winner selection, reminders, group permissions and error handling.
- [ ] Deploy to a test bot first, then switch the Mini App URL and production traffic after sign-off.
- [ ] Keep rollback steps documented and leave Neon unchanged until verification is complete.

## Status

The initial schema mapping is based on `schema.sql` plus tables dynamically created in `lib/api/_settings.js` and `lib/api/_groups.js`. It still needs a complete route-by-route code port and runtime validation before it can replace production.