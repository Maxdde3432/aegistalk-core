-- Полная схема базы данных для AegisTalk
-- Выполни этот SQL в Neon Console

-- ============================================================================
-- USERS
-- ============================================================================
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
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- ============================================================================
-- SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============================================================================
-- GROUPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'private',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT FALSE,
  title_color VARCHAR(7) DEFAULT '#ffffff',
  background_color VARCHAR(7) DEFAULT '#1a73e8',
  avatar_url TEXT,
  animated_avatar_url TEXT,
  invite_link TEXT,
  external_link TEXT,
  site_verification_status TEXT DEFAULT 'none',
  verification_code TEXT,
  group_public_key TEXT,
  gradient_theme TEXT,
  boost_level INTEGER DEFAULT 0,
  discussion_chat_id UUID,
  reactions_enabled BOOLEAN DEFAULT TRUE,
  allowed_reactions TEXT,
  allow_member_invites BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (verification_code)
);

CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);

-- ============================================================================
-- GROUP MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  is_left BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- ============================================================================
-- CHATS
-- ============================================================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL DEFAULT 'private',
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_user1 ON chats(user1_id);
CREATE INDEX IF NOT EXISTS idx_chats_user2 ON chats(user2_id);
CREATE INDEX IF NOT EXISTS idx_chats_group ON chats(group_id);
CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_encrypted TEXT,
  message_type VARCHAR(50) DEFAULT 'text',
  status VARCHAR(20) DEFAULT 'sent',
  is_deleted BOOLEAN DEFAULT FALSE,
  nonce TEXT,
  sender_public_key TEXT,
  signature TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS chat_hidden_for_users (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- ============================================================================
-- EMAIL VERIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  attempt_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);

-- ============================================================================
-- BOT (Aegis Bot)
-- ============================================================================
INSERT INTO users (id, username, email, password_hash, first_name, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'aegis_bot',
  'bot@aegistalk.com',
  '',
  'Aegis Bot',
  TRUE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ПРИВЕТСТВЕННЫЙ ЧАТ С БОТОМ
-- ============================================================================
INSERT INTO chats (id, type, user1_id, user2_id, created_at, last_message_at)
SELECT
  '10000000-0000-0000-0000-000000000001',
  'private',
  '00000000-0000-0000-0000-000000000001',
  id,
  NOW(),
  NOW()
FROM users
WHERE id != '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

-- Приветственное сообщение от бота
INSERT INTO messages (chat_id, sender_id, content, message_type, created_at)
SELECT 
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Добро пожаловать в AegisTalk! 🚀\n\n— ☁️ Облако: Храните здесь свои файлы и заметки.\n— 📱 Сервис: Сюда придут коды входа и уведомления.',
  'text',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM messages WHERE chat_id = '10000000-0000-0000-0000-000000000001'
);
