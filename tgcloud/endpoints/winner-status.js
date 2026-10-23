import { error: auditError } from '../lib/_audit.js';
import { db } from '../lib/_db.js';
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
  const auth=requireTelegram(req),body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||''),access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  const round=Number(body.round||0);
  if(!access || auth.startParam!==token || !round)return res.status(403).json({error:'Tasdiqlash xatosi'});
  const sql=db();
  const w=(await sql`SELECT round,winner_label FROM giveaway_winners WHERE giveaway_id=${access.gid} AND round=${round} AND user_id=${Number(auth.user.id)} LIMIT 1`)[0];
  res.setHeader('Cache-Control','no-store');res.json({ok:true,isWinner:!!w,winner:w?.winner_label||null});
 }catch(e){await auditError({source:'api',action:'winner-status',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
