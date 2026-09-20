const { db } = require("./_db");
const { requireAdmin } = require("./_auth");

module.exports = async function(req,res) {
  try {
    if(req.method!=="POST") return res.status(405).json({error:"POST only"});
    requireAdmin(req);
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const round=Number(body.round);
    const winner=String(body.winner||"").trim();

    const sql=db();
    const rows=await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`;
    const s=rows[0];

    if(!s) return res.status(404).json({error:"State missing"});
    if(Number(s.round)!==round) return res.status(409).json({error:"Round mismatch"});

    const list=Array.isArray(s.winners)?s.winners:[];
    if(list.some(x=>Number(x.round)===round))
      return res.status(200).json({ok:true,already:true,winners:list});

    const winners=[...list,{round,winner}];

    await sql`
      UPDATE giveaway_state
      SET winners=${JSON.stringify(winners)}::jsonb,
          status=${round>=Number(s.total_rounds)?"finished":"spinning"},
          updated_at=NOW()
      WHERE id=1
    `;

    res.status(200).json({ok:true,winners});
  }catch(e){
    console.error(e);
    res.status(e.statusCode||500).json({error:e.message});
  }
};
