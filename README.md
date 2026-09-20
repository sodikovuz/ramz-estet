# RAMZ ESTET — Ably realtime wheel demo

Bu loyiha Vercel + Neon PostgreSQL + Ably yordamida real-time wheel animatsiyasini namoyish qiladi.

## 1. Neon

`schema.sql` ni Neon SQL Editor'da ishga tushiring.

Vercel Environment Variables:

- `DATABASE_URL` — Neon connection string
- `ABLY_API_KEY` — Ably API key
- `ADMIN_SECRET` — uzun, tasodifiy admin secret

## 2. Deploy

Project'ni Vercel'ga deploy qiling.

Viewer:

`/`

Admin:

`/admin`

## 3. Admin

Admin sahifasida:

- Admin secret kiriting
- Participantlarni qatorma-qator kiriting
- Target index tanlang
- Duration tanlang
- START SPIN bosing

Bu demo winnerni tasodifiy tanlamaydi. Target index admin tomonidan beriladi.

## 4. Realtime

Admin START bosganda Vercel:

1. spin holatini Neon'ga yozadi;
2. 1.5 soniyalik kelish bufferi bilan `startAt` yaratadi;
3. Ably'ga `spin` event publish qiladi.

Viewerlar eventni WebSocket orqali oladi va server timestamp asosida animatsiyaning ayni progressidan boshlaydi.

## 5. Muhim

`ABLY_API_KEY` va `ADMIN_SECRET` ni HTML/JS ichiga yozmang.

Viewer Ably'ga token orqali ulanadi.
