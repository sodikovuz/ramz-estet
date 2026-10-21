const REQUIRED_TABLES = [
  'giveaways', 'telegram_giveaway_participants', 'giveaway_viewers', 'giveaway_winners',
  'giveaway_state', 'admin_sessions', 'giveaway_notify_log', 'startapp_tokens', 'audit_logs',
  'telegram_chats', 'giveaway_chats', 'giveaway_chat_posts', 'giveaway_inline_posts',
  'bot_settings', 'bot_message_cleanup', 'telegram_processed_updates', 'bot_ui_state',
];
const PRIMARY_KEYS = {
  giveaways: ['id'], telegram_giveaway_participants: ['giveaway_id', 'user_id'],
  giveaway_viewers: ['giveaway_id', 'user_id'], giveaway_winners: ['id'], giveaway_state: ['id'],
  admin_sessions: ['user_id'], giveaway_notify_log: ['giveaway_id', 'marker'], startapp_tokens: ['token_hash'],
  audit_logs: ['id'], telegram_chats: ['chat_id'], giveaway_chats: ['giveaway_id', 'chat_id', 'role'],
  giveaway_chat_posts: ['id'], giveaway_inline_posts: ['giveaway_id', 'inline_message_id'],
  bot_settings: ['id'], bot_message_cleanup: ['id'], telegram_processed_updates: ['update_id'], bot_ui_state: ['chat_id'],
};
const RELATIONS = [
  ['telegram_giveaway_participants', 'giveaway_id'], ['giveaway_viewers', 'giveaway_id'],
  ['giveaway_winners', 'giveaway_id'], ['giveaway_notify_log', 'giveaway_id'],
  ['startapp_tokens', 'giveaway_id'], ['giveaway_chats', 'giveaway_id'],
  ['giveaway_chat_posts', 'giveaway_id'], ['giveaway_inline_posts', 'giveaway_id'],
];
function keyOf(row, fields) { return JSON.stringify(fields.map((field) => row[field] ?? null)); }
export function validateServerlessExport(input) {
  const errors = []; const warnings = []; const counts = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['Export root must be an object.'], warnings, counts };
  if (input.formatVersion !== 1) errors.push('formatVersion must be 1.');
  if (!input.tables || typeof input.tables !== 'object' || Array.isArray(input.tables)) return { ok: false, errors: errors.concat(['tables must be an object.']), warnings, counts };
  const tables = input.tables;
  for (const name of REQUIRED_TABLES) {
    if (!Array.isArray(tables[name])) { errors.push('Missing table array: ' + name); continue; }
    counts[name] = tables[name].length; const fields = PRIMARY_KEYS[name]; const seen = new Set();
    tables[name].forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push(name + '[' + index + '] must be a row object.'); return; }
      const missing = fields.filter((field) => row[field] === undefined || row[field] === null);
      if (missing.length) { errors.push(name + '[' + index + '] missing primary-key field(s): ' + missing.join(', ')); return; }
      const key = keyOf(row, fields); if (seen.has(key)) errors.push(name + ' has duplicate primary key at row ' + index + ': ' + key); seen.add(key);
    });
  }
  for (const [childName, childField] of RELATIONS) {
    const children = tables[childName]; const parents = tables.giveaways;
    if (!Array.isArray(children) || !Array.isArray(parents)) continue;
    const parentIds = new Set(parents.map((row) => String(row && row.id)));
    children.forEach((row, index) => {
      if (row[childField] === undefined || row[childField] === null) errors.push(childName + '[' + index + '] missing relation field ' + childField);
      else if (!parentIds.has(String(row[childField]))) errors.push(childName + '[' + index + '] references absent giveaways.id=' + row[childField]);
    });
  }
  const unknown = Object.keys(tables).filter((name) => !REQUIRED_TABLES.includes(name));
  if (unknown.length) warnings.push('Unrecognized tables included in export: ' + unknown.join(', '));
  return { ok: errors.length === 0, errors, warnings, counts };
}
