const {db}=require("./_db");
module.exports=async function(req,res){
 try{
  const gid=Number(req.query?.gid||0);
  if(!gid)return res.status(400).json({error:"gid required"});
  const sql=db();
  const g=(await sql`SELECT id,title,description,image_file_id,total_rounds,status,created_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:"Giveaway not found"});
  const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
  const ws=await sql`SELECT round,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
  res.setHeader("Cache-Control","no-store");
  res.json({
    giveaway:{id:Number(g.id),title:g.title,description:g.description,image_file_id:g.image_file_id,
      total_rounds:Number(g.total_rounds),status:g.status,created_at:g.created_at},
    participantCount:c,
    winners:ws
  });
 }catch(e){res.status(500).json({error:e.message});}
};
