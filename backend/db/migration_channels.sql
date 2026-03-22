-- Миграция для добавления новых полей каналов
-- Запуск: docker exec -i aegistalk_db psql -U aegistalk -d aegistalk < migration_channels.sql

-- Добавляем новые поля в таблицу groups
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS title_color VARCHAR(20) DEFAULT '#FFFFFF';

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS background_color VARCHAR(20) DEFAULT '#0E1621';

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS animated_avatar_url TEXT;

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS discussion_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL;

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS boost_level INTEGER DEFAULT 0;

-- Индекс для поиска публичных каналов
CREATE INDEX IF NOT EXISTS idx_groups_public ON groups(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_groups_type_public ON groups(type, is_public) WHERE type = 'channel' AND is_public = TRUE;
