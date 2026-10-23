import { error: auditError } from '../lib/_audit.js';
import { tg } from '../lib/_telegram.js';
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
    const result=await tg("getWebhookInfo",{});
    res.status(200).json({ok:true,result});
  }catch(e){console.error(e);await auditError({source:'api',action:'test-winner-image',error:e,meta:{method:req.method,path:req.url}});res.status(500).json({error:e.message});}
};
