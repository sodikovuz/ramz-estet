const {db}=require('./_db');
const {open}=require('./_security');
const {isAdminTelegramUser,error:auditError}=require('./_audit');
const {ensureGroupSchema}=require('./_groups');
const Ably=require('ably');

function access(req){
  const token=req.headers['x-panel-token'];
  const p=open(token);
  if(!p||p.k!=='panel'||!p.u||!isAdminTelegramUser(p.u)) return null;
  return {uid:Number(p.u),gid:Number(p.g||0)};
}
async function publish(gid,name,data){
  if(!process.env.ABLY_API_KEY)return;
  await new Ably.Rest(process.env.ABLY_API_KEY).channels.get(`giveaway:${gid}`).publish(name,data);
}
function parseTashkent(v){
  const s=String(v||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))return null;
  const d=new Date(s+':00+05:00');
  return Number.isNaN(d.getTime())?null:d;
}
async function startGiveaway(sql,gid){
  const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
  if(!g)throw Object.assign(new Error('Giveaway topilmadi'),{statusCode:404});
  if(['finished','closed','running'].includes(String(g.status)))throw Object.assign(new Error('Bu giveawayni hozir boshlab bo‘lmaydi'),{statusCode:409});
  const ps=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=${g.created_at} ORDER BY joined_at`;
  if(ps.length<Number(g.total_rounds))throw Object.assign(new Error(`Kam participant: ${ps.length}/${g.total_rounds}`),{statusCode:400});
  await sql`UPDATE giveaways SET status='running',started_at=NOW() WHERE id=${gid}`;
  const start=require('./start');
  const fakeReq={method:'POST',body:{giveawayId:gid,participantRecords:ps.map(p=>({userId:Number(p.user_id),username:p.username||null,firstName:p.first_name||null})),totalRounds:Number(g.total_rounds),durationMs:8000},headers:{'x-admin-secret':process.env.ADMIN_SECRET}};
  const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
  await start(fakeReq,fakeRes);
  if(fakeRes.statusCode>=400)throw Object.assign(new Error(fakeRes.data?.error||'Start xatosi'),{statusCode:fakeRes.statusCode});
  return true;
}
module.exports=async function(req,res){
 let a=null;
 try{
  a=access(req);
  if(!a)return res.status(401).json({error:'Panel sessiyasi yaroqsiz yoki muddati tugagan'});
  const sql=db();
  await ensureGroupSchema(sql);
  if(req.method==='GET'){
    const gid=Number(new URL(req.url,'http://localhost').searchParams.get('gid')||0);
    const stats=(await sql`SELECT
      COUNT(*)::int total,
      COUNT(*) FILTER(WHERE status='scheduled')::int scheduled,
      COUNT(*) FILTER(WHERE status='running')::int running,
      COUNT(*) FILTER(WHERE status='finished')::int finished,
      COUNT(*) FILTER(WHERE status='closed')::int closed
      FROM giveaways`)[0]||{};
    const giveaways=await sql`SELECT g.id,g.title,g.description,g.total_rounds,g.status,g.start_at,g.started_at,g.finished_at,g.created_at,
      COALESCE((SELECT COUNT(*) FROM telegram_giveaway_participants p WHERE p.giveaway_id=g.id AND p.joined_at>=g.created_at),0)::int participant_count,
      COALESCE((SELECT COUNT(*) FROM giveaway_winners w WHERE w.giveaway_id=g.id),0)::int winner_count,
      COALESCE((SELECT COUNT(*) FROM giveaway_viewers v WHERE v.giveaway_id=g.id AND v.last_seen_at>NOW()-INTERVAL '45 seconds'),0)::int viewer_count
      FROM giveaways g ORDER BY g.created_at DESC LIMIT 200`;
    let detail=null;
    if(gid){
      const g=giveaways.find(x=>Number(x.id)===gid)||(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
      if(!g)return res.status(404).json({error:'Giveaway topilmadi'});
      const participants=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=${g.created_at} ORDER BY joined_at`;
      const winners=await sql`SELECT round,user_id,username,first_name,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
      const groups=await sql`SELECT c.chat_id,c.title,c.username,c.type,c.bot_status,c.can_post_messages,c.can_delete_messages,gc.role
        FROM giveaway_chats gc JOIN telegram_chats c ON c.chat_id=gc.chat_id
        WHERE gc.giveaway_id=${gid} AND c.active=TRUE ORDER BY c.title`;
      detail={giveaway:g,participants,winners,groups};
    }
    return res.json({ok:true,stats,giveaways,detail});
  }
  if(req.method!=='POST')return res.status(405).json({error:'GET/POST only'});
  const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const action=String(b.action||'');
  if(action==='create'){
    const title=String(b.title||'').trim().slice(0,160);
    const description=String(b.description||'').trim().slice(0,3000);
    const rounds=Math.max(1,Math.min(100,Math.trunc(Number(b.total_rounds)||0)));
    const startAt=parseTashkent(b.start_at);
    if(!title)return res.status(400).json({error:'Giveaway nomini kiriting'});
    if(!rounds)return res.status(400).json({error:'G‘oliblar sonini kiriting'});
    if(!startAt)return res.status(400).json({error:'Boshlanish sanasi/vaqti noto‘g‘ri'});
    const g=(await sql`INSERT INTO giveaways(title,description,total_rounds,status,start_at,created_by) VALUES(${title},${description},${rounds},'scheduled',${startAt},${a.uid}) RETURNING id`)[0];
    const chatIds=Array.isArray(b.chat_ids)?b.chat_ids.map(Number).filter(Number.isSafeInteger):[];
    for(const chatId of [...new Set(chatIds)]){
      const chat=(await sql`SELECT chat_id FROM telegram_chats WHERE chat_id=${chatId} AND active=TRUE AND can_post_messages=TRUE LIMIT 1`)[0];
      if(chat)await sql`INSERT INTO giveaway_chats(giveaway_id,chat_id,role) VALUES(${g.id},${chatId},'post') ON CONFLICT DO NOTHING`;
    }
    await sql`INSERT INTO giveaway_state(id,giveaway_id,round,total_rounds,status,telegram_status,updated_at) VALUES(1,${g.id},1,${rounds},'scheduled','open',NOW()) ON CONFLICT(id) DO UPDATE SET giveaway_id=EXCLUDED.giveaway_id,total_rounds=EXCLUDED.total_rounds,status='scheduled',telegram_status='open',updated_at=NOW()`;
    return res.json({ok:true,id:Number(g.id)});
  }
  const gid=Number(b.giveaway_id||0);
  if(!gid)return res.status(400).json({error:'Giveaway tanlanmagan'});
  const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway topilmadi'});
  if(action==='start'){await startGiveaway(sql,gid);return res.json({ok:true});}
  if(action==='assign_groups'){
    const chatIds=Array.isArray(b.chat_ids)?b.chat_ids.map(Number).filter(Number.isSafeInteger):[];
    await sql`DELETE FROM giveaway_chats WHERE giveaway_id=${gid}`;
    for(const chatId of [...new Set(chatIds)]){
      const chat=(await sql`SELECT chat_id FROM telegram_chats WHERE chat_id=${chatId} AND active=TRUE AND can_post_messages=TRUE LIMIT 1`)[0];
      if(chat)await sql`INSERT INTO giveaway_chats(giveaway_id,chat_id,role) VALUES(${gid},${chatId},'post') ON CONFLICT DO NOTHING`;
    }
    return res.json({ok:true});
  }
  if(action==='close'){
    if(String(g.status)!=='scheduled')return res.status(409).json({error:'Faqat rejalashtirilgan giveawayni yopish mumkin'});
    await sql`UPDATE giveaways SET status='closed' WHERE id=${gid} AND status='scheduled'`;
    await publish(gid,'state',{status:'closed',giveawayId:gid});
    return res.json({ok:true});
  }
  return res.status(400).json({error:'Noma’lum amal'});
 }catch(e){
  console.error(e);
  await auditError({source:'web',action:'admin-dashboard',adminUserId:a?.uid||null,giveawayId:a?.gid||null,error:e,meta:{method:req.method,path:req.url}});
  return res.status(e.statusCode||500).json({error:e.message||'Dashboard error'});
 }
};