import Ably from 'ably';
import { error: auditError } from '../lib/_audit.js';
import { db } from '../lib/_db.js';
import { requireAdmin } from '../lib/_auth.js';
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});requireAdmin(req);
  const body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{}),gid=Number(body.giveawayId||0),sql=db();
  const s=(await sql`SELECT * FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0];
  if(!s)return res.status(404).json({error:'State missing'});
  const round=Number(body.round||s.round);if(round!==Number(s.round))return res.status(409).json({error:'Round mismatch'});
  if(s.status!=='spinning')return res.status(400).json({error:'No active spin'});
  return res.status(400).json({error:'Winner is server-selected; use /api/finish-round'});
 }catch(e){await auditError({source:'api',action:'next',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
