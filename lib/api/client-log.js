const {requireTelegram}=require('./_telegram-auth');
const {log}=require('./_audit');
module.exports=async function(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'POST only'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    let uid=null,gid=null,source='web';
    // Browser errors are allowed to be reported even if Telegram initData is
    // unavailable (for example a normal browser/Vercel preview). No secrets,
    // cookies, tokens or request headers are accepted from the client payload.
    const init=req.headers['x-telegram-init-data'];
    if(init){
      try{
        const a=requireTelegram(req);
        uid=Number(a.user?.id||0)||null;
        source='web-telegram';
      }catch(_){ source='web'; }
    }
    const level=['error','warn','info','critical'].includes(String(body.level))?String(body.level):'info';
    const action=String(body.action||'client-error').slice(0,80);
    const message=String(body.message||'').slice(0,1000);
    const requestId=await log({
      level,source,action,adminUserId:uid,giveawayId:gid,message,
      meta:{
        page:String(body.page||'').slice(0,200),
        stack:String(body.stack||'').slice(0,3000),
        userAgent:String(req.headers['user-agent']||'').slice(0,300),
        url:String(body.url||'').slice(0,300),
        line:Number(body.line||0)||null,
        column:Number(body.column||0)||null
      },
      notify: level==='error'||level==='critical',
      returnDetails:true
    });
    res.setHeader('Cache-Control','no-store');
    return res.json({ok:true,requestId:requestId.requestId,stored:requestId.stored,telegramSent:requestId.telegramSent,telegramError:requestId.telegramError});
  }catch(e){
    console.error('client-log failed',e);
    return res.status(500).json({error:'Log qabul qilinmadi'});
  }
};
