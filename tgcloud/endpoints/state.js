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
  let code = 200; res.status = (c) => { code = c; return res; };try{requireAdmin(req);const sql=db();const rows=await sql`SELECT * FROM giveaway_state ORDER BY updated_at DESC LIMIT 20`;res.setHeader("Cache-Control","no-store");res.json(rows);}catch(e){await auditError({source:'api',action:'state',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}};
