import { db, EndpointError } from 'sdk';
import { eq, gt, asc, and } from 'sdk/db';
import { giveaways, participants, viewers, giveawayState } from '../schema.js';
import { readStartAppToken } from '../lib/startapp-tokens.js';

function iso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default async function watchGiveaway(input = {}, ctx) {
  const user = ctx?.initData?.user;
  if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
    throw new EndpointError('Telegram foydalanuvchisi aniqlanmadi', { code: 'TELEGRAM_USER_REQUIRED' });
  }
  const token = String(input.startApp || ctx?.initData?.startParam || '');
  const access = await readStartAppToken(token, 'watch') || await readStartAppToken(token, 'join');
  if (!access) throw new EndpointError('Tomosha havolasi yaroqsiz yoki muddati tugagan', { code: 'INVALID_WATCH_TOKEN' });
  const giveaway = await db.select().from(giveaways).where(eq(giveaways.id, access.giveawayId)).get();
  if (!giveaway) throw new EndpointError('Giveaway topilmadi', { code: 'GIVEAWAY_NOT_FOUND' });

  const now = new Date();
  await db.insert(viewers).values({
    giveawayId: giveaway.id, userId: Number(user.id),
    username: user.username || null, firstName: user.first_name || null,
    enteredAt: now, lastSeenAt: now,
  }).onConflictDoUpdate({
    target: [viewers.giveawayId, viewers.userId],
    set: { username: user.username || null, firstName: user.first_name || null, lastSeenAt: now },
  }).run();

  const participantRows = await db.select().from(participants)
    .where(eq(participants.giveawayId, giveaway.id)).orderBy(asc(participants.joinedAt)).all();
  // Filter active presence in the database. Avoid relying on Date instance
  // identity, which may differ between SDK adapters/serialization boundaries.
  const activeViewers = await db.select().from(viewers).where(and(
    eq(viewers.giveawayId, giveaway.id),
    gt(viewers.lastSeenAt, new Date(now.getTime() - 45000)),
  )).all();
  const state = await db.select().from(giveawayState)
    .where(eq(giveawayState.giveawayId, giveaway.id)).get();
  const participantNames = participantRows.map((row) => row.username ? '@' + row.username : (row.firstName || String(row.userId)));

  return {
    ok: true, mode: access.action,
    giveaway: {
      id: giveaway.id, title: giveaway.title, description: giveaway.description || '',
      image_file_id: giveaway.imageFileId || null, total_rounds: giveaway.totalRounds,
      status: giveaway.status, start_at: iso(giveaway.startAt),
      started_at: iso(giveaway.startedAt), finished_at: iso(giveaway.finishedAt),
    },
    participantCount: participantRows.length, participantNames, viewerCount: activeViewers.length,
    state: state ? {
      status: state.status, round: state.round, total_rounds: state.totalRounds,
      start_at: state.startAt, duration_ms: state.durationMs, target_index: state.targetIndex,
      participants: participantNames, winners: state.winners || [],
    } : null,
  };
}
