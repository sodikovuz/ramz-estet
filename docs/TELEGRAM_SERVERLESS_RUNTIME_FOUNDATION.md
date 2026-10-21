# Telegram Serverless runtime foundation

This change adds reusable primitives only; it does **not** claim the bot has been migrated.

## New modules

- `tgcloud/lib/update.js`: pure update classification, actor/chat extraction and string-safe Telegram ID comparison. It has no platform SDK dependency.
- `tgcloud/lib/telegram.js`: Serverless SDK wrapper for Telegram methods, HTML escaping, inline-keyboard construction and safe callback-query acknowledgements.
- `tgcloud/lib/startapp-tokens.js`: server-side lookup of opaque, hashed startapp capabilities with expiry checks.
- `tgcloud/endpoints/publicGiveaway.js`: read-only public giveaway data and winner history.
- `tgcloud/endpoints/joinGiveaway.js`: idempotent participant registration with Telegram Mini App identity supplied by the platform.
- `tgcloud/lib/validate-export.js`: read-only export preflight for required tables, duplicate keys and missing giveaway references.
- `tests/serverless-update.test.js`, `tests/telegram-auth.test.js`, `tests/serverless-export.test.js`: pure helper and export-validation tests.

## Integration rules

1. Keep all existing message, callback, inline-query, chosen-inline-result and membership behavior when porting handlers.
2. Do not install a moderation-only `handlers/message.js`: Telegram Serverless dispatches updates to handlers, so that could replace the existing admin conversation state machine and silently break features.
3. Keep Telegram identifiers as strings when comparing or passing identifiers; never use a JavaScript Number as an identifier when precision could be lost.
4. Use only the platform SDK in Serverless handlers. Node packages, `process.env`, filesystem access, and direct Bot API HTTP calls are not assumed to work in the isolated runtime.
5. Run the unit tests and SDK validation before any staging deployment.

## Remaining migration work

The existing Vercel implementation still contains the authoritative bot state machine and API behavior. Each message/callback branch and each API route must be ported and acceptance-tested, including database writes, authorization, inline mode, group membership, reminders, cleanup, realtime events, and winner-image generation. Database export/import and webhook cutover remain separate, explicitly authorized operations. Production has not been changed by this foundation commit.

## Endpoint parity progress

The following isolated endpoint ports now exist in `tgcloud/endpoints/`:

- `publicGiveaway.js`: token-gated giveaway summary, participants, and winner history.
- `currentGiveaway.js`: token-gated current state, participant list, and active-viewer count.
- `joinGiveaway.js`: authenticated, idempotent participant registration.
- `watchGiveaway.js`: viewer presence update and state response.
- `winnerStatus.js`: checks whether the authenticated Telegram user won a specified round.

These endpoints use the platform-verified `ctx.initData` identity and hashed startapp token records. They are not yet wired into the existing frontend, and endpoint behavior has not yet been validated with `npx tgcloud run` against a linked staging bot. They do not yet replace the legacy REST API, Ably event publication, group post edits, admin authorization, reminders, winner settlement/announcement, or image rendering. Do not switch the live Mini App to these partial endpoints yet.
