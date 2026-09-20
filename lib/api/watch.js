const {db}=require("./_db");
const {esc}=require("./_telegram");
const Ably=require("ably");
async function publish(gid,name,data){
 if(!process.env.ABLY_API_KEY)return;
 const c=new Ably.Rest(process.env.ABLY_API_KEY);
 await c.channels.get(`giveaway:${gid}`).publish(name,data);
}
module.exports=async function(req,res){
 try{
  const gid=Number(req.query?.gid||0); if(!gid)return res.status(400).json({error:"gid required"});
  const sql=db();
  const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:"Giveaway not found"});
  const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
  const vc=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${gid} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;
  const st=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0]||{
    status:g.status,round:1,total_rounds:g.total_rounds,start_at:g.start_at?new Date(g.start_at).getTime():null,duration_ms:8000,participants:[],winners:[]
  };
  if(req.method==="GET")return res.json({giveaway:g,participantCount:c,viewerCount:vc,state:st});
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const u=body.user||{};
  if(u?.id){
    await sql`INSERT INTO giveaway_viewers(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${Number(u.id)},${u.username||null},${u.first_name||null})
      ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,last_seen_at=NOW()`;
    await publish(gid,"viewers",{count:(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${gid} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n});
  }
  const latest=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0]||st;
  res.json({participantCount:c,viewerCount:vc,state:latest,giveaway:g});
 }catch(e){res.status(500).json({error:e.message});}
};
