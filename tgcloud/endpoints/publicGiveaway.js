import { db } from 'sdk';
import { eq, asc } from 'sdk/db';
import { giveaways, participants, winners } from '../schema.js';
import { readStartAppToken } from '../lib/startapp-tokens.js';

function iso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Compatible public read operation for the existing Mini App response shape.
// Telegram Serverless validates the caller's Mini App initData before invocation.
export default async function publicGiveaway(input = {}, ctx) {
  const token = String(input.startApp || ctx?.initData?.startParam || '');
  const access = await readStartAppToken(token, 'watch') || await readStartAppToken(token, 'join');
  if (!access) return { ok: false, status: 403, error: 'Havola yaroqsiz yoki muddati tugagan' };

  const giveaway = await db.select().from(giveaways).where(eq(giveaways.id, access.giveawayId)).get();
  if (!giveaway) return { ok: false, status: 404, error: 'Giveaway topilmadi' };
  const participantRows = await db.select().from(participants)
    .where(eq(participants.giveawayId, access.giveawayId))
    .orderBy(asc(participants.joinedAt)).all();
  const winnerRows = await db.select().from(winners)
    .where(eq(winners.giveawayId, access.giveawayId))
    .orderBy(asc(winners.round)).all();

  const participantNames = participantRows.map((row) => row.username
    ? '@' + row.username
    : (row.firstName || String(row.userId)));
  const safeGiveaway = {
    id: giveaway.id, title: giveaway.title, description: giveaway.description || '',
    total_rounds: giveaway.totalRounds, status: giveaway.status,
    start_at: iso(giveaway.startAt), started_at: iso(giveaway.startedAt),
    finished_at: iso(giveaway.finishedAt), created_at: iso(giveaway.createdAt),
  };
  return {
    ok: true, mode: access.action, giveaway: safeGiveaway,
    participantCount: participantRows.length, participantNames,
    winners: winnerRows.map((row) => ({
      round: row.round, winner_label: row.winnerLabel, won_at: iso(row.wonAt),
    })),
  };
}
