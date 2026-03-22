-- Скрипт добавляет всех участников канала в группу обсуждений
-- Запуск: docker exec -i aegistalk_db psql -U aegistalk -d aegistalk < fix_discussion_members.sql

-- Находим все каналы с обсуждениями
WITH channels_with_discussions AS (
  SELECT id as channel_id, discussion_chat_id, owner_id
  FROM groups
  WHERE type = 'channel' AND discussion_chat_id IS NOT NULL
),
-- Находим ID группы для каждого обсуждения
discussion_groups AS (
  SELECT g.id as discussion_group_id, c.channel_id
  FROM groups g
  JOIN channels_with_discussions c ON g.id = (
    SELECT group_id FROM chats WHERE id = c.discussion_chat_id
  )
),
-- Находим всех участников каналов (кроме владельца, он уже добавлен)
channel_members AS (
  SELECT gm.group_id as channel_id, gm.user_id
  FROM group_members gm
  JOIN discussion_groups dg ON gm.group_id = dg.channel_id
  WHERE gm.is_active = TRUE AND gm.user_id != (SELECT owner_id FROM groups WHERE id = gm.group_id)
),
-- Добавляем участников в группу обсуждений
insert_members AS (
  INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
  SELECT 
    gen_random_uuid(),
    dg.discussion_group_id,
    cm.user_id,
    'member',
    NOW(),
    TRUE
  FROM channel_members cm
  JOIN discussion_groups dg ON cm.channel_id = dg.channel_id
  ON CONFLICT (group_id, user_id) DO NOTHING
)
-- Выводим результат
SELECT 'Members added to discussion groups' as result;
