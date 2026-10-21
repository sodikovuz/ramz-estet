// Telegram Serverless message handler.
// The previous scaffold echoed every incoming message ("You said: ...").
// Do not pretend the legacy admin conversation/callback state machine is
// migrated: those handlers and their database operations still need porting.
import { api } from 'sdk';

const MINI_APP_URL = 'https://app8341742293.tgcloud.ai/';

export default async function messageHandler(message, ctx) {
  const chatId = message?.chat?.id;
  if (chatId == null) return;

  const text = String(message?.text ?? '').trim();
  // Never echo arbitrary messages or expose admin actions to group chats.
  if (message?.chat?.type !== 'private') return;

  if (text === '/start' || text === '/start@ramzestetbot' || text === '/menu') {
    await api.sendMessage({
      chat_id: chatId,
      text: [
        'RAMZ ESTET',
        '',
        'Telegram Serverless Mini App ulandi.',
        'Admin boshqaruv menyusi va giveaway amallari to‘liq ko‘chirilmaguncha eski botdagi boshqaruv tugmalari bu yerda ishlamasligi mumkin.',
        '',
        'Mini App’ni ochish uchun quyidagi tugmani bosing.',
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{
          text: '🌐 WebApp Admin Panel',
          web_app: { url: MINI_APP_URL },
        }]],
      },
    });
    return;
  }

  if (text === '/help' || text === '/help@ramzestetbot') {
    await api.sendMessage({
      chat_id: chatId,
      text: 'RAMZ ESTET Serverless sinov rejimida. Eski admin suhbat oqimi va callback amallari hali to‘liq ko‘chirilmagan. Production botni almashtirmang.',
    });
  }
}
