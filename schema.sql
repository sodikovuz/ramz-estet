CREATE TABLE IF NOT EXISTS giveaway_state (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ready',
  spin_id BIGINT NOT NULL DEFAULT 0,
  start_at BIGINT,
  duration_ms INTEGER NOT NULL DEFAULT 8000,
  target_index INTEGER,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO giveaway_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
