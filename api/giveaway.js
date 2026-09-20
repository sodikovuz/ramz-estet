
const {db}=require("./_db");
const {baseUrl}=require("./_util");
const {requireAdmin}=require("./_auth");
const crypto=require("crypto");

async function byToken(sql,gid,t){
  const rows=await sql`SELECT * FROM giveaways WHERE id=${gid} AND panel_token=${t} LIMIT 1`;
  return rows[0];
}
module.exports=async function(req,res){
 try{
  const sql=db();
  const gid=Number(req.query?.gid||0);
  const t=String(req.query?.token||req.headers["x-panel-token"]||"");
  if(!gid||!t)return res.status(400).json({error:"gid/token required"});
  const g=await byToken(sql,gid,t);
  if(!g)return res.status(403).json({error:"Invalid panel token"});

  if(req.method==="GET"){
    const ps=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at`;
    const ws=await sql`SELECT round,user_id,username,first_name,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
    return res.status(200).json({
      giveaway:{
        id:Number(g.id),title:g.title,description:g.description,image_file_id:g.image_file_id,
        total_rounds:Number(g.total_rounds),duration_ms:Number(g.duration_ms),
        status:g.status,telegram_status:g.telegram_status,created_at:g.created_at,
        started_at:g.started_at,finished_at:g.finished_at
      },
      participants:ps.map(x=>({...x,user_id:Number(x.user_id)})),
      winners:ws.map(x=>({...x,user_id:x.user_id==null?null:Number(x.user_id)})),
      publicUrl:`${baseUrl()}/?gid=${Number(g.id)}`
    });
  }

  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const action=String(body.action||"");

  if(action==="close"){
    await sql`UPDATE giveaways SET telegram_status='closed' WHERE id=${gid}`;
    await sql`UPDATE giveaway_state SET telegram_status='closed',updated_at=NOW() WHERE id=1 AND giveaway_id=${gid}`;
    return res.json({ok:true});
  }

  if(action==="start"){
    const ps=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at`;
    if(ps.length<Number(g.total_rounds))return res.status(400).json({error:`Participantlar yetarli emas: ${ps.length}/${g.total_rounds}`});
    const start=require("./start");
    const fakeReq={
      method:"POST",
      body:{
        giveawayId:gid,totalRounds:Number(g.total_rounds),durationMs:Number(g.duration_ms),
        participantRecords:ps.map(x=>({userId:Number(x.user_id),username:x.username,firstName:x.first_name}))
      },
      headers:{"x-admin-secret":process.env.ADMIN_SECRET||""}
    };
    const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
    await start(fakeReq,fakeRes);
    if(fakeRes.statusCode>=400)return res.status(fakeRes.statusCode).json(fakeRes.data||{error:"Start failed"});
    await sql`UPDATE giveaways SET status='active',telegram_status='closed',started_at=NOW() WHERE id=${gid}`;
    return res.json({ok:true,event:fakeRes.data?.event});
  }

  if(action==="reset"){
    await sql`UPDATE giveaways SET status='draft',telegram_status='open',started_at=NULL,finished_at=NULL WHERE id=${gid}`;
    await sql`DELETE FROM giveaway_winners WHERE giveaway_id=${gid}`;
    await sql`UPDATE giveaway_state SET status='ready',round=0,spin_id=0,start_at=NULL,target_index=NULL,participants='[]'::jsonb,participant_user_ids='[]'::jsonb,winners='[]'::jsonb WHERE id=1 AND giveaway_id=${gid}`;
    return res.json({ok:true});
  }

  return res.status(400).json({error:"Unknown action"});
 }catch(e){console.error(e);res.status(500).json({error:e.message});}
};
