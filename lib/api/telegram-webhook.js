const {db}=require("./_db");
const {tg,esc}=require("./_telegram");
const {makeStartApp,makePanelToken}=require("./_security");
const {isAdminTelegramUser,log,error}=require('./_audit');
const {getSettings,updateSettings,scheduleMessage,getUiMessage,setUiMessage,clearUiMessage,claimUpdate,clearCleanupQueue}=require('./_settings');
const TZ="Asia/Tashkent";
function kb(rows){return {inline_keyboard:rows};}
async function safeAnswerCallbackQuery(id,opts={}){
 if(!id)return false;
 try{
  await tg("answerCallbackQuery",{callback_query_id:id,...opts});
  return true;
 }catch(e){
  const msg=String(e?.message||e);
  if(/query is too old|query ID is invalid|response timeout expired/i.test(msg)) return false;
  console.error("[telegram] answerCallbackQuery failed:",msg);
  return false;
 }
}
function tashkentParts(d=new Date()){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const o={}; for(const x of parts) if(x.type!=="literal") o[x.type]=x.value; return o;
}
function calendar(year,month){
 const first=new Date(Date.UTC(year,month-1,1));
 const days=new Date(Date.UTC(year,month,0)).getUTCDate();
 const start=(first.getUTCDay()+6)%7;
 const names=["Du","Se","Ch","Pa","Ju","Sh","Ya"];
 const rows=[[{text:`‹ ${month===1?year-1:year}-${String(month===1?12:month-1).padStart(2,"0")}`,callback_data:`calm:${month===1?year-1:year}-${String(month===1?12:month-1).padStart(2,"0")}`},{text:`📅 ${year}-${String(month).padStart(2,"0")}`,callback_data:"noop"},{text:`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,"0")} ›`,callback_data:`calm:${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,"0")}`}]];
 rows.push(names.map(n=>({text:n,callback_data:"noop"})));
 let row=[]; for(let i=0;i<start;i++) row.push({text:" ",callback_data:"noop"});
 for(let day=1;day<=days;day++){ const val=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`; row.push({text:String(day),callback_data:`cal:${val}`}); if(row.length===7){rows.push(row);row=[];} }
 if(row.length) {while(row.length<7) row.push({text:" ",callback_data:"noop"}); rows.push(row);}
 rows.push([{text:"Bekor qilish",callback_data:"cancel_create"}]);
 return kb(rows);
}
function timeKeyboard(){
 const times=[]; for(let h=0;h<24;h++) for(const m of [0,30]) times.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
 const rows=[]; for(let i=0;i<times.length;i+=4) rows.push(times.slice(i,i+4).map(t=>({text:t,callback_data:`time:${t}`})));
 rows.push([{text:"Boshqa vaqt",callback_data:"custom_time"}],[{text:"⬅️ Sanani o‘zgartirish",callback_data:"pick_date"},{text:"Bekor qilish",callback_data:"cancel_create"}]);
 return kb(rows);
}
function cancelKeyboard(){return kb([[{text:"Bekor qilish",callback_data:"cancel_create"}]]);}
function backKeyboard(to="menu"){return kb([[{text:"Orqaga",callback_data:to}]])}
const delayLabel=n=>({0:"Darhol",1:"1 daqiqa",5:"5 daqiqa",15:"15 daqiqa",30:"30 daqiqa",60:"1 soat",360:"6 soat",1440:"24 soat"}[Number(n)]||`${n} daqiqa`);
function yn(v){return v?"YOQILGAN":"O‘CHIRILGAN"}
async function reminderSettingsView(){
 const s=await getSettings();
 const mark=v=>v?"ON":"OFF";
 const rows=[
  [{text:`15 daqiqa oldin · ${mark(s.reminder_15m)}`,callback_data:"settings:reminder_15"}],
  [{text:`5 daqiqa oldin · ${mark(s.reminder_5m)}`,callback_data:"settings:reminder_5"}],
  [{text:`2 daqiqa oldin · ${mark(s.reminder_2m)}`,callback_data:"settings:reminder_2"}],
  [{text:`Barcha reminderlar · ${mark(s.reminders_enabled)}`,callback_data:"settings:reminders_toggle"}],
  [{text:"⬅️ Admin Settings",callback_data:"settings"}],
  [{text:"Bosh menyu",callback_data:"menu"}]
 ];
 return {
  text:`<b>REMINDER SETTINGS</b>

<blockquote>Giveaway boshlanishidan oldin admin va kerakli chatlarga yuboriladigan eslatmalar.</blockquote>

<b>15 DAQIQA</b>
Holat: <b>${mark(s.reminder_15m)}</b>

<b>5 DAQIQA</b>
Holat: <b>${mark(s.reminder_5m)}</b>

<b>2 DAQIQA</b>
Holat: <b>${mark(s.reminder_2m)}</b>

<b>UMUMIY</b>
Reminder tizimi: <b>${mark(s.reminders_enabled)}</b>

<blockquote>Har bir vaqt alohida boshqariladi. Tizim o‘chirilsa, barcha reminderlar vaqtincha to‘xtaydi.</blockquote>`,
  parse_mode:"HTML",
  reply_markup:kb(rows)
 };
}
async function settingsView(){
 const s=await getSettings();
 const d=delayLabel;
 const rows=[
  [{text:`Chat tozalash · ${yn(s.bot_messages_enabled)}`,callback_data:"settings:bot_toggle"},{text:"Vaqt",callback_data:"settings:bot_delay"}],
  [{text:`Admin xabarlari · ${yn(s.user_messages_enabled)}`,callback_data:"settings:user_toggle"},{text:"Vaqt",callback_data:"settings:user_delay"}],
  [{text:`Avtomatik start · ${yn(s.auto_start_enabled)}`,callback_data:"settings:auto_start"}],
  [{text:`Avtomatik finish · ${yn(s.auto_finish_enabled)}`,callback_data:"settings:auto_finish"}],
  [{text:`Reminderlar · ${yn(s.reminders_enabled)}`,callback_data:"settings:reminders"}],
  [{text:`Winner announcement · ${yn(s.winner_announcement_enabled)}`,callback_data:"settings:winner_announce"}],
  [{text:`Winner image · ${yn(s.winner_image_enabled)}`,callback_data:"settings:winner_image"}],
  [{text:`QR / Signature / Stamp · ${yn(s.winner_qr_enabled)} / ${yn(s.winner_signature_enabled)} / ${yn(s.winner_stamp_enabled)}`,callback_data:"settings:winner_style"}],
  [{text:`Realtime participant · ${yn(s.participant_realtime_enabled)}`,callback_data:"settings:participant_realtime"}],
  [{text:`Realtime viewer · ${yn(s.viewer_realtime_enabled)}`,callback_data:"settings:viewer_realtime"}],
  [{text:`Duplicate protection · ${yn(s.duplicate_protection_enabled)}`,callback_data:"settings:duplicate_toggle"}],
  [{text:`Audit log · ${yn(s.audit_logging_enabled)}`,callback_data:"settings:audit"}],
  [{text:`Qidiruv · ${yn(s.search_enabled)}`,callback_data:"settings:search"}],
  [{text:`Statistika · ${yn(s.statistics_enabled)}`,callback_data:"settings:stats"}],
  [{text:`Panel single-message · ${yn(s.panel_single_message)}`,callback_data:"settings:panel"}],
  [{text:`Session timeout · ${s.admin_session_timeout_minutes} daqiqa`,callback_data:"settings:session"}],
  [{text:`Token expiry · ${s.token_expiry_days} kun`,callback_data:"settings:token"}],
  [{text:"Hozir tozalash",callback_data:"settings:cleanup_now"}],
  [{text:"Bosh menyu",callback_data:"menu"}]
 ];
 return {text:`<b>ADMIN SETTINGS</b>

<b>CHAT</b>
Bot xabarlari: <b>${yn(s.bot_messages_enabled)}</b> · ${d(s.bot_messages_delay_minutes)}
Admin xabarlari: <b>${yn(s.user_messages_enabled)}</b> · ${d(s.user_messages_delay_minutes)}

<b>AUTOMATION</b>
Auto start: <b>${yn(s.auto_start_enabled)}</b>
Auto finish: <b>${yn(s.auto_finish_enabled)}</b>
Reminderlar: <b>${yn(s.reminders_enabled)}</b>
<blockquote>15m: ${yn(s.reminder_15m)} · 5m: ${yn(s.reminder_5m)} · 2m: ${yn(s.reminder_2m)}</blockquote>

<b>WINNER</b>
Announcement: <b>${yn(s.winner_announcement_enabled)}</b>
Image: <b>${yn(s.winner_image_enabled)}</b>
QR: <b>${yn(s.winner_qr_enabled)}</b>
Signature: <b>${yn(s.winner_signature_enabled)}</b>
Stamp: <b>${yn(s.winner_stamp_enabled)}</b>

<b>REALTIME / SECURITY</b>
Participant: <b>${yn(s.participant_realtime_enabled)}</b>
Viewer: <b>${yn(s.viewer_realtime_enabled)}</b>
Duplicate protection: <b>${yn(s.duplicate_protection_enabled)}</b>
Audit log: <b>${yn(s.audit_logging_enabled)}</b>

<b>ADMIN UX</b>
Panel: <b>${yn(s.panel_single_message)}</b>
Search: <b>${yn(s.search_enabled)}</b>
Statistics: <b>${yn(s.statistics_enabled)}</b>
Session: <b>${s.admin_session_timeout_minutes} daqiqa</b>
Token: <b>${s.token_expiry_days} kun</b>

<blockquote>Har bir funksiya alohida yoqiladi yoki o‘chiriladi.</blockquote>`,parse_mode:"HTML",reply_markup:kb(rows)};
}
function statusLabel(s){return ({scheduled:"Rejalashtirilgan",running:"Jarayonda",finished:"Yakunlangan",closed:"Bekor qilingan"}[String(s)]||String(s));}
function previewKeyboard(){return kb([[{text:"Tasdiqlash va yaratish",callback_data:"create_confirm"}],[{text:"Sanani o‘zgartirish",callback_data:"pick_date"},{text:"Vaqtni o‘zgartirish",callback_data:"pick_time"}],[{text:"Bekor qilish",callback_data:"cancel_create"}]]);}
async function editOrSend(chat,q,opts){
 const messageId=q?.message?.message_id||await getUiMessage(chat);
 if(messageId){
  try{
   const r=await tg("editMessageText",{chat_id:chat,message_id:Number(messageId),...opts});
   if(r?.message_id) await setUiMessage(chat,r.message_id); else await setUiMessage(chat,Number(messageId));
   return r;
  }catch(e){
   if(/message is not modified/i.test(String(e.message||e))) return null;
   await clearUiMessage(chat);
  }
 }
 const r=await tg("sendMessage",{chat_id:chat,...opts});
 if(r?.message_id) await setUiMessage(chat,r.message_id);
 return r;
}
function paginate(items,page,size=8){const total=Math.max(1,Math.ceil(items.length/size));const p=Math.max(0,Math.min(Number(page)||0,total-1));return {items:items.slice(p*size,(p+1)*size),page:p,total};}
function formatTashkent(date){return new Intl.DateTimeFormat("uz-UZ",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);}
async function menu(chat){
 const sql=db();
 const stats=(await sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled, COUNT(*) FILTER (WHERE status='running')::int AS running, COUNT(*) FILTER (WHERE status='finished')::int AS finished FROM giveaways`)[0]||{};
 return editOrSend(chat,null,{text:`<b>RAMZ ESTET</b>\n<blockquote>Admin boshqaruv paneli</blockquote>\n\n<b>Umumiy:</b> ${stats.total||0} ta\n<b>Rejalashtirilgan:</b> ${stats.scheduled||0}\n<b>Jarayonda:</b> ${stats.running||0}\n<b>Yakunlangan:</b> ${stats.finished||0}\n\nKerakli bo‘limni tanlang.`,parse_mode:"HTML",reply_markup:kb([
  [{text:"Giveaway yaratish",callback_data:"new"}],
  [{text:"Giveawaylarim",callback_data:"list:0"}],
  [{text:"Faol giveawaylar",callback_data:"active:0"}],
  [{text:"G‘oliblar tarixi",callback_data:"history:0"}],
  [{text:"⚙️ Admin Settings",callback_data:"settings"}],
  [{text:"Yordam",callback_data:"help"}]
 ])});
}
async function state(sql,uid,patch){
 await sql`INSERT INTO admin_sessions(user_id,state,data) VALUES(${uid},'idle','{}'::jsonb)
 ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state,data=EXCLUDED.data`;
 if(patch) await sql`UPDATE admin_sessions SET state=${patch.state},data=${JSON.stringify(patch.data)}::jsonb WHERE user_id=${uid}`;
}
module.exports=async function(req,res){
 try{
  if(req.method!=="POST")return res.status(405).end();
  if(!process.env.TELEGRAM_WEBHOOK_SECRET || req.headers["x-telegram-bot-api-secret-token"]!==process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(401).json({error:"Unauthorized webhook"});
  const u=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{}),sql=db(),admin=String(process.env.ADMIN_TELEGRAM_ID||"");
  if(u.message?.message_id && u.message?.chat?.id && isAdminTelegramUser(u.message.from?.id)){
    try{
      const s=await getSettings();
      if(s.user_messages_enabled){
        const delay=Number(s.user_messages_delay_minutes);
        if(delay===0){
          await tg("deleteMessage",{chat_id:u.message.chat.id,message_id:u.message.message_id});
        }else{
          await scheduleMessage(u.message.chat.id,u.message.message_id,'user',delay);
        }
      }
    }catch(e){console.error('[cleanup] incoming message cleanup failed:',e?.message||e);}
  }
  if(u.inline_query){
    const iq=u.inline_query,iqUid=iq.from?.id,query=String(iq.query||'').trim();
    // Inline mode is authenticated by Telegram itself. We additionally require
    // that the requested giveaway belongs to the querying Telegram user, so
    // ADMIN_TELEGRAM_ID is not a blocker when it is missing/misconfigured.
    const m=query.match(/^(?:giveaway:|post:|#?)(\d+)$/i);
    if(!m) return res.json({ok:true,results:[],cache_time:0,is_personal:true});
    const gid=Number(m[1]);
    const g=(await sql`SELECT id,title,description,total_rounds,start_at,status,image_file_id FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!isAdminTelegramUser(iqUid)) return res.json({ok:true,results:[],cache_time:0,is_personal:true});
    if(!g) return res.json({ok:true,results:[],cache_time:0,is_personal:true});
    const joinToken=await makeStartApp(gid,'join'),watchToken=await makeStartApp(gid,'watch');
    const joinUrl=`https://t.me/${process.env.BOT_USERNAME||'ramzestetbot'}/giveaway?startapp=${encodeURIComponent(joinToken)}`;
    const watchUrl=`https://t.me/${process.env.BOT_USERNAME||'ramzestetbot'}/giveaway?startapp=${encodeURIComponent(watchToken)}`;
    const text=`<b>${esc(g.title)}</b>\n\n${esc(g.description||'Giveawayga qatnashing!')}\n\n<b>G‘oliblar:</b> ${Number(g.total_rounds)} ta\n<b>Boshlanish:</b> ${new Date(g.start_at).toLocaleString('uz-UZ',{timeZone:TZ})}\n\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
    const buttons={inline_keyboard:[[{text:'QATNASHISH',url:joinUrl}],[{text:'BARABANNI TOMOSHA QILISH',url:watchUrl}]]};
    // If the poster was uploaded to Telegram, use the cached-photo inline result
    // so Telegram can render the actual poster without exposing a bot-token URL.
    const result=g.image_file_id
      ? {type:'photo',id:`giveaway_photo_${gid}_${Date.now()}`,photo_file_id:String(g.image_file_id),caption:text,parse_mode:'HTML',reply_markup:buttons}
      : {type:'article',id:`giveaway_${gid}_${Date.now()}`,title:`${g.title}`,description:'Giveaway postini yuborish',input_message_content:{message_text:text,parse_mode:'HTML'},reply_markup:buttons};
    await tg("answerInlineQuery",{inline_query_id:iq.id,results:[result],cache_time:0,is_personal:true});
    return res.json({ok:true});
  }
  if(u.chosen_inline_result)return res.json({ok:true});
  if(u.callback_query){
   const q=u.callback_query,data=String(q.data||""),chat=q.message?.chat?.id,uid=q.from?.id;
   if(!isAdminTelegramUser(uid)){await safeAnswerCallbackQuery(q.id,{text:"Faqat admin.",show_alert:true});return res.json({ok:true});}
   // Telegram callback answers expire quickly; expired/duplicate queries are harmless and ignored.
   await safeAnswerCallbackQuery(q.id);
   const callbackSettings=await getSettings();
   if(callbackSettings.duplicate_protection_enabled && u.update_id){
    const fresh=await claimUpdate(u.update_id);
    if(!fresh)return res.json({ok:true});
   }
   await log({source:'bot',action:'callback',adminUserId:uid,giveawayId:(/^g:(\d+)$/.exec(data)||[])[1]||null,meta:{data:String(data).slice(0,120)}});
   if(data==="new"){
    await state(sql,uid,{state:"title",data:{}});
    await editOrSend(chat,q,{text:"<b>1 / 4 — Giveaway nomi</b>\n\nGiveaway nomini yuboring.",parse_mode:"HTML",reply_markup:cancelKeyboard()}); return res.json({ok:true});
   }
   if(data==="noop"){return res.json({ok:true});}
   if(data==="settings" || data.startsWith("settings:")){
    const parts=data.split(":"),action=parts[1]||"";
    let s=await getSettings();
    if(action==="info"){await editOrSend(chat,q,await settingsInfo(parts[2]||""));return res.json({ok:true});}
    if(action==="bot_toggle") s=await updateSettings({bot_messages_enabled:!s.bot_messages_enabled});
    else if(action==="user_toggle") s=await updateSettings({user_messages_enabled:!s.user_messages_enabled});
    else if(action==="duplicate_toggle") s=await updateSettings({duplicate_protection_enabled:!s.duplicate_protection_enabled});
    else if(action==="auto_start") s=await updateSettings({auto_start_enabled:!s.auto_start_enabled});
    else if(action==="auto_finish") s=await updateSettings({auto_finish_enabled:!s.auto_finish_enabled});
    else if(action==="reminders"){await editOrSend(chat,q,await reminderSettingsView());return res.json({ok:true});}
    else if(action==="reminders_toggle") s=await updateSettings({reminders_enabled:!s.reminders_enabled});
    else if(action==="reminder_15") s=await updateSettings({reminder_15m:!s.reminder_15m});
    else if(action==="reminder_5") s=await updateSettings({reminder_5m:!s.reminder_5m});
    else if(action==="reminder_2") s=await updateSettings({reminder_2m:!s.reminder_2m});
    else if(action==="winner_announce") s=await updateSettings({winner_announcement_enabled:!s.winner_announcement_enabled});
    else if(action==="winner_image") s=await updateSettings({winner_image_enabled:!s.winner_image_enabled});
    else if(action==="winner_style") s=await updateSettings({winner_qr_enabled:!s.winner_qr_enabled,winner_signature_enabled:!s.winner_signature_enabled,winner_stamp_enabled:!s.winner_stamp_enabled});
    else if(action==="participant_realtime") s=await updateSettings({participant_realtime_enabled:!s.participant_realtime_enabled});
    else if(action==="viewer_realtime") s=await updateSettings({viewer_realtime_enabled:!s.viewer_realtime_enabled});
    else if(action==="audit") s=await updateSettings({audit_logging_enabled:!s.audit_logging_enabled});
    else if(action==="search") s=await updateSettings({search_enabled:!s.search_enabled});
    else if(action==="stats") s=await updateSettings({statistics_enabled:!s.statistics_enabled});
    else if(action==="panel") s=await updateSettings({panel_single_message:!s.panel_single_message});
    else if(action==="session"){
      const vals=[5,15,30,60,120,360,720,1440],i=vals.indexOf(Number(s.admin_session_timeout_minutes));
      s=await updateSettings({admin_session_timeout_minutes:vals[(i+1)%vals.length]});
    } else if(action==="token"){
      const vals=[1,3,7,14,30],i=vals.indexOf(Number(s.token_expiry_days));
      s=await updateSettings({token_expiry_days:vals[(i+1)%vals.length]});
    } else if(action==="bot_delay"){
      const vals=[0,1,5,15,30,60,360,1440],i=vals.indexOf(Number(s.bot_messages_delay_minutes));
      s=await updateSettings({bot_messages_delay_minutes:vals[(i+1)%vals.length]});
    } else if(action==="user_delay"){
      const vals=[0,1,5,15,30,60,360,1440],i=vals.indexOf(Number(s.user_messages_delay_minutes));
      s=await updateSettings({user_messages_delay_minutes:vals[(i+1)%vals.length]});
    } else if(action==="cleanup_now"){
      const queued=await clearCleanupQueue(); let deleted=0,failed=0;
      for(const m of queued){try{await tg("deleteMessage",{chat_id:m.chat_id,message_id:m.message_id});deleted++;}catch(e){failed++;}}
      await editOrSend(chat,q,{text:`<b>TOZALASH BAJARILDI</b>

Navbat: <b>${queued.length}</b>
O‘chirildi: <b>${deleted}</b>
Muvaffaqiyatsiz: <b>${failed}</b>`,parse_mode:"HTML",reply_markup:kb([[{text:"Admin Settings",callback_data:"settings"}],[{text:"Bosh menyu",callback_data:"menu"}]])});
      return res.json({ok:true});
    }
    await editOrSend(chat,q,await settingsView());
    return res.json({ok:true});
   }
   if(data.startsWith("poster_upload:")){const gid=Number(data.slice(14));if(!Number.isSafeInteger(gid)||gid<1){await editOrSend(chat,q,{text:"<b>GIVEAWAY ID NOTO‘G‘RI</b>\n\nBu tugma eskirgan yoki yaroqsiz. Menyudan qayta urinib ko‘ring.",parse_mode:"HTML",reply_markup:kb([[{text:"Bosh menyu",callback_data:"menu"}]])});return res.json({ok:true});}const g=(await sql`SELECT id,title FROM giveaways WHERE id=${gid} AND created_by=${uid} LIMIT 1`)[0];if(!g){await editOrSend(chat,null,{text:"<b>GIVEAWAY TOPILMADI</b>",parse_mode:"HTML",reply_markup:backKeyboard("menu")});return res.json({ok:true});}await state(sql,uid,{state:"poster_wait",data:{giveawayId:gid}});await editOrSend(chat,q,{text:`<b>POSTER YUKLASH</b>\n\n<b>${esc(g.title)}</b>\n\nPoster rasmini shu chatga yuboring.\n\nPoster ixtiyoriy. Hozir yubormasangiz, quyidagi tugma orqali postersiz davom etishingiz mumkin.`,parse_mode:"HTML",reply_markup:kb([[{text:"Postersiz davom etish",callback_data:`poster_skip:${gid}`}],[{text:"Giveawayni boshqarish",callback_data:`g:${gid}`}],[{text:"Bosh menyu",callback_data:"menu"}]])});return res.json({ok:true});}
   if(data.startsWith("poster_skip:")){const gid=Number(data.slice(12));const g=(await sql`SELECT id,title,total_rounds,start_at FROM giveaways WHERE id=${gid} AND created_by=${uid} LIMIT 1`)[0];if(!g){await editOrSend(chat,null,{text:"<b>GIVEAWAY TOPILMADI</b>",parse_mode:"HTML",reply_markup:backKeyboard("menu")});return res.json({ok:true});}await state(sql,uid,{state:"idle",data:{}});await editOrSend(chat,q,{text:`<b>GIVEAWAY SAQLANDI</b>\n\n<b>${esc(g.title)}</b>\n\nG‘oliblar: <b>${Number(g.total_rounds)} ta</b>\nBoshlanish: <b>${formatTashkent(new Date(g.start_at))}</b>\nVaqt zonasi: <b>Toshkent (UTC+5)</b>\nPoster: <b>yo‘q</b>\n\nGiveaway postersiz tayyor. Posterni keyinroq ham qo‘shishingiz mumkin.`,parse_mode:"HTML",reply_markup:kb([[{text:"Giveawayni boshqarish",callback_data:`g:${gid}`}],[{text:"Keyin poster qo‘shish",callback_data:`poster_upload:${gid}`}],[{text:"Giveawaylar",callback_data:"list:0"}],[{text:"Bosh menyu",callback_data:"menu"}]])});return res.json({ok:true});}
   if(data==="cancel_create"){await state(sql,uid,{state:"idle",data:{}});await editOrSend(chat,q,{text:"<b>YARATISH BEKOR QILINDI</b>\n\nGiveaway yaratish jarayoni bekor qilindi.",parse_mode:"HTML",reply_markup:kb([[{text:"Giveaway yaratish",callback_data:"new"}],[{text:"Bosh menyu",callback_data:"menu"}]])});return res.json({ok:true});}
   if(data==="pick_date") {
    const now=tashkentParts(); await state(sql,uid,{state:"date_pick",data:{...(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0]?.data||{},calendarYear:Number(now.year),calendarMonth:Number(now.month)}});
    await editOrSend(chat,q,{text:"<b>4 / 4 — Boshlanish sanasi</b>\n\nKalendar orqali kunni tanlang.\n\n<blockquote>Toshkent vaqti — UTC+5.</blockquote>",parse_mode:"HTML",reply_markup:calendar(Number(now.year),Number(now.month))});return res.json({ok:true});
   }
   if(data.startsWith("calm:")){const [y,m]=data.slice(5).split("-").map(Number);await tg("editMessageReplyMarkup",{chat_id:chat,message_id:q.message?.message_id,reply_markup:calendar(y,m)});return res.json({ok:true});}
   if(data.startsWith("cal:")){const date=data.slice(4);const sess=(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0];const d={...(sess?.data||{}),date};await state(sql,uid,{state:"time_pick",data:d});await tg("editMessageText",{chat_id:chat,message_id:q.message?.message_id,text:`<b>4 / 4 — Boshlanish vaqti</b>\n\nSana: <code>${date}</code>\n\nEndi boshlanish vaqtini tanlang.`,parse_mode:"HTML",reply_markup:timeKeyboard()});return res.json({ok:true});}
   if(data==="pick_time"){await state(sql,uid,{state:"time_pick",data:(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0]?.data||{}});await editOrSend(chat,q,{text:"<b>Boshlanish vaqti</b>\n\nToshkent vaqti <code>UTC+5</code>.",parse_mode:"HTML",reply_markup:timeKeyboard()});return res.json({ok:true});}
   if(data.startsWith("time:")){const time=data.slice(5);const sess=(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0];const d={...(sess?.data||{}),time};await state(sql,uid,{state:"preview",data:d});const dt=new Date(`${d.date}T${time}:00+05:00`);await tg("editMessageText",{chat_id:chat,message_id:q.message?.message_id,text:`<b>GIVEAWAY PREVIEW</b>\n\n<b>Nomi</b>\n${esc(d.title||"—")}\n\n<b>Tavsif</b>\n${esc(d.description||"—")}\n\n<b>G‘oliblar</b> · ${d.total_rounds||"—"} ta\n<b>Boshlanish</b> · <code>${formatTashkent(dt)}</code>\n<blockquote>Toshkent vaqti — UTC+5</blockquote>\n\nMa’lumotlar to‘g‘rimi?`,parse_mode:"HTML",reply_markup:previewKeyboard()});return res.json({ok:true});}
   if(data==="custom_time"){await state(sql,uid,{state:"custom_time",data:(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0]?.data||{}});await editOrSend(chat,q,{text:"<b>Boshqa vaqt</b>\n\nVaqtni <code>HH:MM</code> formatida yuboring.\nMasalan: <code>19:30</code>\n\n<blockquote>Toshkent vaqti — UTC+5.</blockquote>",parse_mode:"HTML",reply_markup:cancelKeyboard()});return res.json({ok:true});}
   if(data==="create_confirm"){const sess=(await sql`SELECT data FROM admin_sessions WHERE user_id=${uid}`)[0];const d=sess?.data||{};const dt=new Date(`${d.date}T${d.time}:00+05:00`);if(!d.title||!d.date||!d.time||Number.isNaN(dt.getTime())){await editOrSend(chat,null,{text:"<b>MA’LUMOTLAR TO‘LIQ EMAS</b>\n\nSanani va vaqtni qayta tanlang.",parse_mode:"HTML"});return res.json({ok:true});}const g=(await sql`INSERT INTO giveaways(title,description,total_rounds,status,start_at,created_by) VALUES(${d.title},${d.description||""},${d.total_rounds||5},'scheduled',${dt},${uid}) RETURNING id`)[0];await sql`INSERT INTO giveaway_state(id,giveaway_id,round,total_rounds,status,telegram_status,updated_at) VALUES(1,${g.id},1,${d.total_rounds||5},'scheduled','open',NOW()) ON CONFLICT(id) DO UPDATE SET giveaway_id=EXCLUDED.giveaway_id,total_rounds=EXCLUDED.total_rounds,status='scheduled',telegram_status='open',updated_at=NOW()`;await state(sql,uid,{state:"poster_choice",data:{giveawayId:g.id}});await editOrSend(chat,q,{text:`<b>GIVEAWAY TAYYOR</b>\n\n<b>${esc(d.title)}</b>\n\nG‘oliblar: <b>${d.total_rounds||5} ta</b>\nBoshlanish: <b>${formatTashkent(dt)}</b>\nVaqt zonasi: <b>Toshkent (UTC+5)</b>\n\n<b>Poster (ixtiyoriy)</b>\nGiveawayni postersiz ham davom ettirishingiz mumkin. Poster keyinroq ham qo‘shiladi.\n\n<blockquote>Kerakli amalni tanlang.</blockquote>`,parse_mode:"HTML",reply_markup:kb([[{text:"Poster yuborish",callback_data:`poster_upload:${g.id}`}],[{text:"Postersiz davom etish",callback_data:`poster_skip:${g.id}`}],[{text:"Giveawayni boshqarish",callback_data:`g:${g.id}`}],[{text:"Giveawaylar",callback_data:"list:0"}]])});return res.json({ok:true});}
   if(data.startsWith("list:")){
    const page=Number(data.split(":")[1]||0);
    const gs=await sql`SELECT id,title,total_rounds,status,start_at FROM giveaways ORDER BY created_at DESC LIMIT 200`;
    const pg=paginate(gs,page,8);
    const rows=pg.items.map(g=>[{text:`#${g.id} · ${g.title}`,callback_data:`g:${g.id}`}]);
    const nav=[];if(pg.page>0)nav.push({text:"‹ Oldingi",callback_data:`list:${pg.page-1}`});if(pg.page<pg.total-1)nav.push({text:"Keyingi ›",callback_data:`list:${pg.page+1}`});if(nav.length)rows.push(nav);rows.push([{text:"Bosh menyu",callback_data:"menu"}]);
    const body=pg.items.length?pg.items.map(g=>`<b>#${g.id}</b> · ${esc(g.title)}\nHolat: <code>${esc(statusLabel(g.status))}</code>\nBoshlanish: <code>${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:TZ})}</code>`).join("\n\n"):"Hali giveaway yo‘q.";
    await editOrSend(chat,q,{text:`<b>GIVEAWAYLARIM</b>\n\n${body}\n\n<code>${pg.page+1}/${pg.total}</code>`,parse_mode:"HTML",reply_markup:kb(rows)});return res.json({ok:true});
   }
   if(data.startsWith("start_confirm:")){
    const gid=Number(data.slice(14)),g=(await sql`SELECT id,title,status,total_rounds,start_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g)return res.json({ok:true});
    if(String(g.status)!=="scheduled"){await editOrSend(chat,null,{text:`<b>GIVEAWAYNI BOSHLAB BO‘LMAYDI</b>\n\nHolat: <code>${esc(statusLabel(g.status))}</code>`,parse_mode:"HTML",reply_markup:backKeyboard(`g:${gid}`)});return res.json({ok:true});}
    await editOrSend(chat,q,{text:`<b>GIVEAWAYNI BOSHLASH</b>\n\n<b>#${gid} · ${esc(g.title)}</b>\n\nIshtirokchilar: <b>${Number((await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=(SELECT created_at FROM giveaways WHERE id=${gid})`)[0].n)}</b>\nG‘oliblar: <b>${Number(g.total_rounds)}</b>\nBoshlanish vaqti: <code>${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:TZ})}</code>\n\nBaraban ishga tushiriladi. Tasdiqlaysizmi?`,parse_mode:"HTML",reply_markup:kb([[{text:"Ha, boshlash",callback_data:`start:${gid}`}],[{text:"Yo‘q, qaytish",callback_data:`g:${gid}`}]] )});return res.json({ok:true});
   }
   if(data.startsWith("close_confirm:")){
    const gid=Number(data.slice(14)),g=(await sql`SELECT id,title,status FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g)return res.json({ok:true});
    if(String(g.status)!=="scheduled"){await editOrSend(chat,q,{text:`<b>BU AMALNI BAJARIB BO‘LMAYDI</b>\n\nHolat: <code>${esc(statusLabel(g.status))}</code>\n\nFaqat rejalashtirilgan giveawayni bekor qilish mumkin.`,parse_mode:"HTML",reply_markup:backKeyboard(`g:${gid}`)});return res.json({ok:true});}
    await editOrSend(chat,q,{text:`<b>GIVEAWAYNI BEKOR QILISH</b>\n\n<b>#${gid} · ${esc(g.title)}</b>\n\nBu giveaway bekor qilinadi. Ishtirokchilar saqlanadi, lekin giveaway boshlanmaydi.\n\nTasdiqlaysizmi?`,parse_mode:"HTML",reply_markup:kb([[{text:"Ha, bekor qilish",callback_data:`close:${gid}`}],[{text:"Yo‘q, qaytish",callback_data:`g:${gid}`}]] )});return res.json({ok:true});
   }
   if(data.startsWith("close:")){
    const gid=Number(data.slice(6)),g=(await sql`SELECT id,title,status FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g)return res.json({ok:true});
    if(String(g.status)!=="scheduled"){await editOrSend(chat,q,{text:"Bu giveaway endi bekor qilinmaydi.",parse_mode:"HTML",reply_markup:backKeyboard(`g:${gid}`)});return res.json({ok:true});}
    await sql`UPDATE giveaways SET status='closed' WHERE id=${gid}`;
    await log({source:"bot",action:"giveaway-cancelled",adminUserId:uid,giveawayId:gid,meta:{previousStatus:g.status}});
    await editOrSend(chat,q,{text:`<b>GIVEAWAY BEKOR QILINDI</b>\n\n<b>#${gid} · ${esc(g.title)}</b>\n\nGiveaway boshlanmaydi.`,parse_mode:"HTML",reply_markup:kb([[{text:"Boshqaruv",callback_data:`g:${gid}`}],[{text:"Bosh menyu",callback_data:"menu"}]])});
    return res.json({ok:true});
   }
   if(data.startsWith("active:")){
    const page=Number(data.split(":")[1]||0);
    const gs=await sql`SELECT id,title,total_rounds,status,start_at FROM giveaways WHERE status IN ('scheduled','running') ORDER BY start_at ASC LIMIT 200`;
    const pg=paginate(gs,page,8);
    const rows=pg.items.map(g=>[{text:`#${g.id} · ${g.title}`,callback_data:`g:${g.id}`}]);
    const nav=[];if(pg.page>0)nav.push({text:"‹ Oldingi",callback_data:`active:${pg.page-1}`});if(pg.page<pg.total-1)nav.push({text:"Keyingi ›",callback_data:`active:${pg.page+1}`});if(nav.length)rows.push(nav);rows.push([{text:"Bosh menyu",callback_data:"menu"}]);
    const body=pg.items.length?pg.items.map(g=>`<b>#${g.id}</b> · ${esc(g.title)}\nHolat: <code>${esc(statusLabel(g.status))}</code>\nBoshlanish: <code>${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:TZ})}</code>`).join("\n\n"):"Hozir faol giveaway yo‘q.";
    await editOrSend(chat,q,{text:`<b>FAOL GIVEAWAYLAR</b>\n\n${body}\n\n<code>${pg.page+1}/${pg.total}</code>`,parse_mode:"HTML",reply_markup:kb(rows)});return res.json({ok:true});
   }
   if(data==="help"){
    await editOrSend(chat,q,{text:"<b>YORDAM · ADMIN</b>\n\n<b>Giveaway yaratish</b> — yangi giveawayni bosqichma-bosqich yarating.\n\n<b>Giveawaylarim</b> — barcha giveawaylarni topish va boshqarish.\n\n<b>Faol giveawaylar</b> — rejalashtirilgan va jarayondagi giveawaylarni tez topish.\n\n<b>Qatnashchilar</b> — faqat tanlangan giveaway ishtirokchilarini ko‘rsatadi.\n\n<b>GURUHGA POST QILISH</b> — inline rejim orqali postni kerakli guruhga yuboradi.\n\n<b>Bekor qilish</b> — rejalashtirilgan giveawayni tasdiqlash oynasi orqali bekor qiladi.\n\n<blockquote>Har bir bo‘limda “Orqaga” yoki “Bosh menyu” orqali tez qaytish mumkin.</blockquote>",parse_mode:"HTML",reply_markup:backKeyboard("menu")});return res.json({ok:true});
   }
   if(data.startsWith("history:")){
    const page=Number(data.split(":")[1]||0);
    const ws=await sql`SELECT w.giveaway_id,w.round,w.winner_label,w.won_at,g.title FROM giveaway_winners w JOIN giveaways g ON g.id=w.giveaway_id ORDER BY w.won_at DESC LIMIT 200`;
    const pg=paginate(ws,page,8);
    const nav=[];if(pg.page>0)nav.push({text:"‹ Oldingi",callback_data:`history:${pg.page-1}`});if(pg.page<pg.total-1)nav.push({text:"Keyingi ›",callback_data:`history:${pg.page+1}`});
    const rows=nav.length?[nav]:[];rows.push([{text:"Bosh menyu",callback_data:"menu"}]);
    const t=pg.items.length?pg.items.map(w=>`<b>#${w.giveaway_id} · ${esc(w.title)}</b>\nRound <code>${w.round}</code> · <b>${esc(w.winner_label)}</b>\n<blockquote>${new Date(w.won_at).toLocaleString("uz-UZ",{timeZone:TZ})}</blockquote>`).join("\n\n"):"Hali g‘oliblar tarixi yo‘q.";
    await editOrSend(chat,q,{text:`<b>G‘OLIBLAR TARIXI</b>\n\n${t}\n\n<code>${pg.page+1}/${pg.total}</code>`,parse_mode:"HTML",reply_markup:kb(rows)});return res.json({ok:true});
   }
   if(data==="menu"){await menu(chat);return res.json({ok:true});}
   if(data.startsWith("g:")){
    const gid=Number(data.slice(2)),g=(await sql`SELECT * FROM giveaways WHERE id=${gid}`)[0];
    if(!g)return res.json({ok:true});
    const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=(SELECT created_at FROM giveaways WHERE id=${gid})`)[0].n;
    const panelSettings=await getSettings();\n    const panelToken=makePanelToken(gid,uid,Number(panelSettings.admin_session_timeout_minutes)*60);
    const base=String(process.env.PUBLIC_BASE_URL||"").replace(/\/$/,"");
    if(!/^https:\/\//i.test(base)) throw Object.assign(new Error("PUBLIC_BASE_URL HTTPS bo‘lishi kerak"),{statusCode:500});
    const url=`${base}/manage.html#token=${encodeURIComponent(panelToken)}`;
    const watchToken=await makeStartApp(gid,"watch");
    const watch=`https://t.me/${process.env.BOT_USERNAME||"ramzestetbot"}/giveaway?startapp=${encodeURIComponent(watchToken)}`;
    await editOrSend(chat,q,{text:`<b>GIVEAWAY #${gid}</b>\n\n<b>${esc(g.title)}</b>\n\n<code>Ishtirokchilar</code> · <b>${c}</b>\n<code>G‘oliblar</code> · <b>${g.total_rounds}</b>\n<code>Boshlanish</code> · <code>${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:TZ})}</code>\n<code>Holat</code> · <b>${esc(statusLabel(g.status))}</b>\n\n<blockquote>Postni yuborish uchun “GURUHGA POST QILISH” tugmasini bosing.</blockquote>`,parse_mode:"HTML",reply_markup:kb([
      [{text:"GURUHGA POST QILISH",switch_inline_query:`giveaway:${gid}`}],
      [{text:"Qatnashchilar",callback_data:`p:${gid}:0`}],
      [{text:"Boshlash",callback_data:`start_confirm:${gid}`}],
      [{text:"Boshqaruv paneli",url:url}],
      [{text:"Tomosha qilish",url:watch}], ...(String(g.status)==="scheduled"?[[{text:"Giveawayni bekor qilish",callback_data:`close_confirm:${gid}`}]]:[]), [{text:"Bosh menyu",callback_data:"menu"}]
    ])});return res.json({ok:true});
   }
   if(data.startsWith("p:")){
    const parts=data.split(":"),gid=Number(parts[1]),page=Number(parts[2]||0);
    const ps=await sql`SELECT username,first_name,user_id,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=(SELECT created_at FROM giveaways WHERE id=${gid}) ORDER BY joined_at DESC LIMIT 200`;
    const pg=paginate(ps,page,8);
    const rows=[];const nav=[];if(pg.page>0)nav.push({text:"‹ Oldingi",callback_data:`p:${gid}:${pg.page-1}`});if(pg.page<pg.total-1)nav.push({text:"Keyingi ›",callback_data:`p:${gid}:${pg.page+1}`});if(nav.length)rows.push(nav);rows.push([{text:"Orqaga",callback_data:`g:${gid}`}]);
    const t=pg.items.length?pg.items.map((p,i)=>`<b>${pg.page*8+i+1}.</b> ${esc(p.username?`@${p.username}`:p.first_name||p.user_id)}\n<blockquote>${new Date(p.joined_at).toLocaleString("uz-UZ",{timeZone:TZ})}</blockquote>`).join("\n\n"):"Hali qatnashchi yo‘q.";
    await editOrSend(chat,q,{text:`<b>QATNASHCHILAR · #${gid}</b>\n\n${t}\n\n<code>${pg.page+1}/${pg.total}</code>`,parse_mode:"HTML",reply_markup:kb(rows)});return res.json({ok:true});
   }
   if(data.startsWith("start:")){
    const gid=Number(data.slice(6));
    const fake={method:"POST",body:{action:"start"},headers:{"x-admin-secret":process.env.ADMIN_SECRET},query:{gid}};
    const r={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this}};
    const handler=require("./giveaway"); await handler(fake,r);
    await editOrSend(chat,q,{text:r.statusCode>=400?`<b>XATOLIK</b>\n\n${esc(r.data?.error||"Xatolik")}`:"<b>GIVEAWAY BOSHLANDI</b>\n\nBaraban realtime rejimda ishga tushdi." ,parse_mode:"HTML"});
    return res.json({ok:true});
   }
  }

  const m=u.message;if(!m)return res.json({ok:true});const chat=m.chat.id,uid=m.from?.id,text=String(m.text||"").trim();
  if(!isAdminTelegramUser(uid)){return res.json({ok:true});}
  await log({source:'bot',action:'message',adminUserId:uid,meta:{text:text.slice(0,120)}});
  if(text==="/start" || text==="/menu"){await menu(chat);return res.json({ok:true});}
  if(text==="/help"){await editOrSend(chat,null,{text:"<b>RAMZ ESTET · YORDAM</b>\n\n<b>/menu</b> — bosh menyu\n<b>/cancel</b> — joriy yaratish jarayonini bekor qilish\n<b>/help</b> — yordam\n\nAdmin paneldagi har bir bosqichda “Bekor qilish” tugmasi ham mavjud.",parse_mode:"HTML",reply_markup:backKeyboard("menu")});return res.json({ok:true});}
  if(text==="/cancel" || text.toLowerCase()==="bekor"){await state(sql,uid,{state:"idle",data:{}});await editOrSend(chat,null,{text:"<b>AMAL BEKOR QILINDI</b>\n\nJoriy amal to‘xtatildi. Kiritilgan vaqtinchalik ma’lumotlar tozalandi.",parse_mode:"HTML",reply_markup:kb([[{text:"Giveaway yaratish",callback_data:"new"}],[{text:"Bosh menyu",callback_data:"menu"}]])});return res.json({ok:true});}
  const sess=(await sql`SELECT * FROM admin_sessions WHERE user_id=${uid}`)[0];
  if(!sess){await menu(chat);return res.json({ok:true});}
  const d=sess.data||{};
  if(sess.state==="title"){
    d.title=text;await state(sql,uid,{state:"description",data:d});
    await editOrSend(chat,null,{text:"<b>2 / 4 — Tavsif</b>\n\nQisqa tavsif yuboring. O‘tkazib yuborish uchun <code>-</code> yuboring.",parse_mode:"HTML",reply_markup:cancelKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="description"){
    d.description=text==="-"?"":text;await state(sql,uid,{state:"rounds",data:d});
    await editOrSend(chat,null,{text:"<b>3 / 4 — G‘oliblar soni</b>\n\n1 dan 50 gacha son yuboring.",parse_mode:"HTML",reply_markup:cancelKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="rounds"){
    const n=Math.max(1,Math.min(50,Number(text)||5));d.total_rounds=n;const now=tashkentParts();await state(sql,uid,{state:"date_pick",data:{...d,calendarYear:Number(now.year),calendarMonth:Number(now.month)}});await editOrSend(chat,null,{text:"📅 <b>Endi boshlanish kunini tanlang</b>\n\nKalendar orqali tanlang. Vaqt Toshkent vaqti bilan.",parse_mode:"HTML",reply_markup:calendar(Number(now.year),Number(now.month))});return res.json({ok:true});
  }
  if(sess.state==="date_pick"){
    await editOrSend(chat,null,{text:"Kunni yuqoridagi kalendardan tanlang.",reply_markup:cancelKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="time_pick"){
    await editOrSend(chat,null,{text:"Vaqtni yuqoridagi tugmalardan tanlang.",reply_markup:cancelKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="custom_time"){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)){await editOrSend(chat,null,{text:"<b>Vaqt formati noto‘g‘ri.</b>\n\nMasalan: <code>19:30</code>",parse_mode:"HTML"});return res.json({ok:true});}
    d.time=text;await state(sql,uid,{state:"preview",data:d});const dt=new Date(`${d.date}T${d.time}:00+05:00`);await editOrSend(chat,null,{text:`🧾 <b>Giveaway preview</b>\n\n🎁 ${esc(d.title||"—")}\n📄 ${esc(d.description||"—")}\n🏆 ${d.total_rounds||"—"} ta g‘olib\n📅 ${formatTashkent(dt)}\n🌍 Toshkent (UTC+5)\n\nHammasi to‘g‘rimi?`,parse_mode:"HTML",reply_markup:previewKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="preview"){
    await editOrSend(chat,null,{text:"Preview yuqorida. Tasdiqlash tugmasini bosing."});return res.json({ok:true});
  }
  if(sess.state==="date"){
    d.date=text;await state(sql,uid,{state:"time_pick",data:d});await editOrSend(chat,null,{text:"<b>Boshlanish vaqti</b>\n\nToshkent vaqti — UTC+5.",parse_mode:"HTML",reply_markup:timeKeyboard()});return res.json({ok:true});
  }
  if(sess.state==="time"){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)){await editOrSend(chat,null,{text:"<b>Vaqt formati noto‘g‘ri.</b>\n\nMasalan: <code>19:30</code>",parse_mode:"HTML"});return res.json({ok:true});}
    d.time=text;await state(sql,uid,{state:"preview",data:d});const dt=new Date(`${d.date}T${d.time}:00+05:00`);await editOrSend(chat,null,{text:`🧾 <b>Giveaway preview</b>\n\n🎁 ${esc(d.title||"—")}\n📄 ${esc(d.description||"—")}\n🏆 ${d.total_rounds||"—"} ta g‘olib\n📅 ${formatTashkent(dt)}\n🌍 Toshkent (UTC+5)\n\nHammasi to‘g‘rimi?`,parse_mode:"HTML",reply_markup:previewKeyboard()});return res.json({ok:true});
  }
  // Optional poster upload.
  if(m.photo?.length){
    const posterSession=(await sql`SELECT state,data FROM admin_sessions WHERE user_id=${uid}`)[0];
    const targetId=posterSession?.state==="poster_wait"?Number(posterSession?.data?.giveawayId||0):0;
    const latest=targetId
      ? (await sql`SELECT id FROM giveaways WHERE id=${targetId} AND created_by=${uid} LIMIT 1`)[0]
      : (await sql`SELECT id FROM giveaways WHERE created_by=${uid} ORDER BY created_at DESC LIMIT 1`)[0];
    if(latest){
      const fid=m.photo[m.photo.length-1].file_id;
      await sql`UPDATE giveaways SET image_file_id=${fid} WHERE id=${latest.id}`;
      await state(sql,uid,{state:"idle",data:{}});
      const pg=(await sql`SELECT id,title,description,total_rounds,start_at FROM giveaways WHERE id=${latest.id}`)[0];
      const joinToken=await makeStartApp(latest.id,"join"),watchToken=await makeStartApp(latest.id,"watch");
      const baseBot=`https://t.me/${process.env.BOT_USERNAME||'ramzestetbot'}/giveaway`;
      const previewButtons=kb([[{text:"QATNASHISH",url:`${baseBot}?startapp=${encodeURIComponent(joinToken)}`}],[{text:"BARABANNI TOMOSHA QILISH",url:`${baseBot}?startapp=${encodeURIComponent(watchToken)}`}],[{text:"GURUHGA POST QILISH",switch_inline_query:`giveaway:${latest.id}`}],[{text:"BOSHQARISH",callback_data:`g:${latest.id}`}],[{text:"BOSH MENYU",callback_data:"menu"}]]);
      const caption=`<b>${esc(pg.title)}</b>\n\n${esc(pg.description||"Giveawayga qatnashing!") }\n\n<b>G‘oliblar:</b> ${Number(pg.total_rounds)} ta\n<b>Boshlanish:</b> <code>${formatTashkent(new Date(pg.start_at))}</code>\n\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
      await tg("sendPhoto",{chat_id:chat,photo:fid,caption,parse_mode:"HTML",reply_markup:previewButtons});
    }
    return res.json({ok:true});
  }
  await menu(chat);return res.json({ok:true});
 }catch(e){
   console.error(e);
   let updateType='unknown';
   try{
     const raw=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
     updateType=raw.callback_query?'callback_query':raw.message?'message':raw.inline_query?'inline_query':raw.chosen_inline_result?'chosen_inline_result':'unknown';
   }catch(_){}
   await error({source:'bot',action:'telegram-webhook',error:e,meta:{method:req.method,path:req.url,updateType}});
   res.status(500).json({error:'Internal server error'});
 }
};
