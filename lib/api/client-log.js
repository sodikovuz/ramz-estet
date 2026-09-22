const {log}=require('./_audit');

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST only'});
  let body={};
  try { body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); } catch(e) { return res.status(400).json({ok:false,error:'Invalid JSON'}); }
  const action=String(body.action||'client.error').slice(0,100);
  const message=String(body.message||'').slice(0,1200);
  const level=['error','warn','info','critical'].includes(String(body.level))?String(body.level):'error';
  const stack=String(body.stack||'').slice(0,9000);
  const clientError={name:String(body.errorName||'ClientError').slice(0,100),message,stack};
  const meta={
    page:String(body.page||'').slice(0,200),
    url:String(body.url||'').slice(0,500),
    line:Number(body.line||0)||null,
    column:Number(body.column||0)||null,
    userAgent:String(req.headers['user-agent']||'').slice(0,500),
    viewport:String(body.viewport||'').slice(0,100),
    online:body.online==null?null:Boolean(body.online),
    telegramVersion:String(body.telegramVersion||'').slice(0,100),
    stack
  };
  try {
    const result=await log({level,source:'web',action,message,error:clientError,meta,notify:(level==='error'||level==='critical')});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,...result,telegramAttempted:!!(process.env.DEVELOPER_TELEGRAM_ID&&process.env.BOT_TOKEN)});
  } catch(e) {
    console.error('[client-log] fatal',e);
    return res.status(500).json({ok:false,stored:false,error:'Log qabul qilinmadi'});
  }
};
