CREATE TABLE IF NOT EXISTS user_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  username VARCHAR(32) NOT NULL,
  description TEXT,
  api_secret_hash TEXT NOT NULL,
  token_last4 VARCHAR(4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_token_issued_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_bots_owner
  ON user_bots(owner_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bots_username_lower
  ON user_bots (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bots_name_lower
  ON user_bots (LOWER(name));
