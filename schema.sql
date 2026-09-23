
CREATE TABLE IF NOT EXISTS giveaways (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_file_id TEXT,
  total_rounds INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'scheduled',
  start_at TIMESTAMPTZ NOT NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  posted_chat_id BIGINT,
  posted_message_id BIGINT,
  inline_message_id TEXT,
  viewer_url TEXT
);

CREATE TABLE IF NOT EXISTS telegram_giveaway_participants (
  giveaway_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (giveaway_id,user_id)
);

CREATE TABLE IF NOT EXISTS giveaway_viewers (
  giveaway_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (giveaway_id,user_id)
);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id BIGSERIAL PRIMARY KEY,
  giveaway_id BIGINT NOT NULL,
  round INTEGER NOT NULL,
  user_id BIGINT,
  username TEXT,
  winner_label TEXT NOT NULL,
  won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(giveaway_id,round)
);

CREATE TABLE IF NOT EXISTS giveaway_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  giveaway_id BIGINT,
  round INTEGER DEFAULT 1,
  total_rounds INTEGER DEFAULT 5,
  spin_id BIGINT DEFAULT 1,
  start_at BIGINT,
  duration_ms INTEGER DEFAULT 8000,
  target_index INTEGER,
  participants JSONB DEFAULT '[]'::jsonb,
  winners JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'idle',
  telegram_status TEXT DEFAULT 'idle',
  telegram_chat_id BIGINT,
  telegram_message_id BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS giveaway_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 5;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS spin_id BIGINT DEFAULT 1;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS start_at BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 8000;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS target_index INTEGER;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_status TEXT DEFAULT 'idle';
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS admin_sessions(user_id BIGINT PRIMARY KEY,state TEXT NOT NULL DEFAULT 'idle',data JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS giveaway_notify_log(giveaway_id BIGINT NOT NULL,marker TEXT NOT NULL,sent_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(giveaway_id,marker));

-- Security/reliability migration for the current build.
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS participant_user_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS first_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_state_giveaway_id_uidx ON giveaway_state(giveaway_id) WHERE giveaway_id IS NOT NULL;

-- Do not store Telegram/admin secrets in giveaway URLs.
-- STARTAPP_SECRET must be a random 32+ byte secret configured in Vercel.
-- TELEGRAM_WEBHOOK_SECRET must be configured and applied through setWebhook.

CREATE TABLE IF NOT EXISTS startapp_tokens (
  token_hash TEXT PRIMARY KEY,
  giveaway_id BIGINT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('join','watch')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS startapp_tokens_exp_idx ON startapp_tokens(expires_at);
CREATE INDEX IF NOT EXISTS startapp_tokens_giveaway_idx ON startapp_tokens(giveaway_id, action);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  action TEXT,
  admin_user_id BIGINT,
  giveaway_id BIGINT,
  message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_level_idx ON audit_logs(level,created_at DESC);


-- Telegram group management.
CREATE TABLE IF NOT EXISTS telegram_chats (
  chat_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  username TEXT,
  type TEXT NOT NULL,
  bot_status TEXT,
  can_post_messages BOOLEAN DEFAULT FALSE,
  can_delete_messages BOOLEAN DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS giveaway_chats (
  giveaway_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  role TEXT NOT NULL DEFAULT 'post' CHECK (role IN ('post','winner','reminder')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (giveaway_id,chat_id,role)
);
CREATE TABLE IF NOT EXISTS giveaway_chat_posts (
  id BIGSERIAL PRIMARY KEY,
  giveaway_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  message_id BIGINT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(giveaway_id,chat_id)
);
CREATE INDEX IF NOT EXISTS giveaway_chats_giveaway_idx ON giveaway_chats(giveaway_id);
CREATE INDEX IF NOT EXISTS giveaway_chats_chat_idx ON giveaway_chats(chat_id);
