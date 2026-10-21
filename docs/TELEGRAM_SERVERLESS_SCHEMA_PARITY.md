# Telegram Serverless schema parity audit

This is a source-level audit of the checked-in PostgreSQL schema and helper-created tables against `tgcloud/schema.js`. It is not a live database comparison and does not authorize a production import.

## Tables accounted for in the Serverless schema

| PostgreSQL source | Serverless export | Notes |
|---|---|---|
| `giveaways` | `giveaways` | Includes `panel_token` and `duration_ms` fields represented in the Serverless schema; confirm their source-side migrations are present before export. |
| `telegram_giveaway_participants` | `participants` | Composite uniqueness on giveaway/user. |
| `giveaway_viewers` | `viewers` | Composite uniqueness on giveaway/user. |
| `giveaway_winners` | `winners` | Unique giveaway/round; includes `first_name`. |
| `giveaway_state` | `giveawayState` | Unique giveaway ID and participant user IDs are represented. |
| `admin_sessions` | `adminSessions` | Session JSON is retained. |
| `giveaway_notify_log` | `notifyLog` | Composite uniqueness is represented. |
| `startapp_tokens` | `startappTokens` | The source CHECK constraint for action values is not represented by this schema declaration; validate `action` in application code. |
| `audit_logs` | `auditLogs` | JSON metadata and time indexes are represented. |
| `telegram_chats` | `telegramChats` | Group permissions and active status are represented. |
| `giveaway_chats` | `giveawayChats` | Composite uniqueness is represented; source role CHECK needs application validation. |
| `giveaway_chat_posts` | `giveawayChatPosts` | Unique giveaway/chat pair is represented. |
| `giveaway_inline_posts` | `giveawayInlinePosts` | Created dynamically by `lib/api/_groups.js`; do not omit when exporting. |
| `bot_settings` | `botSettings` | All settings currently declared in `lib/api/_settings.js` are represented. |
| `bot_message_cleanup` | `botMessageCleanup` | Cleanup queue and due-time index are represented. |
| `telegram_processed_updates` | `processedUpdates` | Needed for webhook idempotency. |
| `bot_ui_state` | `botUiState` | Needed for single-message admin UI behavior. |

## Required corrections / validation before data import

1. **Source schema drift:** `schema.sql` shown in the repository does not declare `giveaways.panel_token`, `giveaways.duration_ms`, or `giveaway_inline_posts` in its visible base definition. Some are added dynamically elsewhere. Capture the actual live schema with read-only introspection and make a versioned source migration before exporting; do not assume this file alone is the entire schema.
2. **No foreign keys:** Telegram Serverless does not support foreign keys. The import verifier must check orphaned giveaway IDs in participants, viewers, winners, state, chat mappings and tokens.
3. **Timestamp semantics:** the Serverless declarations use timestamp mode and Unix-second defaults. Exporter/importer must use integer Unix seconds consistently and compare a sample of converted values.
4. **ID precision:** preserve IDs as exact 64-bit integers. Avoid converting large identifiers through floating-point JSON tooling; use integer-safe serialization.
5. **Unique constraints:** verify all composite keys and indexes after import, especially participants, viewers, winner round, notify log, giveaway state, chat roles, chat posts and processed update IDs.
6. **Application-level constraints:** validate `startapp_tokens.action` against `join|watch` and `giveaway_chats.role` against `post|winner|reminder` in the service layer.
7. **No production mutation:** the first export/import run must target a staging database and emit per-table counts, min/max IDs, orphan counts, and sample timestamp checks. Do not run a production migration until all checks pass.

## Cutover gate

Schema parity is **not yet proven**. It requires (a) live read-only source schema introspection, (b) successful Serverless SDK schema validation, (c) staging import with zero unexplained count/constraint differences, and (d) route-level acceptance tests. This document deliberately does not claim that migration is complete.
