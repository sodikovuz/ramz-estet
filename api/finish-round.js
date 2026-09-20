
const Ably=require("ably");
const {db}=require("./_db");
module.exports=async function(req,res){
 try{
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const round=Number(body.round),sql=db();
  const s=(await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`)[0];
  if(!s)return res.status(404).json({error:"State missing"});
  if(Number(s.round)!==round)return res.status(409).json({error:"Round mismatch"});
  const existing=Array.isArray(s.winners)?s.winners:[];
  if(existing.some(x=>Number(x.round)===round))return res.json({ok:true,already:true,winners:existing});
  const participants=Array.isArray(s.participants)?s.participants:[];
  const ids=Array.isArray(s.participant_user_ids)?s.participant_user_ids:[];
  const targetIndex=Number(s.target_index);
  if(!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=participants.length)return res.status(500).json({error:"Invalid target"});
  const winner=String(participants[targetIndex]);
  const uid=ids[targetIndex]==null?null:Number(ids[targetIndex]);
  let username=null,firstName=null;
  if(uid!=null){
    const p=(await sql`SELECT username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${Number(s.giveaway_id)} AND user_id=${uid} LIMIT 1`)[0];
    username=p?.username||null;firstName=p?.first_name||null;
  }
  const winners=[...existing,{round,winner,userId:uid}];
  await sql`INSERT INTO giveaway_winners(giveaway_id,round,user_id,username,first_name,winner_label)
    VALUES(${Number(s.giveaway_id)},${round},${uid},${username},${firstName},${winner})
    ON CONFLICT(giveaway_id,round) DO NOTHING`;
  const nextRound=round+1;
  if(nextRound>Number(s.total_rounds)){
    await sql`UPDATE giveaway_state SET status='finished',winners=${JSON.stringify(winners)}::jsonb,updated_at=NOW() WHERE id=1`;
    await sql`UPDATE giveaways SET status='finished',finished_at=NOW() WHERE id=${Number(s.giveaway_id)}`;
    await new Ably.Rest(process.env.ABLY_API_KEY).channels.get("ramz-giveaway").publish("giveaway_finished",{type:"giveaway_finished",giveawayId:Number(s.giveaway_id),winners});
    return res.json({ok:true,finished:true,winner,winners});
  }
  const remaining=participants.filter((_,i)=>i!==targetIndex);
  const remainingIds=ids.filter((_,i)=>i!==targetIndex);
  const nextTarget=Math.floor(Math.random()*remaining.length),nextSpinId=Number(s.spin_id)+1,startAt=Date.now()+1800;
  await sql`UPDATE giveaway_state SET round=${nextRound},spin_id=${nextSpinId},start_at=${startAt},
    target_index=${nextTarget},participants=${JSON.stringify(remaining)}::jsonb,
    participant_user_ids=${JSON.stringify(remainingIds)}::jsonb,winners=${JSON.stringify(winners)}::jsonb,status='spinning',updated_at=NOW()
    WHERE id=1`;
  const event={type:"round_start",giveawayId:Number(s.giveaway_id),round:nextRound,totalRounds:Number(s.total_rounds),spinId:nextSpinId,startAt,durationMs:Number(s.duration_ms),targetIndex:nextTarget,participants:remaining,winners};
  await new Ably.Rest(process.env.ABLY_API_KEY).channels.get("ramz-giveaway").publish("round_start",event);
  res.json({ok:true,event,winner,winners});
 }catch(e){console.error(e);res.status(500).json({error:e.message});}
};
