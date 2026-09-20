# RAMZ ESTET — 5 Round Ably Realtime Demo

Bu paket:
- Vercel Functions
- Neon PostgreSQL
- Ably realtime
- 5 ta ketma-ket round
- Viewerda katta G‘OLIB #1, #2... overlay
- Winner history
- Server `startAt` asosida smooth synchronization

## Environment Variables

Vercel:
- DATABASE_URL
- ABLY_API_KEY
- ADMIN_SECRET

## Neon

`schema.sql` ni Neon SQL Editor'da Run qiling.

## Pages

Viewer:
`/`

Admin:
`/admin`

## Admin ishlashi

Participantlarni har qatorda yozing.
Har round uchun target index kiriting.

Masalan 50 participant:
- G‘olib #1 -> 5
- G‘olib #2 -> 17
- G‘olib #3 -> 2
- G‘olib #4 -> 31
- G‘olib #5 -> 44

Har round tugagach admin keyingi roundni ishga tushiradi.

Eslatma: bu demo target indexni admin beradi; client-side random prize-selection yo‘q.
