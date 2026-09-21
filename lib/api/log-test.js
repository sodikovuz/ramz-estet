const {log}=require('./_audit');
module.exports=async function(req,res){
 if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST only'});
 const secret=String(req.headers['x-admin-secret']||'');
 if(!process.env.ADMIN_SECRET||secret!==process.env.ADMIN_SECRET) return res.status(401).json({ok:false,error:'Unauthorized'});
 const r=await log({level:'error',source:'test',action:'manual.log_test',message:'RAMZ ESTET TEST ERROR',meta:{test:true},notify:true});
 return res.json({ok:true,...r});
};
