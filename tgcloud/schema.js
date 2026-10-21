import { table, integer, text, boolean, json, index, unique, sql } from 'sdk/db';

// SQLite schema mapping for known Ramz Estet PostgreSQL tables.
// Convert TIMESTAMPTZ to Unix seconds and JSONB to JSON before importing.
// Telegram Serverless does not support foreign keys.

export const giveaways = table('giveaways', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(), description: text('description').default(''),
  imageFileId: text('image_file_id'), totalRounds: integer('total_rounds').notNull().default(5),
  status: text('status').notNull().default('scheduled'),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  createdBy: integer('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }), finishedAt: integer('finished_at', { mode: 'timestamp' }),
  postedChatId: integer('posted_chat_id'), postedMessageId: integer('posted_message_id),
  inlineMessageId: text('inline_message_id'), viewerUrl: text('viewer_url'),
  panelToken: text('panel_token'), durationMs: integer('duration_ms').default(8000),
}, (t) => ({ statusStartIdx: index('giveaways_status_start_idx').on(t.status, t.startAt), createdByIdx: index('giveaways_created_by_idx').on(t.createdBy) }));

export const participants = table('telegram_giveaway_participants', {
  giveawayId: integer('giveaway_id').notNull(), userId: integer('user_id').notNull(),
  username: text('username'), firstName: text('first_name'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: unique('participants_pk').on(t.giveawayId, t.userId), joinedIdx: index('participants_joined_idx').on(t.giveawayId, t.joinedAt) }));

export const viewers = table('giveaway_viewers', {
  giveawayId: integer('giveaway_id').notNull(), userId: integer('user_id').notNull(),
  username: text('username'), firstName: text('first_name'),
  enteredAt: integer('entered_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: unique('viewers_pk').on(t.giveawayId, t.userId) }));

export const winners = table('giveaway_winners', {
  id: integer('id').primaryKey({ autoIncrement: true }), giveawayId: integer('giveaway_id').notNull(),
  round: integer('round').notNull(), userId: integer('user_id'), username: text('username'),
  firstName: text('first_name'), winnerLabel: text('winner_label').notNull(),
  wonAt: integer('won_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ roundUnique: unique('winners_round_uq').on(t.giveawayId, t.round), wonAtIdx: index('winners_won_at_idx').on(t.wonAt) }));

export const giveawayState = table('giveaway_state', {
  id: integer('id').primaryKey().default(1), giveawayId: integer('giveaway_id').unique(),
  round: integer('round').default(1), totalRounds: integer('total_rounds').default(5),
  spinId: integer('spin_id').default(1), startAt: integer('start_at'), durationMs: integer('duration_ms').default(8000),
  targetIndex: integer('target_index'), participants: json('participants').default([]),
  participantUserIds: json('participant_user_ids').default([]), winners: json('winners').default([]),
  status: text('status').default('idle'), telegramStatus: text('telegram_status').default('idle'),
  telegramChatId: integer('telegram_chat_id'), telegramMessageId: integer('telegram_message_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const adminSessions = table('admin_sessions', {
  userId: integer('user_id').primaryKey(), state: text('state').notNull().default('idle'),
  data: json('data').notNull().default({}), updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const notifyLog = table('giveaway_notify_log', {
  giveawayId: integer('giveaway_id').notNull(), marker: text('marker').notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({ pk: unique('notify_log_pk').on(t.giveawayId, t.marker) }));

export const startappTokens = table('startapp_tokens', {
  tokenHash: text('token_hash').primaryKey(), giveawayId: integer('giveaway_id').notNull(),
  action: text('action').notNull(), expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ expiryIdx: index('startapp_tokens_exp_idx').on(t.expiresAt), giveawayActionIdx: index('startapp_tokens_giveaway_action_idx').on(t.giveawayId, t.action) }));

export const auditLogs = table('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), requestId: text('request_id'),
  level: text('level').notNull().default('info'), source: text('source').notNull(), action: text('action'),
  adminUserId: integer('admin_user_id'), giveawayId: integer('giveaway_id'), message: text('message'),
  meta: json('meta').notNull().default({}), createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ createdIdx: index('audit_logs_created_idx').on(t.createdAt), levelCreatedIdx: index('audit_logs_level_created_idx').on(t.level, t.createdAt) }));

export const telegramChats = table('telegram_chats', {
  chatId: integer('chat_id').primaryKey(), title: text('title').notNull(), username: text('username'),
  type: text('type').notNull(), botStatus: text('bot_status'), canPostMessages: boolean('can_post_messages').default(false),
  canDeleteMessages: boolean('can_delete_messages').default(false), active: boolean('active').notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const giveawayChats = table('giveaway_chats', {
  giveawayId: integer('giveaway_id').notNull(), chatId: integer('chat_id').notNull(),
  role: text('role').notNull().default('post'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: unique('giveaway_chats_pk').on(t.giveawayId, t.chatId, t.role), giveawayIdx: index('giveaway_chats_giveaway_idx').on(t.giveawayId), chatIdx: index('giveaway_chats_chat_idx').on(t.chatId) }));

export const giveawayChatPosts = table('giveaway_chat_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }), giveawayId: integer('giveaway_id').notNull(),
  chatId: integer('chat_id').notNull(), messageId: integer('message_id'),
  postedAt: integer('posted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniquePost: unique('giveaway_chat_posts_uq').on(t.giveawayId, t.chatId) }));

export const giveawayInlinePosts = table('giveaway_inline_posts', {
  giveawayId: integer('giveaway_id').notNull(), inlineMessageId: text('inline_message_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ pk: unique('giveaway_inline_posts_pk').on(t.giveawayId, t.inlineMessageId), giveawayIdx: index('giveaway_inline_posts_idx').on(t.giveawayId) }));

export const botSettings = table('bot_settings', {
  id: integer('id').primaryKey().default(1), botMessagesEnabled: boolean('bot_messages_enabled').notNull().default(false),
  botMessagesDelayMinutes: integer('bot_messages_delay_minutes').notNull().default(15),
  userMessagesEnabled: boolean('user_messages_enabled').notNull().default(false),
  userMessagesDelayMinutes: integer('user_messages_delay_minutes').notNull().default(0),
  duplicateProtectionEnabled: boolean('duplicate_protection_enabled').notNull().default(true),
  autoStartEnabled: boolean('auto_start_enabled').notNull().default(false), autoFinishEnabled: boolean('auto_finish_enabled').notNull().default(true),
  remindersEnabled: boolean('reminders_enabled').notNull().default(true), reminder15m: boolean('reminder_15m').notNull().default(true),
  reminder5m: boolean('reminder_5m').notNull().default(true), reminder2m: boolean('reminder_2m').notNull().default(true),
  winnerAnnouncementEnabled: boolean('winner_announcement_enabled').notNull().default(true), winnerImageEnabled: boolean('winner_image_enabled').notNull().default(true),
  winnerQrEnabled: boolean('winner_qr_enabled').notNull().default(true), winnerSignatureEnabled: boolean('winner_signature_enabled').notNull().default(true),
  winnerStampEnabled: boolean('winner_stamp_enabled').notNull().default(true), participantRealtimeEnabled: boolean('participant_realtime_enabled').notNull().default(true),
  viewerRealtimeEnabled: boolean('viewer_realtime_enabled').notNull().default(true), adminSessionTimeoutMinutes: integer('admin_session_timeout_minutes').notNull().default(60),
  tokenExpiryDays: integer('token_expiry_days').notNull().default(7), auditLoggingEnabled: boolean('audit_logging_enabled').notNull().default(true),
  panelSingleMessage: boolean('panel_single_message').notNull().default(true), cleanupGroupMessages: boolean('cleanup_group_messages').notNull().default(false),
  searchEnabled: boolean('search_enabled').notNull().default(true), statisticsEnabled: boolean('statistics_enabled').notNull().default(true),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const botMessageCleanup = table('bot_message_cleanup', {
  id: integer('id').primaryKey({ autoIncrement: true }), chatId: integer('chat_id').notNull(),
  messageId: integer('message_id').notNull(), kind: text('kind').notNull().default('bot'),
  deleteAt: integer('delete_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniqueMessage: unique('bot_message_cleanup_uq').on(t.chatId, t.messageId), dueIdx: index('bot_message_cleanup_due_idx').on(t.deleteAt) }));

export const processedUpdates = table('telegram_processed_updates', {
  updateId: integer('update_id').primaryKey(),
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ processedTimeIdx: index('telegram_processed_updates_time_idx').on(t.processedAt) }));

export const botUiState = table('bot_ui_state', {
  chatId: integer('chat_id').primaryKey(), messageId: integer('message_id').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
