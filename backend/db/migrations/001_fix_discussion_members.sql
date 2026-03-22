-- Автоматическая миграция: Добавление участников в группы обсуждений
-- Запускается при старте приложения

-- Добавляем участников канала в группу обсуждений (если они ещё не добавлены)
INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
SELECT 
    gen_random_uuid(),
    dg.id as discussion_group_id,
    cm.user_id,
    'member',
    NOW(),
    TRUE
FROM group_members cm
JOIN groups cg ON cm.group_id = cg.id
JOIN chats c ON c.group_id = cg.id
JOIN groups dg ON dg.id = (
    SELECT group_id FROM chats WHERE id = cg.discussion_chat_id
)
WHERE cg.type = 'channel' 
  AND cg.discussion_chat_id IS NOT NULL
  AND cm.is_active = TRUE
  AND cm.user_id != cg.owner_id
  AND NOT EXISTS (
    SELECT 1 FROM group_members gm 
    WHERE gm.group_id = dg.id AND gm.user_id = cm.user_id
  )
ON CONFLICT (group_id, user_id) DO NOTHING;
