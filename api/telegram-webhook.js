const {db}=require("./_db");
const {tg}=require("./_telegram");

function htmlEscape(s){
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

module.exports=async function(req,res){
 try{
  if(req.method!=="POST") return res.status(405).end();

  const u=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const sql=db();
  const admin=String(process.env.ADMIN_TELEGRAM_ID||"");

  // Inline mode: admin types @botname 5
  if(u.inline_query){
    const iq=u.inline_query;
    const q=String(iq.query||"").trim();

    // Only the configured admin can generate giveaway inline cards.
    if(String(iq.from?.id)!==admin){
      await tg("answerInlineQuery",{
        inline_query_id:iq.id,
        results:[],
        cache_time:0,
        is_personal:true
      });
      return res.json({ok:true});
    }

    // Accept "5", "3", etc. Keep it simple for Telegram inline search.
    const parsed=parseInt(q,10);
    const rounds=Math.max(1,Math.min(5,Number.isFinite(parsed)?parsed:5));
    const gid=Date.now();

    await sql`INSERT INTO giveaway_state(
      id,giveaway_id,round,total_rounds,status,telegram_status,
      winners,participants,updated_at
    ) VALUES(
      1,${gid},1,${rounds},'idle','open','[]'::jsonb,'[]'::jsonb,NOW()
    )
    ON CONFLICT(id) DO UPDATE SET
      giveaway_id=EXCLUDED.giveaway_id,
      round=1,
      total_rounds=EXCLUDED.total_rounds,
      status='idle',
      telegram_status='open',
      winners='[]'::jsonb,
      participants='[]'::jsonb,
      telegram_chat_id=NULL,
      telegram_message_id=NULL,
      updated_at=NOW()`;

    await sql`DELETE FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`;

    const result={
      type:"article",
      id:`giveaway-${gid}`,
      title:`🎁 RAMZ ESTET — ${rounds} ta g‘olib`,
      description:"Giveaway postini chatga yuborish",
      input_message_content:{
        message_text:
          `🎁 <b>RAMZ ESTET GIVEAWAY</b>\n\n`+
          `🎯 G‘oliblar: <b>${rounds} ta</b>\n`+
          `👥 Ishtirokchilar: <b>0</b>\n\n`+
          `👇 Giveawayga qo‘shiling`,
        parse_mode:"HTML"
      },
      reply_markup:{
        inline_keyboard:[[
          {
            text:"🎉 Giveawayga qo‘shilish (0)",
            callback_data:`join:${gid}`
          }
        ]]
      }
    };

    await tg("answerInlineQuery",{
      inline_query_id:iq.id,
      results:[result],
      cache_time:0,
      is_personal:true,
      next_offset:""
    });

    return res.json({ok:true});
  }

  // Participant button
  if(u.callback_query){
   const q=u.callback_query, data=String(q.data||"");

   if(data.startsWith("join:")){
    const gid=Number(data.split(":")[1]);

    const s=(await sql`
      SELECT total_rounds,telegram_status,telegram_chat_id,telegram_message_id
      FROM giveaway_state
      WHERE giveaway_id=${gid}
      LIMIT 1
    `)[0];

    if(!s){
      await tg("answerCallbackQuery",{
        callback_query_id:q.id,
        text:"Giveaway topilmadi.",
        show_alert:true
      });
      return res.json({ok:true});
    }

    if(s.telegram_status!=="open"){
      await tg("answerCallbackQuery",{
        callback_query_id:q.id,
        text:"Giveaway yopilgan.",
        show_alert:true
      });
      return res.json({ok:true});
    }

    await sql`
      INSERT INTO telegram_giveaway_participants
        (giveaway_id,user_id,username,first_name)
      VALUES
        (${gid},${q.from.id},${q.from.username||null},${q.from.first_name||""})
      ON CONFLICT(giveaway_id,user_id) DO NOTHING
    `;

    const c=(await sql`
      SELECT COUNT(*)::int AS n
      FROM telegram_giveaway_participants
      WHERE giveaway_id=${gid}
    `)[0].n;

    await tg("answerCallbackQuery",{
      callback_query_id:q.id,
      text:"✅ Giveawayga qo‘shildingiz!"
    });

    // Inline-sent messages can be updated directly from callback message.
    const msg=q.message;
    if(msg?.chat?.id && msg?.message_id){
      const oldText=String(msg.text||msg.caption||"");
      const updatedText=oldText
        .replace(/👥 Ishtirokchilar:\s*<b>\d+<\/b>/,"👥 Ishtirokchilar: <b>"+c+"</b>")
        .replace(/👥 Ishtirokchilar:\s*\d+/,"👥 Ishtirokchilar: <b>"+c+"</b>");

      const body={
        chat_id:msg.chat.id,
        message_id:msg.message_id,
        reply_markup:{
          inline_keyboard:[[
            {text:`🎉 Giveawayga qo‘shilish (${c})`,callback_data:`join:${gid}`}
          ]]
        }
      };

      if(updatedText!==oldText){
        body.text=updatedText;
        body.parse_mode="HTML";
        await tg("editMessageText",body);
      }else{
        await tg("editMessageReplyMarkup",body);
      }

      await sql`
        UPDATE giveaway_state
        SET telegram_chat_id=${msg.chat.id},
            telegram_message_id=${msg.message_id},
            updated_at=NOW()
        WHERE giveaway_id=${gid}
      `;
    }
   }

   return res.json({ok:true});
  }

  const m=u.message;
  if(!m?.text) return res.json({ok:true});

  const chat=m.chat.id;
  const uid=m.from?.id;
  const text=String(m.text).trim();

  if(text==="/start"){
   await tg("sendMessage",{
    chat_id:chat,
    text:String(uid)===admin
      ? "Admin: inline orqali giveaway yarating:\n\n@botname 5\n\nKeyin natijani chatga yuboring.\n\n/startwheel — wheelni boshlash\n/close — yopish"
      : "Admin yuborgan giveaway postidagi 🎉 tugmani bosing."
   });
   return res.json({ok:true});
  }

  if(String(uid)!==admin){
   await tg("sendMessage",{chat_id:chat,text:"Bu buyruq faqat admin uchun."});
   return res.json({ok:true});
  }

  if(text==="/startwheel"){
   const s=(await sql`
     SELECT * FROM giveaway_state WHERE id=1 LIMIT 1
   `)[0];

   if(!s) throw new Error("Giveaway yaratilmagan");

   const gid=Number(s.giveaway_id);
   const ps=await sql`
     SELECT username,first_name,user_id
     FROM telegram_giveaway_participants
     WHERE giveaway_id=${gid}
     ORDER BY joined_at
   `;

   const participants=ps.map(p=>
     p.username ? `@${p.username}` : (p.first_name||String(p.user_id))
   );

   if(participants.length<Number(s.total_rounds)){
     throw new Error(`Kam participant: ${participants.length}/${s.total_rounds}`);
   }

   await sql`
     UPDATE giveaway_state
     SET telegram_status='closed', updated_at=NOW()
     WHERE id=1
   `;

   // Start the existing wheel using the SAME giveaway_id.
   const start=require("./start");
   const fakeReq={
     method:"POST",
     body:{
       participants,
       totalRounds:Number(s.total_rounds),
       durationMs:Number(s.duration_ms||8000),
       giveawayId:gid
     },
     headers:{"x-admin-secret":process.env.ADMIN_SECRET||""}
   };
   const fakeRes={
     statusCode:200,
     status(n){this.statusCode=n;return this},
     json(v){this.data=v;return this},
     setHeader(){}
   };

   await start(fakeReq,fakeRes);

   if(fakeRes.statusCode>=400){
     throw new Error(fakeRes.data?.error||"Wheel start failed");
   }

   await tg("sendMessage",{
     chat_id:chat,
     text:`🎡 Wheel boshlandi — ${participants.length} participant.`
   });

   return res.json({ok:true});
  }

  if(text==="/close"){
   await sql`
     UPDATE giveaway_state
     SET telegram_status='closed', updated_at=NOW()
     WHERE id=1
   `;
   await tg("sendMessage",{chat_id:chat,text:"🔒 Giveaway yopildi."});
   return res.json({ok:true});
  }

  await tg("sendMessage",{
    chat_id:chat,
    text:"Inline: @botname 5\n/startwheel\n/close"
  });

  return res.json({ok:true});
 }catch(e){
  console.error(e);
  return res.status(500).json({error:e.message});
 }
};
