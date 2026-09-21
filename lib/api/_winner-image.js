const sharp=require('sharp');
const fontkit=require('fontkit');
const crypto=require('crypto');
const QRCode=require('qrcode');

const fontPath=require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
const font=fontkit.openSync(fontPath);

function textPaths(text,fontSize,baselineY,opts={}){
  const value=String(text??'');
  const run=font.layout(value);
  const scale=fontSize/font.unitsPerEm;
  const letterSpacing=Number(opts.letterSpacing||0);
  const align=opts.align||'left';
  let width=0;

  for(let i=0;i<run.positions.length;i++){
    width+=(run.positions[i].xAdvance||0)*scale;
    if(i<run.positions.length-1) width+=letterSpacing;
  }

  let x=Number(opts.x||0);
  if(align==='center') x-=width/2;
  else if(align==='right') x-=width;

  const paths=[];
  for(let i=0;i<run.glyphs.length;i++){
    const pos=run.positions[i];
    const gx=x+(pos.xOffset||0)*scale;
    const gy=baselineY-(pos.yOffset||0)*scale;
    const d=run.glyphs[i].path.toSVG();

    if(d){
      paths.push('<path d="'+d+'" transform="translate('+gx.toFixed(2)+' '+gy.toFixed(2)+') scale('+scale.toFixed(6)+' '+(-scale).toFixed(6)+')"/>');
    }

    x+=(pos.xAdvance||0)*scale;
    if(i<run.glyphs.length-1) x+=letterSpacing;
  }

  return paths.join('');
}

/* Branded virtual signature. It is vector-drawn so it renders reliably on Vercel. */
function signaturePaths(x,y,scale=1){
  const s=Number(scale);
  return [
    '<g fill="none" stroke="#8fa8ff" stroke-width="'+(4*s)+'" stroke-linecap="round" stroke-linejoin="round" opacity="0.98">',
    '<path d="M '+(x+8*s)+' '+(y+72*s)+' C '+(x+18*s)+' '+(y+18*s)+', '+(x+61*s)+' '+(y+2*s)+', '+(x+84*s)+' '+(y+27*s)+' C '+(x+103*s)+' '+(y+48*s)+', '+(x+76*s)+' '+(y+72*s)+', '+(x+49*s)+' '+(y+61*s)+' C '+(x+27*s)+' '+(y+52*s)+', '+(x+39*s)+' '+(y+23*s)+', '+(x+70*s)+' '+(y+14*s)+'"/>',
    '<path d="M '+(x+71*s)+' '+(y+14*s)+' C '+(x+53*s)+' '+(y+48*s)+', '+(x+56*s)+' '+(y+91*s)+', '+(x+36*s)+' '+(y+107*s)+' C '+(x+19*s)+' '+(y+120*s)+', '+(x+10*s)+' '+(y+101*s)+', '+(x+29*s)+' '+(y+86*s)+' C '+(x+55*s)+' '+(y+66*s)+', '+(x+99*s)+' '+(y+72*s)+', '+(x+137*s)+' '+(y+93*s)+' C '+(x+178*s)+' '+(y+116*s)+', '+(x+224*s)+' '+(y+98*s)+', '+(x+250*s)+' '+(y+65*s)+'"/>',
    '<path d="M '+(x+140*s)+' '+(y+92*s)+' C '+(x+155*s)+' '+(y+54*s)+', '+(x+188*s)+' '+(y+45*s)+', '+(x+198*s)+' '+(y+66*s)+' C '+(x+205*s)+' '+(y+84*s)+', '+(x+177*s)+' '+(y+94*s)+', '+(x+159*s)+' '+(y+81*s)+'"/>',
    '<path d="M '+(x+192*s)+' '+(y+94*s)+' C '+(x+232*s)+' '+(y+113*s)+', '+(x+273*s)+' '+(y+103*s)+', '+(x+307*s)+' '+(y+76*s)+'"/>',
    '<path d="M '+(x+4*s)+' '+(y+128*s)+' C '+(x+84*s)+' '+(y+111*s)+', '+(x+207*s)+' '+(y+140*s)+', '+(x+319*s)+' '+(y+118*s)+'"/>',
    '</g>',
    '<g fill="none" stroke="#365cff" stroke-width="'+(10*s)+'" opacity="0.16">',
    '<path d="M '+(x+20*s)+' '+(y+77*s)+' C '+(x+85*s)+' '+(y+24*s)+', '+(x+170*s)+' '+(y+126*s)+', '+(x+312*s)+' '+(y+75*s)+'"/>',
    '<path d="M '+(x+32*s)+' '+(y+115*s)+' C '+(x+118*s)+' '+(y+89*s)+', '+(x+220*s)+' '+(y+141*s)+', '+(x+305*s)+' '+(y+106*s)+'"/>',
    '</g>'
  ].join('');
}

