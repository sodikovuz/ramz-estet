// Parse only the result IDs emitted by the legacy inline-query contract.
// Keep this pure so malformed and unrelated IDs can be rejected in unit tests.
export function parseGiveawayInlineResultId(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^giveaway_(?:photo_)?([1-9]\d{0,14})_(\d{1,})$/);
  if (!match) return null;
  const giveawayId = Number(match[1]);
  if (!Number.isSafeInteger(giveawayId) || giveawayId <= 0) return null;
  return { giveawayId, nonce: match[2] };
}
