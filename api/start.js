const Ably = require("ably");
const { db } = require("./_db");
const { requireAdmin } = require("./_auth");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    requireAdmin(req);

    const body = typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});

    const participants = Array.isArray(body.participants)
      ? body.participants
          .map(v => typeof v === "object" ? v.username : v)
          .map(v => String(v || "").trim())
          .filter(Boolean)
          .slice(0, 200)
      : [];

    const targetIndex = Number(body.targetIndex);
    const durationMs = Math.max(
      5000,
      Math.min(15000, Number(body.durationMs) || 8000)
    );

    if (!participants.length) {
      return res.status(400).json({ error: "Add at least one participant" });
    }

    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= participants.length
    ) {
      return res.status(400).json({ error: "Invalid targetIndex" });
    }

    const sql = db();

    const currentRows = await sql`
      SELECT spin_id
      FROM giveaway_state
      WHERE id = 1
      LIMIT 1
    `;

    const nextSpinId =
      Number(currentRows[0]?.spin_id || 0) + 1;

    /*
      Give clients 1.5 seconds to receive the event before animation starts.
      The timestamp is epoch milliseconds so every browser can calculate
      elapsed animation progress consistently.
    */
    const startAt = Date.now() + 1500;

    const rows = await sql`
      UPDATE giveaway_state
      SET
        status = 'spinning',
        spin_id = ${nextSpinId},
        start_at = ${startAt},
        duration_ms = ${durationMs},
        target_index = ${targetIndex},
        participants = ${JSON.stringify(participants)}::jsonb,
        updated_at = NOW()
      WHERE id = 1
      RETURNING
        id,
        status,
        spin_id,
        start_at,
        duration_ms,
        target_index,
        participants
    `;

    const state = rows[0];

    if (!process.env.ABLY_API_KEY) {
      return res.status(500).json({ error: "ABLY_API_KEY is missing" });
    }

    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const channel = ably.channels.get("ramz-giveaway");

    await channel.publish("spin", {
      spinId: Number(state.spin_id),
      startAt: Number(state.start_at),
      durationMs: Number(state.duration_ms),
      targetIndex: Number(state.target_index),
      participants: state.participants
    });

    return res.status(200).json({
      ok: true,
      state
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      error: err.message || "Could not start spin"
    });
  }
};
