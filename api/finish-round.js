const Ably = require("ably");
const { db } = require("./_db");

module.exports = async function(req,res) {
  try {
    if(req.method!=="POST") return res.status(405).json({error:"POST only"});
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const round=Number(body.round);

    const sql=db();
    const rows=await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`;
    const s=rows[0];

    if(!s) return res.status(404).json({error:"State missing"});
    if(Number(s.round)!==round) return res.status(409).json({error:"Round mismatch"});

    const existing=Array.isArray(s.winners)?s.winners:[];
    if(existing.some(x=>Number(x.round)===round))
      return res.status(200).json({ok:true,already:true,winners:existing});

    const participants=Array.isArray(s.participants)?s.participants:[];
    const targetIndex=Number(s.target_index);

    if(!Number.isInteger(targetIndex) || targetIndex<0 || targetIndex>=participants.length)
      return res.status(500).json({error:"Invalid stored target index"});

    const winner=String(participants[targetIndex]);
    const winners=[...existing,{round,winner}];
    const nextRound=round+1;

    if (nextRound>Number(s.total_rounds)) {
      await sql`
        UPDATE giveaway_state SET
          status='finished',
          winners=${JSON.stringify(winners)}::jsonb,
          updated_at=NOW()
        WHERE id=1
      `;
      await new Ably.Rest(process.env.ABLY_API_KEY).channels.get("ramz-giveaway")
        .publish("giveaway_finished",{type:"giveaway_finished",giveawayId:Number(s.giveaway_id),winners});
      return res.status(200).json({ok:true,finished:true,winner,winners});
    }

    const remaining=participants.filter((_,i)=>i!==targetIndex);
    if (!remaining.length) return res.status(400).json({error:"No participants left"});

    // Next winner is also selected on the server.
    const nextTarget=Math.floor(Math.random()*remaining.length);
    const nextSpinId=Number(s.spin_id)+1;
    const startAt=Date.now()+1800;

    await sql`
      UPDATE giveaway_state SET
        round=${nextRound},
        spin_id=${nextSpinId},
        start_at=${startAt},
        target_index=${nextTarget},
        participants=${JSON.stringify(remaining)}::jsonb,
        winners=${JSON.stringify(winners)}::jsonb,
        status='spinning',
        updated_at=NOW()
      WHERE id=1
    `;

    const event={
      type:"round_start",
      giveawayId:Number(s.giveaway_id),
      round:nextRound,
      totalRounds:Number(s.total_rounds),
      spinId:nextSpinId,
      startAt,
      durationMs:Number(s.duration_ms),
      targetIndex:nextTarget,
      participants:remaining,
      winners
    };

    await new Ably.Rest(process.env.ABLY_API_KEY)
      .channels.get("ramz-giveaway").publish("round_start",event);

    res.status(200).json({ok:true,event,winner,winners});
  } catch(e) {
    console.error(e);
    res.status(e.statusCode||500).json({error:e.message});
  }
};
