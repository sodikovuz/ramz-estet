import { error: auditError } from '../lib/_audit.js';
import { renderWinnerImage } from '../lib/_winner-image.js';

export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
  try{
    if(req.method!=='GET')return res.status(405).json({error:'GET only'});
    const winners=[
      {winner:'@username1'},
      {winner:'@username2'},
      {winner:'@username3'},
      {winner:'@username4'},
      {winner:'@username5'}
    ];
    const dateText=new Date().toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'});
    const png=await renderWinnerImage('RAMZ ESTET Giveaway',winners,dateText);
    res.setHeader('Content-Type','image/png');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(png);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:e.message||'Image generation error'});
  }
};
