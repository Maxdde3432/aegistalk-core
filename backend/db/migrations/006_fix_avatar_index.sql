-- ============================================================================
-- FIX USER_AVATARS TABLE - Добавляем user_id колонку
-- Исправление ошибки: column "user_id" does not exist
-- ============================================================================

-- Проверяем существует ли таблица user_avatars
DO $$
BEGIN
    -- Если таблица существует, добавляем user_id если его нет
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_avatars') THEN
        -- Проверяем существует ли колонка user_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_avatars' AND column_name = 'user_id'
        ) THEN
            -- Добавляем колонку user_id
            ALTER TABLE user_avatars 
            ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            
            -- Добавляем индекс
            CREATE INDEX IF NOT EXISTS idx_user_avatars_user_id ON user_avatars(user_id);
            
            RAISE NOTICE 'user_id column added to user_avatars table';
        ELSE
            RAISE NOTICE 'user_id column already exists in user_avatars table';
        END IF;
    ELSE
        RAISE NOTICE 'user_avatars table does not exist, skipping';
    END IF;
END $$;

-- Удаляем старый индекс avatar_url (если существует)
DROP INDEX IF EXISTS idx_users_avatar;
