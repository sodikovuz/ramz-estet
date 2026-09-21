const {requireTelegram}=require('./_telegram-auth');
const {isAdminTelegramUser,log}=require('./_audit');

function validSecret(req){
  const supplied=String(req.headers['x-admin-secret']||'');
  const expected=String(process.env.ADMIN_SECRET||'');
  return !!expected && supplied.length===expected.length && supplied===expected;
}

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  let uid=null, authorized=validSecret(req);
  if(!authorized){
    try{
      const a=requireTelegram(req);
      uid=Number(a.user?.id||0)||null;
      authorized=!!uid && isAdminTelegramUser(uid);
    }catch(_){}
  }
  if(!authorized) return res.status(403).json({error:'Admin only'});
  const result=await log({
    level:'error',
    source:'test',
    action:'manual.test-log',
    adminUserId:uid,
    message:'RAMZ ESTET TEST ERROR — logging system test',
    meta:{test:true},
    notify:true,
    returnDetails:true
  });
  return res.json({ok:true,...result});
};
