
import { db } from '../lib/_db.js';
import { error: auditError } from '../lib/_audit.js';
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
  requireAdmin(req);
  const sql=db();
  const rows=await sql`SELECT id,title,description,total_rounds,status,telegram_status,created_at,started_at,finished_at FROM giveaways ORDER BY id DESC LIMIT 100`;
  const counts=await sql`SELECT giveaway_id,COUNT(*)::int AS n FROM telegram_giveaway_participants GROUP BY giveaway_id`;
  const map=new Map(counts.map(x=>[Number(x.giveaway_id),Number(x.n)]));
  res.json({giveaways:rows.map(x=>({...x,id:Number(x.id),participant_count:map.get(Number(x.id))||0,total_rounds:Number(x.total_rounds)}))});
 }catch(e){await auditError({source:'api',action:'giveaways',error:e,meta:{method:req.method,path:req.url}});res.status(500).json({error:e.message});}
};
