import { v4 as uuidv4 } from 'uuid';
import { getClient, query } from '../db/index.js';
import crypto from 'crypto';
import { assignUniqueVerificationCode } from '../utils/verificationCode.js';


const GROUP_ROLE_ORDER = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
  bot: 0
};

const GROUP_MANAGERS = new Set(['owner', 'admin', 'moderator']);

const getRoleRank = (role) => GROUP_ROLE_ORDER[role] ?? -1;

const canManageMembersByRole = (role) => GROUP_MANAGERS.has(role);

const canRemoveMemberByRole = (actorRole, targetRole) => {
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'admin') return ['moderator', 'member', 'bot'].includes(targetRole);
  if (actorRole === 'moderator') return ['member', 'bot'].includes(targetRole);
  return false;
};

const canChangeMemberRole = ({ actorRole, targetRole, nextRole, targetIsBot }) => {
  if (targetRole === 'owner') return false;
  if (targetIsBot || targetRole === 'bot' || nextRole === 'bot') {
    return targetIsBot && targetRole === 'bot' && nextRole === 'bot';
  }
  if (!['member', 'moderator', 'admin'].includes(nextRole)) return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    if (targetRole === 'admin') return false;
    return nextRole === 'member' || nextRole === 'moderator';
  }
  return false;
};

const memberRoleOrderSql = "CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 WHEN 'member' THEN 3 WHEN 'bot' THEN 4 ELSE 5 END";

const sendGroupRealtimeEvent = async (groupId, eventData) => {
  try {
    const server = await import('../server.js');
    if (typeof server.sendMessageToChat === 'function') {
      server.sendMessageToChat(groupId, eventData, 'channel');
    }
  } catch (error) {
    console.error('[Groups] Failed to broadcast group event:', error);
  }
};

const sendRealtimeEventToUser = async (targetUserId, eventData) => {
  try {
    const server = await import('../server.js');
    if (typeof server.sendToUser === 'function') {
      server.sendToUser(targetUserId, eventData);
      return;
    }

    const wss = server.default?.get?.('wss');
    if (wss?.clients) {
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.userId === targetUserId) {
          client.send(JSON.stringify(eventData));
        }
      });
    }
  } catch (error) {
    console.error('[Groups] Failed to send personal realtime event:', error);
  }
};

// ============================================================================
// GET COMMON CHATS - Получить общие чаты с пользователем
// ============================================================================
export const getCommonChats = async (req, res) => {
  try {
    const userId = req.userId;
    const { otherUserId } = req.params;

    // Находим все каналы и группы, где состоят оба пользователя
    const result = await query(
      `SELECT g.id, g.name, g.avatar_url, g.type, g.created_at,
              (SELECT role FROM group_members WHERE group_id = g.id AND user_id = $1) as my_role
       FROM groups g
       INNER JOIN group_members gm1 ON g.id = gm1.group_id AND gm1.user_id = $1 AND gm1.is_active = TRUE
       INNER JOIN group_members gm2 ON g.id = gm2.group_id AND gm2.user_id = $2 AND gm2.is_active = TRUE
       WHERE g.type = 'channel' OR g.type = 'group'
       ORDER BY g.created_at DESC`,
      [userId, otherUserId]
    );

    const commonChats = result.rows.map(group => ({
      id: group.id,
      name: group.name,
      avatarUrl: group.avatar_url,
      type: group.type,
      myRole: group.my_role
    }));

    console.log(`[Groups] Common chats between ${userId} and ${otherUserId}:`, commonChats);
    res.json(commonChats);
  } catch (error) {
    console.error('[Groups] GetCommonChats error:', error);
    res.status(500).json({ error: 'Ошибка при получении общих чатов' });
  }
};

// ============================================================================
// GET MY GROUPS - Получить все группы пользователя
// ============================================================================
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT g.id, g.name, g.description, g.external_link AS "externalLink", g.site_verification_status AS "siteVerificationStatus", g.verification_code AS "verificationCode", g.avatar_url, g.animated_avatar_url,
              g.type, g.owner_id, g.is_public, g.invite_link, g.created_at,
              g.title_color, g.background_color, g.background_image_url, g.gradient_theme, g.boost_level, g.discussion_chat_id,
              g.allow_member_invites,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = TRUE) as member_count,
              (SELECT role FROM group_members WHERE group_id = g.id AND user_id = $1) as my_role
       FROM groups g
       WHERE g.owner_id = $1 OR g.id IN (
         SELECT group_id FROM group_members WHERE user_id = $1 AND is_active = TRUE
       )
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const groups = result.rows.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      externalLink: group.externalLink,
      siteVerificationStatus: group.siteVerificationStatus || group.site_verification_status || 'none',
      // verification code скрываем из списка групп
      avatarUrl: group.avatar_url,
      animatedAvatarUrl: group.animated_avatar_url,
      type: group.type,
      ownerId: group.owner_id,
      isPublic: group.is_public,
      inviteLink: group.invite_link,
      createdAt: group.created_at,
      memberCount: parseInt(group.member_count),
      myRole: group.my_role,
      titleColor: group.title_color,
      backgroundColor: group.background_color,
      backgroundImageUrl: group.background_image_url,
      gradientTheme: group.gradient_theme || 'tg_blue',
      boostLevel: group.boost_level,
      discussionChatId: group.discussion_chat_id,
      allowMemberInvites: group.allow_member_invites || false
    }));

    res.json(groups);

  } catch (error) {
    console.error('[Groups] GetMyGroups error:', error);
    res.status(500).json({ error: 'Ошибка при получении групп' });
  }
};

