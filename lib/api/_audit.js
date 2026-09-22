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
       telegramSent=await notifyDeveloper({requestId:id,level,source,action,adminUserId,giveawayId,message,meta});
     }catch(e){ telegramError=e?.message||String(e); console.error('[audit] telegram notification failed:',telegramError); }
   }
   return {requestId:id,stored,telegramSent,telegramError};
 }catch(e){ console.error('[audit] fatal:',e?.message||e); return {requestId:id,stored,telegramSent,telegramError:e?.message||String(e)}; }
}
function safeMeta(meta={}){
 const out={};
 for(const [k,v] of Object.entries(meta||{})){
   if(/token|secret|password|authorization|cookie|api[_-]?key|bot_token/i.test(k)) out[k]='[REDACTED]';
   else out[k]=clean(typeof v==='string'?v:JSON.stringify(v),1200);
 }
 return out;
}
function chunks(text,size=3500){
 const s=String(text||'');
 const out=[]; for(let i=0;i<s.length;i+=size) out.push(s.slice(i,i+size)); return out;
}
async function notifyDeveloper({requestId,level,source,action,adminUserId,giveawayId,message,error,meta}){
 if(!process.env.DEVELOPER_TELEGRAM_ID || !process.env.BOT_TOKEN) return false;
 const err=error||{};
 const stack=String(err.stack||'').slice(0,9000);
 const details=safeMeta(meta);
 const stamp=new Date().toISOString();
 const title=level==='critical'?'CRITICAL ERROR':level==='error'?'ERROR':'WARNING';
 const header=`<b>RAMZ ESTET · ${title}</b>\n\n<b>Request ID</b>\n<code>${esc(requestId)}</code>\n\n<b>Time</b>\n<code>${esc(stamp)}</code>\n\n<b>Source</b> · <code>${esc(source)}</code>\n<b>Action</b> · <code>${esc(action||'—')}</code>\n<b>Message</b>\n<blockquote>${esc(clean(message,1800))}</blockquote>`;
 const context=`<b>Context</b>\n<b>Admin</b> · <code>${adminUserId?Number(adminUserId):'—'}</code>\n<b>Giveaway</b> · <code>${giveawayId?Number(giveawayId):'—'}</code>\n<b>Error</b> · <code>${esc(err.name||'Error')}</code>\n<b>Code</b> · <code>${esc(err.code||'—')}</code>`;
 const metaText=`<b>Metadata</b>\n<pre>${esc(JSON.stringify(details,null,2).slice(0,2600))}</pre>`;
 try{
   await tg('sendMessage',{chat_id:Number(process.env.DEVELOPER_TELEGRAM_ID),text:header+'\n\n'+context+'\n\n'+metaText,parse_mode:'HTML',disable_web_page_preview:true});
   if(stack){
     for(const part of chunks(stack,3400)){
       await tg('sendMessage',{chat_id:Number(process.env.DEVELOPER_TELEGRAM_ID),text:`<b>Stack trace · ${esc(requestId)}</b>\n<pre>${esc(part)}</pre>`,parse_mode:'HTML',disable_web_page_preview:true});
     }
   }
   return true;
 }catch(e){console.error('[audit] developer notification failed:',e?.message||e);return false;}
}
async function error({source='web',action='',adminUserId=null,giveawayId=null,error,meta={}}={}){
 const id=rid();
 const message=error?.message||String(error||'Unknown error');
 const result=await log({level:'error',source,action,adminUserId,giveawayId,message,meta,notify:false,requestId:id});
 const developerSent=await notifyDeveloper({requestId:id,level:'error',source,action,adminUserId,giveawayId,message,error,meta});
 return {...result,telegramSent:developerSent};
}
module.exports={log,error,isAdminTelegramUser,admins,clean,rid};
