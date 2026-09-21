const sharp=require('sharp');
const fontkit=require('fontkit');

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

function stampSvg(cx,cy,r){
  return [
    '<g fill="none" stroke="#e7c65c">',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" stroke-width="5"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-15)+'" stroke-width="2"/>',
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-39)+'" stroke-width="2"/>',
    '</g>',
    '<g fill="#e7c65c">',
    textPaths('RAMZ ESTET',22,cy-r+39,{x:cx,align:'center',letterSpacing:3}),
    textPaths('VIRTUAL MUHR',15,cy+r-27,{x:cx,align:'center',letterSpacing:2}),
    textPaths('R',74,cy+27,{x:cx,align:'center'}),
    '</g>',
    '<g fill="#e7c65c">',
    '<circle cx="'+(cx-r+31)+'" cy="'+cy+'" r="4"/>',
    '<circle cx="'+(cx+r-31)+'" cy="'+cy+'" r="4"/>',
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

  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'">'+
    '<rect width="100%" height="100%" fill="#070707"/>'+
    '<rect x="28" y="28" width="1144" height="'+(height-56)+'" rx="32" fill="#111" stroke="#9a7600" stroke-width="3"/>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',58,105,{x:600,align:'center',letterSpacing:8})+'</g>'+
    '<g fill="#fff">'+textPaths('GIVEAWAY YAKUNIY NATIJALARI',34,170,{x:600,align:'center'})+'</g>'+
    '<g fill="#aaa">'+textPaths(safeTitle,26,225,{x:600,align:'center'})+'</g>'+
    '<g fill="#fff">'+rows+'</g>'+
    '<line x1="100" y1="'+dividerY+'" x2="1100" y2="'+dividerY+'" stroke="#9a7600" stroke-width="2"/>'+
    '<g fill="#e7c65c">'+textPaths('BARCHA G‘OLIBLARNI TABRIKLAYMIZ!',28,footerTitleY,{x:600,align:'center',letterSpacing:1})+'</g>'+
    '<g fill="#aaa">'+textPaths('ISHONCH UCHUN RAHMAT',19,footerSubY,{x:600,align:'center',letterSpacing:2})+'</g>'+
    '<g>'+signaturePaths(120,signatureY,0.72)+'</g>'+
    '<g fill="#d9d9d9">'+textPaths('VIRTUAL IMZO',20,signatureY-8,{x:120})+'</g>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',17,signatureY+105,{x:260,align:'center',letterSpacing:2})+'</g>'+
    '<g>'+stampSvg(900,stampCenterY,stampRadius)+'</g>'+
    '<g fill="#777">'+textPaths(String(dateText||''),18,dateY,{x:1100,align:'right'})+'</g>'+
    '<line x1="100" y1="'+(height-58)+'" x2="1100" y2="'+(height-58)+'" stroke="#9a7600" stroke-width="1"/>'+
    '</svg>';

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports={renderWinnerImage};