// ============================================================================
// CREATE GROUP - Создать группу или канал
// ============================================================================
export const createGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, type = 'group', isPublic = false, titleColor, backgroundColor } = req.body;

    // Валидация
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Название должно быть не менее 2 символов' });
    }

    if (type !== 'group' && type !== 'channel') {
      return res.status(400).json({ error: 'Неверный тип. Должен быть group или channel' });
    }

    // Создаём группу
    const groupId = uuidv4();
    const result = await query(
      `INSERT INTO groups (id, name, description, type, owner_id, is_public, title_color, background_color, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, name, description, type, owner_id, is_public, title_color, background_color, created_at`,
      [groupId, name.trim(), description?.trim() || null, type, userId, isPublic, titleColor || '#FFFFFF', backgroundColor || '#0E1621']
    );

    // Добавляем владельца как участника с ролью owner
    await query(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
       VALUES ($1, $2, $3, 'owner', NOW(), TRUE)`,
      [uuidv4(), groupId, userId]
    );

    // Создаём чат для группы или канала
    const chatId = uuidv4();
    await query(
      `INSERT INTO chats (id, type, group_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [chatId, type, groupId]
    );

    const group = result.rows[0];

    res.status(201).json({
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      ownerId: group.owner_id,
      isPublic: group.is_public,
      titleColor: group.title_color,
      backgroundColor: group.background_color,
      createdAt: group.created_at,
      chatId: chatId
    });

  } catch (error) {
    console.error('[Groups] CreateGroup error:', error);
    res.status(500).json({ error: 'Ошибка при создании группы' });
  }
};

// ============================================================================
// GET GROUP INFO - Получить информацию о группе
// ============================================================================
export const getGroupInfo = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем доступ
    const accessCheck = await query(
      `SELECT g.id FROM groups g
       WHERE g.id = $1 AND (g.owner_id = $2 OR g.id IN (
         SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
       ))`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Группа не найдена или доступ запрещён' });
    }

    let result = await query(
      `SELECT g.id, g.name, g.description, g.external_link AS "externalLink", g.site_verification_status AS "siteVerificationStatus", g.verification_code AS "verificationCode", g.avatar_url, g.animated_avatar_url,
              g.type, g.owner_id, g.is_public, g.invite_link, g.group_public_key,
              g.title_color, g.background_color, g.background_image_url, g.gradient_theme, g.boost_level, g.discussion_chat_id,
              g.reactions_enabled, g.allowed_reactions, g.allow_member_invites,
              g.created_at, c.id as chat_id,
              u.first_name as owner_first_name, u.last_name as owner_last_name, u.username as owner_username
       FROM groups g
       LEFT JOIN users u ON g.owner_id = u.id
       LEFT JOIN chats c ON c.group_id = g.id
       WHERE g.id = $1`,
      [groupId]
    );

    let group = result.rows[0];

    // Лениво создаём verification code, если ссылка уже есть, а кода или статуса ещё нет
    if (group?.externalLink && !group?.verificationCode) {
      await assignUniqueVerificationCode(groupId, 'idle');
      result = await query(
        `SELECT g.id, g.name, g.description, g.external_link AS "externalLink", g.site_verification_status AS "siteVerificationStatus", g.verification_code AS "verificationCode", g.avatar_url, g.animated_avatar_url,
                g.type, g.owner_id, g.is_public, g.invite_link, g.group_public_key,
                g.title_color, g.background_color, g.background_image_url, g.gradient_theme, g.boost_level, g.discussion_chat_id,
                g.reactions_enabled, g.allowed_reactions, g.allow_member_invites,
                g.created_at, c.id as chat_id,
                u.first_name as owner_first_name, u.last_name as owner_last_name, u.username as owner_username
         FROM groups g
         LEFT JOIN users u ON g.owner_id = u.id
         LEFT JOIN chats c ON c.group_id = g.id
         WHERE g.id = $1`,
        [groupId]
      );
      group = result.rows[0];
    }

    // Получаем участников
    const membersResult = await query(
      `SELECT gm.id, gm.user_id, gm.role, gm.joined_at,
              u.username, u.first_name, u.last_name, u.avatar_url, u.is_online, u.last_seen, u.public_key,
              COALESCE(u.is_bot, FALSE) AS is_bot
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1 AND gm.is_active = TRUE
       ORDER BY ${memberRoleOrderSql}, gm.joined_at ASC`,
      [groupId]
    );

    const members = membersResult.rows.map(m => ({
      id: m.user_id,
      username: m.username,
      firstName: m.first_name,
      lastName: m.last_name,
      avatarUrl: m.avatar_url,
      role: m.role,
      publicKey: m.public_key,
      isBot: m.is_bot,
      isOnline: m.is_online,
      lastSeen: m.last_seen,
      joinedAt: m.joined_at
    }));

    // Получаем количество участников
    const countResult = await query(
      `SELECT COUNT(*) as member_count FROM group_members WHERE group_id = $1 AND is_active = TRUE`,
      [groupId]
    );
    const memberCount = parseInt(countResult.rows[0].member_count) || 0;

    // Если у канала уже есть обсуждение, подтягиваем информацию о чате обсуждений
    let discussionChat = null;
    if (group.discussion_chat_id) {
      const discussionResult = await query(
        `SELECT c.id, g.id as group_id, g.name as group_name
         FROM chats c
         JOIN groups g ON c.group_id = g.id
         WHERE c.id = $1`,
        [group.discussion_chat_id]
      );
      if (discussionResult.rows.length > 0) {
        discussionChat = {
          id: discussionResult.rows[0].id,
          groupId: discussionResult.rows[0].group_id,
          name: discussionResult.rows[0].group_name
        };
      }
    }

    let discussionParentChannel = null;
    if (group.chat_id) {
      const discussionParentResult = await query(
        `SELECT id, name
         FROM groups
         WHERE discussion_chat_id = $1
         LIMIT 1`,
        [group.chat_id]
      );

      if (discussionParentResult.rows.length > 0) {
        discussionParentChannel = {
          id: discussionParentResult.rows[0].id,
          name: discussionParentResult.rows[0].name
        };
      }
    }

    // Получаем роль текущего пользователя
    const myRoleResult = await query(
      `SELECT role, is_active, is_left FROM group_members WHERE group_id = $1 AND user_id = $2 AND (is_active = TRUE OR is_left = TRUE)`,
      [groupId, userId]
    );
    const myRoleInfo = myRoleResult.rows[0];
    const myRole = myRoleInfo?.role || 'member';
    const isLeft = myRoleInfo?.is_left || false; // Вышел ли сам

    const isOwnerOrAdmin = (myRole === 'owner' || myRole === 'admin');

    const responseData = {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatar_url,
      animatedAvatarUrl: group.animated_avatar_url,
      type: group.type,
      ownerId: group.owner_id,
      ownerName: `${group.owner_first_name || ''} ${group.owner_last_name || ''}`.trim(),
      ownerUsername: group.owner_username,
      isPublic: group.is_public,
      inviteLink: group.invite_link,
      publicKey: group.group_public_key,
      titleColor: group.title_color,
      backgroundColor: group.background_color,
      backgroundImageUrl: group.background_image_url,
      gradientTheme: group.gradient_theme || 'tg_blue',
      boostLevel: group.boost_level,
      discussionChatId: group.discussion_chat_id,
      isDiscussionGroup: Boolean(discussionParentChannel),
      discussionParentChannel,
      externalLink: group.externalLink || group.external_link || null,
      siteVerificationStatus: group.siteVerificationStatus || group.site_verification_status || 'none',
      verificationCode: isOwnerOrAdmin ? (group.verificationCode || group.verification_code || null) : null,
      discussionChat: discussionChat,
      discussionGroupId: discussionChat?.groupId, // ID группы обсуждения
      memberCount, // Количество участников
      reactionsEnabled: group.reactions_enabled,
      allowedReactions: group.allowed_reactions,
      allowMemberInvites: group.allow_member_invites || false,
      createdAt: group.created_at,
      chatId: group.chat_id,
      members,
      myRole,
      isLeft, // Может ли вернуться
      canRejoin: isLeft // Для совместимости
    };
    
    console.log('[Groups] GetGroupInfo responseData:', { 
      allowMemberInvites: responseData.allowMemberInvites, 
      raw_db_value: group.allow_member_invites 
    });

    res.json(responseData);

  } catch (error) {
    console.error('[Groups] GetGroupInfo error:', error);
    res.status(500).json({ error: 'Ошибка при получении информации о группе' });
  }
};

