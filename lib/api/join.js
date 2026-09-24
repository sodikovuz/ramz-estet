const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
const {error: auditError}=require('./_audit');
const {ensureGroupSchema}=require('./_groups');
const Ably=require('ably');
module.exports=async function(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'POST only'});
    const auth=requireTelegram(req);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const token=String(body.startApp||auth.startParam||'');
    const access=await readStartApp(token,'join');
    if(!access) return res.status(403).json({error:'Join havolasi yaroqsiz yoki muddati tugagan'});
    const gid=access.gid, u=auth.user;
    const sql=db();
    await ensureGroupSchema(sql);
    const g=(await sql`SELECT id,title,status,start_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g) return res.status(404).json({error:'Giveaway topilmadi'});
    if(['closed','finished'].includes(String(g.status))) return res.status(409).json({error:'Bu giveaway yopilgan'});
    await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${Number(u.id)},${u.username||null},${u.first_name||null})
      ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name`;
    const rows=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at ASC`;
    const n=rows.length;
    const participantNames=rows.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
    // Synchronize every inline-posted group message with the exact database count.
    const inlinePosts=await sql`SELECT inline_message_id FROM giveaway_inline_posts WHERE giveaway_id=${gid}`;
    if(process.env.BOT_TOKEN && inlinePosts.length){
      const token=process.env.BOT_TOKEN;
      const caption=`<b>${String(g.title||'Giveaway')}</b>\\n\\n${String(g.description||'Giveawayga qatnashing!')}\\n\\n<b>Qatnashchilar:</b> ${Number(n)} ta\\n<b>G‘oliblar:</b> ${Number(g.total_rounds)} ta\\n<b>Boshlanish:</b> ${new Date(g.start_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}\\n\\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
      for(const p of inlinePosts){
        try{
          const r=await fetch(`https://api.telegram.org/bot${token}/editMessageText`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inline_message_id:p.inline_message_id,text:caption,parse_mode:'HTML'})});
          const d=await r.json();
          if(!d.ok && !/message is not modified|there is no text/i.test(String(d.description||'')) && /message to edit not found|message identifier is not specified/i.test(String(d.description||''))){
            await sql`DELETE FROM giveaway_inline_posts WHERE giveaway_id=${gid} AND inline_message_id=${p.inline_message_id}`;
          }
        }catch(e){console.error('[giveaway] inline text update failed:',e?.message||e);}
        try{
          const r=await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inline_message_id:p.inline_message_id,caption,parse_mode:'HTML'})});
          const d=await r.json();
          if(!d.ok && /message to edit not found|message identifier is not specified/i.test(String(d.description||''))){
            await sql`DELETE FROM giveaway_inline_posts WHERE giveaway_id=${gid} AND inline_message_id=${p.inline_message_id}`;
          }
        }catch(e){console.error('[giveaway] inline caption update failed:',e?.message||e);}
      }
    }
    if(process.env.ABLY_API_KEY){
      try{await new Ably.Rest(process.env.ABLY_API_KEY).channels.get(`giveaway:${gid}`).publish('participants',{count:Number(n),participantNames});}catch(e){console.error('[giveaway] participant realtime publish failed:',e?.message||e);}
    }
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,joined:true,participantCount:Number(n),participantNames,giveawayTitle:String(g.title||''),message:'🎉 Siz “'+String(g.title||'Giveaway')+'” giveawayiga qo‘shildingiz — ismingiz barabanda!'});
  }catch(e){console.error(e);await auditError({source:'web',action:'join',adminUserId:null,giveawayId:null,error:e,meta:{method:req.method,path:req.url,telegramUserId:req.body?.user?.id||null}});res.status(e.statusCode||500).json({error:e.message||'Join error'});}
};
