# Telegram Serverless Mini App authentication

`tgcloud/lib/telegram-auth.js` provides an asynchronous Web Crypto implementation of Telegram Mini App `initData` validation.

## Contract

- Call `verifyTelegramInitData(initData, botToken, options)` with the raw initData header/value and the bot token obtained from the platform's secret-management mechanism.
- Returns `{ user, startParam, authDate }` only after HMAC and freshness checks; otherwise returns `null`.
- Default maximum age is 24 hours. Endpoints should generally choose a shorter window where the product flow permits it.
- Duplicate `hash`, `auth_date`, `user`, or `start_param` fields are rejected.
- The helper does not read environment variables, access storage, or trust client-provided user IDs without validating the signature.

## Integration requirements

1. Confirm the exact Serverless secret API and pass the configured bot token to this helper; do not put credentials in code.
2. Keep authorization separate from identity verification. A valid Telegram user is not automatically an admin.
3. Apply the check to every Mini App endpoint before database reads/writes.
4. Run the test suite in the supported Node version and validate the SDK/runtime build before deployment.

This helper is not yet wired into the production bot or endpoints. No production data, webhook, or deployment was changed.