// ============================================================================
// UPDATE GROUP - Обновить настройки группы
// ============================================================================
export const updateGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const {
      name,
      description,
      externalLink: externalLinkRaw,
      external_link,
      isPublic,
      avatarUrl,
      animatedAvatarUrl,
      titleColor,
      backgroundColor,
      backgroundImageUrl,
      gradientTheme,
      createDiscussion,
      reactionsEnabled,
      allowedReactions,
      allowMemberInvites
    } = req.body;

    const externalLink = externalLinkRaw ?? external_link ?? null;

    // Проверяем права: владелец или админ
    const permissionCheck = await query(
      `SELECT 
         g.owner_id, g.external_link, g.site_verification_status, g.verification_code,
         gm.role
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
       WHERE g.id = $1`,
      [groupId, userId]
    );

    const perms = permissionCheck.rows[0];
    if (!perms) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    const isOwner = perms.owner_id === userId;
    const isAdmin = perms.role === 'admin';
    const currentExternalLink = perms.external_link || null;
    const currentCode = perms.verification_code;
    const normalizedExternalLink = typeof externalLink === 'string' ? externalLink.trim() : externalLink;
    const sanitizedExternalLink = normalizedExternalLink || null;
    const externalLinkChanged = externalLink !== undefined && sanitizedExternalLink !== currentExternalLink;
    const shouldGenerateVerification = externalLink !== undefined && sanitizedExternalLink && (externalLinkChanged || !currentCode);
    const shouldClearVerification = externalLink !== undefined && !sanitizedExternalLink;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Только владелец или админ могут изменять настройки группы' });
    }

    let group = null;

    // Обновляем поля группы
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Название должно быть не менее 2 символов' });
      }
      updates.push(`name = $${paramCount}`);
      values.push(name.trim());
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description?.trim() || null);
      paramCount++;
    }

    if (externalLink !== undefined) {
      if (sanitizedExternalLink && !sanitizedExternalLink.startsWith('https://')) {
        return res.status(400).json({ error: 'Внешняя ссылка должна начинаться с https://' });
      }

      updates.push(`external_link = $${paramCount}`);
      values.push(sanitizedExternalLink);
      paramCount++;

      if (shouldClearVerification) {
        updates.push(`site_verification_status = $${paramCount}`);
        values.push('none');
        paramCount++;

        updates.push(`verification_code = $${paramCount}`);
        values.push(null);
        paramCount++;
      }
    }
