const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const auth=requireTelegram(req),body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),token=String(body.startApp||auth.startParam||'');
  const access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  if(!access)return res.status(403).json({error:'Havola yaroqsiz'});
  const sql=db(),g=(await sql`SELECT id,title,description,total_rounds,status,created_at FROM giveaways WHERE id=${access.gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway not found'});
  const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${access.gid}`)[0].n;
  const ws=await sql`SELECT round,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${access.gid} ORDER BY round`;
  res.setHeader('Cache-Control','no-store');res.json({giveaway:g,participantCount:Number(c),winners:ws});
 }catch(e){res.status(e.statusCode||500).json({error:e.message});}
};
