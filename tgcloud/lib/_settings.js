import { db } from './_db.js';
export const DEFAULTS = {
  bot_messages_enabled: false, bot_messages_delay_minutes: 15, user_messages_enabled: false, user_messages_delay_minutes: 0,
  duplicate_protection_enabled: true, auto_start_enabled: false, auto_finish_enabled: true, reminders_enabled: true,
  reminder_15m: true, reminder_5m: true, reminder_2m: true, winner_announcement_enabled: true, winner_image_enabled: true,
  winner_qr_enabled: true, winner_signature_enabled: true, winner_stamp_enabled: true, participant_realtime_enabled: true, viewer_realtime_enabled: true,
  admin_session_timeout_minutes: 60, token_expiry_days: 7, audit_logging_enabled: true, panel_single_message: true, cleanup_group_messages: false, search_enabled: true, statistics_enabled: true
};
let settingsCache = null; let settingsCacheAt = 0; const SETTINGS_TTL_MS = 15000;
export async function ensureSettings() { return Promise.resolve(); }
export async function getSettings() {
  const now = Date.now(); if (settingsCache && now - settingsCacheAt < SETTINGS_TTL_MS) return settingsCache;
  await ensureSettings(); const row = (await db()`SELECT * FROM bot_settings WHERE id=1 LIMIT 1`)[0];
  if (row) {
     const cleanRow = {}; for (const [k, v] of Object.entries(row)) { cleanRow[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v; }
     settingsCache = { ...DEFAULTS, ...cleanRow };
  } else { settingsCache = { id: 1, ...DEFAULTS }; }
  settingsCacheAt = now; return settingsCache;
}
export function normalizeDelay(v) { const n = Number(v); return [0, 1, 5, 15, 30, 60, 360, 1440].includes(n) ? n : 15; }
function bool(v, d) { return v == null ? d : Boolean(v); }
function int(v, d, min, max) { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : d; }
export async function updateSettings(patch) {
  await ensureSettings(); const current = await getSettings();
  const next = {
    botMessagesEnabled: patch.bot_messages_enabled == null ? current.bot_messages_enabled : Boolean(patch.bot_messages_enabled),
    botMessagesDelayMinutes: normalizeDelay(patch.bot_messages_delay_minutes == null ? current.bot_messages_delay_minutes : patch.bot_messages_delay_minutes),
    userMessagesEnabled: patch.user_messages_enabled == null ? current.user_messages_enabled : Boolean(patch.user_messages_enabled),
    userMessagesDelayMinutes: normalizeDelay(patch.user_messages_delay_minutes == null ? current.user_messages_delay_minutes : patch.user_messages_delay_minutes),
    duplicateProtectionEnabled: bool(patch.duplicate_protection_enabled, current.duplicate_protection_enabled), autoStartEnabled: bool(patch.auto_start_enabled, current.auto_start_enabled),
    autoFinishEnabled: bool(patch.auto_finish_enabled, current.auto_finish_enabled), remindersEnabled: bool(patch.reminders_enabled, current.reminders_enabled),
    reminder15m: bool(patch.reminder_15m, current.reminder_15m), reminder5m: bool(patch.reminder_5m, current.reminder_5m), reminder2m: bool(patch.reminder_2m, current.reminder_2m),
    winnerAnnouncementEnabled: bool(patch.winner_announcement_enabled, current.winner_announcement_enabled), winnerImageEnabled: bool(patch.winner_image_enabled, current.winner_image_enabled),
    winnerQrEnabled: bool(patch.winner_qr_enabled, current.winner_qr_enabled), winnerSignatureEnabled: bool(patch.winner_signature_enabled, current.winner_signature_enabled),
    winnerStampEnabled: bool(patch.winner_stamp_enabled, current.winner_stamp_enabled), participantRealtimeEnabled: bool(patch.participant_realtime_enabled, current.participant_realtime_enabled),
    viewerRealtimeEnabled: bool(patch.viewer_realtime_enabled, current.viewer_realtime_enabled), adminSessionTimeoutMinutes: int(patch.admin_session_timeout_minutes, current.admin_session_timeout_minutes, 5, 1440),
    tokenExpiryDays: int(patch.token_expiry_days, current.token_expiry_days, 1, 30), auditLoggingEnabled: bool(patch.audit_logging_enabled, current.audit_logging_enabled),
    panelSingleMessage: bool(patch.panel_single_message, current.panel_single_message), cleanupGroupMessages: bool(patch.cleanup_group_messages, current.cleanup_group_messages),
    searchEnabled: bool(patch.search_enabled, current.search_enabled), statisticsEnabled: bool(patch.statistics_enabled, current.statistics_enabled)
  };
  const sql = db();
  const row = (await sql`UPDATE bot_settings SET bot_messages_enabled=${next.botMessagesEnabled},bot_messages_delay_minutes=${next.botMessagesDelayMinutes},user_messages_enabled=${next.userMessagesEnabled},user_messages_delay_minutes=${next.userMessagesDelayMinutes},duplicate_protection_enabled=${next.duplicateProtectionEnabled},
    auto_start_enabled=${next.autoStartEnabled},auto_finish_enabled=${next.autoFinishEnabled},reminders_enabled=${next.remindersEnabled},reminder_15m=${next.reminder15m},reminder_5m=${next.reminder5m},reminder_2m=${next.reminder2m},
    winner_announcement_enabled=${next.winnerAnnouncementEnabled},winner_image_enabled=${next.winnerImageEnabled},winner_qr_enabled=${next.winnerQrEnabled},winner_signature_enabled=${next.winnerSignatureEnabled},winner_stamp_enabled=${next.winnerStampEnabled},
    participant_realtime_enabled=${next.participantRealtimeEnabled},viewer_realtime_enabled=${next.viewerRealtimeEnabled},admin_session_timeout_minutes=${next.adminSessionTimeoutMinutes},token_expiry_days=${next.tokenExpiryDays},
    audit_logging_enabled=${next.auditLoggingEnabled},panel_single_message=${next.panelSingleMessage},cleanup_group_messages=${next.cleanupGroupMessages},search_enabled=${next.searchEnabled},statistics_enabled=${next.statisticsEnabled},updated_at=unixepoch() WHERE id=1 RETURNING *`)[0];
  if (row) {
     const cleanRow = {}; for (const [k, v] of Object.entries(row)) { cleanRow[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v; }
     settingsCache = { ...DEFAULTS, ...cleanRow };
  }
  settingsCacheAt = Date.now(); return settingsCache;
}
export async function scheduleMessage(chatId, messageId, kind = 'bot', delayMinutes = 15) {
  if (!chatId || !messageId) return; await ensureSettings(); const delay = normalizeDelay(delayMinutes); if (delay === 0) return false;
  const sql = db(); await sql`INSERT INTO bot_message_cleanup(chat_id, message_id, kind, delete_at) VALUES(${Number(chatId)}, ${Number(messageId)}, ${kind}, unixepoch() + ${delay * 60}) ON CONFLICT(chat_id, message_id) DO UPDATE SET delete_at=EXCLUDED.delete_at, kind=EXCLUDED.kind`;
  return true;
}
export async function getUiMessage(chatId) {
  if (!chatId) return null; await ensureSettings(); const sql = db(); return (await sql`SELECT message_id FROM bot_ui_state WHERE chat_id=${Number(chatId)} LIMIT 1`)[0]?.message_id || null;
}
export async function setUiMessage(chatId, messageId) {
  if (!chatId || !messageId) return; await ensureSettings(); const sql = db(); await sql`INSERT INTO bot_ui_state(chat_id, message_id, updated_at) VALUES(${Number(chatId)}, ${Number(messageId)}, unixepoch()) ON CONFLICT(chat_id) DO UPDATE SET message_id=EXCLUDED.message_id, updated_at=unixepoch()`;
}
export async function clearUiMessage(chatId) {
  if (!chatId) return; const sql = db(); await sql`DELETE FROM bot_ui_state WHERE chat_id=${Number(chatId)}`;
}
export async function claimUpdate(updateId) {
  const n = Number(updateId); if (!Number.isSafeInteger(n) || n < 1) return true; await ensureSettings();
  const sql = db(); const r = await sql`INSERT INTO telegram_processed_updates(update_id) VALUES(${n}) ON CONFLICT(update_id) DO NOTHING RETURNING update_id`;
  await sql`DELETE FROM telegram_processed_updates WHERE processed_at < unixepoch() - 86400`; return r.length > 0;
}
export async function clearCleanupQueue() {
  await ensureSettings(); const sql = db(); return sql`DELETE FROM bot_message_cleanup RETURNING chat_id, message_id, kind`;
}
export async function dueMessages(limit = 100) {
  await ensureSettings(); const sql = db(); return sql`SELECT id, chat_id, message_id, kind FROM bot_message_cleanup WHERE delete_at <= unixepoch() ORDER BY delete_at ASC LIMIT ${Number(limit)}`;
}
export async function markDeleted(id) { const sql = db(); return sql`DELETE FROM bot_message_cleanup WHERE id=${Number(id)}`; }
