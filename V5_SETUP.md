# V5 setup

1. Neon: run `schema.sql`.
2. Vercel ENV:
   DATABASE_URL
   ABLY_API_KEY
   BOT_TOKEN
   ADMIN_TELEGRAM_ID
   ADMIN_SECRET
   PUBLIC_BASE_URL
   BOT_USERNAME=ramzestetbot
   CRON_SECRET (optional but recommended)
3. Deploy.
4. BotFather:
   /setinline -> @ramzestetbot -> enable
   /newapp (or Menu Button) -> connect the Web App URL:
   https://YOUR-DOMAIN.vercel.app/watch.html
5. Webhook:
   https://YOUR-DOMAIN.vercel.app/api/set-webhook?secret=ADMIN_SECRET
6. Admin `/start` -> Giveaway yaratish.
7. Telegram group poster uses:
   🎉 QATNASHISH callback
   👁 TOMOSHA QILISH -> https://t.me/ramzestetbot/app?startapp=giveaway_ID
8. `watch.html` receives Telegram initData, tracks live viewers, and late-joins the current server state.
9. Vercel cron runs `/api/cron-notify` each minute and sends 15m/5m/2m reminders to users who have already joined the giveaway. Telegram cannot be used to proactively DM users who have never started the bot.
10. All admin-scheduled times are interpreted as Asia/Tashkent (+05:00).
