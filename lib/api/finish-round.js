const Ably=require('ably');
const {db}=require('./_db');
const {requireAdmin}=require('./_auth');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),sql=db();
  let gid=Number(body.giveawayId||0),round=Number(body.round||0),isAdmin=false;
  if(req.headers['x-admin-secret']){requireAdmin(req);isAdmin=true;}
  else{
    const auth=requireTelegram(req),token=String(body.startApp||auth.startParam||''),access=readStartApp(token,'watch')||readStartApp(token,'join');
    if(!access||auth.startParam!==token)return res.status(403).json({error:'Tasdiqlash xatosi'});
    gid=access.gid;
  }
  await sql`UPDATE giveaway_state SET status='spinning' WHERE giveaway_id=${gid} AND status='settling' AND updated_at < NOW()-INTERVAL '30 seconds'`;
  const s=(await sql`SELECT * FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0];
  if(!s)return res.status(404).json({error:'State missing'});
  round=round||Number(s.round);
  if(Number(s.round)!==round)return res.status(409).json({error:'Round mismatch'});
  if(s.status!=='spinning')return res.json({ok:true,already:true,status:s.status});
  if(!isAdmin && Date.now() < Number(s.start_at)+Number(s.duration_ms)+250)return res.status(425).json({error:'Spin hali tugamagan'});
  // Atomic claim: only one request may settle a round.
  const claimed=(await sql`UPDATE giveaway_state SET status='settling',updated_at=NOW() WHERE giveaway_id=${gid} AND status='spinning' AND round=${round} RETURNING *`)[0];
  if(!claimed)return res.json({ok:true,already:true});
  const participants=Array.isArray(claimed.participants)?claimed.participants:[],ids=Array.isArray(claimed.participant_user_ids)?claimed.participant_user_ids:[];
  const targetIndex=Number(claimed.target_index);
  if(!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=participants.length){await sql`UPDATE giveaway_state SET status='error',updated_at=NOW() WHERE giveaway_id=${gid}`;return res.status(500).json({error:'Invalid target'});}
  const winner=String(participants[targetIndex]),uid=ids[targetIndex]==null?null:Number(ids[targetIndex]);
  let username=null,firstName=null;
  if(uid!=null){const p=(await sql`SELECT username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND user_id=${uid} LIMIT 1`)[0];username=p?.username||null;firstName=p?.first_name||null;}
  const old=Array.isArray(claimed.winners)?claimed.winners:[],winners=[...old,{round,winner,userId:uid}];
  await sql`INSERT INTO giveaway_winners(giveaway_id,round,user_id,username,first_name,winner_label) VALUES(${gid},${round},${uid},${username},${firstName},${winner}) ON CONFLICT(giveaway_id,round) DO NOTHING`;
  const ably=new Ably.Rest(process.env.ABLY_API_KEY);
  await ably.channels.get(`giveaway:${gid}`).publish('winner_reveal',{giveawayId:gid,round,winner});
  const nextRound=round+1;
  if(nextRound>Number(claimed.total_rounds)){
    await sql`UPDATE giveaway_state SET status='finished',winners=${JSON.stringify(winners)}::jsonb,updated_at=NOW() WHERE giveaway_id=${gid}`;
    await sql`UPDATE giveaways SET status='finished',finished_at=NOW() WHERE id=${gid}`;
    await ably.channels.get(`giveaway:${gid}`).publish('giveaway_finished',{type:'giveaway_finished',giveawayId:gid});
    return res.json({ok:true,finished:true,winner});
  }
  const remaining=participants.filter((_,i)=>i!==targetIndex),remainingIds=ids.filter((_,i)=>i!==targetIndex);
  const nextTarget=Math.floor(Math.random()*remaining.length),nextSpinId=Number(claimed.spin_id)+1,startAt=Date.now()+1800;
  await sql`UPDATE giveaway_state SET round=${nextRound},spin_id=${nextSpinId},start_at=${startAt},target_index=${nextTarget},participants=${JSON.stringify(remaining)}::jsonb,participant_user_ids=${JSON.stringify(remainingIds)}::jsonb,winners=${JSON.stringify(winners)}::jsonb,status='spinning',updated_at=NOW() WHERE giveaway_id=${gid}`;
  const event={type:'round_start',giveawayId:gid,round:nextRound,totalRounds:Number(claimed.total_rounds),spinId:nextSpinId,startAt,durationMs:Number(claimed.duration_ms),targetIndex:nextTarget,participants:remaining,winners:[]};
  await ably.channels.get(`giveaway:${gid}`).publish('round_start',event);
  res.json({ok:true,event,winner});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
