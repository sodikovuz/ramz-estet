const fs=require('fs');
const path=require('path');
const sharp=require('sharp');

const fontPath=require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
const fontData=fs.readFileSync(fontPath).toString('base64');

function escXml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

async function renderWinnerImage(title,winners,dateText){
  const rows=winners.map((w,i)=>`<text x="100" y="${360+i*72}" class="name">${i+1}-g‘olib — ${escXml(w.winner||'')}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.max(760,430+winners.length*72)}">
    <rect width="100%" height="100%" fill="#070707"/>
    <rect x="28" y="28" width="1144" height="calc(100% - 56px)" rx="32" fill="#111" stroke="#9a7600" stroke-width="3"/>
    <text x="600" y="105" text-anchor="middle" class="brand">RAMZ ESTET</text>
    <text x="600" y="170" text-anchor="middle" class="title">GIVEAWAY YAKUNIY NATIJALARI</text>
    <text x="600" y="225" text-anchor="middle" class="sub">${escXml(title||'Giveaway')}</text>
    ${rows}
    <line x1="100" y1="${390+winners.length*72}" x2="1100" y2="${390+winners.length*72}" stroke="#9a7600"/>
    <text x="100" y="${450+winners.length*72}" class="sign">VIRTUAL IMZO</text>
    <text x="100" y="${495+winners.length*72}" class="stamp">RAMZ ESTET — VIRTUAL MUHR</text>
    <text x="1100" y="${495+winners.length*72}" text-anchor="end" class="date">${escXml(dateText||'')}</text>
    <style>
      @font-face{font-family:"RAMZFont";src:url(data:font/ttf;base64,${fontData}) format("truetype");font-weight:100 900;font-style:normal}
      .brand{font-family:"RAMZFont";font-size:58px;font-weight:900;fill:#e7c65c;letter-spacing:8px}
      .title{font-family:"RAMZFont";font-size:34px;font-weight:900;fill:#fff}
      .sub{font-family:"RAMZFont";font-size:26px;font-weight:700;fill:#aaa}
      .name{font-family:"RAMZFont";font-size:30px;font-weight:800;fill:#fff}
      .sign{font-family:"RAMZFont";font-size:25px;font-weight:700;fill:#d9d9d9}
      .stamp{font-family:"RAMZFont";font-size:22px;font-weight:900;fill:#e7c65c}
      .date{font-family:"RAMZFont";font-size:20px;font-weight:500;fill:#777}
    </style>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports={renderWinnerImage};
