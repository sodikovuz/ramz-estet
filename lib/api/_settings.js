const {db}=require('./_db');
let schemaPromise=null;
let settingsCache=null;
let settingsCacheAt=0;
const SETTINGS_TTL_MS=5000;

const DEFAULTS={
  bot_messages_enabled:false,
  bot_messages_delay_minutes:15,
  user_messages_enabled:false,
  user_messages_delay_minutes:0,
  duplicate_protection_enabled:true,
  auto_start_enabled:false, auto_finish_enabled:true, reminders_enabled:true,
  reminder_15m:true, reminder_5m:true, reminder_2m:true,
  winner_announcement_enabled:true, winner_image_enabled:true, winner_qr_enabled:true,
  winner_signature_enabled:true, winner_stamp_enabled:true,
  participant_realtime_enabled:true, viewer_realtime_enabled:true,
  admin_session_timeout_minutes:60, token_expiry_days:7, audit_logging_enabled:true,
  panel_single_message:true, cleanup_group_messages:false, search_enabled:true, statistics_enabled:true
};

async function ensureSettings(){
  if(schemaPromise) return schemaPromise;
  schemaPromise=(async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      bot_messages_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      bot_messages_delay_minutes INTEGER NOT NULL DEFAULT 15,
      user_messages_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      user_messages_delay_minutes INTEGER NOT NULL DEFAULT 0,
      duplicate_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    const alters=[
      `duplicate_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`auto_start_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
      `auto_finish_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      `reminder_15m BOOLEAN NOT NULL DEFAULT TRUE`,`reminder_5m BOOLEAN NOT NULL DEFAULT TRUE`,`reminder_2m BOOLEAN NOT NULL DEFAULT TRUE`,
      `winner_announcement_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`winner_image_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      `winner_qr_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`winner_signature_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`winner_stamp_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      `participant_realtime_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`viewer_realtime_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      `admin_session_timeout_minutes INTEGER NOT NULL DEFAULT 60`,`token_expiry_days INTEGER NOT NULL DEFAULT 7`,
      `audit_logging_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`panel_single_message BOOLEAN NOT NULL DEFAULT TRUE`,
      `cleanup_group_messages BOOLEAN NOT NULL DEFAULT FALSE`,`search_enabled BOOLEAN NOT NULL DEFAULT TRUE`,`statistics_enabled BOOLEAN NOT NULL DEFAULT TRUE`
    ];
    for(const definition of alters){
      const [name,...rest]=definition.split(" ");
      await sql.unsafe(`ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS ${name} ${rest.join(" ")}`);
    }
    await sql`CREATE TABLE IF NOT EXISTS bot_message_cleanup (
      id BIGSERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, message_id BIGINT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'bot', delete_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(chat_id,message_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS bot_message_cleanup_due_idx ON bot_message_cleanup(delete_at)`;
    await sql`CREATE TABLE IF NOT EXISTS telegram_processed_updates (
      update_id BIGINT PRIMARY KEY, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS telegram_processed_updates_time_idx ON telegram_processed_updates(processed_at)`;
    await sql`CREATE TABLE IF NOT EXISTS bot_ui_state (
      chat_id BIGINT PRIMARY KEY, message_id BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`INSERT INTO bot_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING`;
  })().catch(e=>{schemaPromise=null;throw e});
  return schemaPromise;
}

async function getSettings(){
  const now=Date.now();
  if(settingsCache && now-settingsCacheAt<SETTINGS_TTL_MS) return settingsCache;
  await ensureSettings();
  const row=(await db()`SELECT * FROM bot_settings WHERE id=1 LIMIT 1`)[0];
  settingsCache=row||{id:1,...DEFAULTS};
  settingsCacheAt=now;
  return settingsCache;
}

function normalizeDelay(v){
  const n=Number(v);
  return [0,1,5,15,30,60,360,1440].includes(n)?n:15;
}

function bool(v,d){return v==null?d:Boolean(v)}
function int(v,d,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):d}

async function updateSettings(patch){
  await ensureSettings();
  const current=await getSettings();
  const next={
    bot_messages_enabled:patch.bot_messages_enabled==null?current.bot_messages_enabled:Boolean(patch.bot_messages_enabled),
    bot_messages_delay_minutes:normalizeDelay(patch.bot_messages_delay_minutes==null?current.bot_messages_delay_minutes:patch.bot_messages_delay_minutes),
    user_messages_enabled:patch.user_messages_enabled==null?current.user_messages_enabled:Boolean(patch.user_messages_enabled),
    user_messages_delay_minutes:normalizeDelay(patch.user_messages_delay_minutes==null?current.user_messages_delay_minutes:patch.user_messages_delay_minutes),
    duplicate_protection_enabled:bool(patch.duplicate_protection_enabled,current.duplicate_protection_enabled),
    auto_start_enabled:bool(patch.auto_start_enabled,current.auto_start_enabled),
    auto_finish_enabled:bool(patch.auto_finish_enabled,current.auto_finish_enabled),
    reminders_enabled:bool(patch.reminders_enabled,current.reminders_enabled),
    reminder_15m:bool(patch.reminder_15m,current.reminder_15m), reminder_5m:bool(patch.reminder_5m,current.reminder_5m), reminder_2m:bool(patch.reminder_2m,current.reminder_2m),
    winner_announcement_enabled:bool(patch.winner_announcement_enabled,current.winner_announcement_enabled),
    winner_image_enabled:bool(patch.winner_image_enabled,current.winner_image_enabled), winner_qr_enabled:bool(patch.winner_qr_enabled,current.winner_qr_enabled),
    winner_signature_enabled:bool(patch.winner_signature_enabled,current.winner_signature_enabled), winner_stamp_enabled:bool(patch.winner_stamp_enabled,current.winner_stamp_enabled),
    participant_realtime_enabled:bool(patch.participant_realtime_enabled,current.participant_realtime_enabled), viewer_realtime_enabled:bool(patch.viewer_realtime_enabled,current.viewer_realtime_enabled),
    admin_session_timeout_minutes:int(patch.admin_session_timeout_minutes,current.admin_session_timeout_minutes,5,1440), token_expiry_days:int(patch.token_expiry_days,current.token_expiry_days,1,30),
    audit_logging_enabled:bool(patch.audit_logging_enabled,current.audit_logging_enabled), panel_single_message:bool(patch.panel_single_message,current.panel_single_message),
    cleanup_group_messages:bool(patch.cleanup_group_messages,current.cleanup_group_messages), search_enabled:bool(patch.search_enabled,current.search_enabled), statistics_enabled:bool(patch.statistics_enabled,current.statistics_enabled)
  };
  const row=(await db()`UPDATE bot_settings SET bot_messages_enabled=${next.bot_messages_enabled},bot_messages_delay_minutes=${next.bot_messages_delay_minutes},user_messages_enabled=${next.user_messages_enabled},user_messages_delay_minutes=${next.user_messages_delay_minutes},duplicate_protection_enabled=${next.duplicate_protection_enabled},
    auto_start_enabled=${next.auto_start_enabled},auto_finish_enabled=${next.auto_finish_enabled},reminders_enabled=${next.reminders_enabled},reminder_15m=${next.reminder_15m},reminder_5m=${next.reminder_5m},reminder_2m=${next.reminder_2m},
    winner_announcement_enabled=${next.winner_announcement_enabled},winner_image_enabled=${next.winner_image_enabled},winner_qr_enabled=${next.winner_qr_enabled},winner_signature_enabled=${next.winner_signature_enabled},winner_stamp_enabled=${next.winner_stamp_enabled},
    participant_realtime_enabled=${next.participant_realtime_enabled},viewer_realtime_enabled=${next.viewer_realtime_enabled},admin_session_timeout_minutes=${next.admin_session_timeout_minutes},token_expiry_days=${next.token_expiry_days},
    audit_logging_enabled=${next.audit_logging_enabled},panel_single_message=${next.panel_single_message},cleanup_group_messages=${next.cleanup_group_messages},search_enabled=${next.search_enabled},statistics_enabled=${next.statistics_enabled},updated_at=NOW() WHERE id=1 RETURNING *`)[0];
  settingsCache=row;
  settingsCacheAt=Date.now();
  return row;
}

async function scheduleMessage(chatId,messageId,kind='bot',delayMinutes=15){
  if(!chatId||!messageId)return;
  await ensureSettings();
  const delay=normalizeDelay(delayMinutes);
  if(delay===0)return false;
  await db()`INSERT INTO bot_message_cleanup(chat_id,message_id,kind,delete_at) VALUES(${Number(chatId)},${Number(messageId)},${kind},NOW()+(${delay}::text||' minutes')::interval) ON CONFLICT(chat_id,message_id) DO UPDATE SET delete_at=EXCLUDED.delete_at,kind=EXCLUDED.kind`;
  return true;
}

async function getUiMessage(chatId){
  if(!chatId)return null;
  await ensureSettings();
  return (await db()`SELECT message_id FROM bot_ui_state WHERE chat_id=${Number(chatId)} LIMIT 1`)[0]?.message_id||null;
}
async function setUiMessage(chatId,messageId){
  if(!chatId||!messageId)return;
  await ensureSettings();
  await db()`INSERT INTO bot_ui_state(chat_id,message_id,updated_at) VALUES(${Number(chatId)},${Number(messageId)},NOW()) ON CONFLICT(chat_id) DO UPDATE SET message_id=EXCLUDED.message_id,updated_at=NOW()`;
}
async function clearUiMessage(chatId){
  if(!chatId)return;
  await db()`DELETE FROM bot_ui_state WHERE chat_id=${Number(chatId)}`;
}

async function claimUpdate(updateId){
  const n=Number(updateId);
  if(!Number.isSafeInteger(n)||n<1)return true;
  await ensureSettings();
  const r=await db()`INSERT INTO telegram_processed_updates(update_id) VALUES(${n}) ON CONFLICT(update_id) DO NOTHING RETURNING update_id`;
  await db()`DELETE FROM telegram_processed_updates WHERE processed_at<NOW()-INTERVAL '24 hours'`;
  return r.length>0;
}
async function clearCleanupQueue(){
  await ensureSettings();
  return db()`DELETE FROM bot_message_cleanup RETURNING chat_id,message_id,kind`;
}

async function dueMessages(limit=100){
  await ensureSettings();
  return db()`SELECT id,chat_id,message_id,kind FROM bot_message_cleanup WHERE delete_at<=NOW() ORDER BY delete_at ASC LIMIT ${Number(limit)}`;
}

async function markDeleted(id){
  return db()`DELETE FROM bot_message_cleanup WHERE id=${Number(id)}`;
}

module.exports={getSettings,updateSettings,ensureSettings,scheduleMessage,dueMessages,markDeleted,normalizeDelay,getUiMessage,setUiMessage,clearUiMessage,claimUpdate,clearCleanupQueue,DEFAULTS};