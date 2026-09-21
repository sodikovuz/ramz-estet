const {requireTelegram}=require('./_telegram-auth');
const {readPanelToken}=require('./_security');
const {log}=require('./_audit');
module.exports=async function(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'POST only'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    let uid=null,gid=null,source='web';
    const panel=req.headers['x-panel-token'];
    if(panel){
      const p=require('./_security').open(panel); if(!p||p.k!=='panel')return res.status(401).json({error:'Unauthorized'});
      uid=Number(p.u);gid=Number(p.g);source='admin-web';
    }else{
      const a=requireTelegram(req);uid=Number(a.user?.id||0)||null;
    }
    const level=['error','warn','info'].includes(String(body.level))?String(body.level):'info';
    const message=String(body.message||'').slice(0,1000);
    await log({level,source,action:String(body.action||'client-error').slice(0,80),adminUserId:uid,giveawayId:gid,message,meta:{page:String(body.page||'').slice(0,200),stack:String(body.stack||'').slice(0,1200),userAgent:String(req.headers['user-agent']||'').slice(0,300)}});
    res.setHeader('Cache-Control','no-store');return res.json({ok:true});
  }catch(e){return res.status(400).json({error:'Log qabul qilinmadi'});}
};
