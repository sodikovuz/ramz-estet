const {tg}=require("./_telegram");
const {requireAdmin}=require("./_auth");
module.exports=async function(req,res){
 try{
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  requireAdmin(req);
  const base=(process.env.PUBLIC_BASE_URL||"").replace(/\/$/,"");
  if(!base)return res.status(400).json({error:"PUBLIC_BASE_URL missing"});
  if(!/^https:\/\//i.test(base))return res.status(400).json({error:"PUBLIC_BASE_URL HTTPS bo‘lishi kerak"});
  if(!process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET.length<16)return res.status(500).json({error:"TELEGRAM_WEBHOOK_SECRET missing/too short"});
  const result=await tg("setWebhook",{url:`${base}/api/telegram-webhook`,secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message","callback_query","inline_query","chosen_inline_result"],drop_pending_updates:true});
  res.json({ok:true,webhook:`${base}/api/telegram-webhook`,result});
 }catch(e){res.status(e.statusCode||500).json({error:e.message});}
};
