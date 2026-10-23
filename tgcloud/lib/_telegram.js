export async function tg(method, body, internal = {}) {
  const token = globalThis.env?.BOT_TOKEN || process?.env?.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is missing");
  const chatId = body?.chat_id;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.description || "Telegram API error");
  try {
    const messageId = d.result?.message_id;
    const devId = globalThis.env?.DEVELOPER_TELEGRAM_ID || process?.env?.DEVELOPER_TELEGRAM_ID || '';
    if (!internal.skipCleanup && messageId && chatId && !['deleteMessage', 'deleteMessages'].includes(method) && String(chatId) !== String(devId)) {
      const { getSettings, scheduleMessage } = await import('./_settings.js');
      const s = await getSettings();
      if (s.bot_messages_enabled && (Number(chatId) > 0 || s.cleanup_group_messages)) {
        const delay = Number(s.bot_messages_delay_minutes);
        if (delay === 0) {
          try { await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId }) }); }
          catch (e) { console.error('[cleanup] immediate bot message delete failed:', e?.message || e); }
        } else { await scheduleMessage(chatId, messageId, 'bot', delay); }
      }
    }
  } catch (e) { console.error('[cleanup] bot message tracking failed:', e?.message || e); }
  return d.result;
}
export function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
