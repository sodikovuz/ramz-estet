import { db } from 'sdk';
import { processedUpdates } from '../schema.js';

// Atomically claim a Telegram update ID. Returns false when the update was
// already claimed, allowing handlers to make duplicate delivery idempotent.
export async function claimTelegramUpdate(updateId) {
  const id = Number(updateId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError('A safe non-negative Telegram update_id is required');
  const result = await db.insert(processedUpdates)
    .values({ updateId: id })
    .onConflictDoNothing({ target: processedUpdates.updateId })
    .returning({ updateId: processedUpdates.updateId })
    .run();
  return result?.rowsAffected === 1 || (Array.isArray(result?.rows) && result.rows.length === 1);
}
