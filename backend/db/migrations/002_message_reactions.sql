-- Создаём таблицу реакций если не существует
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON message_reactions(user_id);
