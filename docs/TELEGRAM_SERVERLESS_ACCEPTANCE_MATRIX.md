# Telegram Serverless migration acceptance matrix

This matrix defines the minimum feature-parity gate. A code port is not considered complete until each item has an implementation reference, automated coverage where practical, and staging evidence. Do not mark a row complete based only on compiling or pushing code.

| Area | Required behavior to preserve | Acceptance evidence |
|---|---|---|
| Webhook security | Validate Telegram webhook secret; reject non-POST and unauthorized requests; deduplicate update IDs | Valid/invalid secret tests and duplicate delivery test |
| Admin authorization | Only configured Telegram admin can use private admin flows; group chats never receive admin panel | Unauthorized user, private chat and group-chat tests |
| Admin conversation | `/start`, `/menu`, `/help`, `/cancel`; title, description, winner count, date/time, preview, confirmation and optional poster | Full conversation state-machine test through each branch |
| Giveaway lifecycle | Create, schedule, start, update state, finish, cancel/reset, list active and historical giveaways | Staging create/start/finish/cancel run with database assertions |
| Participants and viewers | Join/watch token validation, expiry, duplicate protection, participant/viewer counters and realtime updates | Valid/expired/replayed token tests; count consistency checks |
| Winner selection | Preserve round ordering, eligible participant selection, persisted winner history and announcement behavior | Deterministic test fixtures and staging end-to-end run |
| Telegram publishing | Photo/file_id handling, inline-mode result, chosen inline result, post tracking and exact-message deletion | Telegram test chat checks for each update envelope |
| Group management | Bot membership updates, admin-only auto-registration, permission state, `.del7`, bounty-message deletion scoped to the configured group | Tests for authorized/unauthorized actor, status and chat ID |
| Settings and cleanup | All toggles, reminder intervals, message cleanup queue and session/token expiry semantics | Setting-by-setting tests plus scheduled-work tests |
| Reminder/cron jobs | 15m/5m/2m reminders, auto-start, auto-finish and notification deduplication | Fake-clock tests and staging scheduled execution |
| Admin WebApp | Authentication, session timeout, giveaway CRUD, groups/settings, stats/search and logs | Browser acceptance checklist and API authorization tests |
| Realtime | Participant/viewer/wheel events preserve current event names and authorization boundaries | Client/server contract tests with two independent sessions |
| Winner image | Preserve QR/signature/stamp toggles, fonts, dimensions, output format and Telegram delivery | Golden-image comparison and staging photo send |
| Data migration | Every source table/column including runtime-created tables, counts, primary keys, JSONB and timestamp conversion | Source snapshot audit, preflight validation, staging row-count reconciliation |
| Operations | Error logging, webhook health, rollback procedure, secret configuration and rate limits | Runbook review and rollback rehearsal |

## Current known blockers

- The current Vercel webhook remains the behavior reference; the Serverless runtime helpers are not a replacement for its state machine.
- The schema file is a mapping proposal, not evidence that source and destination schemas match exactly.
- The existing application depends on Neon/Postgres, Ably, Sharp, fontkit, QR generation, and a Vite-built admin app. Every dependency must be replaced or explicitly proven compatible before cutover.
- Scheduled work, real-time transport, image rendering, and admin frontend hosting need validated Serverless-compatible implementations.
- Production export/import, platform database migration, webhook switching, and Vercel shutdown are separate steps requiring staging success and an approved rollback.

## Cutover rule

Do not switch the production webhook until all required rows above have evidence attached to the pull request, a staging migration has reconciled every table, the bot has passed end-to-end tests, and rollback has been rehearsed. No production state is changed by this checklist.