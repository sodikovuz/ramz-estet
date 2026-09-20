const {tg}=require("./_telegram");
module.exports=async function(req,res){
 try{
  const secret=req.headers["x-admin-secret"]||req.query?.secret;
  if(secret!==process.env.ADMIN_SECRET) return res.status(401).json({error:"Unauthorized"});
  const base=(process.env.PUBLIC_BASE_URL||"").replace(/\/$/,"");
  if(!base) return res.status(400).json({error:"PUBLIC_BASE_URL missing"});
  const result=await tg("setWebhook",{url:`${base}/api/telegram-webhook`,allowed_updates:["message","callback_query"]});
  res.status(200).json({ok:true,result});
 }catch(e){res.status(500).json({error:e.message})}
};
