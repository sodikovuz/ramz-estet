const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');

module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const auth=requireTelegram(req);
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||'');
  const joinAccess=await readStartApp(token,'join');
  const watchAccess=await readStartApp(token,'watch');
  const access=joinAccess||watchAccess;
  if(!access)return res.status(403).json({error:'Mini App havolasi yaroqsiz yoki muddati tugagan'});

  const sql=db();
  const g=(await sql`SELECT id,title,description,image_file_id,total_rounds,status,start_at,started_at,finished_at FROM giveaways WHERE id=${access.gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway topilmadi'});

  const participants=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${g.id}`)[0].n;
  const viewers=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${g.id} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;

  // Support both the new per-giveaway state schema and older installations.
  let state=null;
  const cols=await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='giveaway_state'`;
  const names=new Set(cols.map(x=>x.column_name));
  if(names.has('giveaway_id')){
    state=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE giveaway_id=${g.id} LIMIT 1`)[0]||null;
  }else{
    state=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE id=1 LIMIT 1`)[0]||null;
  }

  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,mode:joinAccess?'join':'watch',giveaway:g,participantCount:Number(participants),viewerCount:Number(viewers),state});
 }catch(e){
  console.error('current-giveaway',e);
  res.status(e.statusCode||500).json({error:e.message||'Giveaway yuklanmadi'});
 }
};
