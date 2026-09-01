ALTER TABLE files ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'guest' CHECK (type IN ('guest', 'staff'));
