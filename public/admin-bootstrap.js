window.__adminBooted=false;
window.addEventListener('error',function(e){
  try{fetch('/api/client-log',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({action:'admin.bootstrap.error',level:'critical',message:e.message||'Admin JavaScript error',errorName:e.error&&e.error.name||'ScriptError',stack:e.error&&e.error.stack||'',page:location.pathname,url:location.href.split('#')[0],line:e.lineno||null,column:e.colno||null,viewport:innerWidth+'x'+innerHeight,online:navigator.onLine,telegramVersion:window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.version||''})})}catch(_){}
  var app=document.getElementById('app');if(app&&!window.__adminBooted){app.innerHTML='<div class="card"><h2>Admin panel xatosi</h2><p class="muted">JavaScript ishga tushmadi. Xato avtomatik logga yuborildi.</p></div>'}
});
setTimeout(function(){if(!window.__adminBooted){var app=document.getElementById('app');if(app&&app.textContent.indexOf('Yuklanmoqda')!==-1)app.innerHTML='<div class="card"><h2>Admin panel ishga tushmadi</h2><p class="muted">JavaScript yuklanishi kutilganidan uzoq davom etdi. Xato logga yuborildi.</p></div>'}},5000);
