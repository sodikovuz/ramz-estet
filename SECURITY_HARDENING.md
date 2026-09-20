# RAMZ ESTET — Security Hardening

## Required Vercel environment variables

- `BOT_TOKEN`
- `DATABASE_URL`
- `ABLY_API_KEY`
- `ADMIN_TELEGRAM_ID`
- `ADMIN_SECRET` — random, at least 24 characters
- `STARTAPP_SECRET` — random, at least 24 characters; use a different secret from ADMIN_SECRET
- `TELEGRAM_WEBHOOK_SECRET` — random, at least 16 characters
- `PUBLIC_BASE_URL` — HTTPS only, e.g. `https://ramz-estet.vercel.app`
- `BOT_USERNAME=ramzestetbot`

Generate secrets locally with:
`openssl rand -hex 32`

## What changed

1. Giveaway IDs are no longer placed in Mini App `startapp` URLs.
2. Mini App links contain short-lived AES-256-GCM encrypted opaque tokens.
3. JOIN requires both the encrypted action token and a valid Telegram WebApp `initData` signature.
4. The server takes the Telegram user ID from verified `initData`; client-supplied user IDs are ignored.
5. WATCH and Ably access are scoped to one giveaway channel only. Wildcard `giveaway:*` subscription is removed.
6. Admin panel URLs no longer contain `ADMIN_SECRET` or raw giveaway IDs. They use a 30-minute encrypted panel token bound to the admin Telegram ID and giveaway.
7. Telegram webhook requests require `X-Telegram-Bot-Api-Secret-Token`.
8. Winner realtime events no longer contain Telegram user IDs. A separate authenticated endpoint tells a client only whether that client is the winner.
9. Per-giveaway state is stored by `giveaway_id`; the old global state row is no longer used for active spins.
10. Security response headers are enabled in `vercel.json`.
11. Public endpoints require POST + Telegram authentication and return `no-store` responses.

## Webhook setup

After adding the environment variables, call the protected `POST /api/set-webhook` with `x-admin-secret: ADMIN_SECRET`.
Do not put `ADMIN_SECRET` into a URL query string.

## Important

`STARTAPP_SECRET`, `ADMIN_SECRET`, and `TELEGRAM_WEBHOOK_SECRET` must never be put in frontend JavaScript, Telegram messages, query strings, Git, or the database.
