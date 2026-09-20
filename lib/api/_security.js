const crypto = require('crypto');

function b64u(buf){
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64u(s){
  const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');
  return Buffer.from(p + '='.repeat((4-p.length%4)%4),'base64');
}
function requireSecret(name){
  const s=process.env[name];
  if(!s || s.length<24) throw Object.assign(new Error(`${name} is missing or too short`),{statusCode:500});
  return s;
}
function keyFor(name){return crypto.createHash('sha256').update(requireSecret(name)).digest();}

// Opaque authenticated token. The payload is encrypted with AES-256-GCM;
// callers cannot derive giveaway IDs, user IDs or admin IDs from the token.
function seal(payload, secretName='STARTAPP_SECRET'){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',keyFor(secretName),iv);
  const plain=Buffer.from(JSON.stringify(payload),'utf8');
  const ct=Buffer.concat([cipher.update(plain),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `v1.${b64u(iv)}.${b64u(ct)}.${b64u(tag)}`;
}
function open(token, secretName='STARTAPP_SECRET'){
  try{
    const [v,ivS,ctS,tagS]=String(token||'').split('.');
    if(v!=='v1'||!ivS||!ctS||!tagS) return null;
    const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(secretName),unb64u(ivS));
    decipher.setAuthTag(unb64u(tagS));
    const plain=Buffer.concat([decipher.update(unb64u(ctS)),decipher.final()]);
    const p=JSON.parse(plain.toString('utf8'));
    if(!p || !Number.isFinite(Number(p.exp)) || Number(p.exp)<Math.floor(Date.now()/1000)) return null;
    return p;
  }catch{return null;}
}
function makeStartApp(gid, action){
  return seal({v:1,k:'miniapp',a:String(action),g:String(gid),exp:Math.floor(Date.now()/1000)+7*24*3600,n:crypto.randomBytes(12).toString('hex')});
}
function readStartApp(token, action){
  const p=open(token);
  if(!p || p.k!=='miniapp' || p.a!==String(action) || !/^\d+$/.test(String(p.g))) return null;
  return {gid:Number(p.g)};
}
function makePanelToken(gid, uid){
  return seal({v:1,k:'panel',g:String(gid),u:String(uid),exp:Math.floor(Date.now()/1000)+30*60,n:crypto.randomBytes(12).toString('hex')});
}
function readPanelToken(token, gid, uid){
  const p=open(token);
  if(!p || p.k!=='panel' || String(p.g)!==String(gid) || String(p.u)!==String(uid)) return false;
  return true;
}
function safeEq(a,b){
  const A=Buffer.from(String(a)),B=Buffer.from(String(b));
  return A.length===B.length && crypto.timingSafeEqual(A,B);
}
module.exports={seal,open,makeStartApp,readStartApp,makePanelToken,readPanelToken,safeEq};
