-- Миграция: Добавление настройки "Разрешить приглашения участниками"
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allow_member_invites BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN groups.allow_member_invites IS 'Разрешить обычным участникам приглашать новых пользователей';
