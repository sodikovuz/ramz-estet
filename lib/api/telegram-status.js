const {error: auditError}=require('./_audit');
const {tg}=require("./_telegram");
const {requireAdmin}=require("./_auth");
module.exports=async function(req,res){
  try{
    requireAdmin(req);
    const result=await tg("getWebhookInfo",{});
    res.status(200).json({ok:true,result});
  }catch(e){console.error(e);await auditError({source:'api',action:'test-winner-image',error:e,meta:{method:req.method,path:req.url}});res.status(500).json({error:e.message});}
};
