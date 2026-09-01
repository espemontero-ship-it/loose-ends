CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  threat TEXT NOT NULL DEFAULT 'low' CHECK (threat IN ('high', 'watch', 'low')),
  secrets TEXT NOT NULL DEFAULT '',
  relations TEXT NOT NULL DEFAULT '',
  logged_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
