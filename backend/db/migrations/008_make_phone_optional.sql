-- Миграция для поддержки регистрации только по email
-- Убираем NOT NULL из phone, так как теперь phone опциональный

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
