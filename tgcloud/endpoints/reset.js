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
  if(gid){await sql`UPDATE giveaway_state SET status='ready',round=0,spin_id=0,start_at=NULL,target_index=NULL,participants='[]'::jsonb,participant_user_ids='[]'::jsonb,winners='[]'::jsonb,updated_at=NOW() WHERE giveaway_id=${gid}`;await new Ably.Rest((globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY)).channels.get(`giveaway:${gid}`).publish('reset',{type:'reset',giveawayId:gid});}
  else {await sql`UPDATE giveaway_state SET status='ready',round=0,spin_id=0,start_at=NULL,target_index=NULL,participants='[]'::jsonb,participant_user_ids='[]'::jsonb,winners='[]'::jsonb,updated_at=NOW()`;}
  res.json({ok:true});
 }catch(e){await auditError({source:'api',action:'reset',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
