const {db}=require('./_db');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
const {error: auditError}=require('./_audit');
module.exports=async function(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'POST only'});
    const auth=requireTelegram(req);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const token=String(body.startApp||auth.startParam||'');
    const access=await readStartApp(token,'join');
    if(!access) return res.status(403).json({error:'Join havolasi yaroqsiz yoki muddati tugagan'});
    const gid=access.gid, u=auth.user;
    const sql=db();
    const g=(await sql`SELECT id,title,status,start_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g) return res.status(404).json({error:'Giveaway topilmadi'});
    if(['closed','finished'].includes(String(g.status))) return res.status(409).json({error:'Bu giveaway yopilgan'});
    await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${Number(u.id)},${u.username||null},${u.first_name||null})
      ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name`;
    const rows=await sql`SELECT user_id,username,first_name FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at ASC`;
    const n=rows.length;
    const participantNames=rows.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,joined:true,participantCount:Number(n),participantNames,giveawayTitle:String(g.title||''),message:'🎉 Siz “'+String(g.title||'Giveaway')+'” giveawayiga qo‘shildingiz — ismingiz barabanda!'});
  }catch(e){console.error(e);await auditError({source:'web',action:'join',adminUserId:null,giveawayId:null,error:e,meta:{method:req.method,path:req.url,telegramUserId:req.body?.user?.id||null}});res.status(e.statusCode||500).json({error:e.message||'Join error'});}
};
