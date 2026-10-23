import { db } from '../lib/_db.js';
import { error: auditError } from '../lib/_audit.js';
import { tg,esc } from '../lib/_telegram.js';
import { makeStartApp } from '../lib/_security.js';
import { dueMessages,markDeleted,getSettings } from '../lib/_settings.js';
const TZ="Asia/Tashkent";
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
 try{
  if((globalThis.env?.CRON_SECRET || process?.env?.CRON_SECRET) && req.headers.authorization!==`Bearer ${(globalThis.env?.CRON_SECRET || process?.env?.CRON_SECRET)}`)return res.status(401).end();
  const sql=db(), now=new Date(), settings=await getSettings();
  // Automatic message cleanup. Runs from the same scheduled endpoint as notifications.
  const due=await dueMessages(100);
  for(const m of due){
    try{
      await tg("deleteMessage",{chat_id:Number(m.chat_id),message_id:Number(m.message_id)});
    }catch(e){
      const msg=String(e?.message||e);
      // Telegram already removed / cannot find the message: it is safe to forget the queue item.
      if(/message to delete not found|message can't be deleted|message is not found|MESSAGE_ID_INVALID/i.test(msg)){
        console.warn('[cleanup] message already unavailable:',msg);
      }else{
        await auditError({source:'cron',action:'message-cleanup',error:e,meta:{cleanupId:Number(m.id),chatId:Number(m.chat_id),messageId:Number(m.message_id),kind:m.kind}});
      }
    }
    await markDeleted(m.id);
  }
  // Optional automatic giveaway start.
  if(settings.auto_start_enabled){
    const due=await sql`SELECT id FROM giveaways WHERE status='scheduled' AND start_at<=NOW() ORDER BY start_at ASC LIMIT 10`;
    for(const g of due){
      try{
        import handler from './giveaway.js';
        const fakeReq={method:"POST",body:{action:"start"},headers:{"x-admin-secret":(globalThis.env?.ADMIN_SECRET || process?.env?.ADMIN_SECRET)},query:{gid:Number(g.id)}};
        const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
        await handler(fakeReq,fakeRes);
        if(fakeRes.statusCode>=400) await auditError({source:"cron",action:"auto-start",giveawayId:Number(g.id),error:new Error(fakeRes.data?.error||"Auto start failed"),meta:{response:fakeRes.data||null}});
      }catch(e){await auditError({source:"cron",action:"auto-start",giveawayId:Number(g.id),error:e});}
    }
  }

  const gs=await sql`SELECT * FROM giveaways WHERE status='scheduled' AND start_at>NOW() AND start_at<NOW()+INTERVAL '16 minutes'`;
  for(const g of gs){
    const mins=Math.round((new Date(g.start_at)-now)/60000);
    const mark=mins<=2?"2m":mins<=5?"5m":mins<=15?"15m":null;
    if(!settings.reminders_enabled || (mark==="15m"&&!settings.reminder_15m) || (mark==="5m"&&!settings.reminder_5m) || (mark==="2m"&&!settings.reminder_2m)) continue;
    if(!mark)continue;
    const key=`notify_${mark}`;
    const already=await sql`SELECT 1 FROM giveaway_notify_log WHERE giveaway_id=${g.id} AND marker=${mark} LIMIT 1`;
    if(already.length)continue;
    const ps=await sql`SELECT DISTINCT user_id FROM telegram_giveaway_participants WHERE giveaway_id=${g.id}`;
    const countdown=mark==="2m"?"2 DAQIQA QOLDI":mark==="5m"?"5 DAQIQA QOLDI":"15 DAQIQA QOLDI";
    const text=`<b>REMINDER</b>\n\n<b>⏳ ${countdown}</b>\n\n🎁 <b>${esc(g.title)}</b>\n<code>#${g.id}</code>\n\n📅 Boshlanish: <b>${new Intl.DateTimeFormat("uz-UZ",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(g.start_at))}</b>\n\n<blockquote>Giveaway tez orada boshlanadi. Tomosha qilish uchun tugmani bosing.</blockquote>`;
    const token=await makeStartApp(g.id,"watch");
    const url=`https://t.me/${(globalThis.env?.BOT_USERNAME || process?.env?.BOT_USERNAME)||"ramzestetbot"}/giveaway?startapp=${encodeURIComponent(token)}`;
    for(const p of ps){try{await tg("sendMessage",{chat_id:p.user_id,text,parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"👁 Tomosha qilish",url}]]}})}catch(e){await auditError({source:'cron',action:'winner-notification',error:e,meta:{recipientUserId:Number(p.user_id),giveawayId:g.id}});}}
    await sql`INSERT INTO giveaway_notify_log(giveaway_id,marker) VALUES(${g.id},${mark})`;
  }
  res.json({ok:true});
 }catch(e){await auditError({source:'api',action:'cron-notify',error:e,meta:{method:req.method,path:req.url}});res.status(500).json({error:e.message});}
};
