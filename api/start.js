const Ably = require("ably");
const { db } = require("./_db");
const { requireAdmin } = require("./_auth");

module.exports = async function(req,res) {
  try {
    if (req.method !== "POST") return res.status(405).json({error:"POST only"});
    requireAdmin(req);

    const body = typeof req.body === "string" ? JSON.parse(req.body||"{}") : (req.body||{});
    const participants = Array.isArray(body.participants)
      ? body.participants.map(x=>String(x).trim()).filter(Boolean).slice(0,500)
      : [];
    const totalRounds = Math.max(1, Math.min(5, Number(body.totalRounds)||5));
    const durationMs = Math.max(5000, Math.min(15000, Number(body.durationMs)||8000));

    if (!participants.length) return res.status(400).json({error:"Participants required"});
    if (participants.length < totalRounds)
      return res.status(400).json({error:"Participants soni roundlar sonidan kam bo'lmasin"});

    const sql = db();
    const old = await sql`SELECT giveaway_id FROM giveaway_state WHERE id=1`;
    const giveawayId = Number(req.body?.giveawayId || (Number(old[0]?.giveaway_id||0)+1));
    const spinId = giveawayId*100+1;
    const round = 1;
    const startAt = Date.now()+1800;

    // First round is selected server-side. The browser never chooses the winner.
    const firstIndex = Math.floor(Math.random() * participants.length);

    const rows = await sql`
      UPDATE giveaway_state SET
        status='spinning',
        giveaway_id=${giveawayId},
        round=${round},
        total_rounds=${totalRounds},
        spin_id=${spinId},
        start_at=${startAt},
        duration_ms=${durationMs},
        target_index=${firstIndex},
        participants=${JSON.stringify(participants)}::jsonb,
        winners='[]'::jsonb,
        updated_at=NOW()
      WHERE id=1
      RETURNING *
    `;

    const event = {
      type:"round_start",
      giveawayId,
      round,
      totalRounds,
      spinId,
      startAt,
      durationMs,
      targetIndex:firstIndex,
      participants
    };

    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    await ably.channels.get("ramz-giveaway").publish("round_start", event);

    res.status(200).json({ok:true,event});
  } catch(e) {
    console.error(e);
    res.status(e.statusCode||500).json({error:e.message});
  }
};
