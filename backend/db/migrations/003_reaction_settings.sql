-- Добавляем поля для управления реакциями в каналах
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS reactions_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allowed_reactions TEXT[] DEFAULT ARRAY['👍', '👎', '❤️', '🔥', '🎉', '😂', '😮', '😢', '😡', '✅', '⭐', '🚀'];

COMMENT ON COLUMN groups.reactions_enabled IS 'Включены ли реакции в канале';
COMMENT ON COLUMN groups.allowed_reactions IS 'Список разрешённых emoji для реакций';
