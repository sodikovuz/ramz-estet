import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyTelegramInitData } from '../tgcloud/lib/telegram-auth.js';

globalThis.crypto ??= webcrypto;
const encoder = new TextEncoder();

async function hmac(keyBytes, value) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function hex(bytes) {
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
}
async function makeInitData({ botToken = 'test-bot-token', authDate = 1_800_000_000, user = { id: 123, first_name: 'Test' }, startParam = 'join_token' } = {}) {
  const entries = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify(user),
    start_param: startParam,
    query_id: 'AAEAAAE',
  });
  const check = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  entries.set('hash', hex(await hmac(secret, check)));
  return { initData: entries.toString(), botToken };
}

test('accepts valid signed Telegram initData and returns user/start parameter', async () => {
  const fixture = await makeInitData();
  const result = await verifyTelegramInitData(fixture.initData, fixture.botToken, { nowSec: 1_800_000_010, maxAgeSec: 60 });
  assert.equal(result.user.id, 123);
  assert.equal(result.startParam, 'join_token');
  assert.equal(result.authDate, 1_800_000_000);
});

test('rejects invalid signature, stale auth_date, malformed data and duplicate auth_date', async () => {
  const fixture = await makeInitData();
  assert.equal(await verifyTelegramInitData(fixture.initData, 'wrong-token', { nowSec: 1_800_000_010 }), null);
  assert.equal(await verifyTelegramInitData(fixture.initData, fixture.botToken, { nowSec: 1_800_100_000, maxAgeSec: 60 }), null);
  assert.equal(await verifyTelegramInitData('user=%7B%7D', fixture.botToken), null);
  assert.equal(await verifyTelegramInitData(fixture.initData + '&auth_date=1800000000', fixture.botToken, { nowSec: 1_800_000_010 }), null);
});

test('rejects future auth_date outside the allowed clock skew window', async () => {
  const fixture = await makeInitData({ authDate: 1_800_000_100 });
  assert.equal(await verifyTelegramInitData(fixture.initData, fixture.botToken, { nowSec: 1_800_000_000, maxAgeSec: 60 }), null);
});
