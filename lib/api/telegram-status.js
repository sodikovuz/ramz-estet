const {tg}=require("./_telegram");
const {requireAdmin}=require("./_auth");
module.exports=async function(req,res){
  try{
    requireAdmin(req);
    const result=await tg("getWebhookInfo",{});
    res.status(200).json({ok:true,result});
  }catch(e){
    res.status(500).json({error:e.message});
  }
};
