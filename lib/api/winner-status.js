const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const auth=requireTelegram(req),body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||''),access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  const round=Number(body.round||0);
  if(!access || auth.startParam!==token || !round)return res.status(403).json({error:'Tasdiqlash xatosi'});
  const sql=db();
  const w=(await sql`SELECT round,winner_label FROM giveaway_winners WHERE giveaway_id=${access.gid} AND round=${round} AND user_id=${Number(auth.user.id)} LIMIT 1`)[0];
  res.setHeader('Cache-Control','no-store');res.json({ok:true,isWinner:!!w,winner:w?.winner_label||null});
 }catch(e){res.status(e.statusCode||500).json({error:e.message});}
};
