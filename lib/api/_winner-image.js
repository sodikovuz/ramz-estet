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
      paths.push(
        '<path d="'+d+'" transform="translate('+gx.toFixed(2)+' '+gy.toFixed(2)+') scale('+scale.toFixed(6)+' '+(-scale).toFixed(6)+')"/>'
      );
    }

    x+=(pos.xAdvance||0)*scale;
    if(i<run.glyphs.length-1) x+=letterSpacing;
  }

  return paths.join('');
}

/*
 * Virtual signature: drawn as SVG paths, not as a font.
 * This avoids the Vercel/Sharp font-rendering problem completely.
 */
function signaturePaths(x,y,scale=1){
  const s=Number(scale);
  return [
    '<g fill="none" stroke="#f4f4f4" stroke-width="'+(4*s)+'" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M '+(x+10*s)+' '+(y+62*s)+' C '+(x+34*s)+' '+(y+8*s)+', '+(x+88*s)+' '+(y+4*s)+', '+(x+112*s)+' '+(y+28*s)+' C '+(x+132*s)+' '+(y+48*s)+', '+(x+101*s)+' '+(y+68*s)+', '+(x+70*s)+' '+(y+55*s)+' C '+(x+48*s)+' '+(y+46*s)+', '+(x+55*s)+' '+(y+22*s)+', '+(x+82*s)+' '+(y+12*s)+'"/>',
    '<path d="M '+(x+76*s)+' '+(y+12*s)+' C '+(x+66*s)+' '+(y+34*s)+', '+(x+62*s)+' '+(y+76*s)+', '+(x+48*s)+' '+(y+96*s)+' C '+(x+38*s)+' '+(y+110*s)+', '+(x+25*s)+' '+(y+104*s)+', '+(x+32*s)+' '+(y+92*s)+' C '+(x+48*s)+' '+(y+68*s)+', '+(x+92*s)+' '+(y+73*s)+', '+(x+126*s)+' '+(y+88*s)+' C '+(x+165*s)+' '+(y+106*s)+', '+(x+196*s)+' '+(y+90*s)+', '+(x+216*s)+' '+(y+68*s)+'"/>',
    '<path d="M '+(x+122*s)+' '+(y+88*s)+' C '+(x+152*s)+' '+(y+48*s)+', '+(x+184*s)+' '+(y+46*s)+', '+(x+188*s)+' '+(y+65*s)+' C '+(x+191*s)+' '+(y+82*s)+', '+(x+164*s)+' '+(y+88*s)+', '+(x+149*s)+' '+(y+76*s)+'"/>',
    '<path d="M '+(x+176*s)+' '+(y+90*s)+' C '+(x+214*s)+' '+(y+104*s)+', '+(x+250*s)+' '+(y+100*s)+', '+(x+278*s)+' '+(y+78*s)+'"/>',
    '<path d="M '+(x+12*s)+' '+(y+113*s)+' C '+(x+82*s)+' '+(y+101*s)+', '+(x+194*s)+' '+(y+126*s)+', '+(x+292*s)+' '+(y+108*s)+'"/>',
    '</g>'
  ].join('');
}

function hologramSvg(){
  return [
    '<g opacity="0.055" fill="none" stroke="#d9e8ff">',
    '<path d="M60 330 C260 210 390 470 600 330 S940 210 1140 330" stroke-width="2"/>',
    '<path d="M60 350 C260 230 390 490 600 350 S940 230 1140 350" stroke-width="1"/>',
    '<path d="M60 370 C260 250 390 510 600 370 S940 250 1140 370" stroke-width="1"/>',
    '</g>',
    '<g fill="#e7c65c" opacity="0.035">',
    textPaths('RE',180,700,{x:880,align:'center',letterSpacing:8}),
    '</g>'
  ].join('');
}

function stampSvg(cx,cy,r){
  const ink='#174a8b';
  const ink2='#0e3768';
  const inner=r-18;
  const core=r-42;

  return [
    '<g fill="none" stroke="'+ink+'" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" stroke-width="4" opacity="0.86"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+inner+'" stroke-width="2.2" stroke-dasharray="2 5" opacity="0.72"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+core+'" stroke-width="2.8" opacity="0.9"/>',
    '</g>',

    '<g fill="'+ink+'" opacity="0.9">',
    textPaths('RAMZ ESTET',17,cy-r+31,{x:cx,align:'center',letterSpacing:2.4}),
    textPaths('VIRTUAL MUHR',11,cy+r-18,{x:cx,align:'center',letterSpacing:1.7}),
    '</g>',

    '<g fill="'+ink+'" opacity="0.8">',
    '<circle cx="'+(cx-r+24)+'" cy="'+cy+'" r="3"/>',
    '<circle cx="'+(cx+r-24)+'" cy="'+cy+'" r="3"/>',
    '</g>',

    '<g fill="none" stroke="'+ink2+'" stroke-width="2.2" opacity="0.82">',
    '<path d="M '+(cx-25)+' '+(cy+25)+' L '+(cx-25)+' '+(cy-17)+' L '+cx+' '+(cy-31)+' L '+(cx+25)+' '+(cy-17)+' L '+(cx+25)+' '+(cy+25)+'"/>',
    '<path d="M '+(cx-25)+' '+(cy-17)+' L '+cx+' '+(cy+4)+' L '+(cx+25)+' '+(cy-17)+'"/>',
    '<path d="M '+(cx-31)+' '+(cy+31)+' Q '+cx+' '+(cy+43)+' '+(cx+31)+' '+(cy+31)+'"/>',
    '</g>',

    '<g fill="'+ink+'" opacity="0.88">',
    textPaths('RE',37,cy+14,{x:cx,align:'center',letterSpacing:1}),
    '</g>',

    '<g fill="'+ink+'" opacity="0.75">',
    textPaths('RE-2026',9,cy+r-2,{x:cx,align:'center',letterSpacing:1.5}),
    '</g>',

    '<g fill="'+ink+'" opacity="0.22">',
    '<circle cx="'+(cx-r+43)+'" cy="'+(cy-r+43)+'" r="2"/>',
    '<circle cx="'+(cx+r-48)+'" cy="'+(cy-r+31)+'" r="2"/>',
    '<circle cx="'+(cx-r+34)+'" cy="'+(cy+r-38)+'" r="2"/>',
    '<circle cx="'+(cx+r-35)+'" cy="'+(cy+r-43)+'" r="2"/>',
    '<circle cx="'+(cx-8)+'" cy="'+(cy-8)+'" r="1.8"/>',
    '<circle cx="'+(cx+19)+'" cy="'+(cy+13)+'" r="1.5"/>',
    '</g>',

    '<g fill="none" stroke="'+ink+'" opacity="0.16" stroke-width="1.2">',
    '<path d="M '+(cx-r+10)+' '+(cy-r+21)+' L '+(cx+r-18)+' '+(cy+r-10)+'"/>',
    '<path d="M '+(cx-r+24)+' '+(cy+r-12)+' L '+(cx+r-10)+' '+(cy-r+20)+'"/>',
    '</g>'
  ].join('');
}

