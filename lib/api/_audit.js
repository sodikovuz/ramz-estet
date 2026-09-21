const crypto = require('crypto');
const { db } = require('./_db');
const { tg, esc } = require('./_telegram');

function clean(v, max=500){
  let s=String(v ?? '');
  s=s.replace(/(?:bot|api|secret|token|authorization|password|key)[^\s:=]*\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]');
  s=s.replace(/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[TOKEN_REDACTED]');
  return s.slice(0,max);
}
function rid(){return crypto.randomBytes(8).toString('hex');}
function admins(){return String(process.env.ADMIN_TELEGRAM_IDS||process.env.ADMIN_TELEGRAM_ID||'').split(',').map(x=>x.trim()).filter(Boolean);}
function isAdminTelegramUser(uid){return admins().includes(String(uid));}
async function ensure(){
 const sql=db();
 await sql`CREATE TABLE IF NOT EXISTS audit_logs (
   id BIGSERIAL PRIMARY KEY,
   request_id TEXT,
   level TEXT NOT NULL DEFAULT 'info',
   source TEXT NOT NULL,
   action TEXT,
   admin_user_id BIGINT,
   giveaway_id BIGINT,
   message TEXT,
   meta JSONB NOT NULL DEFAULT '{}'::jsonb,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`;
 await sql`CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS audit_logs_level_idx ON audit_logs(level,created_at DESC)`;
}
async function log({level='info',source='web',action='',adminUserId=null,giveawayId=null,message='',meta={},notify=false,requestId=null}={}){
 const id=requestId||rid();
 let stored=false, telegramSent=false, telegramError=null;
 try{
   try{
     await ensure();
     const sql=db();
     await sql`INSERT INTO audit_logs(request_id,level,source,action,admin_user_id,giveaway_id,message,meta)
       VALUES(${id},${clean(level,20)},${clean(source,40)},${clean(action,80)},${adminUserId?Number(adminUserId):null},${giveawayId?Number(giveawayId):null},${clean(message)},${JSON.stringify(meta||{})}::jsonb)`;
     stored=true;
   }catch(e){ console.error('[audit] database write failed:',e?.message||e); }
   if(notify && process.env.DEVELOPER_TELEGRAM_ID && process.env.BOT_TOKEN){
     try{
       const text=`🛡 <b>RAMZ ESTET LOG</b>\n\n<b>Level:</b> ${esc(level)}\n<b>Source:</b> ${esc(source)}\n<b>Action:</b> ${esc(action||'—')}\n<b>Request:</b> <code>${esc(id)}</code>\n${giveawayId?`<b>Giveaway:</b> #${Number(giveawayId)}\n`:''}${adminUserId?`<b>Admin:</b> <code>${Number(adminUserId)}</code>\n`:''}<b>Message:</b> ${esc(clean(message,900))}`;
       await tg('sendMessage',{chat_id:Number(process.env.DEVELOPER_TELEGRAM_ID),text,parse_mode:'HTML',disable_web_page_preview:true});
       telegramSent=true;
     }catch(e){ telegramError=e?.message||String(e); console.error('[audit] telegram notification failed:',telegramError); }
   }
   return {requestId:id,stored,telegramSent,telegramError};
 }catch(e){ console.error('[audit] fatal:',e?.message||e); return {requestId:id,stored,telegramSent,telegramError:e?.message||String(e)}; }
}
async function error({source='web',action='',adminUserId=null,giveawayId=null,error,meta={}}={}){
 return log({level:'error',source,action,adminUserId,giveawayId,message:error?.message||String(error||'Unknown error'),meta,notify:true});
}
module.exports={log,error,isAdminTelegramUser,admins,clean,rid};