function stampSvg(cx,cy,r){
  const ink='#68a7ff';
  const dark='#0c3e88';
  const specks=[];
  for(let i=0;i<34;i++){
    const ang=(i*47)%360;
    const rr=r+8+((i*13)%22);
    const rad=ang*Math.PI/180;
    specks.push(
      '<circle cx="'+(cx+Math.cos(rad)*rr)+'" cy="'+(cy+Math.sin(rad)*rr)+'" r="'+(1+(i%3)*0.7)+'"/>'
    );
  }

  return [
    '<g fill="'+ink+'" opacity="0.13">'+specks.join('')+'</g>',
    '<g fill="none" stroke="'+ink+'" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" stroke-width="5" opacity="0.92"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-12)+'" stroke-width="2.5" opacity="0.9"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-25)+'" stroke-width="2" stroke-dasharray="3 6" opacity="0.75"/>',
    '</g>',
    '<g fill="'+ink+'" opacity="0.96">',
    textPaths('RAMZ ESTET',19,cy-r+35,{x:cx,align:'center',letterSpacing:2.1}),
    textPaths('VIRTUAL MUHR',13,cy+r-19,{x:cx,align:'center',letterSpacing:1.5}),
    '</g>',
    '<g fill="'+dark+'">',
    '<circle cx="'+(cx-r+30)+'" cy="'+cy+'" r="4"/>',
    '<circle cx="'+(cx+r-30)+'" cy="'+cy+'" r="4"/>',
    '</g>',
    '<g fill="none" stroke="'+dark+'" stroke-width="3" opacity="0.9">',
    '<path d="M '+(cx-25)+' '+(cy+26)+' L '+(cx-25)+' '+(cy-13)+' L '+cx+' '+(cy-30)+' L '+(cx+25)+' '+(cy-13)+' L '+(cx+25)+' '+(cy+26)+'"/>',
    '<path d="M '+(cx-25)+' '+(cy-13)+' L '+cx+' '+(cy+6)+' L '+(cx+25)+' '+(cy-13)+'"/>',
    '</g>',
    '<g fill="'+ink+'">'+
      textPaths('RE',43,cy+16,{x:cx,align:'center',letterSpacing:1})+
    '</g>',
    '<g fill="'+dark+'">',
    textPaths('RE-2026',11,cy+r-39,{x:cx,align:'center',letterSpacing:1.5}),
    '</g>',
    '<g fill="none" stroke="'+ink+'" opacity="0.38" stroke-width="2">',
    '<path d="M '+(cx-r+15)+' '+(cy-r+18)+' L '+(cx+r-18)+' '+(cy+r-13)+'"/>',
    '<path d="M '+(cx-r+24)+' '+(cy+r-18)+' L '+(cx+r-12)+' '+(cy-r+20)+'"/>',
    '</g>'
  ].join('');
}

function watermarkSvg(){
  return [
    '<g fill="#e7c65c" opacity="0.035">',
    textPaths('RE',210,760,{x:915,align:'center',letterSpacing:8}),
    '</g>',
    '<g fill="none" stroke="#c8d7ee" opacity="0.045">',
    '<path d="M60 285 C245 175 385 410 585 300 S930 170 1140 300" stroke-width="2"/>',
    '<path d="M60 305 C245 195 385 430 585 320 S930 190 1140 320" stroke-width="1"/>',
    '<path d="M60 325 C245 215 385 450 585 340 S930 210 1140 340" stroke-width="1"/>',
    '</g>'
  ].join('');
}

