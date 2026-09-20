const crypto = require('crypto');
function b64u(buf){return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unb64u(s){const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');return Buffer.from(p+'='.repeat((4-p.length%4)%4),'base64');}
function requireSecret(name){const s=process.env[name];if(!s||s.length<24)throw Object.assign(new Error(`${name} is missing or too short`),{statusCode:500});return s;}
function keyFor(name){return crypto.createHash('sha256').update(requireSecret(name)).digest();}
function seal(payload,secretName='STARTAPP_SECRET'){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',keyFor(secretName),iv);const plain=Buffer.from(JSON.stringify(payload));const ct=Buffer.concat([cipher.update(plain),cipher.final()]);return `v1.${b64u(iv)}.${b64u(ct)}.${b64u(cipher.getAuthTag())}`;}
function open(token,secretName='STARTAPP_SECRET'){try{const [v,ivS,ctS,tagS]=String(token||'').split('.');if(v!=='v1'||!ivS||!ctS||!tagS)return null;const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(secretName),unb64u(ivS));decipher.setAuthTag(unb64u(tagS));const plain=Buffer.concat([decipher.update(unb64u(ctS)),decipher.final()]);const p=JSON.parse(plain.toString());if(!p||!Number.isFinite(Number(p.exp))||Number(p.exp)<Math.floor(Date.now()/1000))return null;return p;}catch{return null;}}
// Telegram startapp has a short payload limit. Never put the encrypted giveaway
// payload in the URL. Use a 43-character opaque random capability and store only
// its SHA-256 hash server-side. The raw token cannot reveal giveaway/action IDs.
async function makeStartApp(gid,action){
  const {db}=require('./_db');
  const token=b64u(crypto.randomBytes(32));
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const exp=new Date(Date.now()+7*24*3600*1000);
  const sql=db();
  await sql`CREATE TABLE IF NOT EXISTS startapp_tokens (token_hash TEXT PRIMARY KEY,giveaway_id BIGINT NOT NULL,action TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`INSERT INTO startapp_tokens(token_hash,giveaway_id,action,expires_at) VALUES(${hash},${Number(gid)},${String(action)},${exp})`;
  return token;
}
async function readStartApp(token,action){
  const t=String(token||'');
  if(!/^[A-Za-z0-9_-]{43}$/.test(t))return null;
  const {db}=require('./_db');
  const hash=crypto.createHash('sha256').update(t).digest('hex');
  const sql=db();
  await sql`CREATE TABLE IF NOT EXISTS startapp_tokens (token_hash TEXT PRIMARY KEY,giveaway_id BIGINT NOT NULL,action TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows=await sql`SELECT giveaway_id FROM startapp_tokens WHERE token_hash=${hash} AND action=${String(action)} AND expires_at>NOW() LIMIT 1`;
  return rows[0]?{gid:Number(rows[0].giveaway_id)}:null;
}
function makePanelToken(gid,uid){return seal({v:1,k:'panel',g:String(gid),u:String(uid),exp:Math.floor(Date.now()/1000)+1800,n:crypto.randomBytes(12).toString('hex')});}
function readPanelToken(token,gid,uid){const p=open(token);return !!(p&&p.k==='panel'&&String(p.g)===String(gid)&&String(p.u)===String(uid));}
function safeEq(a,b){const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B);}
module.exports={seal,open,makeStartApp,readStartApp,makePanelToken,readPanelToken,safeEq};
