import { randomBytes, createHash, createHmac } from './crypto.js';
export function b64u(buf) {
  let b = buf;
  if (buf instanceof Uint8Array) { b = Array.from(buf).map(x => String.fromCharCode(x)).join(''); }
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  const p = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const b = atob(p + '='.repeat((4 - p.length % 4) % 4));
  return new Uint8Array([...b].map(x => x.charCodeAt(0)));
}
function requireSecret(name) {
  const s = globalThis.env?.[name] || process?.env?.[name];
  if (!s || s.length < 24) throw Object.assign(new Error(`${name} is missing or too short`), { statusCode: 500 });
  return s;
}
async function keyFor(name) { return await createHash('sha256', new TextEncoder().encode(requireSecret(name))); }
export async function seal(payload, secretName = 'STARTAPP_SECRET') {
  const iv = await randomBytes(12);
  const keyMaterial = await keyFor(secretName);
  const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt']);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plain);
  const encrypted = new Uint8Array(encryptedBuf);
  const ct = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);
  return `v1.${b64u(iv)}.${b64u(ct)}.${b64u(tag)}`;
}
export async function open(token, secretName = 'STARTAPP_SECRET') {
  try {
    const [v, ivS, ctS, tagS] = String(token || '').split('.');
    if (v !== 'v1' || !ivS || !ctS || !tagS) return null;
    const iv = unb64u(ivS); const ct = unb64u(ctS); const tag = unb64u(tagS);
    const encrypted = new Uint8Array(ct.length + tag.length);
    encrypted.set(ct); encrypted.set(tag, ct.length);
    const keyMaterial = await keyFor(secretName);
    const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
    const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
    const plain = new TextDecoder().decode(decryptedBuf);
    const p = JSON.parse(plain);
    if (!p || !Number.isFinite(Number(p.exp)) || Number(p.exp) < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
export async function makeStartApp(gid, action) {
  const { db } = await import('./_db.js');
  const tokenRaw = await randomBytes(32);
  const token = b64u(tokenRaw);
  const hashRaw = await createHash('sha256', new TextEncoder().encode(token));
  const hash = Array.from(hashRaw).map(b => b.toString(16).padStart(2, '0')).join('');
  const exp = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const sql = db();
  await sql`INSERT INTO startapp_tokens(token_hash, giveaway_id, action, expires_at) VALUES(${hash}, ${Number(gid)}, ${String(action)}, ${exp})`;
  return token;
}
export async function readStartApp(token, action) {
  const t = String(token || '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return null;
  const { db } = await import('./_db.js');
  const hashRaw = await createHash('sha256', new TextEncoder().encode(t));
  const hash = Array.from(hashRaw).map(b => b.toString(16).padStart(2, '0')).join('');
  const sql = db();
  const rows = await sql`SELECT giveaway_id FROM startapp_tokens WHERE token_hash=${hash} AND action=${String(action)} AND expires_at>unixepoch() LIMIT 1`;
  return rows[0] ? { gid: Number(rows[0].giveaway_id) } : null;
}
export async function makePanelToken(gid, uid, ttlSeconds = 1800) {
  const ttl = Math.max(300, Math.min(86400, Number(ttlSeconds) || 1800));
  const nonce = await randomBytes(12);
  return await seal({ v: 1, k: 'panel', g: String(gid), u: String(uid), exp: Math.floor(Date.now() / 1000) + ttl, n: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('') });
}
export async function readPanelToken(token, gid, uid) {
  const p = await open(token);
  return !!(p && p.k === 'panel' && String(p.g) === String(gid) && String(p.u) === String(uid));
}
export async function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) { result |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return result === 0;
}
