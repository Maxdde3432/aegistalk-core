-- Добавляем поле is_left для отслеживания, вышел ли участник сам
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_left BOOLEAN DEFAULT FALSE;

-- Комментарии
COMMENT ON COLUMN group_members.is_left IS 'TRUE если участник вышел сам (может вернуться), FALSE если был кикнут/забанен';

-- Индекс для быстрого поиска активных участников
CREATE INDEX IF NOT EXISTS idx_group_members_active ON group_members(group_id, is_active, is_left);
