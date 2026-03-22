-- Проверка группы обсуждений
SELECT g.id, g.name, g.type, g.owner_id 
FROM groups g 
WHERE g.id = '4696e383-431a-4e0e-8cd0-2be01716059b';

-- Проверка участников группы обсуждений
SELECT gm.user_id, gm.role, u.first_name 
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = '4696e383-431a-4e0e-8cd0-2be01716059b' AND gm.is_active = TRUE;

-- Если участников нет (кроме владельца), добавим вручную
-- Сначала найдём владельца канала
SELECT g.owner_id FROM groups g WHERE g.discussion_chat_id = '4696e383-431a-4e0e-8cd0-2be01716059b';

-- Найдем всех участников канала
SELECT gm.user_id, u.first_name 
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id IN (SELECT id FROM groups WHERE discussion_chat_id = '4696e383-431a-4e0e-8cd0-2be01716059b')
AND gm.is_active = TRUE;
