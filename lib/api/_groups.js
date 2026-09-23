const {db}=require("./_db");
const {tg}=require("./_telegram");

let ready=false;
async function ensureGroupSchema(sql=db()){
  if(ready)return;
  await sql`CREATE TABLE IF NOT EXISTS telegram_chats (
    chat_id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    username TEXT,
    type TEXT NOT NULL,
    bot_status TEXT,
    can_post_messages BOOLEAN DEFAULT FALSE,
    can_delete_messages BOOLEAN DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS giveaway_chats (
    giveaway_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    role TEXT NOT NULL DEFAULT 'post' CHECK (role IN ('post','winner','reminder')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (giveaway_id,chat_id,role)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS giveaway_chat_posts (
    id BIGSERIAL PRIMARY KEY,
    giveaway_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id BIGINT,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(giveaway_id,chat_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS giveaway_chats_giveaway_idx ON giveaway_chats(giveaway_id)`;
  await sql`CREATE INDEX IF NOT EXISTS giveaway_chats_chat_idx ON giveaway_chats(chat_id)`;
  ready=true;
}
function normalizeChatId(v){
  const s=String(v??"").trim();
  if(!s)return "";
  return s;
}
async function inspectChat(input){
  const chat=await tg("getChat",{chat_id:normalizeChatId(input)},{skipCleanup:true});
  if(!chat || !["group","supergroup"].includes(String(chat.type))) {
    throw Object.assign(new Error("Faqat guruh yoki superguruh qo‘shish mumkin."),{statusCode:400});
  }
  const me=await tg("getMe",{}, {skipCleanup:true});
  const member=await tg("getChatMember",{chat_id:chat.id,user_id:me.id},{skipCleanup:true});
  const status=String(member?.status||"");
  if(!["administrator","creator"].includes(status)){
    throw Object.assign(new Error("Bot guruhda administrator bo‘lishi kerak."),{statusCode:400});
  }
  const canPost=member?.can_post_messages!==false;
  const canDelete=member?.can_delete_messages===true;
  return {chat,member,bot:me,botStatus:status,canPost,canDelete};
}
async function upsertChat(info,sql=db()){
  await ensureGroupSchema(sql);
  const c=info.chat;
  await sql`INSERT INTO telegram_chats(chat_id,title,username,type,bot_status,can_post_messages,can_delete_messages,active,updated_at)
    VALUES(${Number(c.id)},${String(c.title||c.username||"Telegram guruh")},${c.username||null},${c.type},${info.botStatus||null},${Boolean(info.canPost)},${Boolean(info.canDelete)},TRUE,NOW())
    ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,username=EXCLUDED.username,type=EXCLUDED.type,
      bot_status=EXCLUDED.bot_status,can_post_messages=EXCLUDED.can_post_messages,
      can_delete_messages=EXCLUDED.can_delete_messages,active=TRUE,updated_at=NOW()`;
  return c;
}
async function registerChatFromUpdate(chat,sql=db()){
  if(!chat?.id || !["group","supergroup"].includes(String(chat.type)))return null;
  try{
    const info=await inspectChat(chat.id);
    return await upsertChat(info,sql);
  }catch(e){
    await ensureGroupSchema(sql);
    await sql`INSERT INTO telegram_chats(chat_id,title,username,type,bot_status,active,updated_at)
      VALUES(${Number(chat.id)},${String(chat.title||chat.username||"Telegram guruh")},${chat.username||null},${chat.type},NULL,TRUE,NOW())
      ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,username=EXCLUDED.username,type=EXCLUDED.type,active=TRUE,updated_at=NOW()`;
    return chat;
  }
}
module.exports={ensureGroupSchema,inspectChat,upsertChat,registerChatFromUpdate};