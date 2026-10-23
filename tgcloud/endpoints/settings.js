import { db } from '../lib/_db.js';
import { open } from '../lib/_security.js';
import { isAdminTelegramUser,error:auditError } from '../lib/_audit.js';
import { getSettings,updateSettings,clearCleanupQueue } from '../lib/_settings.js';
import { tg } from '../lib/_telegram.js';

function access(req){
  const token=req.headers['x-panel-token'];
  const p=open(token);
  if(!p||p.k!=='panel'||!p.u||!isAdminTelegramUser(p.u)) return null;
  return {uid:Number(p.u),gid:Number(p.g||0)};
}

const BOOL_KEYS=[
 'bot_messages_enabled','user_messages_enabled','duplicate_protection_enabled',
 'auto_start_enabled','auto_finish_enabled','reminders_enabled',
 'reminder_15m','reminder_5m','reminder_2m',
 'winner_announcement_enabled','winner_image_enabled','winner_qr_enabled','winner_signature_enabled','winner_stamp_enabled',
 'participant_realtime_enabled','viewer_realtime_enabled','audit_logging_enabled','panel_single_message',
 'cleanup_group_messages','search_enabled','statistics_enabled'
];

const INT_KEYS=['bot_messages_delay_minutes','user_messages_delay_minutes','admin_session_timeout_minutes','token_expiry_days'];

function sanitizePatch(body){
  const out={};
  for(const k of BOOL_KEYS) if(Object.prototype.hasOwnProperty.call(body,k)) out[k]=Boolean(body[k]);
  for(const k of INT_KEYS) if(Object.prototype.hasOwnProperty.call(body,k)) out[k]=Number(body[k]);
  return out;
}

export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
  let session=null;
  try{
    session=access(req);
    if(!session)return res.status(401).json({error:'Panel sessiyasi yaroqsiz yoki muddati tugagan'});
    if(req.method==='GET'){
      const settings=await getSettings();
      return res.json({ok:true,settings});
    }
    if(req.method!=='POST')return res.status(405).json({error:'GET/POST only'});
    const body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    if(body.action==='cleanup_now'){
      const queued=await clearCleanupQueue();
      let deleted=0,failed=0;
      for(const m of queued){
        try{
          await tg('deleteMessage',{chat_id:Number(m.chat_id),message_id:Number(m.message_id)});
          deleted++;
        }catch(e){failed++;}
      }
      return res.json({ok:true,cleanup:{queued:queued.length,deleted,failed},settings:await getSettings()});
    }
    const patch=sanitizePatch(body);
    if(!Object.keys(patch).length)return res.status(400).json({error:'O‘zgartirish topilmadi'});
    const settings=await updateSettings(patch);
    return res.json({ok:true,settings});
  }catch(e){
    console.error(e);
    await auditError({source:'web',action:'settings',adminUserId:session?.uid||null,giveawayId:session?.gid||null,error:e,meta:{method:req.method,path:req.url}});
    return res.status(e.statusCode||500).json({error:e.message||'Settings error'});
  }
};
