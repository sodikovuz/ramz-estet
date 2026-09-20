# RAMZ ESTET — Wheel + Telegram Bot

Environment variables:
- DATABASE_URL
- ABLY_API_KEY
- ADMIN_SECRET
- BOT_TOKEN
- ADMIN_TELEGRAM_ID
- PUBLIC_BASE_URL

Neon'da `schema.sql`ni ishga tushiring.

Deploydan keyin webhookni bir marta oching:
`https://YOUR-DOMAIN/api/set-webhook?secret=ADMIN_SECRET`

Admin botda:
`/giveaway 5`

Userlar inline tugma orqali qo‘shiladi. Participantlar Neon'ga saqlanadi. Admin:
`/startwheel`

Wheel server tomonda random tanlaydi va Ably orqali viewerlarga yuboradi.

`BOT_TOKEN`ni maxfiy saqlang.