if (isPublic !== undefined) {
      updates.push(`is_public = $${paramCount}`);
      values.push(isPublic);
      paramCount++;
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatarUrl);
      paramCount++;
    }

    if (animatedAvatarUrl !== undefined) {
      updates.push(`animated_avatar_url = $${paramCount}`);
      values.push(animatedAvatarUrl);
      paramCount++;
    }

    if (titleColor !== undefined) {
      updates.push(`title_color = $${paramCount}`);
      values.push(titleColor);
      paramCount++;
    }

    if (backgroundColor !== undefined) {
      updates.push(`background_color = $${paramCount}`);
      values.push(backgroundColor);
      paramCount++;
    }

    if (backgroundImageUrl !== undefined) {
      updates.push(`background_image_url = $${paramCount}`);
      values.push(backgroundImageUrl);
      paramCount++;
    }

    if (gradientTheme !== undefined) {
      updates.push(`gradient_theme = $${paramCount}`);
      values.push(gradientTheme);
      paramCount++;
    }

    if (reactionsEnabled !== undefined) {
      updates.push(`reactions_enabled = $${paramCount}`);
      values.push(reactionsEnabled);
      paramCount++;
    }

    if (allowedReactions !== undefined && Array.isArray(allowedReactions)) {
      updates.push(`allowed_reactions = $${paramCount}::text[]`);
      values.push(allowedReactions);
      paramCount++;
    }

    if (allowMemberInvites !== undefined) {
      updates.push(`allow_member_invites = $${paramCount}`);
      values.push(allowMemberInvites);
      paramCount++;
    }

    // Выполняем UPDATE, если есть поля для обновления
    if (updates.length > 0) {
      console.log('[Groups] Incoming updates:', { name, description, externalLink, isPublic, gradientTheme, backgroundImageUrl, allowMemberInvites });
      // Добавляем WHERE-параметры
      const whereParam1 = paramCount;
      const allValues = [...values, groupId];

      console.log('[Groups] UPDATE query:', {
        titleColor,
        backgroundColor,
        groupId,
        userId
      });

      const result = await query(
        `UPDATE groups
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${whereParam1}
         RETURNING id, name, description, external_link AS "externalLink", is_public, avatar_url, animated_avatar_url, title_color, background_color, background_image_url, gradient_theme, reactions_enabled, allowed_reactions, allow_member_invites`,
        allValues
      );

      group = result.rows[0];
      console.log('[Groups] After UPDATE:', group);
    }

    if (shouldGenerateVerification) {
      await assignUniqueVerificationCode(groupId, 'idle');
    }

    // Создание привязанной группы для обсуждений
    // Обсуждение создаётся только по явному действию владельца
    if (createDiscussion === true) {
      await ensureDiscussionForChannel({
        groupId,
        userId,
        channelName: name || group?.name
      });

      const updatedGroup = await query(
        `SELECT id, name, description, external_link AS "externalLink", site_verification_status AS "siteVerificationStatus", verification_code AS "verificationCode", is_public, avatar_url, animated_avatar_url, title_color, background_color, background_image_url, discussion_chat_id
         FROM groups WHERE id = $1`,
        [groupId]
      );
      group = updatedGroup.rows[0];
    }

    // Если обсуждение не создавали и другие поля не менялись, возвращаем текущие данные
    // Если ничего не обновляли и обсуждение не создавали, возвращаем текущие данные
    if (!group) {
      const currentGroup = await query(
        `SELECT id, name, description, external_link AS "externalLink", site_verification_status AS "siteVerificationStatus", verification_code AS "verificationCode", is_public, avatar_url, animated_avatar_url, title_color, background_color, background_image_url, discussion_chat_id
         FROM groups WHERE id = $1`,
        [groupId]
      );
      group = currentGroup.rows[0];
    }

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      externalLink: group.externalLink,
      isPublic: group.is_public,
      avatarUrl: group.avatar_url,
      animatedAvatarUrl: group.animated_avatar_url,
      titleColor: group.title_color,
      backgroundColor: group.background_color,
      backgroundImageUrl: group.background_image_url,
      gradientTheme: group.gradient_theme || 'tg_blue',
      discussionChatId: group.discussion_chat_id
    });

  } catch (error) {
    console.error('[Groups] UpdateGroup error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении группы' });
  }
};

// ============================================================================
// DELETE GROUP - Удалить группу
// ============================================================================
export const deleteGroup = async (req, res) => {
  let client;
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    client = await getClient();
    await client.query('BEGIN');

    // Проверяем права владельца и сразу подтягиваем чат группы.
    const targetResult = await client.query(
      `SELECT g.id, g.name, g.type, g.owner_id, g.discussion_chat_id,
              (
                SELECT c.id
                FROM chats c
                WHERE c.group_id = g.id
                ORDER BY c.created_at ASC
                LIMIT 1
              ) AS chat_id
       FROM groups g
       WHERE g.id = $1
       FOR UPDATE`,
      [groupId]
    );

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    const targetGroup = targetResult.rows[0];
    if (targetGroup.owner_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Только владелец может удалить группу' });
    }

    const deletedGroupIds = [];
    const deletedChatIds = [];
    const notifyUserIds = new Set();
    let unlinkedChannelId = null;

    const collectMemberIds = async (groupIds) => {
      if (!groupIds.length) return;
      const result = await client.query(
        `SELECT DISTINCT user_id
         FROM group_members
         WHERE group_id = ANY($1::uuid[]) AND is_active = TRUE`,
        [groupIds]
      );
      result.rows.forEach((row) => notifyUserIds.add(row.user_id));
    };

    // Если удаляется обсуждение, отвязываем его от родительского канала.
    if (targetGroup.chat_id) {
      const parentChannelResult = await client.query(
        `SELECT id
         FROM groups
         WHERE discussion_chat_id = $1
         FOR UPDATE`,
        [targetGroup.chat_id]
      );

      if (parentChannelResult.rows.length > 0) {
        unlinkedChannelId = parentChannelResult.rows[0].id;
        await client.query(
          `UPDATE groups
           SET discussion_chat_id = NULL
           WHERE id = $1`,
          [unlinkedChannelId]
        );
      }
    }

    // Если удаляется канал с привязанным обсуждением, удаляем и обсуждение тоже.
    if (targetGroup.discussion_chat_id) {
      const linkedDiscussionResult = await client.query(
        `SELECT c.group_id, c.id AS chat_id
         FROM chats c
         WHERE c.id = $1
         LIMIT 1`,
        [targetGroup.discussion_chat_id]
      );

      if (linkedDiscussionResult.rows.length > 0) {
        const linkedDiscussionGroupId = linkedDiscussionResult.rows[0].group_id;
        const linkedDiscussionChatId = linkedDiscussionResult.rows[0].chat_id;

        if (linkedDiscussionGroupId && linkedDiscussionGroupId !== groupId) {
          await collectMemberIds([linkedDiscussionGroupId]);
          deletedGroupIds.push(linkedDiscussionGroupId);
          if (linkedDiscussionChatId) {
            deletedChatIds.push(linkedDiscussionChatId);
          }

          await client.query(`DELETE FROM groups WHERE id = $1`, [linkedDiscussionGroupId]);
        }
      }
    }

    await collectMemberIds([groupId]);
    deletedGroupIds.push(groupId);
    if (targetGroup.chat_id) {
      deletedChatIds.push(targetGroup.chat_id);
    }

    await client.query(`DELETE FROM groups WHERE id = $1`, [groupId]);
    await client.query('COMMIT');

    const uniqueDeletedGroupIds = [...new Set(deletedGroupIds)];
    const uniqueDeletedChatIds = [...new Set(deletedChatIds)];
    const uniqueNotifyUserIds = [...notifyUserIds];

    await Promise.all(uniqueNotifyUserIds.flatMap((targetUserId) =>
      uniqueDeletedChatIds.map((chatId) => sendRealtimeEventToUser(targetUserId, {
        type: 'chat_deleted',
        chatId,
        groupId,
        deletedGroupIds: uniqueDeletedGroupIds,
        deletedChatIds: uniqueDeletedChatIds,
        byUserId: userId
      }))
    ));

    res.json({
      message: 'Группа удалена',
      groupId,
      deletedGroupIds: uniqueDeletedGroupIds,
      deletedChatIds: uniqueDeletedChatIds,
      unlinkedChannelId
    });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[Groups] DeleteGroup rollback error:', rollbackError);
      }
    }
    console.error('[Groups] DeleteGroup error:', error);
    res.status(500).json({ error: 'Ошибка при удалении группы' });
  } finally {
    client?.release?.();
  }
};

