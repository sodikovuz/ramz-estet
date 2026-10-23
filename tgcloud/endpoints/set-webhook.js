import { tg } from '../lib/_telegram.js';
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
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  requireAdmin(req);
  const base=((globalThis.env?.PUBLIC_BASE_URL || process?.env?.PUBLIC_BASE_URL)||"").replace(/\/$/,"");
  if(!base)return res.status(400).json({error:"PUBLIC_BASE_URL missing"});
  if(!/^https:\/\//i.test(base))return res.status(400).json({error:"PUBLIC_BASE_URL HTTPS bo‘lishi kerak"});
  if(!(globalThis.env?.TELEGRAM_WEBHOOK_SECRET || process?.env?.TELEGRAM_WEBHOOK_SECRET) || (globalThis.env?.TELEGRAM_WEBHOOK_SECRET || process?.env?.TELEGRAM_WEBHOOK_SECRET).length<16)return res.status(500).json({error:"TELEGRAM_WEBHOOK_SECRET missing/too short"});
  const result=await tg("setWebhook",{url:`${base}/api/telegram-webhook`,secret_token:(globalThis.env?.TELEGRAM_WEBHOOK_SECRET || process?.env?.TELEGRAM_WEBHOOK_SECRET),allowed_updates:["message","callback_query","inline_query","chosen_inline_result","my_chat_member"],drop_pending_updates:true});
  res.json({ok:true,webhook:`${base}/api/telegram-webhook`,result});
 }catch(e){await auditError({source:'api',action:'set-webhook',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}
};
