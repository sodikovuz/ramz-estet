import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUpdate, getUpdateActorId, getUpdateChat, sameTelegramId } from '../tgcloud/lib/update.js';

test('classifies all update types used by the current webhook and common extensions', () => {
  const cases = [
    [{ my_chat_member: {} }, 'my_chat_member'],
    [{ message: {} }, 'message'],
    [{ callback_query: {} }, 'callback_query'],
    [{ inline_query: {} }, 'inline_query'],
    [{ chosen_inline_result: {} }, 'chosen_inline_result'],
    [{ edited_message: {} }, 'edited_message'],
    [{ channel_post: {} }, 'channel_post'],
    [{ edited_channel_post: {} }, 'edited_channel_post'],
    [{ chat_member: {} }, 'chat_member'],
    [{ chat_join_request: {} }, 'chat_join_request'],
    [{}, 'unknown'],
    [null, 'unknown'],
  ];
  for (const [update, expected] of cases) assert.equal(classifyUpdate(update), expected);
});

test('prefers actor and chat fields from the relevant update envelope', () => {
  assert.equal(getUpdateActorId({ callback_query: { from: { id: 123 } } }), '123');
  assert.equal(getUpdateActorId({ message: { from: {} } }), null);
  assert.deepEqual(getUpdateChat({ my_chat_member: { chat: { id: -10 } }, message: { chat: { id: 20 } } }), { id: -10 });
  assert.equal(getUpdateChat({ inline_query: { from: { id: 123 } } }), null);
});

test('compares Telegram identifiers without lossy numeric coercion', () => {
  assert.equal(sameTelegramId('-1004421394811', -1004421394811), true);
  assert.equal(sameTelegramId('9007199254740993', '9007199254740993'), true);
  assert.equal(sameTelegramId('9007199254740993', 9007199254740993), false);
  assert.equal(sameTelegramId(null, null), false);
});