// ============================================================================
// ADD MEMBER - Добавить участника
// ============================================================================
export const addMember = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Требуется ID пользователя' });
    }

    const accessCheck = await query(
      `SELECT gm.role, g.allow_member_invites
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь участником группы' });
    }

    const actorRole = accessCheck.rows[0].role;
    const allowMemberInvites = Boolean(accessCheck.rows[0].allow_member_invites);
    const canInvite = canManageMembersByRole(actorRole) || (actorRole === 'member' && allowMemberInvites);

    if (!canInvite) {
      return res.status(403).json({ error: 'Недостаточно прав для добавления участников' });
    }

    const targetUserResult = await query(
      `SELECT id, is_active, COALESCE(is_bot, FALSE) AS is_bot
       FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    if (targetUserResult.rows.length === 0 || !targetUserResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const targetUser = targetUserResult.rows[0];
    const targetRole = targetUser.is_bot ? 'bot' : 'member';

    const existingMember = await query(
      `SELECT id, role, is_active
       FROM group_members
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId]
    );

    if (existingMember.rows.length > 0) {
      if (existingMember.rows[0].is_active) {
        return res.status(400).json({ error: 'Пользователь уже является участником' });
      }

      await query(
        `UPDATE group_members
         SET is_active = TRUE,
             is_left = FALSE,
             joined_at = NOW(),
             role = CASE
               WHEN $3::boolean THEN 'bot'
               WHEN role IN ('owner', 'admin', 'moderator', 'member') THEN role
               ELSE 'member'
             END
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, targetUserId, targetUser.is_bot]
      );

      await sendRealtimeEventToUser(targetUserId, {
        type: 'added_to_channel',
        groupId,
        userId: targetUserId
      });

      await sendGroupRealtimeEvent(groupId, {
        type: 'member_added',
        groupId,
        userId: targetUserId,
        role: targetRole
      });

      return res.json({ message: 'Участник возвращён в группу', targetUserId, reactivated: true, role: targetRole });
    }

    await query(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
       VALUES ($1, $2, $3, $4, NOW(), TRUE)`,
      [uuidv4(), groupId, targetUserId, targetRole]
    );

    await sendRealtimeEventToUser(targetUserId, {
      type: 'added_to_channel',
      groupId,
      userId: targetUserId
    });

    await sendGroupRealtimeEvent(groupId, {
      type: 'member_added',
      groupId,
      userId: targetUserId,
      role: targetRole
    });

    res.json({ message: 'Участник добавлен', targetUserId, role: targetRole });
  } catch (error) {
    console.error('[Groups] AddMember error:', error);
    res.status(500).json({ error: 'Ошибка при добавлении участника' });
  }
};

const ensureDiscussionForChannel = async ({ groupId, userId, channelName }) => {
  const existingDiscussion = await query(
    `SELECT discussion_chat_id FROM groups WHERE id = $1`,
    [groupId]
  );

  if (existingDiscussion.rows[0]?.discussion_chat_id) {
    return {
      discussionChatId: existingDiscussion.rows[0].discussion_chat_id,
      created: false
    };
  }

  const discussionGroupId = uuidv4();
  const discussionName = `${channelName || 'Канал'} - Обсуждение`;

  await query(
    `INSERT INTO groups (id, name, description, type, owner_id, is_public, created_at)
     VALUES ($1, $2, $3, 'group', $4, FALSE, NOW())`,
    [discussionGroupId, discussionName, 'Группа для обсуждений канала', userId]
  );

  await query(
    `INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
     VALUES ($1, $2, $3, 'owner', NOW(), TRUE)`,
    [uuidv4(), discussionGroupId, userId]
  );

  const discussionChatId = uuidv4();
  await query(
    `INSERT INTO chats (id, type, group_id, created_at)
     VALUES ($1, 'group', $2, NOW())`,
    [discussionChatId, discussionGroupId]
  );

  await query(
    `UPDATE groups SET discussion_chat_id = $1 WHERE id = $2`,
    [discussionChatId, groupId]
  );

  return {
    discussionGroupId,
    discussionChatId,
    created: true
  };
};

// ============================================================================
// REMOVE MEMBER - Удалить участника
// ============================================================================
export const removeMember = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId, targetUserId } = req.params;

    const actorResult = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (actorResult.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь участником группы' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Используйте leaveGroup для выхода из группы' });
    }

    const targetResult = await query(
      `SELECT gm.role, COALESCE(u.is_bot, FALSE) AS is_bot
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден в группе' });
    }

    const actorRole = actorResult.rows[0].role;
    const targetRole = targetResult.rows[0].role;

    if (!canRemoveMemberByRole(actorRole, targetRole)) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этого участника' });
    }

    await query(
      `UPDATE group_members
       SET is_active = FALSE, is_left = FALSE
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId]
    );

    await sendRealtimeEventToUser(targetUserId, {
      type: 'participant_kicked',
      groupId,
      userId: targetUserId
    });

    await sendGroupRealtimeEvent(groupId, {
      type: 'participant_kicked',
      groupId,
      userId: targetUserId
    });

    res.json({ message: 'Участник удалён', targetUserId, canRejoin: false });
  } catch (error) {
    console.error('[Groups] RemoveMember error:', error);
    res.status(500).json({ error: 'Ошибка при удалении участника' });
  }
};

// ============================================================================
// UPDATE MEMBER ROLE - Изменить роль участника
// ============================================================================
export const updateMemberRole = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId, targetUserId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Требуется новая роль' });
    }

    const nextRole = String(role).trim().toLowerCase();

    const actorResult = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (actorResult.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь участником группы' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Нельзя менять собственную роль этим действием' });
    }

    const targetResult = await query(
      `SELECT gm.role, COALESCE(u.is_bot, FALSE) AS is_bot
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден в группе' });
    }

    const actorRole = actorResult.rows[0].role;
    const targetRole = targetResult.rows[0].role;
    const targetIsBot = Boolean(targetResult.rows[0].is_bot);

    if (targetRole === nextRole) {
      return res.json({ message: 'Роль уже установлена', targetUserId, role: nextRole });
    }

    if (!canChangeMemberRole({ actorRole, targetRole, nextRole, targetIsBot })) {
      return res.status(403).json({ error: 'Недостаточно прав для изменения этой роли' });
    }

    await query(
      `UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId, nextRole]
    );

    await sendGroupRealtimeEvent(groupId, {
      type: 'member_role_changed',
      groupId,
      userId: targetUserId,
      newRole: nextRole
    });

    res.json({ message: 'Роль обновлена', targetUserId, role: nextRole });
  } catch (error) {
    console.error('[Groups] UpdateMemberRole error:', error);
    res.status(500).json({ error: 'Ошибка при изменении роли' });
  }
};
// ============================================================================
// LEAVE GROUP - Выйти из группы
// ============================================================================
export const leaveGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем участие
    const memberCheck = await query(
      `SELECT gm.role FROM group_members gm
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Вы не являетесь участником группы' });
    }

    const role = memberCheck.rows[0].role;

    // Владелец не может выйти сам: нужно удалить группу или передать права
    if (role === 'owner') {
      return res.status(403).json({ 
        error: 'Владелец не может выйти из группы. Удалите группу или передайте права другому участнику.'
      });
    }

    // Деактивируем участника и помечаем, что он вышел сам
    await query(
      `UPDATE group_members 
       SET is_active = FALSE, is_left = TRUE 
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    res.json({ message: 'Вы вышли из группы', groupId, canRejoin: true });

  } catch (error) {
    console.error('[Groups] LeaveGroup error:', error);
    res.status(500).json({ error: 'Ошибка при выходе из группы' });
  }
};

// ============================================================================
// REJOIN GROUP - Вернуться в группу после самостоятельного выхода
// ============================================================================
export const rejoinGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем, был ли пользователь участником и выходил ли он сам
    const memberCheck = await query(
      `SELECT gm.role, gm.is_left FROM group_members gm
       WHERE gm.group_id = $1 AND gm.user_id = $2`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Вы никогда не были в этой группе' });
    }

    const member = memberCheck.rows[0];

    // Если участник уже активен, то он и так состоит в группе
    if (member.is_active) {
      return res.status(400).json({ error: 'Вы уже являетесь участником группы' });
    }

    // Если is_left = FALSE, значит пользователя удалили и сам он вернуться не может
    if (!member.is_left) {
      return res.status(403).json({ error: 'Вы были удалены из группы и не можете вернуться самостоятельно' });
    }

    // Активируем участника обратно
    await query(
      `UPDATE group_members 
       SET is_active = TRUE, is_left = FALSE, joined_at = NOW()
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    res.json({ message: 'Вы вернулись в группу', groupId });

  } catch (error) {
    console.error('[Groups] RejoinGroup error:', error);
    res.status(500).json({ error: 'Ошибка при возврате в группу' });
  }
};

