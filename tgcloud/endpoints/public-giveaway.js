import { db } from '../lib/_db.js';
import { error: auditError } from '../lib/_audit.js';
import { requireTelegram } from '../lib/_telegram-auth.js';
import { readStartApp } from '../lib/_security.js';
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const auth=requireTelegram(req),body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{}),token=String(body.startApp||auth.startParam||'');
  const access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  if(!access)return res.status(403).json({error:'Havola yaroqsiz'});
  const sql=db(),g=(await sql`SELECT id,title,description,total_rounds,status,created_at FROM giveaways WHERE id=${access.gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway not found'});
  const c=(await sql`SELECT COUNT(*)::int n FROM telegram_giveaway_participants WHERE giveaway_id=${access.gid}`)[0].n;
  const ws=await sql`SELECT round,winner_label,won_at FROM giveaway_winners WHERE giveaway_id=${access.gid} ORDER BY round`;
  res.setHeader('Cache-Control','no-store');res.json({giveaway:g,participantCount:Number(c),winners:ws});
 }catch(e){await auditError({source:'api',action:'public-giveaway',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
