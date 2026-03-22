-- AegisTalk Database Schema
-- Безопасная схема БД для мессенджера с E2E шифрованием

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS - Пользователи
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    
    -- Профиль
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    
    -- Публичные ключи для E2E шифрования
    public_key TEXT,
    public_key_signature TEXT,
    
    -- Настройки безопасности
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT check_phone_or_email CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- CONTACTS - Контакты
-- ============================================================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Информация о контакте
    display_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Статус запроса
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'rejected')),
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT unique_contact UNIQUE (user_id, contact_user_id),
    CONSTRAINT check_not_self_contact CHECK (user_id != contact_user_id)
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_contact_user_id ON contacts(contact_user_id);

-- ============================================================================
-- GROUPS - Группы и Каналы
-- ============================================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,

    -- Тип: 'group' (чат) или 'channel' (канал)
    type VARCHAR(20) DEFAULT 'group' CHECK (type IN ('group', 'channel')),

    -- Владелец
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Настройки
    max_members INTEGER DEFAULT 200,
    is_public BOOLEAN DEFAULT FALSE,
    invite_link VARCHAR(255),

    -- E2E шифрование для группы
    group_public_key TEXT,

    -- Настройки канала (для type='channel')
    title_color VARCHAR(20) DEFAULT '#FFFFFF',      -- Цвет названия канала
    background_color VARCHAR(20) DEFAULT '#0E1621', -- Цвет фона сообщений
    gradient_theme VARCHAR(50) DEFAULT 'classic',   -- Градиентная тема (classic, day, night, sea, fire, nature, space, sunset, ocean, fog, pink, desert)
    animated_avatar_url TEXT,                       -- Анимированная аватарка (APNG/WebP)
    
    -- Привязанная группа для обсуждений (комментарии к постам)
    discussion_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,

    -- Уровень буста (для будущих функций кастомизации)
    boost_level INTEGER DEFAULT 0,

    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ограничения
    CONSTRAINT check_group_name_length CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100)
);

CREATE INDEX idx_groups_owner_id ON groups(owner_id);
CREATE INDEX idx_groups_type ON groups(type);

-- ============================================================================
-- GROUP_MEMBERS - Участники групп
-- ============================================================================
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Роль: 'owner', 'admin', 'member'
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    
    -- Личный ключ участника для группового E2E
    member_private_key_encrypted TEXT,
    
    -- Статус
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ограничения
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);

-- ============================================================================
-- CHATS - Чаты (личные и групповые)
-- ============================================================================
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Тип чата: 'private', 'group', 'channel'
    type VARCHAR(20) NOT NULL CHECK (type IN ('private', 'group', 'channel')),
    
    -- Для личных чатов - два участника
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Для групповых чатов
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    
    -- Общий ключ сессии для E2E (для личных чатов)
    shared_secret_encrypted TEXT,
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    -- Ограничения
    CONSTRAINT check_private_chat_users CHECK (
        (type = 'private' AND user1_id IS NOT NULL AND user2_id IS NOT NULL) OR
        (type IN ('group', 'channel') AND group_id IS NOT NULL)
    ),
    CONSTRAINT check_unique_private_chat UNIQUE (user1_id, user2_id)
);

CREATE INDEX idx_chats_user1 ON chats(user1_id);
CREATE INDEX idx_chats_user2 ON chats(user2_id);
CREATE INDEX idx_chats_group ON chats(group_id);

-- ============================================================================
-- MESSAGES - Сообщения
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Тип сообщения
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN (
        'text', 'image', 'video', 'audio', 'file', 'voice', 'sticker'
    )),
    
    -- Содержимое (зашифровано на клиенте)
    content_encrypted TEXT NOT NULL,
    
    -- E2E шифрование
    nonce TEXT NOT NULL,                    -- Уникальный номер для шифрования
    sender_public_key TEXT NOT NULL,        -- Публичный ключ отправителя
    signature TEXT NOT NULL,                -- Подпись сообщения
    
    -- Медиа (если есть)
    media_url TEXT,
    media_thumbnail_url TEXT,
    media_mime_type VARCHAR(100),
    media_size_bytes BIGINT,
    
    -- Статус доставки
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    
    -- Редактирование
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    
    -- Удаление
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Индексы для производительности
    CONSTRAINT check_message_content CHECK (
        LENGTH(content_encrypted) > 0 OR media_url IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS chat_hidden_for_users (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_status ON messages(status);

-- ============================================================================
-- MESSAGE_REACTIONS - Реакции на сообщения
-- ============================================================================
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message_id ON message_reactions(message_id);

-- ============================================================================
-- SESSIONS - Активные сессии пользователей
-- ============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Информация об устройстве
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    
    -- Токен сессии
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);

-- ============================================================================
-- REPORTS - Жалобы (для админ-панели)
-- ============================================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'spam', 'harassment', 'violence', 'illegal_content', 
        'fake_account', 'other'
    )),
    description TEXT,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);

-- ============================================================================
-- Функция для обновления updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Начальные данные для тестирования (можно удалить в production)
-- ============================================================================
-- INSERT INTO users (phone, username, password_hash, public_key, public_key_signature, first_name, last_name)
-- VALUES 
-- ('+1234567890', 'alice', '$argon2id$...', 'pubkey_alice...', 'sig_alice...', 'Alice', 'Smith'),
-- ('+0987654321', 'bob', '$argon2id$...', 'pubkey_bob...', 'sig_bob...', 'Bob', 'Johnson');
