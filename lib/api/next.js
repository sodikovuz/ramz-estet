const Ably = require("ably");
const { db } = require("./_db");
const { requireAdmin } = require("./_auth");

module.exports = async function(req,res) {
  try {
    if (req.method !== "POST") return res.status(405).json({error:"POST only"});
    requireAdmin(req);

    const body = typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const round = Number(body.round);
    const winner = String(body.winner||"").trim();
    const targetIndex = Number(body.targetIndex);

    const sql=db();
    const rows=await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`;
    const s=rows[0];

    if (!s || s.status!=="spinning") return res.status(400).json({error:"No active giveaway"});
    if (round!==Number(s.round)) return res.status(409).json({error:"Round mismatch"});
    if (!winner) return res.status(400).json({error:"Winner required"});

    const oldWinners=Array.isArray(s.winners)?s.winners:[];
    const winners=[...oldWinners,{round,winner}];
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
      return res.status(200).json({ok:true,finished:true,winners});
    }

    const remaining=s.participants.filter(x=>x!==winner);
    if (!remaining.length) return res.status(400).json({error:"No participants left"});

    const rawTargets=Array.isArray(body.targets)?body.targets.map(Number):[];
    const nextTarget=Number(body.nextTargetIndex);

    if (!Number.isInteger(nextTarget)||nextTarget<0||nextTarget>=remaining.length)
      return res.status(400).json({error:"Invalid next target index"});

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

    res.status(200).json({ok:true,event,winners});
  } catch(e) {
    console.error(e);
    res.status(e.statusCode||500).json({error:e.message});
  }
};
