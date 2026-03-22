CREATE TABLE IF NOT EXISTS chat_hidden_for_users (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_hidden_for_users_user_id
  ON chat_hidden_for_users(user_id, hidden_at DESC);
