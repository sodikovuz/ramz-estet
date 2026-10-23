import { log } from '../lib/_audit.js';
export default async function handler(req) {
  let res = {
    status: (code) => res,
    json: (data) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'content-type': 'application/json' } }),
    end: () => new Response(null, { status: code || 200 }),
    setHeader: () => {}
  };
  let code = 200; res.status = (c) => { code = c; return res; };
 if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST only'});
 const secret=String(req.headers['x-admin-secret']||'');
 if(!(globalThis.env?.ADMIN_SECRET || process?.env?.ADMIN_SECRET)||secret!==(globalThis.env?.ADMIN_SECRET || process?.env?.ADMIN_SECRET)) return res.status(401).json({ok:false,error:'Unauthorized'});
 const r=await log({level:'error',source:'test',action:'manual.log_test',message:'RAMZ ESTET TEST ERROR',meta:{test:true},notify:true});
 return res.json({ok:true,...r});
};
