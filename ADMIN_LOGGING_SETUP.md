# Admin va developer logging

Vercel Environment Variables:
- `ADMIN_TELEGRAM_IDS` — barcha haqiqiy admin Telegram ID larini vergul bilan ajrating. Masalan: `111111111,222222222`
- `ADMIN_SECRET` — server API admin secret, 24+ belgili.
- `DEVELOPER_TELEGRAM_ID` — developer loglarini oladigan Telegram ID.
- `BOT_TOKEN` — bot token.

`ADMIN_TELEGRAM_ID` eski konfiguratsiya uchun fallback sifatida ishlaydi.

Loglar Neon `audit_logs` jadvalida saqlanadi. Browser xatolari `/api/client-log` orqali yoziladi. Tokenlar, secretlar va authorization qiymatlari logga yozilmaydi.

Developerga error loglari Telegram orqali yuboriladi. Production'da `DEVELOPER_TELEGRAM_ID` ni faqat server Environment Variables orqali kiriting.

Adminlar endi barcha giveawaylarni ko‘ra va boshqara oladi; giveaway egasi bo‘lish sharti olib tashlangan, lekin admin Telegram ID tekshiruvi saqlangan.
