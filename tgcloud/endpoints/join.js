import { db } from '../lib/_db.js';
import { requireTelegram } from '../lib/_telegram-auth.js';
import { readStartApp } from '../lib/_security.js';
import { error: auditError } from '../lib/_audit.js';
import { ensureGroupSchema } from '../lib/_groups.js';
import Ably from 'ably';
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
  try{
    if(req.method!=='POST') return res.status(405).json({error:'POST only'});
    const auth=requireTelegram(req);
    const body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const token=String(body.startApp||auth.startParam||'');
    const access=await readStartApp(token,'join');
    if(!access) return res.status(403).json({error:'Join havolasi yaroqsiz yoki muddati tugagan'});
    const gid=access.gid, u=auth.user;
    const sql=db();
    await ensureGroupSchema(sql);
    const g=(await sql`SELECT id,title,description,total_rounds,start_at,status,image_file_id FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g) return res.status(404).json({error:'Giveaway topilmadi'});
    if(['closed','finished'].includes(String(g.status))) return res.status(409).json({error:'Bu giveaway yopilgan'});
    await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${Number(u.id)},${u.username||null},${u.first_name||null})
      ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name`;
    const rows=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at ASC`;
    const n=rows.length;
    const participantNames=rows.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
    // Group posts are sent directly with sendMessage/sendPhoto, so update the
    // exact chat message saved in giveaway_chat_posts after every successful join.
    const baseBot=`https://t.me/${(globalThis.env?.BOT_USERNAME || process?.env?.BOT_USERNAME)||"ramzestetbot"}/giveaway`;
    const joinMarkup={inline_keyboard:[[{text:'QATNASHISH',url:`${baseBot}?startapp=${encodeURIComponent(token)}`}]]};
    const groupPosts=await sql`SELECT chat_id,message_id FROM giveaway_chat_posts WHERE giveaway_id=${gid} AND message_id IS NOT NULL`;
    if(groupPosts.length){
      const postText=`<b>${String(g.title||'Giveaway')}</b>\n\n${String(g.description||'Giveawayga qatnashing!')}\n\n<b>Qatnashchilar:</b> ${Number(n)} ta\n<b>G‘oliblar:</b> ${Number(g.total_rounds)} ta\n<b>Boshlanish:</b> ${new Date(g.start_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}\n\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
      for(const p of groupPosts){
        try{
          const method=g.image_file_id?'editMessageCaption':'editMessageText';
          const payload=g.image_file_id
            ? {chat_id:Number(p.chat_id),message_id:Number(p.message_id),caption:postText,parse_mode:'HTML',reply_markup:joinMarkup}
            : {chat_id:Number(p.chat_id),message_id:Number(p.message_id),text:postText,parse_mode:'HTML',reply_markup:joinMarkup};
          await (await import('./_telegram')).tg(method,payload,{skipCleanup:true});
        }catch(e){
          console.error('[giveaway] group post participant update failed:',e?.message||e);
        }
      }
    }
    // Keep legacy inline-post support for any older posts that were tracked.
    const inlinePosts=await sql`SELECT inline_message_id FROM giveaway_inline_posts WHERE giveaway_id=${gid}`;
    if(inlinePosts.length){
      const token=(globalThis.env?.BOT_TOKEN || process?.env?.BOT_TOKEN);
      const inlineText=`<b>${String(g.title||'Giveaway')}</b>\n\n${String(g.description||'Giveawayga qatnashing!')}\n\n<b>Qatnashchilar:</b> ${Number(n)} ta\n<b>G‘oliblar:</b> ${Number(g.total_rounds)} ta\n<b>Boshlanish:</b> ${new Date(g.start_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}\n\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
      for(const p of inlinePosts){
        try{
          const r=await fetch(`https://api.telegram.org/bot${token}/editMessageText`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inline_message_id:p.inline_message_id,text:inlineText,parse_mode:'HTML'})});
          const d=await r.json();
          if(!d.ok && /message to edit not found|message identifier is not specified/i.test(String(d.description||''))){
            await sql`DELETE FROM giveaway_inline_posts WHERE giveaway_id=${gid} AND inline_message_id=${p.inline_message_id}`;
          }
        }catch(e){console.error('[giveaway] inline text update failed:',e?.message||e);}
      }
    }
    if((globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY)){
      try{await new Ably.Rest((globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY)).channels.get(`giveaway:${gid}`).publish('participants',{count:Number(n),participantNames});}catch(e){console.error('[giveaway] participant realtime publish failed:',e?.message||e);}
    }
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,joined:true,participantCount:Number(n),participantNames,giveawayTitle:String(g.title||''),message:'🎉 Siz “'+String(g.title||'Giveaway')+'” giveawayiga qo‘shildingiz — ismingiz barabanda!'});
  }catch(e){console.error(e);await auditError({source:'web',action:'join',adminUserId:null,giveawayId:null,error:e,meta:{method:req.method,path:req.url,telegramUserId:req.body?.user?.id||null}});res.status(e.statusCode||500).json({error:e.message||'Join error'});}
};
