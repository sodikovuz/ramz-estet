const Ably=require('ably');
const {db}=require('./_db');
const {requireAdmin}=require('./_auth');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  requireAdmin(req);
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const records=Array.isArray(body.participantRecords)?body.participantRecords:null;
  const participantRecords=records
    ? records.map(p=>({userId:Number(p.userId)||null,username:p.username?String(p.username):null,firstName:p.firstName?String(p.firstName):null})).filter(p=>p.userId).slice(0,500)
    : (Array.isArray(body.participants)?body.participants.map(x=>({userId:null,username:null,firstName:String(x).trim()})).filter(p=>p.firstName).slice(0,500):[]);
  const participants=participantRecords.map(p=>p.username?`@${p.username}`:(p.firstName||String(p.userId)));
  const userIds=participantRecords.map(p=>p.userId);
  const totalRounds=Math.max(1,Math.min(50,Number(body.totalRounds)||5));
  const durationMs=Math.max(5000,Math.min(15000,Number(body.durationMs)||8000));
  const giveawayId=Number(body.giveawayId||0);
  if(!giveawayId)return res.status(400).json({error:'giveawayId required'});
  if(!participants.length)return res.status(400).json({error:'Participants required'});
  if(participants.length<totalRounds)return res.status(400).json({error:`Participants soni roundlar sonidan kam: ${participants.length}/${totalRounds}`});
  const sql=db();
  const old=(await sql`SELECT spin_id FROM giveaway_state WHERE giveaway_id=${giveawayId} LIMIT 1`)[0];
  const nextSpinId=Number(old?.spin_id||0)+1;
  const startAt=Date.now()+1800;
  const targetIndex=Math.floor(Math.random()*participants.length);
  const payload={giveaway_id:giveawayId,round:1,total_rounds:totalRounds,spin_id:nextSpinId,start_at:startAt,duration_ms:durationMs,target_index:targetIndex,participants:JSON.stringify(participants),participant_user_ids:JSON.stringify(userIds),winners:'[]'};
  if(old){
    await sql`UPDATE giveaway_state SET round=1,total_rounds=${totalRounds},spin_id=${nextSpinId},start_at=${startAt},duration_ms=${durationMs},target_index=${targetIndex},participants=${payload.participants}::jsonb,participant_user_ids=${payload.participant_user_ids}::jsonb,winners='[]'::jsonb,status='spinning',updated_at=NOW() WHERE giveaway_id=${giveawayId}`;
  }else{
    await sql`INSERT INTO giveaway_state(giveaway_id,round,total_rounds,spin_id,start_at,duration_ms,target_index,participants,participant_user_ids,winners,status,updated_at)
      VALUES(${giveawayId},1,${totalRounds},${nextSpinId},${startAt},${durationMs},${targetIndex},${payload.participants}::jsonb,${payload.participant_user_ids}::jsonb,'[]'::jsonb,'spinning',NOW())`;
  }
  const event={type:'round_start',giveawayId,round:1,totalRounds,spinId:nextSpinId,startAt,durationMs,targetIndex,participants,winners:[]};
  const ably=new Ably.Rest(process.env.ABLY_API_KEY);
  await ably.channels.get(`giveaway:${giveawayId}`).publish('round_start',event);
  res.json({ok:true,event});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
