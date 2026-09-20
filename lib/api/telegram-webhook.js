const {db}=require("./_db");
const {tg,esc}=require("./_telegram");
const {makeStartApp,makePanelToken}=require("./_security");
const TZ="Asia/Tashkent";
function kb(rows){return {inline_keyboard:rows};}
async function menu(chat){
 return tg("sendMessage",{chat_id:chat,text:"🎛 <b>RAMZ ESTET ADMIN</b>\n\nKerakli bo‘limni tanlang:",parse_mode:"HTML",reply_markup:kb([
 [{text:"➕ Giveaway yaratish",callback_data:"new"}],
 [{text:"📋 Giveawaylarim",callback_data:"list"}],
 [{text:"🏆 G‘oliblar tarixi",callback_data:"history"}]
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
  if(u.inline_query){
    const iq=u.inline_query,iqUid=iq.from?.id,query=String(iq.query||'').trim();
    // Inline mode is authenticated by Telegram itself. We additionally require
    // that the requested giveaway belongs to the querying Telegram user, so
    // ADMIN_TELEGRAM_ID is not a blocker when it is missing/misconfigured.
    const m=query.match(/^(?:giveaway:|post:|#?)(\d+)$/i);
    if(!m) return res.json({ok:true,results:[],cache_time:0,is_personal:true});
    const gid=Number(m[1]);
    const g=(await sql`SELECT id,title,description,total_rounds,start_at,status,image_file_id FROM giveaways WHERE id=${gid} AND created_by=${iqUid} LIMIT 1`)[0];
    if(!g) return res.json({ok:true,results:[],cache_time:0,is_personal:true});
    const joinToken=makeStartApp(gid,'join'),watchToken=makeStartApp(gid,'watch');
    const joinUrl=`https://t.me/${process.env.BOT_USERNAME||'ramzestetbot'}/giveaway?startapp=${encodeURIComponent(joinToken)}`;
    const watchUrl=`https://t.me/${process.env.BOT_USERNAME||'ramzestetbot'}/giveaway?startapp=${encodeURIComponent(watchToken)}`;
    const text=`🎉 <b>${esc(g.title)}</b>\n\n${esc(g.description||'Giveawayga qatnashing!')}\n\n🏆 ${Number(g.total_rounds)} ta g‘olib\n🕐 ${new Date(g.start_at).toLocaleString('uz-UZ',{timeZone:TZ})}\n\n🎡 G‘olib server tomonidan tasodifiy aniqlanadi.`;
    return res.json({ok:true,results:[{type:'article',id:`giveaway_${gid}_${Date.now()}`,title:`🎉 ${g.title}`,description:'Giveaway postini yuborish',input_message_content:{message_text:text,parse_mode:'HTML'},reply_markup:{inline_keyboard:[[{text:'🎉 QATNASHISH',url:joinUrl}],[{text:'👁 BARABAN AYLANISHINI TOMOSHA QILISH',url:watchUrl}]]}}],cache_time:0,is_personal:true});
  }
  if(u.chosen_inline_result)return res.json({ok:true});
  if(u.callback_query){
   const q=u.callback_query,data=String(q.data||""),chat=q.message?.chat?.id,uid=q.from?.id;
   if(String(uid)!==admin){await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Faqat admin.",show_alert:true});return res.json({ok:true});}
   await tg("answerCallbackQuery",{callback_query_id:q.id});
   if(data==="new"){
    await state(sql,uid,{state:"title",data:{}});
    await tg("sendMessage",{chat_id:chat,text:"🎁 Giveaway nomini yuboring:"}); return res.json({ok:true});
   }
   if(data==="list"){
    const gs=await sql`SELECT id,title,total_rounds,status,start_at FROM giveaways WHERE created_by=${uid} ORDER BY created_at DESC LIMIT 30`;
    const rows=gs.map(g=>[{text:`#${g.id} ${g.title} — ${g.status}`,callback_data:`g:${g.id}`}]);
    rows.push([{text:"🏠 Menu",callback_data:"menu"}]);
    await tg("sendMessage",{chat_id:chat,text:gs.length?"📋 <b>Giveawaylarim</b>":"Hali giveaway yo‘q.",parse_mode:"HTML",reply_markup:kb(rows)});return res.json({ok:true});
   }
   if(data==="history"){
    const ws=await sql`SELECT w.giveaway_id,w.round,w.winner_label,w.won_at,g.title FROM giveaway_winners w JOIN giveaways g ON g.id=w.giveaway_id WHERE g.created_by=${uid} ORDER BY w.won_at DESC LIMIT 100`;
    const t=ws.length?ws.map(w=>`🏆 #${w.giveaway_id} ${esc(w.title)}\nRound ${w.round}: <b>${esc(w.winner_label)}</b>\n🕒 ${new Date(w.won_at).toLocaleString("uz-UZ",{timeZone:TZ})}`).join("\n\n"):"Hali g‘oliblar tarixi yo‘q.";
    await tg("sendMessage",{chat_id:chat,text:`🏆 <b>G‘oliblar tarixi</b>\n\n${t}`,parse_mode:"HTML"});return res.json({ok:true});
   }
   if(data==="menu"){await menu(chat);return res.json({ok:true});}
   if(data.startsWith("g:")){
    const gid=Number(data.slice(2)),g=(await sql`SELECT * FROM giveaways WHERE id=${gid} AND created_by=${uid}`)[0];
    if(!g)return res.json({ok:true});
    const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
    const panelToken=makePanelToken(gid,uid);
    const base=String(process.env.PUBLIC_BASE_URL||"").replace(/\/$/,"");
    if(!/^https:\/\//i.test(base)) throw Object.assign(new Error("PUBLIC_BASE_URL HTTPS bo‘lishi kerak"),{statusCode:500});
    const url=`${base}/manage.html#token=${encodeURIComponent(panelToken)}`;
    const watchToken=makeStartApp(gid,"watch");
    const watch=`https://t.me/${process.env.BOT_USERNAME||"ramzestetbot"}/giveaway?startapp=${encodeURIComponent(watchToken)}`;
    await tg("sendMessage",{chat_id:chat,text:`🎁 <b>#${gid} ${esc(g.title)}</b>\n\n👥 ${c}\n🏆 ${g.total_rounds} g‘olib\n🕐 ${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:TZ})}\n\nHolat: <b>${esc(g.status)}</b>\n\n📌 Post qilish uchun quyidagi tugmani bosing va kerakli chatda inline natijani yuboring.`,parse_mode:"HTML",reply_markup:kb([
      [{text:"📤 GURUHGA POST QILISH",switch_inline_query:`giveaway:${gid}`}],
      [{text:"👥 Qatnashchilar",callback_data:`p:${gid}`}],
      [{text:"▶️ Boshlash",callback_data:`start:${gid}`}],
      [{text:"🌐 Boshqaruv paneli",url:url}],
      [{text:"👁 Tomosha qilish",url:watch}]
    ])});return res.json({ok:true});
   }
   if(data.startsWith("p:")){
    const gid=Number(data.slice(2)),ps=await sql`SELECT username,first_name,user_id,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at DESC`;
    const t=ps.length?ps.map((p,i)=>`${i+1}. ${esc(p.username?`@${p.username}`:p.first_name||p.user_id)} — ${new Date(p.joined_at).toLocaleString("uz-UZ",{timeZone:TZ})}`).join("\n"):"Hali qatnashchi yo‘q.";
    await tg("sendMessage",{chat_id:chat,text:`👥 <b>Qatnashchilar #${gid}</b>\n\n${t}`,parse_mode:"HTML"});return res.json({ok:true});
   }
   if(data.startsWith("start:")){
    const gid=Number(data.slice(6));
    const fake={method:"POST",body:{action:"start"},headers:{"x-admin-secret":process.env.ADMIN_SECRET},query:{gid}};
    const r={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this}};
    const handler=require("./giveaway"); await handler(fake,r);
    await tg("sendMessage",{chat_id:chat,text:r.statusCode>=400?`❌ ${esc(r.data?.error||"Xatolik")}`:"🎡 Giveaway boshlandi!" ,parse_mode:"HTML"});
    return res.json({ok:true});
   }
  }

  const m=u.message;if(!m)return res.json({ok:true});const chat=m.chat.id,uid=m.from?.id,text=String(m.text||"").trim();
  if(String(uid)!==admin){await tg("sendMessage",{chat_id:chat,text:"Bu bot admin boshqaruvi uchun."});return res.json({ok:true});}
  if(text==="/start"){await menu(chat);return res.json({ok:true});}
  const sess=(await sql`SELECT * FROM admin_sessions WHERE user_id=${uid}`)[0];
  if(!sess){await menu(chat);return res.json({ok:true});}
  const d=sess.data||{};
  if(sess.state==="title"){
    d.title=text;await state(sql,uid,{state:"description",data:d});
    await tg("sendMessage",{chat_id:chat,text:"📄 Opisaniyani yuboring (o‘tkazib yuborish uchun -):"});return res.json({ok:true});
  }
  if(sess.state==="description"){
    d.description=text==="-"?"":text;await state(sql,uid,{state:"rounds",data:d});
    await tg("sendMessage",{chat_id:chat,text:"🏆 G‘oliblar soni? (1–50)"});return res.json({ok:true});
  }
  if(sess.state==="rounds"){
    const n=Math.max(1,Math.min(50,Number(text)||5));d.total_rounds=n;await state(sql,uid,{state:"date",data:d});
    await tg("sendMessage",{chat_id:chat,text:"📅 Boshlanish sanasi (YYYY-MM-DD):"});return res.json({ok:true});
  }
  if(sess.state==="date"){
    d.date=text;await state(sql,uid,{state:"time",data:d});await tg("sendMessage",{chat_id:chat,text:"🕐 Boshlanish vaqti (HH:MM, Toshkent vaqti):"});return res.json({ok:true});
  }
  if(sess.state==="time"){
    d.time=text;
    const iso=`${d.date}T${d.time}:00+05:00`;
    const dt=new Date(iso);if(Number.isNaN(dt.getTime())){await tg("sendMessage",{chat_id:chat,text:"❌ Sana/vaqt noto‘g‘ri. Qayta yuboring."});return res.json({ok:true});}
    const g=(await sql`INSERT INTO giveaways(title,description,total_rounds,status,start_at,created_by) VALUES(${d.title},${d.description},${d.total_rounds},'scheduled',${dt},${uid}) RETURNING id`)[0];
    await sql`INSERT INTO giveaway_state(id,giveaway_id,round,total_rounds,status,telegram_status,updated_at) VALUES(1,${g.id},1,${d.total_rounds},'scheduled','open',NOW()) ON CONFLICT(id) DO UPDATE SET giveaway_id=EXCLUDED.giveaway_id,total_rounds=EXCLUDED.total_rounds,status='scheduled',telegram_status='open',updated_at=NOW()`;
    await state(sql,uid,{state:"idle",data:{}});
    await tg("sendMessage",{chat_id:chat,text:`✅ <b>Giveaway #${g.id} yaratildi</b>\n\n${esc(d.title)}\n🏆 ${d.total_rounds} ta g‘olib\n🕐 ${dt.toLocaleString("uz-UZ",{timeZone:TZ})}\n\nRasm yuborishingiz mumkin.`,parse_mode:"HTML",reply_markup:kb([
      [{text:"📤 Posterni yuborish",callback_data:`g:${g.id}`}],
      [{text:"📋 Giveawaylarim",callback_data:"list"}]
    ])});return res.json({ok:true});
  }
  // Photo upload after creation: save file_id into latest giveaway.
  if(m.photo?.length){
    const latest=(await sql`SELECT id FROM giveaways WHERE created_by=${uid} ORDER BY created_at DESC LIMIT 1`)[0];
    if(latest){
      const fid=m.photo[m.photo.length-1].file_id;
      await sql`UPDATE giveaways SET image_file_id=${fid} WHERE id=${latest.id}`;
      await tg("sendMessage",{chat_id:chat,text:`🖼 Rasm saqlandi.\nGiveaway #${latest.id} uchun poster yuborish tugmasini bosing.`});
    }
    return res.json({ok:true});
  }
  await menu(chat);return res.json({ok:true});
 }catch(e){console.error(e);res.status(500).json({error:e.message});}
};
