const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const htmlPath=path.join(root,'public','admin.html');
const html=fs.readFileSync(htmlPath,'utf8');
const version=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||'dev';
const next=html.replace(/__ASSET_VERSION__/g,version);
if(next!==html) fs.writeFileSync(htmlPath,next);
console.log('[asset-version] admin assets version:',version);
