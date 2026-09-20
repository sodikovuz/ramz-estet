const {db}=require("./_db");
const {tg}=require("./_telegram");

module.exports=async function(req,res){
 try{
  if(req.method!=="POST") return res.status(405).end();
  const u=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const sql=db();
  const admin=String(process.env.ADMIN_TELEGRAM_ID||"");

  if(u.callback_query){
   const q=u.callback_query, data=String(q.data||"");
   if(data.startsWith("join:")){
    const gid=Number(data.split(":")[1]);
    const s=(await sql`SELECT total_rounds,telegram_chat_id,telegram_message_id,telegram_status FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0];
    if(!s) { await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Giveaway topilmadi.",show_alert:true}); return res.json({ok:true}); }
    if(s.telegram_status!=="open"){ await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Giveaway yopilgan.",show_alert:true}); return res.json({ok:true}); }
    await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${q.from.id},${q.from.username||null},${q.from.first_name||""})
      ON CONFLICT(giveaway_id,user_id) DO NOTHING`;
    const c=(await sql`SELECT COUNT(*)::int AS n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
    await tg("answerCallbackQuery",{callback_query_id:q.id,text:"✅ Giveawayga qo‘shildingiz!"});
    if(s.telegram_chat_id&&s.telegram_message_id)
      await tg("editMessageReplyMarkup",{chat_id:s.telegram_chat_id,message_id:s.telegram_message_id,
        reply_markup:{inline_keyboard:[[{text:`🎉 Giveawayga qo‘shilish (${c})`,callback_data:`join:${gid}`}]]}});
   }
   return res.json({ok:true});
  }

  const m=u.message;
  if(!m?.text) return res.json({ok:true});
  const chat=m.chat.id, uid=m.from?.id, text=String(m.text).trim();
  if(text==="/start"){
   await tg("sendMessage",{chat_id:chat,text:String(uid)===admin
    ?"Admin: /giveaway 5 — yaratish\n/startwheel — boshlash\n/close — yopish"
    :"Admin yuborgan giveaway postidagi 🎉 tugmani bosing."});
   return res.json({ok:true});
  }
  if(String(uid)!==admin){
   await tg("sendMessage",{chat_id:chat,text:"Bu buyruq faqat admin uchun."});
   return res.json({ok:true});
  }

  if(text.startsWith("/giveaway")){
   const rounds=Math.max(1,Math.min(5,Number(text.split(/\s+/)[1])||5));
   const mx=(await sql`SELECT COALESCE(MAX(giveaway_id),0) AS n FROM giveaway_state`)[0].n;
   const gid=Number(mx)+1;
   await sql`INSERT INTO giveaway_state(id,giveaway_id,round,total_rounds,status,telegram_status,winners,participants,updated_at)
     VALUES(1,${gid},1,${rounds},'idle','open','[]'::jsonb,'[]'::jsonb,NOW())
     ON CONFLICT(id) DO UPDATE SET giveaway_id=EXCLUDED.giveaway_id,round=1,total_rounds=EXCLUDED.total_rounds,
     status='idle',telegram_status='open',winners='[]'::jsonb,participants='[]'::jsonb,updated_at=NOW()`;
   await sql`DELETE FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`;
   const msg=await tg("sendMessage",{chat_id:chat,
    text:`🎁 <b>RAMZ ESTET GIVEAWAY</b>\n\n🎯 G‘oliblar: <b>${rounds}</b>\n👥 Ishtirokchilar: <b>0</b>\n\nGiveawayga qo‘shiling 👇`,
    parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"🎉 Giveawayga qo‘shilish (0)",callback_data:`join:${gid}`}]]}});
   await sql`UPDATE giveaway_state SET telegram_chat_id=${chat},telegram_message_id=${msg.message_id} WHERE id=1`;
   await tg("sendMessage",{chat_id:chat,text:`✅ Giveaway #${gid} yaratildi. Participantlar yig‘ilgach /startwheel bosing.`});
   return res.json({ok:true});
  }

  if(text==="/startwheel"){
   const s=(await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`)[0];
   if(!s) throw new Error("Giveaway yaratilmagan");
   const ps=await sql`SELECT username,first_name,user_id FROM telegram_giveaway_participants WHERE giveaway_id=${Number(s.giveaway_id)} ORDER BY joined_at`;
   const participants=ps.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
   if(participants.length<Number(s.total_rounds)) throw new Error(`Kam participant: ${participants.length}/${s.total_rounds}`);
   await sql`UPDATE giveaway_state SET telegram_status='closed' WHERE id=1`;
   const start=require("./start");
   const fakeReq={method:"POST",body:{participants,totalRounds:Number(s.total_rounds),durationMs:Number(s.duration_ms||8000)},headers:{"x-admin-secret":process.env.ADMIN_SECRET||""}};
   const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
   await start(fakeReq,fakeRes);
   if(fakeRes.statusCode>=400) throw new Error(fakeRes.data?.error||"Wheel start failed");
   await tg("sendMessage",{chat_id:chat,text:`🎡 Wheel boshlandi — ${participants.length} participant.`});
   return res.json({ok:true});
  }

  if(text==="/close"){
   await sql`UPDATE giveaway_state SET telegram_status='closed' WHERE id=1`;
   await tg("sendMessage",{chat_id:chat,text:"🔒 Giveaway yopildi."});
   return res.json({ok:true});
  }
  await tg("sendMessage",{chat_id:chat,text:"/giveaway 5\n/startwheel\n/close"});
  return res.json({ok:true});
 }catch(e){
  console.error(e);
  return res.status(500).json({error:e.message});
 }
};