async function renderWinnerImage(title,winners,dateText){
  const safeTitle=String(title||'Giveaway');
  const count=Array.isArray(winners)?winners.length:0;

  const dividerY=405+count*72;
  const height=dividerY+320;

  const rows=(Array.isArray(winners)?winners:[]).map((w,i)=>
    textPaths((i+1)+'-g‘olib — '+(w.winner||''),30,360+i*72,{x:100})
  ).join('');
  const footerTitleY=dividerY+52;
  const footerSubY=dividerY+84;
  const signatureY=dividerY+126;
  const stampCenterY=dividerY+178;
  const stampRadius=82;
  const dateY=height-30;
  const docSeed=JSON.stringify({title:safeTitle,winners:(Array.isArray(winners)?winners:[]).map(w=>String(w.winner||'')),date:String(dateText||'')});
  const docId='RE-GW-'+crypto.createHash('sha256').update(docSeed).digest('hex').slice(0,12).toUpperCase();
  const verifyPayload='RAMZ ESTET | '+docId;
  const qrSvg=await QRCode.toString(verifyPayload,{type:'svg',margin:0,width:150,errorCorrectionLevel:'M'});
  const qrInner=qrSvg.replace(/^<\\?xml[^>]*>\\s*/,'').replace(/<svg[^>]*>/,'').replace('</svg>','');

  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'">'+
    '<rect width="100%" height="100%" fill="#070707"/>'+
    '<rect x="28" y="28" width="1144" height="'+(height-56)+'" rx="32" fill="#111" stroke="#9a7600" stroke-width="3"/>'+hologramSvg()+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',58,105,{x:600,align:'center',letterSpacing:8})+'</g>'+
    '<g fill="#fff">'+textPaths('GIVEAWAY YAKUNIY NATIJALARI',34,170,{x:600,align:'center'})+'</g>'+
    '<g fill="#aaa">'+textPaths(safeTitle,26,225,{x:600,align:'center'})+'</g>'+
    '<g fill="#fff">'+rows+'</g>'+
    '<line x1="100" y1="'+dividerY+'" x2="1100" y2="'+dividerY+'" stroke="#9a7600" stroke-width="2"/>'+
    '<g fill="#e7c65c">'+textPaths('BARCHA G‘OLIBLARNI TABRIKLAYMIZ!',28,footerTitleY,{x:600,align:'center',letterSpacing:1})+'</g>'+
    '<g fill="#aaa">'+textPaths('ISHONCH UCHUN RAHMAT',19,footerSubY,{x:600,align:'center',letterSpacing:2})+'</g>'+
    '<g filter="url(#sigGlow)">'+signaturePaths(120,signatureY,0.72)+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('VIRTUAL IMZO',20,signatureY-8,{x:120})+'</g>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',17,signatureY+105,{x:260,align:'center',letterSpacing:2})+'</g>'+
    '<g>'+stampSvg(900,stampCenterY,stampRadius)+'</g>'+
    '<g fill="#777">'+textPaths(String(dateText||''),18,dateY,{x:1100,align:'right'})+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('HUJJAT RAQAMI:',14,dateY-48,{x:880})+'</g>'+
    '<g fill="#e7c65c">'+textPaths(docId,13,dateY-25,{x:880})+'</g>'+
    '<g fill="#111"><rect x="88" y="'+(height-172)+'" width="128" height="128" rx="8"/></g>'+
    '<g transform="translate(92 '+(height-168)+') scale(0.82)">'+qrInner+'</g>'+
    '<g fill="#aaa">'+textPaths('HUJJAT KODI',13,height-28,{x:235})+'</g>'+
    '<line x1="100" y1="'+(height-58)+'" x2="1100" y2="'+(height-58)+'" stroke="#9a7600" stroke-width="1"/>'+
    '</svg>';

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports={renderWinnerImage};
