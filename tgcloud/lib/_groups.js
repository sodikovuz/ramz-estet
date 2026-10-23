import { db } from './_db.js';
import { tg } from './_telegram.js';
export async function ensureGroupSchema(sqlObj) {}
export async function inspectChat(chatId) {
  try { const d = await tg('getChat', { chat_id: Number(chatId) }, { skipCleanup: true }); return d; } catch (e) { console.error(`[groups] getChat(${chatId}) failed:`, e?.message || e); return null; }
}
export async function upsertChat(chat, sqlObj, updates = {}) {
  const cid = Number(chat.id); const type = String(chat.type || 'unknown'); const title = String(chat.title || chat.username || ''); const username = chat.username ? String(chat.username) : null;
  const sql = sqlObj || db(); let botStatus = 'unknown';
  if (updates.botStatus !== undefined) botStatus = updates.botStatus; else if (updates.member) botStatus = String(updates.member.status || 'unknown');
  const canPost = updates.member ? Boolean(updates.member.can_post_messages || botStatus === 'creator' || botStatus === 'administrator') : null;
  const canDelete = updates.member ? Boolean(updates.member.can_delete_messages || botStatus === 'creator' || botStatus === 'administrator') : null;
  const active = updates.forceInactive ? false : true;
  if (canPost !== null && canDelete !== null) {
    await sql`INSERT INTO telegram_chats(chat_id, title, username, type, bot_status, can_post_messages, can_delete_messages, active) VALUES(${cid}, ${title}, ${username}, ${type}, ${botStatus}, ${canPost}, ${canDelete}, ${active}) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title, username=EXCLUDED.username, type=EXCLUDED.type, bot_status=EXCLUDED.bot_status, can_post_messages=EXCLUDED.can_post_messages, can_delete_messages=EXCLUDED.can_delete_messages, active=EXCLUDED.active, updated_at=unixepoch()`;
  } else {
    await sql`INSERT INTO telegram_chats(chat_id, title, username, type, bot_status, active) VALUES(${cid}, ${title}, ${username}, ${type}, ${botStatus}, ${active}) ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title, username=EXCLUDED.username, type=EXCLUDED.type, bot_status=EXCLUDED.bot_status, active=EXCLUDED.active, updated_at=unixepoch()`;
  }
  return { id: cid, title, type };
}
export async function registerChatFromUpdate(chat, sqlObj, opts = {}) {
  if (!chat || !chat.id) return null; const type = String(chat.type || ''); if (!['group', 'supergroup', 'channel'].includes(type)) return null; return upsertChat(chat, sqlObj, opts);
}
