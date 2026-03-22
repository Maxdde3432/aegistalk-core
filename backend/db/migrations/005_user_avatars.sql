-- Миграция для работы с аватарами пользователей
-- Добавляем поле для хранения URL аватара (уже есть в init.sql)

-- Убеждаемся что avatar_url существует
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Индекс удалён - PostgreSQL не может индексировать длинные TEXT значения
