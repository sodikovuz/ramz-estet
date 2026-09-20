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
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO giveaway_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS giveaway_id BIGINT DEFAULT 0;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 0;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 5;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS spin_id BIGINT DEFAULT 0;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS start_at BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 8000;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS target_index INTEGER;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]'::jsonb;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS telegram_giveaway_participants (
  giveaway_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (giveaway_id, user_id)
);
CREATE INDEX IF NOT EXISTS tg_giveaway_participants_giveaway_idx
ON telegram_giveaway_participants(giveaway_id);
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
ALTER TABLE giveaway_state ADD COLUMN IF NOT EXISTS telegram_status TEXT DEFAULT 'idle';
