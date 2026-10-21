import { db, EndpointError } from 'sdk';
import { eq, asc } from 'sdk/db';
import { giveaways, participants } from '../schema.js';
import { readStartAppToken } from '../lib/startapp-tokens.js';

export default async function joinGiveaway(input = {}, ctx) {
  const user = ctx?.initData?.user;
  if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
    throw new EndpointError('Telegram foydalanuvchisi aniqlanmadi', { code: 'TELEGRAM_USER_REQUIRED' });
  }
  const token = String(input.startApp || ctx?.initData?.startParam || '');
  const access = await readStartAppToken(token, 'join');
  if (!access) throw new EndpointError('Qatnashish havolasi yaroqsiz yoki muddati tugagan', { code: 'INVALID_JOIN_TOKEN' });

  const giveaway = await db.select().from(giveaways).where(eq(giveaways.id, access.giveawayId)).get();
  if (!giveaway) throw new EndpointError('Giveaway topilmadi', { code: 'GIVEAWAY_NOT_FOUND' });
  if (giveaway.status === 'closed' || giveaway.status === 'finished') {
    throw new EndpointError('Bu giveaway yopilgan', { code: 'GIVEAWAY_CLOSED' });
  }

  await db.insert(participants).values({
    giveawayId: giveaway.id, userId: Number(user.id),
    username: user.username || null, firstName: user.first_name || null,
  }).onConflictDoUpdate({
    target: [participants.giveawayId, participants.userId],
    set: { username: user.username || null, firstName: user.first_name || null },
  }).run();

  const rows = await db.select().from(participants)
    .where(eq(participants.giveawayId, giveaway.id))
    .orderBy(asc(participants.joinedAt)).all();
  const participantNames = rows.map((row) => row.username ? '@' + row.username : (row.firstName || String(row.userId)));
  return {
    ok: true, giveawayId: giveaway.id, joined: true,
    participantCount: rows.length, participantNames,
  };
}
