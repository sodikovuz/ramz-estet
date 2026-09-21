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

function arcTextPaths(text,fontSize,cx,cy,radius,startDeg,endDeg,opts={}){
  const value=String(text||'');
  const run=font.layout(value);
  const scale=fontSize/font.unitsPerEm;
  const total=run.positions.reduce((sum,p)=>sum+(p.xAdvance||0)*scale,0);
  const span=endDeg-startDeg;
  const arcLen=Math.max(1,(Math.abs(span)*Math.PI/180)*radius);
  const naturalStep=total>0 ? span*(1/Math.max(1,total))*radius*0.72 : span;
  const step=Math.min(Math.abs(span)/Math.max(1,value.length), Math.max(2,Math.abs(naturalStep)));
  const actualSpan=step*Math.max(0,run.glyphs.length-1);
  const first=startDeg+(span-actualSpan)/2;
  const color=opts.color||'#1b5fae';
  const paths=[];
  let cursor=0;

  for(let i=0;i<run.glyphs.length;i++){
    const pos=run.positions[i];
    const adv=(pos.xAdvance||0)*scale;
    const mid=cursor+adv/2;
    const angle=first+(span>=0?1:-1)*(mid/Math.max(1,total))*actualSpan;
    const rad=angle*Math.PI/180;
    const px=cx+Math.sin(rad)*radius;
    const py=cy-Math.cos(rad)*radius;
    const d=run.glyphs[i].path.toSVG();
    if(d){
      paths.push(
        '<path fill="'+color+'" d="'+d+'" transform="translate('+px.toFixed(2)+' '+py.toFixed(2)+') rotate('+angle.toFixed(2)+') scale('+scale.toFixed(6)+' '+(-scale).toFixed(6)+') translate('+(-adv/2).toFixed(2)+' 0)"/>'
      );
    }
    cursor+=adv;
  }
  return paths.join('');
}

function stampSvg(cx,cy,r){
  const ink='#2d72c9';
  const dark='#0b3975';
  const light='#6fa8f2';

  const specks=[];
  const fibers=[];
  for(let i=0;i<90;i++){
    const a=((i*137.5)%360)*Math.PI/180;
    const rr=r+2+(i%17);
    const x=cx+Math.cos(a)*rr;
    const y=cy+Math.sin(a)*rr;
    const size=0.6+(i%4)*0.55;
    specks.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+size.toFixed(1)+'"/>');
  }
  for(let i=0;i<24;i++){
    const y=cy-r+12+(i*7.4);
    fibers.push('<path d="M '+(cx-r-8)+' '+y.toFixed(1)+' C '+(cx-r+25)+' '+(y-5).toFixed(1)+', '+(cx+r-20)+' '+(y+5).toFixed(1)+', '+(cx+r+8)+' '+(y-2).toFixed(1)+'"/>');
  }

  const ringPath=(rr,offset,opacity,width)=>{
    return '<circle cx="'+cx+'" cy="'+cy+'" r="'+rr+'" fill="none" stroke="'+ink+'" stroke-width="'+width+'" opacity="'+opacity+'" stroke-dasharray="'+(360+offset)+' '+(6+offset)+'"/>';
  };

  return [
    '<defs>',
    '<filter id="stampInk" x="-25%" y="-25%" width="150%" height="150%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="27" result="noise"/>',
    '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0.7" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    '</defs>',

    '<g filter="url(#stampInk)">',

    /* dry-ink halo and broken edge */
    '<g fill="'+ink+'" opacity="0.12">'+specks.join('')+'</g>',
    '<g fill="none" stroke="'+ink+'" opacity="0.12" stroke-width="8">'+fibers.join('')+'</g>',

    /* imperfect outer rings */
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+ink+'" stroke-width="5.5" opacity="0.9"/>',
    '<circle cx="'+(cx+1.2)+'" cy="'+(cy-0.8)+'" r="'+(r-5)+'" fill="none" stroke="'+dark+'" stroke-width="2.2" opacity="0.72" stroke-dasharray="28 4 9 3 42 5"/>',
    '<circle cx="'+(cx-0.8)+'" cy="'+(cy+1.1)+'" r="'+(r-13)+'" fill="none" stroke="'+ink+'" stroke-width="2.4" opacity="0.88"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-25)+'" fill="none" stroke="'+dark+'" stroke-width="1.7" opacity="0.72" stroke-dasharray="2 5"/>',

    /* top/bottom curved brand text */
    arcTextPaths('RAMZ ESTET',18,cx,cy,r-16,-67,67,{color:ink}),
    arcTextPaths('VIRTUAL MUHR',13,cx,cy,r-16,113,247,{color:ink}),

    /* side separators */
    '<g fill="'+dark+'" opacity="0.9">',
    '<circle cx="'+(cx-r+30)+'" cy="'+cy+'" r="4"/>',
    '<circle cx="'+(cx+r-30)+'" cy="'+cy+'" r="4"/>',
    '</g>',

    /* custom RE crest */
    '<g fill="none" stroke="'+dark+'" stroke-width="2.7" opacity="0.9">',
    '<path d="M '+(cx-27)+' '+(cy+27)+' L '+(cx-27)+' '+(cy-14)+' L '+cx+' '+(cy-32)+' L '+(cx+27)+' '+(cy-14)+' L '+(cx+27)+' '+(cy+27)+'"/>',
    '<path d="M '+(cx-27)+' '+(cy-14)+' L '+cx+' '+(cy+6)+' L '+(cx+27)+' '+(cy-14)+'"/>',
    '</g>',
    '<g fill="'+ink+'" opacity="0.96">'+textPaths('RE',40,cy+14,{x:cx,align:'center',letterSpacing:1})+'</g>',

    /* small crown-like brand mark */
    '<g fill="'+light+'" opacity="0.9">',
    '<path d="M '+(cx-22)+' '+(cy-38)+' L '+(cx-12)+' '+(cy-52)+' L '+cx+' '+(cy-38)+' L '+(cx+12)+' '+(cy-52)+' L '+(cx+22)+' '+(cy-38)+' L '+(cx+18)+' '+(cy-27)+' L '+(cx-18)+' '+(cy-27)+' Z"/>',
    '</g>',

    /* serial + separator marks */
    '<g fill="'+dark+'" opacity="0.95">'+
      textPaths('RE-2026',10,cy+r-38,{x:cx,align:'center',letterSpacing:1.5})+
    '</g>',
    '<g fill="none" stroke="'+ink+'" opacity="0.5" stroke-width="1.5">'+
      '<path d="M '+(cx-r+18)+' '+(cy-r+20)+' L '+(cx+r-18)+' '+(cy+r-14)+'"/>'+
      '<path d="M '+(cx-r+25)+' '+(cy+r-20)+' L '+(cx+r-12)+' '+(cy-r+16)+'"/>'+
    '</g>',

    /* uneven ink spots inside the seal */
    '<g fill="'+ink+'" opacity="0.18">'+
      '<circle cx="'+(cx-62)+'" cy="'+(cy+18)+'" r="2.4"/>'+
      '<circle cx="'+(cx+54)+'" cy="'+(cy-35)+'" r="1.7"/>'+
      '<circle cx="'+(cx+38)+'" cy="'+(cy+47)+'" r="2.1"/>'+
      '<circle cx="'+(cx-46)+'" cy="'+(cy-52)+'" r="1.4"/>'+
      '<circle cx="'+(cx+9)+'" cy="'+(cy+59)+'" r="1.6"/>'+
    '</g>',
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
