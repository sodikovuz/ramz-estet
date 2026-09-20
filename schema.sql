
-- RAMZ ESTET Professional Telegram Giveaway schema
CREATE TABLE IF NOT EXISTS giveaway_state (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ready',
  giveaway_id BIGINT NOT NULL DEFAULT 0,
  round INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 5,
  spin_id BIGINT NOT NULL DEFAULT 0,
  start_at BIGINT,
  duration_ms INTEGER NOT NULL DEFAULT 8000,
  target_index INTEGER,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  participant_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  telegram_chat_id BIGINT,
  telegram_message_id BIGINT,
  telegram_status TEXT DEFAULT 'idle'
);
INSERT INTO giveaway_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS giveaways (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'RAMZ ESTET GIVEAWAY',
  description TEXT NOT NULL DEFAULT '',
  image_file_id TEXT,
  total_rounds INTEGER NOT NULL DEFAULT 5,
  duration_ms INTEGER NOT NULL DEFAULT 8000,
  status TEXT NOT NULL DEFAULT 'draft',
  telegram_status TEXT NOT NULL DEFAULT 'draft',
  panel_token TEXT NOT NULL UNIQUE,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  posted_chat_id BIGINT,
  posted_message_id BIGINT
);

CREATE TABLE IF NOT EXISTS telegram_giveaway_participants (
  giveaway_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (giveaway_id,user_id)
);
CREATE INDEX IF NOT EXISTS tg_giveaway_participants_giveaway_idx
ON telegram_giveaway_participants(giveaway_id);
CREATE INDEX IF NOT EXISTS tg_giveaway_participants_user_idx
ON telegram_giveaway_participants(user_id);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id BIGSERIAL PRIMARY KEY,
  giveaway_id BIGINT NOT NULL,
  round INTEGER NOT NULL,
  user_id BIGINT,
  username TEXT,
  first_name TEXT,
  winner_label TEXT NOT NULL,
  won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(giveaway_id,round)
);
CREATE INDEX IF NOT EXISTS giveaway_winners_user_idx ON giveaway_winners(user_id);
CREATE INDEX IF NOT EXISTS giveaway_winners_gid_idx ON giveaway_winners(giveaway_id);

CREATE TABLE IF NOT EXISTS admin_drafts (
  admin_user_id BIGINT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  image_file_id TEXT,
  step TEXT NOT NULL DEFAULT 'idle',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS participant_user_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_status TEXT DEFAULT 'idle';
