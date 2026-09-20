const {db}=require("./_db");
const Ably=require("ably");
function auth(req){return (req.headers["x-admin-secret"]||req.query?.token||"")===process.env.ADMIN_SECRET}
async function pub(gid,name,data){if(process.env.ABLY_API_KEY){const a=new Ably.Rest(process.env.ABLY_API_KEY);await a.channels.get(`giveaway:${gid}`).publish(name,data)}}
module.exports=async function(req,res){
 try{
  if(!auth(req))return res.status(401).json({error:"Unauthorized"});
  const gid=Number(req.query?.gid||0);const sql=db();
  const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];if(!g)return res.status(404).json({error:"Not found"});
  if(req.method==="GET"){
   const ps=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at`;
   const ws=await sql`SELECT round,user_id,username,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
   const vc=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${gid} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;
   return res.json({giveaway:g,participants:ps,winners:ws,viewerCount:vc});
  }
  const b=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  if(b.action==="close"){await sql`UPDATE giveaways SET status='closed' WHERE id=${gid}`;await pub(gid,"state",{status:"closed"});return res.json({ok:true});}
  if(b.action==="start"){
    const ps=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at`;
    if(ps.length<Number(g.total_rounds))return res.status(400).json({error:`Kam participant: ${ps.length}/${g.total_rounds}`});
    await sql`UPDATE giveaways SET status='running',started_at=NOW() WHERE id=${gid}`;
    await sql`UPDATE giveaway_state SET giveaway_id=${gid},round=1,total_rounds=${g.total_rounds},status='running',updated_at=NOW() WHERE id=1`;
    // Existing server-side wheel endpoint is invoked by the admin panel.
    const start=require("./start");
    const fakeReq={method:"POST",body:{giveawayId:gid,participants:ps.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id))),totalRounds:Number(g.total_rounds),durationMs:8000},headers:{"x-admin-secret":process.env.ADMIN_SECRET}};
    const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
    await start(fakeReq,fakeRes); if(fakeRes.statusCode>=400)return res.status(fakeRes.statusCode).json(fakeRes.data);
    return res.json({ok:true});
  }
  res.status(400).json({error:"Unknown action"});
 }catch(e){res.status(500).json({error:e.message});}
};
