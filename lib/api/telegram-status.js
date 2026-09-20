const {tg}=require("./_telegram");
module.exports=async function(req,res){
  try{
    const secret=req.headers["x-admin-secret"]||req.query?.secret;
    if(secret!==process.env.ADMIN_SECRET) return res.status(401).json({error:"Unauthorized"});
    const result=await tg("getWebhookInfo",{});
    res.status(200).json({ok:true,result});
  }catch(e){
    res.status(500).json({error:e.message});
  }
};
