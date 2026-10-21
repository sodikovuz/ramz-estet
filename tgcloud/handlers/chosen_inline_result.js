import { db } from 'sdk';
import { eq } from 'sdk/db';
import { giveaways, giveawayInlinePosts } from '../schema.js';
import { parseGiveawayInlineResultId } from '../lib/inline-result.js';

// Telegram sends chosen_inline_result only after a user selected a result.
// Persist the inline message ID so future edits/settlement can target the exact
// published inline message. Repeated delivery is safe because the pair is unique.
export default async function chosenInlineResult(chosen = {}, ctx) {
  const parsed = parseGiveawayInlineResultId(chosen.result_id);
  const inlineMessageId = typeof chosen.inline_message_id === 'string'
    ? chosen.inline_message_id.trim()
    : '';
  if (!parsed || !inlineMessageId) return { ok: true, ignored: true };

  const giveaway = await db.select({ id: giveaways.id })
    .from(giveaways)
    .where(eq(giveaways.id, parsed.giveawayId))
    .get();
  if (!giveaway) return { ok: true, ignored: true };

  await db.insert(giveawayInlinePosts).values({
    giveawayId: parsed.giveawayId,
    inlineMessageId,
  }).onConflictDoNothing({
    target: [giveawayInlinePosts.giveawayId, giveawayInlinePosts.inlineMessageId],
  }).run();

  return { ok: true, stored: true, giveawayId: parsed.giveawayId };
}
