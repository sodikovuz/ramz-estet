CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  winner BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS winners (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  prize INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS giveaway_state (
  id INTEGER PRIMARY KEY,
  status TEXT DEFAULT 'ready',
  current_spin INTEGER DEFAULT 0,
  winner TEXT,
  spin_started_at TIMESTAMP
);

INSERT INTO giveaway_state (id,status,current_spin)
VALUES (1,'ready',0)
ON CONFLICT (id) DO NOTHING;