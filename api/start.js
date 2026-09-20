
const Ably=require("ably");
const {db}=require("./_db");
const {requireAdmin}=require("./_auth");

module.exports=async function(req,res){
 try{
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  requireAdmin(req);
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const records=Array.isArray(body.participantRecords)?body.participantRecords:null;
  const participants=records
    ? records.map(p=>p.username?`@${p.username}`:(p.firstName||String(p.userId))).map(String).filter(Boolean).slice(0,500)
    : (Array.isArray(body.participants)?body.participants.map(x=>String(x).trim()).filter(Boolean).slice(0,500):[]);
  const userIds=records?records.map(p=>Number(p.userId)||null).slice(0,500):participants.map(()=>null);
  const totalRounds=Math.max(1,Math.min(50,Number(body.totalRounds)||5));
  const durationMs=Math.max(5000,Math.min(15000,Number(body.durationMs)||8000));
  if(!participants.length)return res.status(400).json({error:"Participants required"});
  if(participants.length<totalRounds)return res.status(400).json({error:"Participants soni roundlar sonidan kam bo'lmasin"});
  const sql=db();
  let giveawayId=Number(body.giveawayId||0);
  if(!giveawayId){
    const old=await sql`SELECT giveaway_id FROM giveaway_state WHERE id=1`;
    giveawayId=Number(old[0]?.giveaway_id||0)+1;
  }
  const firstIndex=Math.floor(Math.random()*participants.length);
  const spinId=giveawayId*100+1,startAt=Date.now()+1800;
  await sql`UPDATE giveaway_state SET
    status='spinning',giveaway_id=${giveawayId},round=1,total_rounds=${totalRounds},
    spin_id=${spinId},start_at=${startAt},duration_ms=${durationMs},target_index=${firstIndex},
    participants=${JSON.stringify(participants)}::jsonb,
    participant_user_ids=${JSON.stringify(userIds)}::jsonb,
    winners='[]'::jsonb,telegram_status='closed',updated_at=NOW()
    WHERE id=1`;
  const event={type:"round_start",giveawayId,round:1,totalRounds,spinId,startAt,durationMs,targetIndex:firstIndex,participants,winners:[]};
  await new Ably.Rest(process.env.ABLY_API_KEY).channels.get("ramz-giveaway").publish("round_start",event);
  res.json({ok:true,event});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
