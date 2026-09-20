const Ably=require('ably');
const {db}=require('./_db');
const {requireAdmin}=require('./_auth');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  requireAdmin(req);
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const records=Array.isArray(body.participantRecords)?body.participantRecords:null;
  const participants=records
   ? records.map(p=>p.username?`@${p.username}`:(p.firstName||String(p.userId))).map(String).filter(Boolean).slice(0,500)
   : (Array.isArray(body.participants)?body.participants.map(x=>String(x).trim()).filter(Boolean).slice(0,500):[]);
  const userIds=records?records.map(p=>Number(p.userId)||null).slice(0,500):participants.map(()=>null);
  const totalRounds=Math.max(1,Math.min(50,Number(body.totalRounds)||5));
  const durationMs=Math.max(5000,Math.min(15000,Number(body.durationMs)||8000));
  const giveawayId=Number(body.giveawayId||0);
  if(!giveawayId)return res.status(400).json({error:'giveawayId required'});
  if(!participants.length)return res.status(400).json({error:'Participants required'});
  if(participants.length<totalRounds)return res.status(400).json({error:`Participants soni roundlar sonidan kam: ${participants.length}/${totalRounds}`});
  const sql=db();
  const old=(await sql`SELECT spin_id FROM giveaway_state WHERE id=1 LIMIT 1`)[0];
  const nextSpinId=Number(old?.spin_id||0)+1;
  const startAt=Date.now()+1800;
  await sql`UPDATE giveaway_state SET
    status='spinning',giveaway_id=${giveawayId},round=1,total_rounds=${totalRounds},spin_id=${nextSpinId},
    start_at=${startAt},duration_ms=${durationMs},target_index=${Math.floor(Math.random()*participants.length)},
    participants=${JSON.stringify(participants)}::jsonb,participant_user_ids=${JSON.stringify(userIds)}::jsonb,
    winners='[]'::jsonb,updated_at=NOW() WHERE id=1`;
  const s=(await sql`SELECT target_index FROM giveaway_state WHERE id=1`)[0];
  const event={type:'round_start',giveawayId,round:1,totalRounds,spinId:nextSpinId,startAt,durationMs,targetIndex:Number(s.target_index),participants,winners:[]};
  const ably=new Ably.Rest(process.env.ABLY_API_KEY);
  // Per-giveaway channel: every Telegram viewer of this giveaway gets the exact same server-timed spin.
  await ably.channels.get(`giveaway:${giveawayId}`).publish('round_start',event);
  // Keep the original demo channel compatible too.
  await ably.channels.get('ramz-giveaway').publish('spin',event);
  res.json({ok:true,event});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
