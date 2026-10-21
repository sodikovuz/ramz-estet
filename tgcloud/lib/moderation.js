// Runtime-compatible moderation primitive for Telegram Serverless.
// No Node APIs, environment access, npm dependencies or network access.
// The caller supplies the configured target chat ID and the Serverless Bot API.

const BOUNTY_TERMS = ['bounty', 'баунти', 'баунтий'];

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
}

export function isBountyMessage(message, targetChatId) {
  if (!message?.chat?.id || !message?.message_id) return false;
  if (String(message.chat.id) !== String(targetChatId)) return false;

  const content = normalize([
    message.text,
    message.caption,
  ].filter(Boolean).join('\n'));

  return BOUNTY_TERMS.some((term) => content.includes(term));
}

/**
 * Delete matching messages in the configured group.
 *
 * targetChatId must be provided by trusted project configuration, not by the
 * incoming update. Returns true only after Telegram confirms deletion.
 */
export async function moderateBountyMessage(message, targetChatId, api) {
  if (!isBountyMessage(message, targetChatId)) return false;
  await api.deleteMessage({
    chat_id: message.chat.id,
    message_id: message.message_id,
  });
  return true;
}
