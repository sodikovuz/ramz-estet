# RAMZ ESTET — secure setup

1. Neon: `schema.sql` ni Run qiling.
2. Vercel ENV:
   - DATABASE_URL
   - ABLY_API_KEY
   - BOT_TOKEN
   - ADMIN_TELEGRAM_ID
   - ADMIN_SECRET
   - STARTAPP_SECRET
   - TELEGRAM_WEBHOOK_SECRET
   - PUBLIC_BASE_URL=https://YOUR-DOMAIN.vercel.app
   - BOT_USERNAME=ramzestetbot
   - CRON_SECRET (external cron ishlatilsa)
3. Deploy.
4. BotFather:
   - `/setinline` -> @ramzestetbot -> enable
   - Mini App short name: `giveaway`
   - Web App URL: `https://YOUR-DOMAIN.vercel.app`
5. Webhook: `POST /api/set-webhook` ga `x-admin-secret: ADMIN_SECRET` header bilan yuboring.
6. Admin `/start` -> Giveaway yaratish.
7. `📤 GURUHGA POST QILISH` tugmasi inline rejimni ochadi. Post ichida:
   - 🎉 QATNASHISH -> encrypted `startapp` token
   - 👁 BARABAN AYLANISHINI TOMOSHA QILISH -> encrypted `startapp` token
8. JOIN serverda Telegram `initData` ni tekshiradi; client yuborgan user ID qabul qilinmaydi.
9. Ably token faqat bitta `giveaway:<id>` channeliga subscribe qilish huquqiga ega.
10. Reminder cron 15m/5m/2m watch linklarini encrypted token bilan yuboradi.
11. Vaqtlar `Asia/Tashkent` (+05:00).

Eski raw link formatlari (`startapp=join_123`, `watch_123`, `giveaway_123`) endi ishlamaydi.
