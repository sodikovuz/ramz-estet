(function(){
  window.__adminBooted=false;
  var app=document.getElementById('app');
  var hash=location.hash||'';
  var token='';
  try{token=new URLSearchParams(hash.replace(/^#/,'')).get('token')||'';}catch(_){token='';}
  function report(e){try{fetch('/api/client-log',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({action:'admin.bootstrap.error',level:'critical',message:e&&e.message||'Admin JavaScript error',errorName:e&&e.name||'ScriptError',stack:e&&e.stack||'',page:location.pathname,url:location.href.split('#')[0],line:e&&e.lineno||null,column:e&&e.colno||null,viewport:innerWidth+'x'+innerHeight,online:navigator.onLine})})}catch(_){} }
  window.addEventListener('error',function(e){report(e.error||e);if(app&&!window.__adminBooted){app.innerHTML='<div class="loading">Admin panel yuklanmadi.</div>';}});
  if(!token){app.innerHTML='<div class="loading">Kirish ruxsati kerak.</div>';return;}
  var s=document.createElement('script');
  s.src='/admin.js?v=__ASSET_VERSION__';
  s.async=false;
  s.onload=function(){window.__adminBooted=true;};
  s.onerror=function(){report({name:'AssetLoadError',message:'Admin asset yuklanmadi',stack:''});if(app)app.innerHTML='<div class="loading">Admin panel yuklanmadi.</div>';};
  document.head.appendChild(s);
})();
