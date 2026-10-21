import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGiveawayInlineResultId } from '../tgcloud/lib/inline-result.js';

test('parses article inline result IDs', () => {
  assert.deepEqual(parseGiveawayInlineResultId('giveaway_42_1761000000000'), {
    giveawayId: 42, nonce: '1761000000000',
  });
});

test('parses cached photo inline result IDs', () => {
  assert.deepEqual(parseGiveawayInlineResultId('giveaway_photo_7_1761000000000'), {
    giveawayId: 7, nonce: '1761000000000',
  });
});

test('rejects malformed, unrelated and unsafe IDs', () => {
  for (const value of [null, '', 'giveaway_0_123', 'giveaway_abc_123', 'other_1_123', 'giveaway_1_x', 'giveaway_9007199254740992_123']) {
    assert.equal(parseGiveawayInlineResultId(value), null, String(value));
  }
});
