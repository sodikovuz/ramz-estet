const { db } = require("./_db");

module.exports = async function handler(req, res) {
  try {
    const sql = db();

    const rows = await sql`
      SELECT
        id,
        status,
        spin_id,
        start_at,
        duration_ms,
        target_index,
        participants,
        updated_at
      FROM giveaway_state
      WHERE id = 1
      LIMIT 1
    `;

    const state = rows[0] || {
      id: 1,
      status: "ready",
      spin_id: 0,
      start_at: null,
      duration_ms: 8000,
      target_index: null,
      participants: []
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(state);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not read state" });
  }
};
