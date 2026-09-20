
const {db}=require("./_db");
module.exports=async function(req,res){
 try{
  const secret=req.headers["x-admin-secret"]||req.query?.secret;
  if(secret!==process.env.ADMIN_SECRET)return res.status(401).json({error:"Unauthorized"});
  const sql=db();
  const rows=await sql`SELECT id,title,description,total_rounds,status,telegram_status,created_at,started_at,finished_at FROM giveaways ORDER BY id DESC LIMIT 100`;
  const counts=await sql`SELECT giveaway_id,COUNT(*)::int AS n FROM telegram_giveaway_participants GROUP BY giveaway_id`;
  const map=new Map(counts.map(x=>[Number(x.giveaway_id),Number(x.n)]));
  res.json({giveaways:rows.map(x=>({...x,id:Number(x.id),participant_count:map.get(Number(x.id))||0,total_rounds:Number(x.total_rounds)}))});
 }catch(e){res.status(500).json({error:e.message});}
};
