const Ably = require("ably");
const { db } = require("./_db");
const { requireAdmin } = require("./_auth");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    requireAdmin(req);

    const sql = db();

    const rows = await sql`
      UPDATE giveaway_state
      SET
        status = 'ready',
        start_at = NULL,
        target_index = NULL,
        participants = '[]'::jsonb,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `;

    if (process.env.ABLY_API_KEY) {
      const ably = new Ably.Rest(process.env.ABLY_API_KEY);
      await ably.channels.get("ramz-giveaway").publish("reset", {
        resetAt: Date.now()
      });
    }

    return res.status(200).json({
      ok: true,
      state: rows[0]
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      error: err.message || "Could not reset"
    });
  }
};
