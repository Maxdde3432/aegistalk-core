-- Проверка участников группы обсуждений
SELECT gm.user_id, u.first_name, gm.role, gm.is_active 
FROM group_members gm 
JOIN users u ON gm.user_id = u.id 
WHERE gm.group_id = '16c62b5c-4db0-4937-85d0-71a010d4811a';

-- Если есть с is_active = FALSE, активируем
UPDATE group_members 
SET is_active = TRUE, joined_at = NOW() 
WHERE group_id = '16c62b5c-4db0-4937-85d0-71a010d4811a' AND is_active = FALSE;
