# Telegram Serverless runtime foundation

This change adds reusable primitives only; it does **not** claim the bot has been migrated.

## New modules

- `tgcloud/lib/update.js`: pure update classification, actor/chat extraction and string-safe Telegram ID comparison. It has no platform SDK dependency.
- `tgcloud/lib/telegram.js`: Serverless SDK wrapper for Telegram methods, HTML escaping, inline-keyboard construction and safe callback-query acknowledgements.
- `tests/serverless-update.test.js`: Node tests for the pure update helpers.

## Integration rules

1. Keep all existing message, callback, inline-query, chosen-inline-result and membership behavior when porting handlers.
2. Do not install a moderation-only `handlers/message.js`: Telegram Serverless dispatches updates to handlers, so that could replace the existing admin conversation state machine and silently break features.
3. Keep Telegram identifiers as strings when comparing or passing identifiers; never use a JavaScript Number as an identifier when precision could be lost.
4. Use only the platform SDK in Serverless handlers. Node packages, `process.env`, filesystem access, and direct Bot API HTTP calls are not assumed to work in the isolated runtime.
5. Run the unit tests and SDK validation before any staging deployment.

## Remaining migration work

The existing Vercel implementation still contains the authoritative bot state machine and API behavior. Each message/callback branch and each API route must be ported and acceptance-tested, including database writes, authorization, inline mode, group membership, reminders, cleanup, realtime events, and winner-image generation. Database export/import and webhook cutover remain separate, explicitly authorized operations. Production has not been changed by this foundation commit.
