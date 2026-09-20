# RAMZ ESTET — Professional Telegram Giveaway

## Admin flow

Botga `/start` -> **➕ Giveaway yaratish**.

1. Giveaway opisaniyasi yuboriladi.
2. Rasm ixtiyoriy: Telegram photo `file_id` Neon'da saqlanadi.
3. G‘oliblar soni (1–50) yuboriladi.
4. Giveaway yaratiladi.
5. **📤 Posterni yuborish** tugmasi bosiladi.
6. Telegram chat tanlash oynasini ochadi va `@ramzestetbot giveaway:<ID>` inline natijasini chiqaradi.
7. Admin aynan shu giveaway postini kerakli chatga yuboradi.
8. Ishtirokchilar tugma orqali qo‘shiladi; count real vaqtda yangilanadi.
9. **📋 Giveawaylarim** orqali barcha giveawaylar va tarix ko‘riladi.
10. Har bir giveawayda:
   - qatnashchilar
   - g‘oliblar
   - vaqtlar
   - boshqaruv paneli
   ko‘rsatiladi.
11. 🌐 **Boshqaruv paneli** orqali aynan shu giveaway boshqariladi va `/api/start` wheelni ishga tushiradi.

## Environment

`BOT_TOKEN`
`ADMIN_TELEGRAM_ID`
`ADMIN_SECRET`
`PUBLIC_BASE_URL`
`DATABASE_URL`
`ABLY_API_KEY`

## Neon

`schema.sql` ni bir marta Run qiling.

## Inline

BotFather -> `/setinline` -> `@ramzestetbot` -> inline mode ON.

Webhook:
`https://YOUR-DOMAIN.vercel.app/api/set-webhook?secret=ADMIN_SECRET`

Webhook `message`, `callback_query`, `inline_query`, `chosen_inline_result` update'larini qabul qiladi.

## Important

`ADMIN_TELEGRAM_ID` Telegram username emas, numeric Telegram user ID bo‘lishi kerak.
`BOT_TOKEN` frontendga chiqmaydi.

## Security

See `SECURITY_HARDENING.md`. Mini App JOIN/WATCH links now use encrypted opaque tokens, Telegram `initData` is verified server-side, Ably is scoped per giveaway, admin URLs no longer expose `ADMIN_SECRET`, and the Telegram webhook uses a secret token.
