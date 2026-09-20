const crypto=require('crypto');
const {safeEq}=require('./_security');

function verifyTelegramInitData(initData, maxAgeSec=86400){
  if(!initData || !process.env.BOT_TOKEN) return null;
  try{
    const params=new URLSearchParams(String(initData));
    const hash=params.get('hash');
    if(!hash) return null;
    params.delete('hash');
    const pairs=[...params.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`);
    const dataCheckString=pairs.join('\n');
    const secret=crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
    const calc=crypto.createHmac('sha256',secret).update(dataCheckString).digest('hex');
    if(!safeEq(calc,hash)) return null;
    const authDate=Number(params.get('auth_date')||0);
    if(!authDate || Math.abs(Math.floor(Date.now()/1000)-authDate)>maxAgeSec) return null;
    const user=JSON.parse(params.get('user')||'{}');
    if(!user || !Number(user.id)) return null;
    return {user,startParam:params.get('start_param')||''};
  }catch{return null;}
}
function requireTelegram(req){
  const raw=req.headers['x-telegram-init-data'] || req.headers['x-telegram-web-app-init-data'];
  const out=verifyTelegramInitData(raw);
  if(!out) throw Object.assign(new Error('Telegram sessiyasi tasdiqlanmadi. Mini App Telegram ichida ochilganini tekshiring.'),{statusCode:401});
  return out;
}
module.exports={verifyTelegramInitData,requireTelegram};
