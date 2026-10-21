import { db, EndpointError } from 'sdk';
import { eq, and } from 'sdk/db';
import { winners } from '../schema.js';
import { readStartAppToken } from '../lib/startapp-tokens.js';

export default async function winnerStatus(input = {}, ctx) {
  const user = ctx?.initData?.user;
  const token = String(input.startApp || ctx?.initData?.startParam || '');
  const round = Number(input.round || 0);
  if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0 || !Number.isSafeInteger(round) || round < 1) {
    throw new EndpointError('Tasdiqlash ma’lumotlari noto‘g‘ri', { code: 'INVALID_WINNER_CHECK' });
  }
  if (ctx?.initData?.startParam && token !== ctx.initData.startParam) {
    throw new EndpointError('Mini App havolasi mos kelmadi', { code: 'START_PARAM_MISMATCH' });
  }
  const access = await readStartAppToken(token, 'watch') || await readStartAppToken(token, 'join');
  if (!access) throw new EndpointError('Havola yaroqsiz yoki muddati tugagan', { code: 'INVALID_GIVEAWAY_TOKEN' });
  const winner = await db.select().from(winners).where(and(
    eq(winners.giveawayId, access.giveawayId),
    eq(winners.round, round),
    eq(winners.userId, Number(user.id)),
  )).get();
  return { ok: true, isWinner: Boolean(winner), winner: winner?.winnerLabel || null, round };
}
