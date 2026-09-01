CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'guest' CHECK (type IN ('guest', 'staff')),
  threat TEXT NOT NULL DEFAULT 'low' CHECK (threat IN ('high', 'watch', 'low')),
  basic_info TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '',
  relations JSONB NOT NULL DEFAULT '[]',
  logged_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
