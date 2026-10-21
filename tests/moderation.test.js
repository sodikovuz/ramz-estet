import test from 'node:test';
import assert from 'node:assert/strict';
import { isBountyMessage, moderateBountyMessage } from '../tgcloud/lib/moderation.js';

const TARGET = -1004421394811;

test('only moderates the configured group', () => {
  assert.equal(isBountyMessage({ chat: { id: TARGET }, message_id: 1, text: 'bounty' }, TARGET), true);
  assert.equal(isBountyMessage({ chat: { id: -100123 }, message_id: 1, text: 'bounty' }, TARGET), false);
});

test('matches text and captions case-insensitively', () => {
  for (const text of ['Bounty available', 'БАУНТИ сегодня', 'баунтий']) {
    assert.equal(isBountyMessage({ chat: { id: TARGET }, message_id: 1, text }, TARGET), true);
  }
  assert.equal(isBountyMessage({ chat: { id: TARGET }, message_id: 1, caption: 'Есть БауНти' }, TARGET), true);
});

test('ignores missing message identifiers and unrelated content', () => {
  assert.equal(isBountyMessage({ chat: { id: TARGET }, text: 'bounty' }, TARGET), false);
  assert.equal(isBountyMessage({ chat: { id: TARGET }, message_id: 1, text: 'hello world' }, TARGET), false);
  assert.equal(isBountyMessage({ chat: { id: TARGET }, message_id: 1 }, TARGET), false);
});

test('calls deleteMessage only for a matching message and propagates API errors', async () => {
  const calls = [];
  const api = { deleteMessage: async (args) => { calls.push(args); return true; } };
  assert.equal(await moderateBountyMessage({ chat: { id: TARGET }, message_id: 5, text: 'bounty' }, TARGET, api), true);
  assert.deepEqual(calls, [{ chat_id: TARGET, message_id: 5 }]);
  assert.equal(await moderateBountyMessage({ chat: { id: TARGET }, message_id: 6, text: 'ordinary' }, TARGET, api), false);
  assert.equal(calls.length, 1);

  const failingApi = { deleteMessage: async () => { throw new Error('delete denied'); } };
  await assert.rejects(
    moderateBountyMessage({ chat: { id: TARGET }, message_id: 7, caption: 'баунти' }, TARGET, failingApi),
    /delete denied/
  );
});
