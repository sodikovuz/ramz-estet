// Pure helpers shared by Serverless update handlers. Keep this module free of
// platform SDK imports so it can be tested with Node and reused in handlers.
export function classifyUpdate(update) {
  if (!update || typeof update !== 'object') return 'unknown';
  if (update.my_chat_member) return 'my_chat_member';
  if (update.callback_query) return 'callback_query';
  if (update.inline_query) return 'inline_query';
  if (update.chosen_inline_result) return 'chosen_inline_result';
  if (update.message) return 'message';
  if (update.edited_message) return 'edited_message';
  if (update.channel_post) return 'channel_post';
  if (update.edited_channel_post) return 'edited_channel_post';
  if (update.chat_member) return 'chat_member';
  if (update.chat_join_request) return 'chat_join_request';
  return 'unknown';
}

export function getUpdateActorId(update) {
  const actor = update?.my_chat_member?.from
    ?? update?.message?.from
    ?? update?.callback_query?.from
    ?? update?.inline_query?.from
    ?? update?.chosen_inline_result?.from
    ?? update?.edited_message?.from
    ?? update?.channel_post?.from
    ?? update?.edited_channel_post?.from
    ?? update?.chat_member?.from
    ?? update?.chat_join_request?.from;
  return actor?.id == null ? null : String(actor.id);
}

export function getUpdateChat(update) {
  return update?.my_chat_member?.chat
    ?? update?.message?.chat
    ?? update?.callback_query?.message?.chat
    ?? update?.edited_message?.chat
    ?? update?.channel_post?.chat
    ?? update?.edited_channel_post?.chat
    ?? update?.chat_member?.chat
    ?? update?.chat_join_request?.chat
    ?? null;
}

// Telegram group IDs can exceed JavaScript's safe integer range in future
// integrations. Compare identifiers as strings; do not coerce to Number.
export function sameTelegramId(a, b) {
  return a != null && b != null && String(a) === String(b);
}
