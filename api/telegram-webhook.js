
const {db}=require("./_db");
const {tg}=require("./_telegram");
const {token,baseUrl}=require("./_util");

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function menu(){
  return {inline_keyboard:[
    [{text:"➕ Giveaway yaratish",callback_data:"admin:create"}],
    [{text:"📋 Giveawaylarim",callback_data:"admin:list"}],
    [{text:"🏆 G‘oliblar tarixi",callback_data:"admin:history"}]
  ]};
}
function controlButtons(gid,tok,status){
  const b=[
    [{text:"📤 Posterni yuborish",switch_inline_query:`giveaway:${gid}`}],
    [{text:"👥 Qatnashchilar",callback_data:`admin:participants:${gid}`}],
    [{text:"🏆 Natijalar",callback_data:`admin:winners:${gid}`}],
    [{text:"🌐 Boshqaruv paneli",web_app:{url:`${baseUrl()}/manage.html?gid=${gid}&token=${tok}`}}]
  ];
  if(status==="draft"||status==="active")b.push([{text:"🔒 Yopish",callback_data:`admin:close:${gid}`}]);
  return {inline_keyboard:b};
}
module.exports=async function(req,res){
 try{
  if(req.method!=="POST")return res.status(405).end();
  const u=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const sql=db(),admin=String(process.env.ADMIN_TELEGRAM_ID||"");

  // Inline query: admin can type @ramzestetbot giveaway:123 and send the exact giveaway.
  if(u.inline_query){
    const iq=u.inline_query;
    if(String(iq.from?.id)!==admin){
      await tg("answerInlineQuery",{inline_query_id:iq.id,results:[],cache_time:0,is_personal:true});
      return res.json({ok:true});
    }
    const q=String(iq.query||"").trim();
    const m=q.match(/^giveaway:(\d+)$/i);
    if(!m){
      await tg("answerInlineQuery",{inline_query_id:iq.id,results:[],cache_time:0,is_personal:true});
      return res.json({ok:true});
    }
    const gid=Number(m[1]);
    const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g){
      await tg("answerInlineQuery",{inline_query_id:iq.id,results:[],cache_time:0,is_personal:true});
      return res.json({ok:true});
    }
    const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
    const caption=`🎁 <b>${esc(g.title)}</b>\n\n${esc(g.description)}\n\n🎯 G‘oliblar: <b>${Number(g.total_rounds)}</b>\n👥 Ishtirokchilar: <b>${c}</b>\n\n👇 Giveawayga qo‘shiling`;
    const markup={inline_keyboard:[[{text:`🎉 Giveawayga qo‘shilish (${c})`,callback_data:`join:${gid}`}]]};
    let result;
    if(g.image_file_id){
      result={
        type:"photo",id:`giveaway-${gid}`,photo_file_id:g.image_file_id,
        title:g.title,description:g.description||"RAMZ ESTET Giveaway",
        caption,parse_mode:"HTML",reply_markup:markup
      };
    }else{
      result={
        type:"article",id:`giveaway-${gid}`,title:g.title,
        description:g.description||"RAMZ ESTET Giveaway",
        input_message_content:{message_text:caption,parse_mode:"HTML"},
        reply_markup:markup
      };
    }
    await tg("answerInlineQuery",{inline_query_id:iq.id,results:[result],cache_time:0,is_personal:true});
    return res.json({ok:true});
  }

  if(u.chosen_inline_result){
    const r=u.chosen_inline_result;
    const m=String(r.result_id||"").match(/^giveaway-(\d+)$/);
    if(m && String(r.from?.id)===admin){
      const gid=Number(m[1]);
      await sql`UPDATE giveaways SET posted_chat_id=NULL,posted_message_id=NULL WHERE id=${gid}`;
      // inline_message_id is the durable identifier Telegram gives to an inline-sent message.
      if(r.inline_message_id){
        await sql`UPDATE giveaway_state SET telegram_status='open',updated_at=NOW() WHERE id=1 AND giveaway_id=${gid}`;
      }
    }
    return res.json({ok:true});
  }

  // Callback buttons
  if(u.callback_query){
    const q=u.callback_query,data=String(q.data||"");

    if(data.startsWith("join:")){
      const gid=Number(data.split(":")[1]);
      const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
      if(!g){await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Giveaway topilmadi.",show_alert:true});return res.json({ok:true});}
      if(g.telegram_status!=="open"){await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Giveaway yopilgan.",show_alert:true});return res.json({ok:true});}
      await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
        VALUES(${gid},${q.from.id},${q.from.username||null},${q.from.first_name||""})
        ON CONFLICT(giveaway_id,user_id) DO NOTHING`;
      const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
      await tg("answerCallbackQuery",{callback_query_id:q.id,text:"✅ Giveawayga qo‘shildingiz!"});
      const msg=q.message,inlineId=q.inline_message_id;
      const caption=`🎁 <b>${esc(g.title)}</b>\n\n${esc(g.description)}\n\n🎯 G‘oliblar: <b>${Number(g.total_rounds)}</b>\n👥 Ishtirokchilar: <b>${c}</b>\n\n👇 Giveawayga qo‘shiling`;
      const markup={inline_keyboard:[[{text:`🎉 Giveawayga qo‘shilish (${c})`,callback_data:`join:${gid}`}]]};
      if(inlineId){
        try{
          if(g.image_file_id){
            await tg("editMessageCaption",{inline_message_id:inlineId,caption,parse_mode:"HTML",reply_markup:markup});
          }else{
            await tg("editMessageText",{inline_message_id:inlineId,text:caption,parse_mode:"HTML",reply_markup:markup});
          }
        }catch(e){console.error("inline update",e);}
      }else if(msg?.chat?.id&&msg?.message_id){
        if(g.image_file_id)await tg("editMessageCaption",{chat_id:msg.chat.id,message_id:msg.message_id,caption,parse_mode:"HTML",reply_markup:markup});
        else await tg("editMessageText",{chat_id:msg.chat.id,message_id:msg.message_id,text:caption,parse_mode:"HTML",reply_markup:markup});
      }
      return res.json({ok:true});
    }

    if(String(q.from?.id)!==admin){
      await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Faqat admin uchun.",show_alert:true});
      return res.json({ok:true});
    }

    if(data==="admin:create"){
      await sql`INSERT INTO admin_drafts(admin_user_id,description,image_file_id,step,updated_at)
        VALUES(${q.from.id},'',NULL,'description',NOW())
        ON CONFLICT(admin_user_id) DO UPDATE SET description='',image_file_id=NULL,step='description',updated_at=NOW()`;
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,
        text:"📝 <b>1/3</b>\nGiveaway opisaniyasini yuboring.\n\nMasalan: “RAMZ ESTET giveaway — omadli ishtirokchilar uchun.”\n\nRasmni caption bilan yuborsangiz, opisaniya sifatida caption olinadi.",
        parse_mode:"HTML"});
      return res.json({ok:true});
    }

    if(data==="admin:history"){
      const ws=await sql`
        SELECT w.round,w.winner_label,w.username,w.won_at,g.id AS giveaway_id,g.title
        FROM giveaway_winners w
        JOIN giveaways g ON g.id=w.giveaway_id
        ORDER BY w.won_at DESC
        LIMIT 100`;
      const text=ws.length
        ? ws.map(w=>`🏆 Giveaway #${Number(w.giveaway_id)} — ${esc(w.winner_label)}${w.username?` (@${esc(w.username)})`:""}\n🕒 ${new Date(w.won_at).toLocaleString("uz-UZ")}`).join("\n\n")
        : "Hali g‘oliblar tarixi yo‘q.";
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,text:`🏆 <b>G‘oliblar tarixi</b>\n\n${text}`,parse_mode:"HTML"});
      return res.json({ok:true});
    }

    if(data==="admin:list"){
      const gs=await sql`SELECT id,title,description,total_rounds,status,telegram_status,created_at FROM giveaways ORDER BY id DESC LIMIT 30`;
      if(!gs.length){await tg("answerCallbackQuery",{callback_query_id:q.id,text:"Hali giveaway yo‘q."});return res.json({ok:true});}
      const kb=gs.map(g=>[{text:`#${g.id} • ${String(g.title).slice(0,35)} • ${g.status}`,callback_data:`admin:view:${Number(g.id)}`}]);
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,text:"📋 <b>Giveawaylarim</b>\nKerakli giveawayni tanlang:",parse_mode:"HTML",reply_markup:{inline_keyboard:kb}});
      return res.json({ok:true});
    }

    let m;
    if((m=data.match(/^admin:view:(\d+)$/))){
      const gid=Number(m[1]),g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
      if(!g)return res.json({ok:true});
      const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
      const ws=await sql`SELECT round,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
      const winners=ws.length?ws.map(w=>`🏆 #${w.round} — ${esc(w.winner_label)}`).join("\n"):"Hali g‘olib aniqlanmagan.";
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,
        text:`🎁 <b>Giveaway #${gid}</b>\n\n<b>${esc(g.title)}</b>\n${esc(g.description)}\n\n👥 Qatnashchilar: <b>${c}</b>\n🎯 Raundlar: <b>${Number(g.total_rounds)}</b>\n📌 Status: <b>${esc(g.status)}</b>\n\n${winners}`,
        parse_mode:"HTML",reply_markup:controlButtons(gid,g.panel_token,g.status)});
      return res.json({ok:true});
    }

    if((m=data.match(/^admin:participants:(\d+)$/))){
      const gid=Number(m[1]),ps=await sql`SELECT username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at`;
      const text=ps.length?ps.map((p,i)=>`${i+1}. ${p.username?`@${p.username}`:esc(p.first_name||"User")} — ${new Date(p.joined_at).toLocaleString("uz-UZ")}`).join("\n"):"Hali hech kim qo‘shilmagan.";
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,text:`👥 <b>Giveaway #${gid} qatnashchilari (${ps.length})</b>\n\n${text}`,parse_mode:"HTML"});
      return res.json({ok:true});
    }

    if((m=data.match(/^admin:winners:(\d+)$/))){
      const gid=Number(m[1]),ws=await sql`SELECT round,winner_label,username,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
      const text=ws.length?ws.map(w=>`🏆 #${w.round} — ${esc(w.winner_label)} ${w.username?`(@${esc(w.username)})`:""}\n🕒 ${new Date(w.won_at).toLocaleString("uz-UZ")}`).join("\n\n"):"Hali natija yo‘q.";
      await tg("answerCallbackQuery",{callback_query_id:q.id});
      await tg("sendMessage",{chat_id:q.message.chat.id,text:`🏆 <b>Giveaway #${gid} natijalari</b>\n\n${text}`,parse_mode:"HTML"});
      return res.json({ok:true});
    }

    if((m=data.match(/^admin:close:(\d+)$/))){
      const gid=Number(m[1]);
      await sql`UPDATE giveaways SET telegram_status='closed' WHERE id=${gid}`;
      await sql`UPDATE giveaway_state SET telegram_status='closed' WHERE id=1 AND giveaway_id=${gid}`;
      await tg("answerCallbackQuery",{callback_query_id:q.id,text:"🔒 Giveaway yopildi."});
      return res.json({ok:true});
    }
    return res.json({ok:true});
  }

  // Messages / creation wizard
  const m=u.message;
  if(!m?.chat)return res.json({ok:true});
  const chat=m.chat.id,uid=m.from?.id,text=String(m.text||"").trim();

  if(String(uid)!==admin){
    return res.json({ok:true});
  }

  if(text==="/start"){
    await tg("sendMessage",{chat_id:chat,text:"👋 <b>RAMZ ESTET ADMIN</b>\n\nGiveawaylarni shu yerdan boshqaring.",parse_mode:"HTML",reply_markup:menu()});
    return res.json({ok:true});
  }

  if(text==="/giveaways"){
    await tg("sendMessage",{chat_id:chat,text:"📋 Giveawaylarim",reply_markup:menu()});
    return res.json({ok:true});
  }

  const draft=(await sql`SELECT * FROM admin_drafts WHERE admin_user_id=${uid} LIMIT 1`)[0];

  if(draft?.step==="description" && !m.photo && text){
    await sql`UPDATE admin_drafts SET description=${text},step='media',updated_at=NOW() WHERE admin_user_id=${uid}`;
    await tg("sendMessage",{chat_id:chat,text:"🖼 <b>2/3</b>\nRasm yuboring (ixtiyoriy).\n\nRasm kerak bo‘lmasa <code>/skip</code> yuboring.",parse_mode:"HTML"});
    return res.json({ok:true});
  }

  if(draft?.step==="description" && m.photo){
    const fileId=m.photo[m.photo.length-1].file_id;
    const desc=String(m.caption||"");
    await sql`UPDATE admin_drafts SET description=${desc},image_file_id=${fileId},step='rounds',updated_at=NOW() WHERE admin_user_id=${uid}`;
    await tg("sendMessage",{chat_id:chat,text:"🔢 <b>3/3</b>\nNechta g‘olib kerak? 1 dan 50 gacha son yuboring.\n\nMasalan: <code>5</code>",parse_mode:"HTML"});
    return res.json({ok:true});
  }

  if(draft?.step==="media"){
    if(text==="/skip"){
      await sql`UPDATE admin_drafts SET image_file_id=NULL,step='rounds',updated_at=NOW() WHERE admin_user_id=${uid}`;
      await tg("sendMessage",{chat_id:chat,text:"🔢 <b>3/3</b>\nNechta g‘olib kerak? 1 dan 50 gacha son yuboring.",parse_mode:"HTML"});
      return res.json({ok:true});
    }
    if(m.photo){
      const fileId=m.photo[m.photo.length-1].file_id;
      await sql`UPDATE admin_drafts SET image_file_id=${fileId},step='rounds',updated_at=NOW() WHERE admin_user_id=${uid}`;
      await tg("sendMessage",{chat_id:chat,text:"🔢 <b>3/3</b>\nNechta g‘olib kerak? 1 dan 50 gacha son yuboring.",parse_mode:"HTML"});
      return res.json({ok:true});
    }
  }

  if(draft?.step==="rounds" && text){
    const rounds=Math.max(1,Math.min(50,parseInt(text,10)||0));
    if(!rounds){await tg("sendMessage",{chat_id:chat,text:"Iltimos, 1–50 oralig‘ida son yuboring."});return res.json({ok:true});}
    const gid=Date.now(),tok=token();
    await sql`INSERT INTO giveaways(id,title,description,image_file_id,total_rounds,duration_ms,status,telegram_status,panel_token,created_by)
      VALUES(${gid},'RAMZ ESTET GIVEAWAY',${draft.description||""},${draft.image_file_id||null},${rounds},8000,'draft','open',${tok},${uid})`;
    await sql`DELETE FROM admin_drafts WHERE admin_user_id=${uid}`;
    await tg("sendMessage",{chat_id:chat,
      text:`✅ <b>Giveaway #${gid} yaratildi!</b>\n\n📝 ${esc(draft.description||"—")}\n🎯 G‘oliblar: <b>${rounds}</b>\n🖼 Rasm: <b>${draft.image_file_id?"bor":"yo‘q"}</b>\n\nEndi posterini chatga yuborishingiz mumkin.`,
      parse_mode:"HTML",reply_markup:controlButtons(gid,tok,"draft")});
    return res.json({ok:true});
  }

  await tg("sendMessage",{chat_id:chat,text:"Menyu:",reply_markup:menu()});
  return res.json({ok:true});
 }catch(e){console.error(e);return res.status(500).json({error:e.message});}
};
