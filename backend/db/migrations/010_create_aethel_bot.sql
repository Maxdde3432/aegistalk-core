-- Миграция: Создание системного бота Aethel
-- Запускается один раз при первом запуске

-- Создаём бота Aethel если он ещё не существует
INSERT INTO users (id, username, first_name, last_name, email, password_hash, public_key, public_key_signature, is_active, created_at)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Aethel',
    'Aethel',
    'Bot',
    'bot@example.com',
    '',
    'bot_public_key',
    'bot_signature',
    TRUE,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);
