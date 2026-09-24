const {db}=require("./_db");
const {open}=require("./_security");
const {isAdminTelegramUser}=require("./_audit");
const {tg}=require("./_telegram");
const {ensureGroupSchema,inspectChat,upsertChat}=require("./_groups");

function access(req){
  const token=req.headers["x-panel-token"];
  const p=open(token);
  if(!p||p.k!=="panel"||!p.u||!isAdminTelegramUser(p.u))return null;
  return {uid:Number(p.u),gid:Number(p.g||0)};
}
function asChatId(v){
  const s=String(v??"").trim();
  if(!/^-?\d+$/.test(s) && !/^@[A-Za-z0-9_]{4,}$/.test(s))throw Object.assign(new Error("Guruh ID yoki @username noto‘g‘ri."),{statusCode:400});
  return s;
}
module.exports=async function(req,res){
  try{
    const a=access(req); if(!a)return res.status(401).json({error:"Panel sessiyasi yaroqsiz yoki muddati tugagan"});
    const sql=db(); await ensureGroupSchema(sql);
    if(req.method==="GET"){
      const gid=Number(new URL(req.url,"http://localhost").searchParams.get("gid")||0);
      const chats=await sql`SELECT chat_id,title,username,type,bot_status,can_post_messages,can_delete_messages,active,created_at,updated_at
        FROM telegram_chats WHERE active=TRUE ORDER BY title ASC`;
      let selected=[];
      if(gid)selected=await sql`SELECT chat_id,role FROM giveaway_chats WHERE giveaway_id=${gid} ORDER BY role,chat_id`;
      return res.json({ok:true,chats,selected});
    }
    if(req.method!=="POST")return res.status(405).json({error:"GET/POST only"});
    const b=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const action=String(b.action||"");
    if(action==="add"){
      const input=asChatId(b.chat_id);
      const info=await inspectChat(input);
      await upsertChat(info,sql);
      return res.json({ok:true,chat:{id:Number(info.chat.id),title:info.chat.title||info.chat.username||"Telegram guruh",username:info.chat.username||null,type:info.chat.type,bot_status:info.botStatus,can_post_messages:info.canPost,can_delete_messages:info.canDelete}});
    }
    if(action==="refresh"){
      const chatId=asChatId(b.chat_id);
      const info=await inspectChat(chatId);
      await upsertChat(info,sql);
      return res.json({ok:true});
    }
    if(action==="remove"){
      const chatId=Number(b.chat_id||0);
      if(!chatId)return res.status(400).json({error:"Guruh tanlanmagan"});
      await sql`UPDATE telegram_chats SET active=FALSE,updated_at=NOW() WHERE chat_id=${chatId}`;
      return res.json({ok:true});
    }
    if(action==="assign"){
      const gid=Number(b.giveaway_id||0);
      const chats=Array.isArray(b.chat_ids)?b.chat_ids.map(Number).filter(Number.isSafeInteger):[];
      if(!gid)return res.status(400).json({error:"Giveaway tanlanmagan"});
      const g=(await sql`SELECT id FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
      if(!g)return res.status(404).json({error:"Giveaway topilmadi"});
      await sql`DELETE FROM giveaway_chats WHERE giveaway_id=${gid}`;
      for(const cid of [...new Set(chats)]){
        const c=(await sql`SELECT chat_id FROM telegram_chats WHERE chat_id=${cid} AND active=TRUE LIMIT 1`)[0];
        if(c)await sql`INSERT INTO giveaway_chats(giveaway_id,chat_id,role) VALUES(${gid},${cid},'post') ON CONFLICT DO NOTHING`;
      }
      return res.json({ok:true});
    }
    if(action==="post"){
      const gid=Number(b.giveaway_id||0);
      if(!gid)return res.status(400).json({error:"Giveaway tanlanmagan"});
      const g=(await sql`SELECT id,title,description,total_rounds,start_at,status,image_file_id FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
      if(!g)return res.status(404).json({error:"Giveaway topilmadi"});
      if(String(g.status)==="closed")return res.status(409).json({error:"Yopilgan giveawayni guruhga yuborib bo‘lmaydi"});
      const targets=await sql`SELECT c.chat_id,c.title,c.username FROM giveaway_chats gc JOIN telegram_chats c ON c.chat_id=gc.chat_id
        WHERE gc.giveaway_id=${gid} AND gc.role='post' AND c.active=TRUE AND c.can_post_messages=TRUE ORDER BY c.title`;
      if(!targets.length)return res.status(400).json({error:"Bu giveaway uchun guruh tanlanmagan"});
      const {makeStartApp}=require("./_security");
      const {esc}=require("./_telegram");
      const joinToken=await makeStartApp(gid,"join");
      const baseBot=`https://t.me/${process.env.BOT_USERNAME||"ramzestetbot"}/giveaway`;
      const participantCount=Number((await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=(SELECT created_at FROM giveaways WHERE id=${gid})`)[0]?.n||0);
      const text=`<b>${esc(g.title)}</b>\n\n${esc(g.description||"Giveawayga qatnashing!") }\n\n<b>Qatnashchilar:</b> ${participantCount} ta\n<b>G‘oliblar:</b> ${Number(g.total_rounds)} ta\n<b>Boshlanish:</b> <code>${new Date(g.start_at).toLocaleString("uz-UZ",{timeZone:"Asia/Tashkent"})}</code>\n\n<blockquote>G‘olib server tomonidan tasodifiy aniqlanadi.</blockquote>`;
      const reply_markup={inline_keyboard:[[{text:"QATNASHISH",url:`${baseBot}?startapp=${encodeURIComponent(joinToken)}`}]]};
      const results=[];
      for(const target of targets){
        try{
          const sent=g.image_file_id
            ? await tg("sendPhoto",{chat_id:Number(target.chat_id),photo:String(g.image_file_id),caption:text,parse_mode:"HTML",reply_markup},{skipCleanup:true})
            : await tg("sendMessage",{chat_id:Number(target.chat_id),text,parse_mode:"HTML",reply_markup},{skipCleanup:true});
          await sql`INSERT INTO giveaway_chat_posts(giveaway_id,chat_id,message_id) VALUES(${gid},${Number(target.chat_id)},${Number(sent?.message_id||0)}) ON CONFLICT(giveaway_id,chat_id) DO UPDATE SET message_id=EXCLUDED.message_id,posted_at=NOW()`;
          results.push({chat_id:Number(target.chat_id),title:target.title,ok:true,message_id:Number(sent?.message_id||0)});
        }catch(e){results.push({chat_id:Number(target.chat_id),title:target.title,ok:false,error:String(e?.message||e)})}
      }
      return res.json({ok:true,results});
    }
    return res.status(400).json({error:"Noma’lum amal"});
  }catch(e){
    console.error(e);
    return res.status(e.statusCode||500).json({error:e.message||"Groups error"});
  }
};