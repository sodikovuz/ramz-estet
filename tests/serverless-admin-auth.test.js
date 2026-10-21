import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminTelegramUser, requireAdminTelegramUser } from '../tgcloud/lib/admin-auth.js';

test('accepts only exact IDs from a comma-separated allowlist', () => {
  assert.equal(isAdminTelegramUser(123, '12, 123, 456'), true);
  assert.equal(isAdminTelegramUser('00123', '123'), false);
  assert.equal(isAdminTelegramUser(999, '12,123,456'), false);
  assert.equal(isAdminTelegramUser(123, ''), false);
  assert.equal(isAdminTelegramUser(null, '123'), false);
});

test('throws a structured authorization error for non-admin users', () => {
  assert.throws(() => requireAdminTelegramUser(5, '123'), (error) => {
    assert.equal(error.code, 'ADMIN_REQUIRED');
    assert.equal(error.statusCode, 403);
    return true;
  });
  assert.equal(requireAdminTelegramUser('123', '123'), undefined);
});
