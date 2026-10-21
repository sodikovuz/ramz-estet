# Telegram Serverless staging connection runbook

This runbook is for a **non-production** Telegram bot and an empty/staging Serverless database. It does not authorize production cutover.

## 1. Required access and prerequisites

- A separate Telegram staging bot token, created through BotFather.
- The staging bot's numeric admin Telegram ID(s).
- A public HTTPS origin for the staging Mini App/frontend, if the chosen deployment architecture requires one.
- Access to the Telegram Serverless project and its secret/configuration UI.
- A sanitized, non-production dataset or an intentionally empty database.
- The exact supported SDK/runtime version and documented secret injection mechanism.

Never commit bot tokens, admin secrets, initData, raw startapp tokens, production exports, or personal data. Configure credentials through the platform's secret manager. Do not assume `process.env` exists in isolated handlers.

## 2. Do not connect the production bot yet

The current Vercel webhook and Neon/PostgreSQL remain authoritative. Do not run `npx tgcloud migrate`, import production data, change the live webhook, or disable Vercel while any acceptance gate below is open.

## 3. Staging sequence

1. Create a separate Serverless project/database and use a separate Telegram bot.
2. Confirm the platform's current handler, endpoint, secrets, schema and Telegram API documentation. Record the exact runtime version and SDK method signatures.
3. Configure the staging bot token and admin allowlist in the documented secret/config mechanism. Never put secrets in source files or endpoint input.
4. Apply the Serverless schema to the staging database only. Inspect the generated schema and verify every table/column against `tgcloud/schema.js`.
5. Run the pure test suite and syntax checks:
   ```sh
   find tgcloud -name '*.js' -print0 | xargs -0 -n1 sh -c 'node --input-type=module --check < "$1"' sh
   node --test tests/serverless-update.test.js tests/telegram-auth.test.js tests/serverless-export.test.js tests/inline-result.test.js tests/serverless-admin-auth.test.js
   ```
6. Use the platform's documented local/test command (for example, `npx tgcloud run` only after confirming the installed CLI version and command syntax) against staging. Verify that every handler imports and that Telegram API methods resolve.
7. Port and test all update envelopes before registering a staging webhook: `message`, `callback_query`, `inline_query`, `chosen_inline_result`, and `my_chat_member`. Do not add a generic message handler that can consume the admin conversation flow.
8. Test all API routes and frontend calls against the staged endpoints. Verify response shape, access controls, token expiry, idempotency, and error behavior.
9. Run feature acceptance checks: create/cancel/start/finish giveaway; join/watch; inline publish and inline-message tracking; group membership; winner persistence and announcement; reminders/auto-start/auto-finish; cleanup; settings/admin dashboard; realtime; winner-image generation.
10. Export only a sanitized fixture, validate it with `validateServerlessExport`, import into staging using a reviewed migration script, and reconcile every table's row count, key uniqueness, relations, timestamps and JSON values.
11. Record evidence for each row in `TELEGRAM_SERVERLESS_ACCEPTANCE_MATRIX.md` and update `TELEGRAM_SERVERLESS_ROUTE_PARITY.md` only when implementation and staging evidence both exist.
12. Test rollback in staging before preparing a separate production change plan.

## 4. Current blockers to resolve before staging can be called ready

- The complete legacy admin conversation and callback state machine has not been ported.
- Inline-query publishing and group-membership behavior are not yet fully ported.
- Remaining admin REST endpoints and winner settlement are not yet ported.
- Ably realtime, Sharp/fontkit/QR winner-image generation, scheduled jobs, and cleanup need supported replacements.
- Existing Vercel frontend/API calls are not yet integrated with the Serverless endpoints.
- The SDK/secret configuration and endpoint behavior have not yet been verified in a linked staging project.
- PostgreSQL schema parity, export/import, row reconciliation, and rollback have not been executed.

## 5. Production cutover checklist

Production cutover is a separate, explicitly approved operation. Require all of the following first:

- [ ] All required routes and update envelopes have parity.
- [ ] Automated tests pass on the exact target runtime.
- [ ] Full staging end-to-end acceptance passes with evidence attached.
- [ ] Source/destination schema and all table counts reconcile.
- [ ] Backups are verified and rollback has been rehearsed.
- [ ] Webhook ownership and transition timing are documented.
- [ ] Monitoring, error handling, rate limits, and operator runbook are ready.
- [ ] Explicit production authorization is recorded.

Passing CI alone is not evidence that the migration is complete.
