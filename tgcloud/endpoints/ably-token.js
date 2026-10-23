import Ably from 'ably';
import { error: auditError } from '../lib/_audit.js';
import { requireTelegram } from '../lib/_telegram-auth.js';
import { readStartApp } from '../lib/_security.js';
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!(globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY))return res.status(500).json({error:'ABLY_API_KEY is missing'});
  const auth=requireTelegram(req),body=typeof (req.body || req.json ? await req.clone().json().catch(()=>({})) : {})==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const token=String(body.startApp||auth.startParam||''), access=(await readStartApp(token,'watch'))||(await readStartApp(token,'join'));
  if(!access)return res.status(403).json({error:'Realtime havolasi yaroqsiz'});
  const client=new Ably.Rest((globalThis.env?.ABLY_API_KEY || process?.env?.ABLY_API_KEY));
  const channel=`giveaway:${access.gid}`;
  const tokenRequest=await client.auth.createTokenRequest({capability:JSON.stringify({[channel]:['subscribe']}),ttl:600000});
  res.setHeader('Cache-Control','no-store');res.status(200).json(tokenRequest);
 }catch(e){console.error(e);res.status(e.statusCode||500).json({error:'Realtime token yaratilmadi'});}
};
