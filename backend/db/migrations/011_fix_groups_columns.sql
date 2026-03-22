-- ============================================================================
-- FIX: Добавление missing колонок в таблицу groups
-- Ошибка: column "updated_at" of relation "groups" does not exist
-- ============================================================================

-- Добавляем колонку updated_at если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Добавляем колонку allow_member_invites если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allow_member_invites BOOLEAN DEFAULT TRUE;

-- Добавляем колонку reactions_enabled если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS reactions_enabled BOOLEAN DEFAULT TRUE;

-- Добавляем колонку allowed_reactions если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allowed_reactions TEXT;

-- Добавляем колонку gradient_theme если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS gradient_theme VARCHAR(50) DEFAULT 'classic';

-- Добавляем колонку animated_avatar_url если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS animated_avatar_url TEXT;

-- Добавляем колонку boost_level если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS boost_level INTEGER DEFAULT 0;

-- Добавляем колонку discussion_chat_id если её нет
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS discussion_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL;

-- Проверяем результат
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'groups'
ORDER BY ordinal_position;

-- Выводим сообщение
SELECT '✅ Все колонки добавлены в таблицу groups!' as status;
