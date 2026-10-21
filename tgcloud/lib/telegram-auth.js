// Telegram Mini App initData verification using the Web Crypto API available in
// modern V8 runtimes. Secrets are passed by the caller; never hardcode them.
const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function constantTimeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export async function verifyTelegramInitData(initData, botToken, options = {}) {
  if (typeof initData !== 'string' || !initData || typeof botToken !== 'string' || !botToken) return null;
  const maxAgeSec = Number.isFinite(options.maxAgeSec) ? Math.max(0, options.maxAgeSec) : 86400;
  const nowSec = Number.isFinite(options.nowSec) ? Math.floor(options.nowSec) : Math.floor(Date.now() / 1000);

  try {
    const params = new URLSearchParams(initData);
    const suppliedHash = params.get('hash');
    if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) return null;

    // Reject duplicate security-sensitive fields to avoid ambiguous parsing.
    for (const key of ['hash', 'auth_date', 'user', 'start_param']) {
      if (params.getAll(key).length > 1) return null;
    }

    params.delete('hash');
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Telegram's WebAppData derivation: HMAC(key="WebAppData", data=botToken).
    const secret = await hmacSha256(encoder.encode('WebAppData'), botToken);
    const expectedHash = bytesToHex(await hmacSha256(secret, checkString));
    if (!constantTimeHexEqual(expectedHash, suppliedHash.toLowerCase())) return null;

    const authDate = Number(params.get('auth_date'));
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || Math.abs(nowSec - authDate) > maxAgeSec) return null;

    const rawUser = params.get('user');
    if (!rawUser) return null;
    const user = JSON.parse(rawUser);
    if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) return null;

    return { user, startParam: params.get('start_param') || '', authDate };
  } catch {
    return null;
  }
}
