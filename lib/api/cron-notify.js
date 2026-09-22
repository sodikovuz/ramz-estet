const {db}=require("./_db");
const {error: auditError}=require('./_audit');
const {tg}=require("./_telegram");
const {makeStartApp}=require("./_security");
const TZ="Asia/Tashkent";
module.exports=async function(req,res){
 try{
  if(process.env.CRON_SECRET && req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).end();
  const sql=db(), now=new Date();
  const gs=await sql`SELECT * FROM giveaways WHERE status='scheduled' AND start_at>NOW() AND start_at<NOW()+INTERVAL '16 minutes'`;
  for(const g of gs){
    const mins=Math.round((new Date(g.start_at)-now)/60000);
    const mark=mins<=2?"2m":mins<=5?"5m":mins<=15?"15m":null;
    if(!mark)continue;
    const key=`notify_${mark}`;
    const already=await sql`SELECT 1 FROM giveaway_notify_log WHERE giveaway_id=${g.id} AND marker=${mark} LIMIT 1`;
    if(already.length)continue;
    const ps=await sql`SELECT DISTINCT user_id FROM telegram_giveaway_participants WHERE giveaway_id=${g.id}`;
    const text=mark==="2m"?`🔥 2 daqiqa qoldi!\n#${g.id} ${g.title} tez orada boshlanadi.`:mark==="5m"?`⏰ 5 daqiqa qoldi!\n#${g.id} ${g.title}`:`⏰ 15 daqiqadan keyin\n#${g.id} ${g.title}`;
    const token=await makeStartApp(g.id,"watch");
    const url=`https://t.me/${process.env.BOT_USERNAME||"ramzestetbot"}/giveaway?startapp=${encodeURIComponent(token)}`;
    for(const p of ps){try{await tg("sendMessage",{chat_id:p.user_id,text,reply_markup:{inline_keyboard:[[{text:"👁 Tomosha qilish",url}]]}})}catch(e){await auditError({source:'cron',action:'winner-notification',error:e,meta:{recipientUserId:Number(p.user_id),giveawayId:gid}});}}
    await sql`INSERT INTO giveaway_notify_log(giveaway_id,marker) VALUES(${g.id},${mark})`;
  }
  res.json({ok:true});
 }catch(e){await auditError({source:'api',action:'cron-notify',error:e,meta:{method:req.method,path:req.url}});res.status(500).json({error:e.message});}
};
