const crypto=require('crypto');
const {db}=require('./_db');

function verifyInitData(initData){
  if(!initData||!process.env.BOT_TOKEN) return null;
  const p=new URLSearchParams(initData);
  const hash=p.get('hash'); if(!hash) return null;
  const pairs=[];
  for(const [k,v] of p.entries()) if(k!=='hash') pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret=crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
  const calculated=crypto.createHmac('sha256',secret).update(pairs.join('\n')).digest('hex');
  if(calculated.length!==hash.length || !crypto.timingSafeEqual(Buffer.from(calculated),Buffer.from(hash))) return null;
  const authDate=Number(p.get('auth_date')||0);
  if(!authDate || Math.floor(Date.now()/1000)-authDate>86400) return null;
  let user=null; try{user=JSON.parse(p.get('user')||'null')}catch{}
  return user;
}

module.exports=async function(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'POST required'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const user=verifyInitData(String(body.initData||''));
    if(!user?.id) return res.status(401).json({error:'Telegram user tasdiqlanmadi'});
    const gid=Number(body.gid||0);
    if(!gid) return res.status(400).json({error:'gid required'});
    const sql=db();
    const g=(await sql`SELECT id,title,status,start_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
    if(!g) return res.status(404).json({error:'Giveaway topilmadi'});
    if(g.status==='finished') return res.status(400).json({error:'Bu giveaway tugagan'});
    await sql`INSERT INTO telegram_giveaway_participants(giveaway_id,user_id,username,first_name)
      VALUES(${gid},${user.id},${user.username||null},${user.first_name||null})
      ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name`;
    const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${gid}`)[0].n;
    res.json({ok:true,joined:true,participantCount:c,user:{id:user.id,username:user.username||null,first_name:user.first_name||null}});
  }catch(e){console.error(e);res.status(500).json({error:e.message||'Server error'});}
};