async function renderWinnerImage(title,winners,dateText){
  const safeTitle=String(title||'Giveaway');
  const list=Array.isArray(winners)?winners:[];
  const count=list.length;

  const rowStart=305;
  const rowGap=62;
  const lastRowY=rowStart+Math.max(0,count-1)*rowGap;
  const dividerY=lastRowY+76;
  const footerTitleY=dividerY+48;
  const footerSubY=dividerY+78;
  const footerTop=dividerY+105;
  const height=Math.max(1050,footerTop+310);
  const dateY=height-34;

  const rows=list.map((w,i)=>
    '<g fill="#f5f5f5">'+textPaths((i+1)+'-g‘olib — '+String(w.winner||''),30,rowStart+i*rowGap,{x:100})+'</g>'
  ).join('');

  const docSeed=JSON.stringify({
    title:safeTitle,
    winners:list.map(w=>String(w.winner||'')),
    date:String(dateText||'')
  });
  const docId='RE-GW-'+crypto.createHash('sha256').update(docSeed).digest('hex').slice(0,12).toUpperCase();
  const verifyPayload='RAMZ ESTET | '+docId;
  const qrBuffer=await QRCode.toBuffer(verifyPayload,{
    type:'png',
    width:132,
    margin:2,
    errorCorrectionLevel:'H',
    color:{dark:'#111111',light:'#ffffff'}
  });

  const baseSvg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'">'+
    '<rect width="100%" height="100%" fill="#070707"/>'+
    '<rect x="28" y="28" width="1144" height="'+(height-56)+'" rx="32" fill="#111" stroke="#9a7600" stroke-width="3"/>'+
    watermarkSvg()+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',58,105,{x:600,align:'center',letterSpacing:8})+'</g>'+
    '<g fill="#fff">'+textPaths('GIVEAWAY YAKUNIY NATIJALARI',34,170,{x:600,align:'center'})+'</g>'+
    '<g fill="#aaa">'+textPaths(safeTitle,26,220,{x:600,align:'center'})+'</g>'+
    rows+
    '<line x1="100" y1="'+dividerY+'" x2="1100" y2="'+dividerY+'" stroke="#9a7600" stroke-width="2"/>'+
    '<g fill="#e7c65c">'+textPaths('BARCHA G‘OLIBLARNI TABRIKLAYMIZ!',28,footerTitleY,{x:600,align:'center',letterSpacing:1})+'</g>'+
    '<g fill="#aaa">'+textPaths('ISHONCH UCHUN RAHMAT',19,footerSubY,{x:600,align:'center',letterSpacing:2})+'</g>'+
    '<g filter="url(#sigGlow)">'+signaturePaths(350,footerTop+62,0.80)+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('VIRTUAL IMZO',19,footerTop+42,{x:350})+'</g>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',16,footerTop+190,{x:505,align:'center',letterSpacing:2})+'</g>'+
    '<g>'+stampSvg(825,footerTop+130,112)+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('TEKSHIRISH UCHUN',13,footerTop+62,{x:110,letterSpacing:1.5})+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('SKANERLANG',13,footerTop+84,{x:110,letterSpacing:1.5})+'</g>'+
    '<g fill="#aaa">'+textPaths('RAMZ ESTET OFFICIAL',11,footerTop+180,{x:110,letterSpacing:1.2})+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('HUJJAT RAQAMI:',13,footerTop+92,{x:980})+'</g>'+
    '<g fill="#e7c65c">'+textPaths(docId,12,footerTop+115,{x:980})+'</g>'+
    '<g fill="#777">'+textPaths(String(dateText||''),16,dateY,{x:1100,align:'right'})+'</g>'+
    '<line x1="100" y1="'+(height-58)+'" x2="1100" y2="'+(height-58)+'" stroke="#9a7600" stroke-width="1"/>'+
    '<g fill="#111"><rect x="80" y="'+(footerTop+98)+'" width="150" height="150" rx="8"/></g>'+
    '<defs><filter id="sigGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'+
    '</svg>';

  const base=await sharp(Buffer.from(baseSvg)).png().toBuffer();
  return sharp(base).composite([{input:qrBuffer,left:89,top:footerTop+107}]).png().toBuffer();
}

module.exports={renderWinnerImage};
