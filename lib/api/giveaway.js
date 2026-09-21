const {db}=require('./_db');
const Ably=require('ably');
const {requireAdmin,isAdminTelegramUser}=require('./_auth');
const {open,readPanelToken}=require('./_security');
function panel(req){
 const token=req.headers['x-panel-token'];
 const p=open(token);
 return p&&p.k==='panel'&&p.g&&p.u?{gid:Number(p.g),uid:Number(p.u)}:null;
}
async function pub(gid,name,data){if(process.env.ABLY_API_KEY)await new Ably.Rest(process.env.ABLY_API_KEY).channels.get(`giveaway:${gid}`).publish(name,data)}
module.exports=async function(req,res){
 try{
  const sql=db();let access=panel(req),gid=access?.gid;
  if(!access){
   // Internal bot/admin calls use the server-side secret and an explicit giveaway id.
   if(!req.headers['x-admin-secret'])return res.status(401).json({error:'Unauthorized'});
   requireAdmin(req);gid=Number(req.query?.gid||0);
  }
  if(!gid)return res.status(400).json({error:'Giveaway token required'});
  const g=(await sql`SELECT * FROM giveaways WHERE id=${gid} LIMIT 1`)[0];if(!g)return res.status(404).json({error:'Not found'});
  if(access && !isAdminTelegramUser(access.uid) && Number(g.created_by)!==access.uid)return res.status(403).json({error:'Ruxsat yo‘q'});
  if(req.method==='GET'){
   const ps=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=${g.created_at} ORDER BY joined_at`;
   const ws=await sql`SELECT round,user_id,username,first_name,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${gid} ORDER BY round`;
   const vc=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${gid} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;
   return res.json({giveaway:g,participants:ps,winners:ws,viewerCount:vc});
  }
  const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  if(b.action==='close'){await sql`UPDATE giveaways SET status='closed' WHERE id=${gid}`;await pub(gid,'state',{status:'closed',giveawayId:gid});return res.json({ok:true});}
  if(b.action==='start'){
    const ps=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} AND joined_at>=${g.created_at} ORDER BY joined_at`;
    if(ps.length<Number(g.total_rounds))return res.status(400).json({error:`Kam participant: ${ps.length}/${g.total_rounds}`});
    if(['finished','closed','running'].includes(String(g.status)))return res.status(409).json({error:'Bu giveawayni hozir boshlab bo‘lmaydi'});
    await sql`UPDATE giveaways SET status='running',started_at=NOW() WHERE id=${gid}`;
    const start=require('./start');
    const fakeReq={method:'POST',body:{giveawayId:gid,participantRecords:ps.map(p=>({userId:Number(p.user_id),username:p.username||null,firstName:p.first_name||null})),totalRounds:Number(g.total_rounds),durationMs:8000},headers:{'x-admin-secret':process.env.ADMIN_SECRET}};
    const fakeRes={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.data=v;return this},setHeader(){}};
    await start(fakeReq,fakeRes);if(fakeRes.statusCode>=400)return res.status(fakeRes.statusCode).json(fakeRes.data);
    return res.json({ok:true});
  }
  res.status(400).json({error:'Unknown action'});
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:e.message});}
};
