const fs=require('fs');
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
    width += (run.positions[i].xAdvance||0)*scale;
    if(i<run.positions.length-1) width += letterSpacing;
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
    if(d) paths.push('<path d="'+d+'" transform="translate('+gx.toFixed(2)+' '+gy.toFixed(2)+') scale('+scale.toFixed(6)+' '+(-scale).toFixed(6)+')"/>');
    x+=(pos.xAdvance||0)*scale;
    if(i<run.glyphs.length-1) x+=letterSpacing;
  }
  return paths.join('');
}

async function renderWinnerImage(title,winners,dateText){
  const safeTitle=String(title||'Giveaway');
  const rows=winners.map((w,i)=>textPaths((i+1)+'-g‘olib — '+(w.winner||''),30,360+i*72,{x:100})).join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+Math.max(760,430+winners.length*72)+'">'+
    '<rect width="100%" height="100%" fill="#070707"/>'+
    '<rect x="28" y="28" width="1144" height="calc(100% - 56px)" rx="32" fill="#111" stroke="#9a7600" stroke-width="3"/>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET',58,105,{x:600,align:'center',letterSpacing:8})+'</g>'+
    '<g fill="#fff">'+textPaths('GIVEAWAY YAKUNIY NATIJALARI',34,170,{x:600,align:'center'})+'</g>'+
    '<g fill="#aaa">'+textPaths(safeTitle,26,225,{x:600,align:'center'})+'</g>'+
    '<g fill="#fff">'+rows+'</g>'+
    '<line x1="100" y1="'+(390+winners.length*72)+'" x2="1100" y2="'+(390+winners.length*72)+'" stroke="#9a7600"/>'+
    '<g fill="#d9d9d9">'+textPaths('VIRTUAL IMZO',25,450+winners.length*72,{x:100})+'</g>'+
    '<g fill="#e7c65c">'+textPaths('RAMZ ESTET — VIRTUAL MUHR',22,495+winners.length*72,{x:100})+'</g>'+
    '<g fill="#777">'+textPaths(String(dateText||''),20,495+winners.length*72,{x:1100,align:'right'})+'</g>'+
    '</svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports={renderWinnerImage};
