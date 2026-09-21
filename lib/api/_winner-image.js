const sharp=require('sharp');

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
      .brand{font:900 58px DejaVu Sans;fill:#e7c65c;letter-spacing:8px}.title{font:900 34px DejaVu Sans;fill:#fff}.sub{font:700 26px DejaVu Sans;fill:#aaa}
      .name{font:800 30px DejaVu Sans;fill:#fff}.sign{font:italic 700 25px DejaVu Sans;fill:#d9d9d9}.stamp{font:900 22px DejaVu Sans;fill:#e7c65c}.date{font:500 20px DejaVu Sans;fill:#777}
    </style>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports={renderWinnerImage};
