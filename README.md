# RAMZ ESTET — Ably 5-Round Random Demo

Bu paketda 5 raundli realtime wheel demo bor.

- Admin faqat participantlar, round soni va spin vaqtini beradi.
- G‘olibni browser emas, server tanlaydi.
- Har raundda tanlangan ishtirokchi keyingi raunddan chiqariladi.
- Ably orqali viewerlar `round_start` eventini oladi.
- Viewer animatsiyasi `startAt` server vaqtiga bog‘langan.
- Demo ichida mukofot qiymati, to‘lov yoki Stars logikasi yo‘q.

## Vercel environment variables

- `DATABASE_URL`
- `ABLY_API_KEY`
- `ADMIN_SECRET`

## Neon

`schema.sql` ni Neon SQL Editor'da ishga tushiring.

## Deploy

```bash
npm install
vercel
```

Viewer:
`/`

Admin:
`/admin.html`

## Muhim
Viewer spin tugagach `/api/finish-round` chaqiriladi. Shu endpoint g‘olibni DBga yozadi va keyingi raundni serverda random tanlaydi.
