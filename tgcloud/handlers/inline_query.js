export default async function callbackQueryHandler(update) {
  const req = { method: 'POST', json: true, clone: () => ({ json: async () => update }), headers: { 'x-telegram-bot-api-secret-token': globalThis.env?.TELEGRAM_WEBHOOK_SECRET || process?.env?.TELEGRAM_WEBHOOK_SECRET } };
  const webhook = await import('../endpoints/telegram-webhook.js');
  return await webhook.default(req);
}
