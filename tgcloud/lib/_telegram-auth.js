import { createHmac } from './crypto.js';
import { safeEq } from './_security.js';
export async function verifyTelegramInitData(initData, maxAgeSec = 86400) {
  const botToken = globalThis.env?.BOT_TOKEN || process?.env?.BOT_TOKEN; if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(String(initData)); const hash = params.get('hash'); if (!hash) return null; params.delete('hash');
    const pairs = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`); const dataCheckString = pairs.join('\n');
    const secretBuf = await createHmac('sha256', new TextEncoder().encode('WebAppData'), new TextEncoder().encode(botToken));
    const calcBuf = await createHmac('sha256', secretBuf, new TextEncoder().encode(dataCheckString));
    const calc = Array.from(calcBuf).map(b => b.toString(16).padStart(2, '0')).join('');
    if (!(await safeEq(calc, hash))) return null;
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Math.abs(Math.floor(Date.now() / 1000) - authDate) > maxAgeSec) return null;
    const user = JSON.parse(params.get('user') || '{}'); if (!user || !Number(user.id)) return null; return { user, startParam: params.get('start_param') || '' };
  } catch { return null; }
}
export async function requireTelegram(req) {
  const raw = req.headers['x-telegram-init-data'] || req.headers['x-telegram-web-app-init-data'];
  const out = await verifyTelegramInitData(raw);
  if (!out) throw Object.assign(new Error('Telegram sessiyasi tasdiqlanmadi. Mini App Telegram ichida ochilganini tekshiring.'), { statusCode: 401 }); return out;
}
