-- Миграция: Таблицы для пригласительных ссылок и журнала событий

-- Таблица пригласительных ссылок
CREATE TABLE IF NOT EXISTS group_invite_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(100),
    created_by UUID REFERENCES users(id),
    views INTEGER DEFAULT 0,
    joins INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_invite_links_group ON group_invite_links(group_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON group_invite_links(code);

-- Таблица журнала событий (admin logs)
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_admin_logs_group ON admin_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_user ON admin_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- Комментарии
COMMENT ON TABLE group_invite_links IS 'Пригласительные ссылки для групп/каналов';
COMMENT ON TABLE admin_logs IS 'Журнал действий администраторов в группах';
