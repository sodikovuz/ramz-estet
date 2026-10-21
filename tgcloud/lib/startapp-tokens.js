import { db } from 'sdk';
import { eq, and, gt } from 'sdk/db';
import { startappTokens } from '../schema.js';

const encoder = new TextEncoder();
function bytesToHex(bytes) { return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join(''); }
async function sha256Hex(value) { return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }

// Raw startapp tokens are never stored. Only the SHA-256 capability hash is persisted.
export async function readStartAppToken(token, action, now = new Date()) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  if (action !== 'join' && action !== 'watch') return null;
  const tokenHash = await sha256Hex(token);
  const row = await db.select().from(startappTokens).where(and(
    eq(startappTokens.tokenHash, tokenHash),
    eq(startappTokens.action, action),
    gt(startappTokens.expiresAt, now),
  )).get();
  return row ? { giveawayId: row.giveawayId, action } : null;
}