// ============================================================================
// PROMOTE MEMBER - Повысить роль на один уровень
// ============================================================================
export const promoteMember = async (req, res) => {
  try {
    const { groupId, targetUserId } = req.params;
    const actorResult = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, req.userId]
    );

    if (actorResult.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь участником группы' });
    }

    const targetResult = await query(
      `SELECT gm.role, COALESCE(u.is_bot, FALSE) AS is_bot
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден в группе' });
    }

    const actorRole = actorResult.rows[0].role;
    const targetRole = targetResult.rows[0].role;
    const targetIsBot = Boolean(targetResult.rows[0].is_bot);
    const nextRole = targetRole === 'member' ? 'moderator' : targetRole === 'moderator' ? 'admin' : null;

    if (!nextRole || !canChangeMemberRole({ actorRole, targetRole, nextRole, targetIsBot })) {
      return res.status(403).json({ error: 'Недостаточно прав для повышения этой роли' });
    }

    await query(
      `UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId, nextRole]
    );

    await sendGroupRealtimeEvent(groupId, {
      type: 'member_role_changed',
      groupId,
      userId: targetUserId,
      newRole: nextRole
    });

    res.json({ message: 'Роль повышена', targetUserId, role: nextRole });
  } catch (error) {
    console.error('[Groups] PromoteMember error:', error);
    res.status(500).json({ error: 'Ошибка при повышении роли' });
  }
};

// ============================================================================
// DEMOTE MEMBER - Понизить роль на один уровень
// ============================================================================
export const demoteMember = async (req, res) => {
  try {
    const { groupId, targetUserId } = req.params;
    const actorResult = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, req.userId]
    );

    if (actorResult.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь участником группы' });
    }

    const targetResult = await query(
      `SELECT gm.role, COALESCE(u.is_bot, FALSE) AS is_bot
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден в группе' });
    }

    const actorRole = actorResult.rows[0].role;
    const targetRole = targetResult.rows[0].role;
    const targetIsBot = Boolean(targetResult.rows[0].is_bot);
    const nextRole = targetRole === 'admin' ? 'moderator' : targetRole === 'moderator' ? 'member' : null;

    if (!nextRole || !canChangeMemberRole({ actorRole, targetRole, nextRole, targetIsBot })) {
      return res.status(403).json({ error: 'Недостаточно прав для понижения этой роли' });
    }

    await query(
      `UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId, nextRole]
    );

    await sendGroupRealtimeEvent(groupId, {
      type: 'member_role_changed',
      groupId,
      userId: targetUserId,
      newRole: nextRole
    });

    res.json({ message: 'Роль понижена', targetUserId, role: nextRole });
  } catch (error) {
    console.error('[Groups] DemoteMember error:', error);
    res.status(500).json({ error: 'Ошибка при понижении роли' });
  }
};

