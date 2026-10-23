import { db } from '../lib/_db.js';
import Ably from 'ably';
import { requireTelegram } from '../lib/_telegram-auth.js';
import { readStartApp } from '../lib/_security.js';
import { error: auditError } from '../lib/_audit.js';
async function publish(gid,name,data){if(!(globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY))return;await new Ably.Rest((globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY)).channels.get(`giveaway:${gid}`).publish(name,data)}
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
  const auth=requireTelegram(req), body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||''), access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  if(!access)return res.status(403).json({error:'Watch havolasi yaroqsiz yoki muddati tugagan'});
  const gid=access.gid, u=auth.user, sql=db();
  const g=(await sql`SELECT id,title,description,image_file_id,total_rounds,status,start_at,started_at,finished_at FROM giveaways WHERE id=${gid} LIMIT 1`)[0];
  if(!g)return res.status(404).json({error:'Giveaway not found'});
  const participantRows=await sql`SELECT user_id,username,first_name,joined_at FROM telegram_giveaway_participants WHERE giveaway_id=${gid} ORDER BY joined_at ASC`;
  const c=participantRows.length;
  const participantNames=participantRows.map(p=>p.username?`@${p.username}`:(p.first_name||String(p.user_id)));
  await sql`INSERT INTO giveaway_viewers(giveaway_id,user_id,username,first_name)
    VALUES(${gid},${Number(u.id)},${u.username||null},${u.first_name||null})
    ON CONFLICT(giveaway_id,user_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,last_seen_at=NOW()`;
  const vc=(await sql`SELECT COUNT(*)::int n FROM giveaway_viewers WHERE giveaway_id=${gid} AND last_seen_at>NOW()-INTERVAL '45 seconds'`)[0].n;
  await publish(gid,'viewers',{count:Number(vc)});
  const st=(await sql`SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners FROM giveaway_state WHERE giveaway_id=${gid} LIMIT 1`)[0]||null;
  res.setHeader('Cache-Control','no-store');
  const safeState=st?{...st,participants:participantNames}:null;
  res.json({giveaway:g,participantCount:Number(c),participantNames,viewerCount:Number(vc),state:safeState});
 }catch(e){console.error(e);await auditError({source:'web',action:'watch',adminUserId:null,giveawayId:null,error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
