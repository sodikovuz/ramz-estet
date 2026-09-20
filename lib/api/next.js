const Ably=require('ably');
const {db}=require('./_db');
const {requireAdmin}=require('./_auth');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});requireAdmin(req);
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),gid=Number(body.giveawayId||0),sql=db();
  const s=(await sql`SELECT * FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0];
  if(!s)return res.status(404).json({error:'State missing'});
  const round=Number(body.round||s.round);if(round!==Number(s.round))return res.status(409).json({error:'Round mismatch'});
  if(s.status!=='spinning')return res.status(400).json({error:'No active spin'});
  return res.status(400).json({error:'Winner is server-selected; use /api/finish-round'});
 }catch(e){res.status(e.statusCode||500).json({error:e.message});}
};
