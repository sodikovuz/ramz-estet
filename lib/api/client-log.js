const {log}=require('./_audit');

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST only'});
  let body={};
  try { body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); } catch(e) { return res.status(400).json({ok:false,error:'Invalid JSON'}); }
  const action=String(body.action||'client.error').slice(0,100);
  const message=String(body.message||'').slice(0,1200);
  const level=['error','warn','info','critical'].includes(String(body.level))?String(body.level):'error';
  const meta={
    page:String(body.page||'').slice(0,200),
    url:String(body.url||'').slice(0,500),
    stack:String(body.stack||'').slice(0,5000),
    line:Number(body.line||0)||null,
    column:Number(body.column||0)||null,
    userAgent:String(req.headers['user-agent']||'').slice(0,500)
  };
  try {
    const result=await log({level,source:'web',action,message,meta,notify:(level==='error'||level==='critical')});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,...result,telegramAttempted:!!(process.env.DEVELOPER_TELEGRAM_ID&&process.env.BOT_TOKEN)});
  } catch(e) {
    console.error('[client-log] fatal',e);
    return res.status(500).json({ok:false,stored:false,error:'Log qabul qilinmadi'});
  }
};