// ============================================================================
// GENERATE INVITE LINK - Создать invite-ссылку
// ============================================================================
export const generateInviteLink = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем доступ пользователя и его роль
    const accessCheck = await query(
      `SELECT gm.role, g.allow_member_invites
       FROM groups g
       INNER JOIN group_members gm ON g.id = gm.group_id
       WHERE g.id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const userRole = accessCheck.rows[0].role;
    const allowMemberInvites = accessCheck.rows[0].allow_member_invites;

    // Проверяем права:
    // - owner и admin могут всегда
    // - member только если allow_member_invites = true
    if (userRole !== 'owner' && userRole !== 'admin') {
      if (!allowMemberInvites) {
        return res.status(403).json({ error: 'Только администраторы могут создавать invite-ссылки' });
      }
    }

    // Генерируем уникальный токен
    const inviteToken = `invite_${groupId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Сохраняем в базе
    await query(
      `UPDATE groups SET invite_link = $1 WHERE id = $2`,
      [inviteToken, groupId]
    );

    // Логируем действие
    await query(
      `INSERT INTO admin_logs (group_id, user_id, action, description, created_at)
       VALUES ($1, $2, 'invite_link_created', 'Создана invite-ссылка', NOW())`,
      [groupId, userId]
    );

    res.json({ inviteLink: inviteToken, groupId });

  } catch (error) {
    console.error('[Groups] GenerateInviteLink error:', error);
    res.status(500).json({ error: 'Ошибка при создании invite-ссылки' });
  }
};

// ============================================================================
// JOIN PUBLIC CHANNEL - Вступить в публичный канал без invite-токена
// ============================================================================
export const joinPublicChannel = async (req, res) => {
  try {
    const userId = req.userId;
    const channelId = req.params.id;

    console.log('[JoinPublicChannel] Поиск канала для ID:', channelId);
    console.log('[JoinPublicChannel] userId:', userId);

    if (!channelId) {
      return res.status(400).json({ error: 'Требуется ID канала' });
    }

    // Проверяем, существует ли канал
    const channel = await query(
      `SELECT id, name, type, is_public FROM groups WHERE id = $1`,
      [channelId]
    );

    console.log('[JoinPublicChannel] Найдено в БД:', channel.rows);

    if (channel.rows.length === 0) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    const channelData = channel.rows[0];
    
    // Проверяем, не является ли пользователь уже участником
    const existingMember = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [channelId, userId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже являетесь участником' });
    }

    // Добавляем пользователя как участника
    await query(
      `INSERT INTO group_members (group_id, user_id, role, is_active, joined_at)
       VALUES ($1, $2, $3, TRUE, NOW())`,
      [channelId, userId, 'member']
    );

    // Создаём запись в chats для этого канала
    const chatId = crypto.randomUUID();
    await query(
      `INSERT INTO chats (id, type, user1_id, group_id, created_at)
       VALUES ($1, 'channel', $2, $3, NOW())`,
      [chatId, userId, channelId]
    );

    console.log('[JoinPublicChannel] Success:', { channelId, chatId, channelName: channelData.name });

    res.json({
      message: 'Вы подписались на канал',
      channelId,
      chatId,
      channelName: channelData.name
    });

  } catch (error) {
    console.error('[Groups] JoinPublicChannel error:', error);
    res.status(500).json({ error: 'Ошибка при вступлении в канал: ' + error.message });
  }
};

// ============================================================================
// JOIN BY INVITE LINK - Вступить по invite-ссылке
// ============================================================================
export const joinByInviteLink = async (req, res) => {
  try {
    const userId = req.userId;
    const { inviteToken } = req.body;

    if (!inviteToken) {
      return res.status(400).json({ error: 'Требуется invite-токен' });
    }

    // Находим группу по invite-ссылке
    const group = await query(
      `SELECT id, name, type FROM groups WHERE invite_link = $1`,
      [inviteToken]
    );

    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Неверная invite-ссылка' });
    }

    const groupId = group.rows[0].id;

    // Проверяем, не состоит ли пользователь уже в группе
    const existingMember = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже являетесь участником этой группы' });
    }

    // Добавляем участника
    await query(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at, is_active)
       VALUES ($1, $2, $3, 'member', NOW(), TRUE)`,
      [uuidv4(), groupId, userId]
    );

    res.json({
      message: 'Вы вступили в группу',
      groupId,
      groupName: group.rows[0].name,
      groupType: group.rows[0].type
    });

  } catch (error) {
    console.error('[Groups] JoinByInviteLink error:', error);
    res.status(500).json({ error: 'Ошибка при вступлении в группу' });
  }
};

// ============================================================================
// GET PUBLIC CHANNELS - Получить список публичных каналов
// ============================================================================
export const getPublicChannels = async (req, res) => {
  try {
    const { search } = req.query;

    let queryText = `
      SELECT g.id, g.name, g.description, g.avatar_url, g.animated_avatar_url,
             g.owner_id, g.title_color, g.background_color, g.boost_level, g.invite_link,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = TRUE) as subscriber_count,
             u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM groups g
      LEFT JOIN users u ON g.owner_id = u.id
      WHERE g.type = 'channel' AND g.is_public = TRUE
    `;

    const queryParams = [];
    if (search) {
      queryText += ` AND (g.name ILIKE $1 OR g.description ILIKE $1)`;
      queryParams.push(`%${search}%`);
    }

    queryText += ` ORDER BY subscriber_count DESC`;

    const result = await query(queryText, queryParams);

    const channels = result.rows.map(channel => ({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      avatarUrl: channel.avatar_url,
      animatedAvatarUrl: channel.animated_avatar_url,
      ownerId: channel.owner_id,
      ownerName: `${channel.owner_first_name || ''} ${channel.owner_last_name || ''}`.trim(),
      titleColor: channel.title_color,
      backgroundColor: channel.background_color,
      boostLevel: channel.boost_level,
      subscriberCount: parseInt(channel.subscriber_count),
      inviteToken: channel.invite_link
    }));

    res.json(channels);

  } catch (error) {
    console.error('[Groups] GetPublicChannels error:', error);
    res.status(500).json({ error: 'Ошибка при получении публичных каналов' });
  }
};

// ============================================================================
// GET INVITE LINKS - Получить пригласительные ссылки
// ============================================================================
export const getInviteLinks = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем права
    const accessCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const result = await query(
      `SELECT * FROM group_invite_links WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[Groups] GetInviteLinks error:', error);
    res.status(500).json({ error: 'Ошибка при получении ссылок' });
  }
};

