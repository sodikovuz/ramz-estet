import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const state = (
      await sql`
        SELECT *
        FROM giveaway_state
        WHERE id = 1
        LIMIT 1
      `
    )[0];

    if (!state) {
      return res.status(500).json({
        error: "giveaway_state mavjud emas"
      });
    }

    if (state.status === "spinning") {
      return res.status(400).json({
        error: "Baraban hozir aylanmoqda"
      });
    }

    if (state.current_spin >= 5) {
      return res.status(400).json({
        error: "5 ta g‘olib allaqachon tanlangan"
      });
    }

    const participants = await sql`
      SELECT id, username
      FROM participants
      WHERE winner = false
      ORDER BY id ASC
    `;

    if (!participants.length) {
      return res.status(400).json({
        error: "Ishtirokchilar qolmagan"
      });
    }

    const random =
      crypto.randomBytes(4).readUInt32BE(0);

    const winnerIndex =
      random % participants.length;

    const winner =
      participants[winnerIndex];

    const spin =
      state.current_spin + 1;

    const spinId =
      (state.spin_id || 0) + 1;

    const duration = 6500;

    const startedAt =
      Date.now();

    await sql`
      UPDATE participants
      SET winner = true
      WHERE id = ${winner.id}
    `;

    await sql`
      INSERT INTO winners
      (username, prize)
      VALUES
      (${winner.username}, 15)
    `;

    await sql`
      UPDATE giveaway_state
      SET
        status = 'spinning',
        current_spin = ${spin},
        spin_id = ${spinId},
        winner = ${winner.username},
        spin_started_at = ${startedAt},
        spin_duration = ${duration}
      WHERE id = 1
    `;

    res.status(200).json({
      success: true,
      winner: winner.username,
      winnerIndex,
      spin,
      spinId,
      startedAt,
      duration
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Spin xatosi"
    });
  }
}
