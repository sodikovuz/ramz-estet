const {db}=require('./_db');

const DEFAULTS={
  bot_messages_enabled:true,
  bot_messages_delay_minutes:15,
  user_messages_enabled:false,
  user_messages_delay_minutes:0
};

async function ensureSettings(){
  const sql=db();
  await sql`CREATE TABLE IF NOT EXISTS bot_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bot_messages_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    bot_messages_delay_minutes INTEGER NOT NULL DEFAULT 15,
    user_messages_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    user_messages_delay_minutes INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bot_message_cleanup (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'bot',
    delete_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chat_id,message_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS bot_message_cleanup_due_idx ON bot_message_cleanup(delete_at)`;
  const row=await sql`SELECT * FROM bot_settings WHERE id=1 LIMIT 1`;
  if(!row.length) await sql`INSERT INTO bot_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING`;
}

async function getSettings(){
  await ensureSettings();
  const row=(await db()`SELECT * FROM bot_settings WHERE id=1 LIMIT 1`)[0];
  return row||{id:1,...DEFAULTS};
}

function normalizeDelay(v){
  const n=Number(v);
  return [0,1,5,15,30,60,360,1440].includes(n)?n:15;
}

async function updateSettings(patch){
  await ensureSettings();
  const current=await getSettings();
  const next={
    bot_messages_enabled:patch.bot_messages_enabled==null?current.bot_messages_enabled:Boolean(patch.bot_messages_enabled),
    bot_messages_delay_minutes:normalizeDelay(patch.bot_messages_delay_minutes==null?current.bot_messages_delay_minutes:patch.bot_messages_delay_minutes),
    user_messages_enabled:patch.user_messages_enabled==null?current.user_messages_enabled:Boolean(patch.user_messages_enabled),
    user_messages_delay_minutes:normalizeDelay(patch.user_messages_delay_minutes==null?current.user_messages_delay_minutes:patch.user_messages_delay_minutes)
  };
  const row=(await db()`UPDATE bot_settings SET bot_messages_enabled=${next.bot_messages_enabled},bot_messages_delay_minutes=${next.bot_messages_delay_minutes},user_messages_enabled=${next.user_messages_enabled},user_messages_delay_minutes=${next.user_messages_delay_minutes},updated_at=NOW() WHERE id=1 RETURNING *`)[0];
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

async function dueMessages(limit=100){
  await ensureSettings();
  return db()`SELECT id,chat_id,message_id,kind FROM bot_message_cleanup WHERE delete_at<=NOW() ORDER BY delete_at ASC LIMIT ${Number(limit)}`;
}

async function markDeleted(id){
  return db()`DELETE FROM bot_message_cleanup WHERE id=${Number(id)}`;
}

module.exports={getSettings,updateSettings,ensureSettings,scheduleMessage,dueMessages,markDeleted,normalizeDelay,DEFAULTS};