// ============================================================================
// CREATE INVITE LINK - Создать пригласительную ссылку
// ============================================================================
export const createInviteLink = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { name } = req.body;

    // Проверяем права
    const accessCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const code = crypto.randomBytes(16).toString('hex');
    const result = await query(
      `INSERT INTO group_invite_links (group_id, code, name, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [groupId, code, name || 'Ссылка', userId]
    );

    // Логируем действие
    await query(
      `INSERT INTO admin_logs (group_id, user_id, action, description, created_at)
       VALUES ($1, $2, 'invite_link_created', 'Создана пригласительная ссылка: ${name || 'Без названия'}', NOW())`,
      [groupId, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Groups] CreateInviteLink error:', error);
    res.status(500).json({ error: 'Ошибка при создании ссылки' });
  }
};

// ============================================================================
// DELETE INVITE LINK - Удалить пригласительную ссылку
// ============================================================================
export const deleteInviteLink = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId, linkId } = req.params;

    // Проверяем права
    const accessCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await query(`DELETE FROM group_invite_links WHERE id = $1`, [linkId]);

    res.json({ message: 'Ссылка удалена' });
  } catch (error) {
    console.error('[Groups] DeleteInviteLink error:', error);
    res.status(500).json({ error: 'Ошибка при удалении ссылки' });
  }
};

// ============================================================================
// GET ADMIN LOGS - Получить журнал событий
// ============================================================================
export const getAdminLogs = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    // Проверяем права
    const accessCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const result = await query(
      `SELECT al.*, u.first_name, u.last_name
       FROM admin_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.group_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [groupId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[Groups] GetAdminLogs error:', error);
    res.status(500).json({ error: 'Ошибка при получении журнала' });
  }
};

// ============================================================================
// LINK DISCUSSION GROUP - Связать группу обсуждений
// ============================================================================
export const linkDiscussionGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { discussionGroupId } = req.body || {};

    const accessCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0 || accessCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может управлять обсуждением' });
    }

    if (!discussionGroupId) {
      const channelResult = await query(
        `SELECT name FROM groups WHERE id = $1`,
        [groupId]
      );

      const createdDiscussion = await ensureDiscussionForChannel({
        groupId,
        userId,
        channelName: channelResult.rows[0]?.name || 'Канал'
      });

      return res.json({
        message: createdDiscussion.created ? 'Обсуждение создано и привязано' : 'Обсуждение уже привязано',
        discussionChatId: createdDiscussion.discussionChatId,
        discussionGroupId: createdDiscussion.discussionGroupId || null
      });
    }

    const existingDiscussionChat = await query(
      `SELECT id FROM chats WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [discussionGroupId]
    );

    let discussionChatId = existingDiscussionChat.rows[0]?.id;

    if (!discussionChatId) {
      discussionChatId = uuidv4();
      await query(
        `INSERT INTO chats (id, type, group_id, created_at)
         VALUES ($1, 'group', $2, NOW())`,
        [discussionChatId, discussionGroupId]
      );
    }

    await query(
      `UPDATE groups SET discussion_chat_id = $1 WHERE id = $2`,
      [discussionChatId, groupId]
    );

    res.json({ message: 'Обсуждение привязано', discussionChatId });
  } catch (error) {
    console.error('[Groups] LinkDiscussionGroup error:', error);
    res.status(500).json({ error: 'Ошибка при привязке обсуждения' });
  }
};

// ============================================================================
// GET GROUP BY INVITE - Получить информацию о группе по invite-ссылке без auth
// ============================================================================
export const getGroupByInvite = async (req, res) => {
  try {
    const { inviteToken } = req.params;

    const group = await query(
      `SELECT g.id, g.name, g.description, g.avatar_url, g.animated_avatar_url,
              g.type, g.owner_id, g.is_public, g.title_color, g.background_color,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = TRUE) as member_count
       FROM groups g
       WHERE g.invite_link = $1`,
      [inviteToken]
    );

    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    // Проверяем, является ли текущий пользователь участником, если он авторизован
    let isMember = false
    if (req.userId) {
      const memberCheck = await query(
        `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
        [group.rows[0].id, req.userId]
      )
      isMember = memberCheck.rows.length > 0
    }

    res.json({
      id: group.rows[0].id,
      name: group.rows[0].name,
      description: group.rows[0].description,
      avatarUrl: group.rows[0].avatar_url,
      animatedAvatarUrl: group.rows[0].animated_avatar_url,
      type: group.rows[0].type,
      isPublic: group.rows[0].is_public,
      titleColor: group.rows[0].title_color,
      backgroundColor: group.rows[0].background_color,
      memberCount: parseInt(group.rows[0].member_count),
      isMember
    });

  } catch (error) {
    console.error('[Groups] GetGroupByInvite error:', error);
    res.status(500).json({ error: 'Ошибка при получении информации о группе' });
   }
};
