const {db}=require('./_db');
const {open}=require('./_security');
const {isAdminTelegramUser,error:auditError}=require('./_audit');
const {getSettings,updateSettings,clearCleanupQueue}=require('./_settings');
const {tg}=require('./_telegram');

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

module.exports=async function(req,res){
  let access=null;
  try{
    access=access(req);
    if(!access)return res.status(401).json({error:'Panel sessiyasi yaroqsiz yoki muddati tugagan'});
    if(req.method==='GET'){
      const settings=await getSettings();
      return res.json({ok:true,settings});
    }
    if(req.method!=='POST')return res.status(405).json({error:'GET/POST only'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
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
    await auditError({source:'web',action:'settings',adminUserId:access?.uid||null,giveawayId:access?.gid||null,error:e,meta:{method:req.method,path:req.url}});
    return res.status(e.statusCode||500).json({error:e.message||'Settings error'});
  }
};
