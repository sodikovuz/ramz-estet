const Ably=require('ably');
const {requireTelegram}=require('./_telegram-auth');
const {readStartApp}=require('./_security');
module.exports=async function(req,res){
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!process.env.ABLY_API_KEY)return res.status(500).json({error:'ABLY_API_KEY is missing'});
  const auth=requireTelegram(req),body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||''), access=readStartApp(token,'watch')||readStartApp(token,'join');
  if(!access)return res.status(403).json({error:'Realtime havolasi yaroqsiz'});
  const client=new Ably.Rest(process.env.ABLY_API_KEY);
  const channel=`giveaway:${access.gid}`;
  const tokenRequest=await client.auth.createTokenRequest({capability:JSON.stringify({[channel]:['subscribe']}),ttl:600000});
  res.setHeader('Cache-Control','no-store');res.status(200).json(tokenRequest);
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:'Realtime token yaratilmadi'});}
};
