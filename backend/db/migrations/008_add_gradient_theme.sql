-- Добавляем поле gradient_theme в таблицу groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS gradient_theme VARCHAR(50) DEFAULT 'classic';
