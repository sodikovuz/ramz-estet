import { api } from 'sdk';

// Small wrapper around the platform's Telegram Bot API client. Do not put bot
// tokens in source or construct direct Bot API URLs in Serverless handlers.
export async function callTelegram(method, payload) {
  if (!method || typeof method !== 'string') throw new TypeError('Telegram method is required');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Telegram payload must be an object');
  }
  const operation = api[method];
  if (typeof operation !== 'function') throw new Error(`Unsupported Telegram API method: ${method}`);
  return operation(payload);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inlineKeyboard(rows) {
  if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row))) {
    throw new TypeError('Inline keyboard rows must be an array of arrays');
  }
  return { inline_keyboard: rows };
}

export async function safeAnswerCallbackQuery(callbackQueryId, options = {}) {
  if (callbackQueryId == null || callbackQueryId === '') return false;
  try {
    await callTelegram('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...options,
    });
    return true;
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/query is too old|query ID is invalid|response timeout expired/i.test(message)) return false;
    throw error;
  }
}
