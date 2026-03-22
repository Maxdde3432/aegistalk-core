-- Исправление: Добавление участников канала в группу обсуждений
INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
SELECT 
    gen_random_uuid(),
    c.id as discussion_group_id,
    gm.user_id,
    'member',
    NOW(),
    TRUE
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
JOIN chats ch ON ch.group_id = g.id
JOIN groups c ON c.id = (
    SELECT group_id FROM chats WHERE id = g.discussion_chat_id
)
WHERE g.type = 'channel' 
  AND g.discussion_chat_id IS NOT NULL
  AND gm.is_active = TRUE
  AND gm.user_id != g.owner_id
  AND NOT EXISTS (
    SELECT 1 FROM group_members x 
    WHERE x.group_id = c.id AND x.user_id = gm.user_id
  )
ON CONFLICT (group_id, user_id) DO NOTHING;
