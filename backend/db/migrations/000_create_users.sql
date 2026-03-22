-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  password_hash TEXT,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  public_key TEXT,
  public_key_signature TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
