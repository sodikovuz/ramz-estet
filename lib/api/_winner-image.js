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
    '<g fill="none" stroke="#f5f7ff" stroke-width="'+(3.6*s)+'" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M '+(x+8*s)+' '+(y+76*s)+' C '+(x+18*s)+' '+(y+22*s)+', '+(x+60*s)+' '+(y+2*s)+', '+(x+83*s)+' '+(y+27*s)+' C '+(x+103*s)+' '+(y+48*s)+', '+(x+77*s)+' '+(y+70*s)+', '+(x+51*s)+' '+(y+61*s)+' C '+(x+27*s)+' '+(y+53*s)+', '+(x+37*s)+' '+(y+23*s)+', '+(x+69*s)+' '+(y+15*s)+'"/>',
    '<path d="M '+(x+70*s)+' '+(y+14*s)+' C '+(x+55*s)+' '+(y+44*s)+', '+(x+55*s)+' '+(y+91*s)+', '+(x+36*s)+' '+(y+105*s)+' C '+(x+20*s)+' '+(y+117*s)+', '+(x+10*s)+' '+(y+101*s)+', '+(x+28*s)+' '+(y+86*s)+' C '+(x+52*s)+' '+(y+66*s)+', '+(x+94*s)+' '+(y+72*s)+', '+(x+132*s)+' '+(y+92*s)+' C '+(x+173*s)+' '+(y+114*s)+', '+(x+218*s)+' '+(y+97*s)+', '+(x+244*s)+' '+(y+66*s)+'"/>',
    '<path d="M '+(x+135*s)+' '+(y+91*s)+' C '+(x+151*s)+' '+(y+53*s)+', '+(x+187*s)+' '+(y+45*s)+', '+(x+196*s)+' '+(y+67*s)+' C '+(x+202*s)+' '+(y+84*s)+', '+(x+175*s)+' '+(y+93*s)+', '+(x+158*s)+' '+(y+81*s)+'"/>',
    '<path d="M '+(x+188*s)+' '+(y+93*s)+' C '+(x+229*s)+' '+(y+112*s)+', '+(x+270*s)+' '+(y+103*s)+', '+(x+302*s)+' '+(y+77*s)+'"/>',
    '<path d="M '+(x+7*s)+' '+(y+126*s)+' C '+(x+84*s)+' '+(y+111*s)+', '+(x+207*s)+' '+(y+140*s)+', '+(x+315*s)+' '+(y+119*s)+'"/>',
    '</g>'
  ].join('');
}

function stampSvg(cx,cy,r){
  const ink='#174a8b';
  const ink2='#0d3564';
  const inner=r-18;
  const core=r-43;

  const specks=[
    [-63,-50,2],[-51,57,1.5],[-28,-70,1.2],[8,-65,1.6],[43,-54,1.4],
    [62,-22,1.8],[55,45,1.2],[25,66,1.7],[-8,61,1.2],[-67,18,1.4],
    [-40,5,1.1],[38,8,1.3]
  ];

  return [
    '<g fill="none" stroke="'+ink+'" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" stroke-width="4" opacity="0.84"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+inner+'" stroke-width="2" stroke-dasharray="1.5 4.5" opacity="0.7"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+core+'" stroke-width="2.6" opacity="0.88"/>',
    '</g>',
    '<g fill="'+ink+'" opacity="0.9">',
    textPaths('RAMZ ESTET',17,cy-r+31,{x:cx,align:'center',letterSpacing:2.2}),
    textPaths('VIRTUAL MUHR',11,cy+r-17,{x:cx,align:'center',letterSpacing:1.4}),
    textPaths('RE-2026',9,cy+r-34,{x:cx,align:'center',letterSpacing:1.3}),
    '</g>',
    '<g fill="'+ink+'" opacity="0.82">',
    '<circle cx="'+(cx-r+24)+'" cy="'+cy+'" r="3"/>',
    '<circle cx="'+(cx+r-24)+'" cy="'+cy+'" r="3"/>',
    '</g>',
    '<g fill="none" stroke="'+ink2+'" stroke-width="2" opacity="0.85">',
    '<path d="M '+(cx-25)+' '+(cy+24)+' L '+(cx-25)+' '+(cy-15)+' L '+cx+' '+(cy-30)+' L '+(cx+25)+' '+(cy-15)+' L '+(cx+25)+' '+(cy+24)+'"/>',
    '<path d="M '+(cx-25)+' '+(cy-15)+' L '+cx+' '+(cy+5)+' L '+(cx+25)+' '+(cy-15)+'"/>',
    '<path d="M '+(cx-34)+' '+(cy+30)+' Q '+cx+' '+(cy+43)+' '+(cx+34)+' '+(cy+30)+'"/>',
    '</g>',
    '<g fill="'+ink+'" opacity="0.9">'+textPaths('RE',35,cy+13,{x:cx,align:'center',letterSpacing:1})+'</g>',
    '<g fill="'+ink+'" opacity="0.24">',
    ...specks.map(([dx,dy,rr])=>'<circle cx="'+(cx+dx)+'" cy="'+(cy+dy)+'" r="'+rr+'"/>'),
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
    '<g filter="url(#sigGlow)">'+signaturePaths(365,footerTop+65,0.78)+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('VIRTUAL IMZO',19,footerTop+45,{x:365})+'</g>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',16,footerTop+190,{x:520,align:'center',letterSpacing:2})+'</g>'+
    '<g>'+stampSvg(820,footerTop+125,92)+'</g>'+
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
