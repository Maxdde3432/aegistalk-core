ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ALTER COLUMN public_key DROP NOT NULL;

ALTER TABLE users
  ALTER COLUMN public_key_signature DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
  ON users(google_id)
  WHERE google_id IS NOT NULL;
