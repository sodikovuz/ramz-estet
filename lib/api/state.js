const {error: auditError}=require('./_audit');
const {db}=require("./_db");
const {requireAdmin}=require("./_auth");
module.exports=async function(req,res){try{requireAdmin(req);const sql=db();const rows=await sql`SELECT * FROM giveaway_state ORDER BY updated_at DESC LIMIT 20`;res.setHeader("Cache-Control","no-store");res.json(rows);}catch(e){await auditError({source:'api',action:'state',error:e,meta:{method:req.method,path:req.url}});res.status(e.statusCode||500).json({error:e.message});}};
