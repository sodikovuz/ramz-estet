# RAMZ ESTET — Telegram Inline Giveaway + Realtime Wheel

## Flow

1. BotFather'da bot uchun Inline Mode'ni yoqing: `/setinline`.
2. Vercel Environment Variables:
   - `BOT_TOKEN`
   - `ADMIN_TELEGRAM_ID`
   - `ADMIN_SECRET`
   - `PUBLIC_BASE_URL`
   - `DATABASE_URL`
   - `ABLY_API_KEY`
3. `schema.sql` ni Neon'da bir marta ishga tushiring.
4. Deploy qiling.
5. Webhook:
   `https://YOUR-DOMAIN.vercel.app/api/set-webhook?secret=ADMIN_SECRET`
6. Admin Telegram'da istalgan chatga:
   `@botname 5`
   deb yozadi.
7. Inline natijani chatga yuboradi.
8. Odamlar `🎉 Giveawayga qo‘shilish` tugmasini bosadi.
9. Participantlar Neon'ga yoziladi va count yangilanadi.
10. Admin botga `/startwheel` yuboradi.
11. Wheel mavjud realtime Ably tizimi orqali boshlanadi.

## Eslatma

- `5` — g‘oliblar/roundlar soni.
- Inline natijani admin yuborgan chatda botga tegishli callback tugmalari ishlaydi.
- Bot tokenni frontendga chiqarmang.
