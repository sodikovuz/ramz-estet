async function tg(method, body) {
  const token=process.env.BOT_TOKEN;
  if(!token) throw new Error("BOT_TOKEN is missing");
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  });
  const d=await r.json();
  if(!d.ok) throw new Error(d.description||"Telegram API error");
  return d.result;
}
module.exports={tg};
