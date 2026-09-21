const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const auth=requireTelegram(req),body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||'');
  const joinAccess=await readStartApp(token,'join');
  const watchAccess=await readStartApp(token,'watch');
  const access=watchAccess||joinAccess;
  const mode=joinAccess?'join':'watch';
  if(!access)return res.status(403).json({error:'Mini App havolasi yaroqsiz'});
  const sql=db();
  const g=(await sql`SELECT id,title,description,total_rounds,status,start_at,started_at,finished_at FROM giveaways WHERE id=${access.gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway topilmadi'});
  const participantRows=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${g.id} ORDER BY joined_at ASC`;
  const participants=participantRows.length;
  const participantNames=participantRows.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
  const viewers=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${g.id} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;
  const state=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE giveaway_id=${g.id} LIMIT 1`)[0]||null;
  res.setHeader('Cache-Control','no-store');const safeState=state?{...state,participants:participantNames}:null;
  res.json({ok:true,mode,giveaway:g,participantCount:Number(participants),participantNames,viewerCount:Number(viewers),state:safeState});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
