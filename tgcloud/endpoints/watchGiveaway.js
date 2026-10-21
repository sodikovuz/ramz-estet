import { db, EndpointError } from 'sdk';
import { eq, asc } from 'sdk/db';
import { giveaways, participants, viewers, giveawayState } from '../schema.js';
import { readStartAppToken } from '../lib/startapp-tokens.js';

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

  const participantsRows = await db.select().from(participants)
    .where(eq(participants.giveawayId, giveaway.id)).orderBy(asc(participants.joinedAt)).all();
  const activeViewers = await db.select().from(viewers)
    .where(eq(viewers.giveawayId, giveaway.id)).all();
  const state = await db.select().from(giveawayState)
    .where(eq(giveawayState.giveawayId, giveaway.id)).get();
  const participantNames = participantsRows.map((row) => row.username ? '@' + row.username : (row.firstName || String(row.userId)));
  const activeCount = activeViewers.filter((row) => row.lastSeenAt instanceof Date && now.getTime() - row.lastSeenAt.getTime() < 45000).length;
  return {
    ok: true, mode: access.action, giveawayId: giveaway.id,
    participantCount: participantsRows.length, participantNames, viewerCount: activeCount,
    state: state ? { status: state.status, round: state.round, total_rounds: state.totalRounds,
      start_at: state.startAt, duration_ms: state.durationMs, target_index: state.targetIndex,
      participants: participantNames, winners: state.winners || [] } : null,
  };
}
