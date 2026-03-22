import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';

const SELF_FAVORITES_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none"><rect width="96" height="96" rx="20" fill="%231b2233"/><path d="M32 22h32a4 4 0 0 1 4 4v48l-20-12-20 12V26a4 4 0 0 1 4-4z" fill="%23ffb347"/><circle cx="64" cy="32" r="10" fill="%23ffd166"/><circle cx="34" cy="38" r="12" fill="%2348a6f8"/></svg>';
const SYSTEM_CHAT_WARMUP_TTL_MS = 10 * 60 * 1000;
const systemChatWarmups = new Map();

const toDbTimestampIso = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(normalized);
  const preparedValue = hasTimezone
    ? normalized.replace(' ', 'T')
    : `${normalized.replace(' ', 'T')}Z`;

  const parsedDate = new Date(preparedValue);
  return Number.isNaN(parsedDate.getTime()) ? preparedValue : parsedDate.toISOString();
};

// ============================================================================
// ENSURE BOT CHAT (AegisTalk Bot)
// ============================================================================
export const ensureBotChat = async (userId) => {
  const BOT_ID = '00000000-0000-0000-0000-000000000001';

  try {
    // Ensure the system bot user has a stable avatar and appears "online".
    // Keep existing email/username if already created by migrations.
    await query(
      `INSERT INTO users (id, email, username, first_name, last_name, avatar_url, is_online, created_at, updated_at)
       VALUES ($1, 'bot@example.com', 'AegisTalkBot', 'AegisTalk', 'Bot', $2, TRUE, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         avatar_url = $2,
         is_online = TRUE,
         updated_at = NOW()`,
      [BOT_ID, '/aegistalk-bot.svg']
    );

    const existingChat = await query(
      `SELECT id FROM chats
       WHERE type = 'private'
       AND ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))`,
      [BOT_ID, userId]
    );

    if (existingChat.rows.length > 0) {
      const chatId = existingChat.rows[0].id;
      const existingMessages = await query(
        `SELECT id FROM messages WHERE chat_id = $1 AND is_deleted = FALSE LIMIT 1`,
        [chatId]
      );

      if (existingMessages.rows.length === 0) {
        const welcomeMessage =
          'Добро пожаловать в AegisTalk! 🚀\n\n— ☁️ Облако: Храните здесь свои файлы и заметки.\n— 📱 Сервис: Сюда приходят коды входа и уведомления.';
        const encryptedMessage = Buffer.from(welcomeMessage).toString('base64');

        await query(
          `INSERT INTO messages (id, chat_id, sender_id, message_type, content_encrypted, nonce, sender_public_key, signature, status, created_at)
           VALUES ($1, $2, $3, 'text', $4, '', '', '', 'delivered', NOW())`,
          [uuidv4(), chatId, BOT_ID, encryptedMessage]
        );

        await query(`UPDATE chats SET last_message_at = NOW() WHERE id = $1`, [chatId]);
      }

      return chatId;
    }

    const chatId = uuidv4();
    await query(
      `INSERT INTO chats (id, type, user1_id, user2_id, created_at, last_message_at)
       VALUES ($1, 'private', $2, $3, NOW(), NOW())`,
      [chatId, BOT_ID, userId]
    );

    const welcomeMessage =
      'Добро пожаловать в AegisTalk! 🚀\n\n— ☁️ Облако: Храните здесь свои файлы и заметки.\n— 📱 Сервис: Сюда приходят коды входа и уведомления.';
    const encryptedMessage = Buffer.from(welcomeMessage).toString('base64');

    await query(
      `INSERT INTO messages (id, chat_id, sender_id, message_type, content_encrypted, nonce, sender_public_key, signature, status, created_at)
       VALUES ($1, $2, $3, 'text', $4, '', '', '', 'delivered', NOW())`,
      [uuidv4(), chatId, BOT_ID, encryptedMessage]
    );

    await query(`UPDATE chats SET last_message_at = NOW() WHERE id = $1`, [chatId]);

    return chatId;
  } catch (error) {
    console.error('[ensureBotChat] Error:', error);
    return null;
  }
};

// ============================================================================
// ENSURE FAVORITES (SELF) CHAT
// ============================================================================
export const ensureFavoritesChat = async (userId) => {
  try {
    const existing = await query(
      `SELECT id FROM chats
       WHERE type = 'private' AND user1_id = $1 AND user2_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      const chatId = existing.rows[0].id;
      await query(
        `DELETE FROM chat_hidden_for_users WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
      );
      return chatId;
    }

    const chatId = uuidv4();
    await query(
      `INSERT INTO chats (id, type, user1_id, user2_id, created_at, last_message_at)
       VALUES ($1, 'private', $2, $2, NOW(), NOW())`,
      [chatId, userId]
    );

    const welcomeMessage =
      'Это ваш личный сейф. Сохраняйте сюда заметки, файлы и пересланные сообщения.';
    const encryptedMessage = Buffer.from(welcomeMessage).toString('base64');

    await query(
      `INSERT INTO messages (id, chat_id, sender_id, message_type, content_encrypted, nonce, sender_public_key, signature, status, created_at)
       VALUES ($1, $2, $3, 'text', $4, '', '', '', 'delivered', NOW())`,
      [uuidv4(), chatId, userId, encryptedMessage]
    );

    await query(`UPDATE chats SET last_message_at = NOW() WHERE id = $1`, [chatId]);

    return chatId;
  } catch (error) {
    console.error('[ensureFavoritesChat] Error:', error);
    return null;
  }
};

// ============================================================================
// GET MY CHATS
// ============================================================================
export const getMyChats = async (req, res) => {
  try {
    const userId = req.userId;
    const AI_BOT_ID = '00000000-0000-0000-0000-000000000002';
    await ensureSystemChatsIfNeeded(userId);

    const chatsResult = await query(
      `SELECT c.id, c.type, c.created_at, c.last_message_at,
              ROUND(EXTRACT(EPOCH FROM c.created_at::timestamptz) * 1000)::bigint as created_at_ms,
              u1.id as user1_id, u1.first_name as user1_first_name, u1.last_name as user1_last_name,
              u1.username as user1_username, u1.avatar_url as user1_avatar, u1.is_online as user1_online, u1.is_bot as user1_is_bot, u1.public_key as user1_public_key,
              u2.id as user2_id, u2.first_name as user2_first_name, u2.last_name as user2_last_name,
              u2.username as user2_username, u2.avatar_url as user2_avatar, u2.is_online as user2_online, u2.is_bot as user2_is_bot, u2.public_key as user2_public_key,
              g.id as group_id, g.name as group_name, g.avatar_url as group_avatar, g.group_public_key,
              g.external_link AS "externalLink",
              c.external_link AS "chatExternalLink",
              g.site_verification_status AS "siteVerificationStatus",
              last_message.content_encrypted as last_message_content,
              last_message.message_type as last_message_type,
              last_message.created_at as last_message_time,
              last_message.created_at_ms as last_message_time_ms
       FROM (
         SELECT DISTINCT c2.id
         FROM chats c2
         LEFT JOIN chat_hidden_for_users chfu ON chfu.chat_id = c2.id AND chfu.user_id = $1
         WHERE (c2.user1_id = $1 OR c2.user2_id = $1 OR c2.group_id IN (
           SELECT group_id FROM group_members WHERE user_id = $1 AND is_active = TRUE
         )) AND chfu.chat_id IS NULL
       ) as unique_chats
       JOIN chats c ON c.id = unique_chats.id
       LEFT JOIN users u1 ON c.user1_id = u1.id
       LEFT JOIN users u2 ON c.user2_id = u2.id
       LEFT JOIN groups g ON c.group_id = g.id
       LEFT JOIN LATERAL (
         SELECT
           m.content_encrypted,
           m.message_type,
           m.created_at,
           ROUND(EXTRACT(EPOCH FROM m.created_at::timestamptz) * 1000)::bigint as created_at_ms
         FROM messages m
         WHERE m.chat_id = c.id AND m.is_deleted = FALSE
         ORDER BY m.created_at DESC
         LIMIT 1
       ) last_message ON TRUE
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId]
    );

    const chats = chatsResult.rows.filter((chat) => !(chat.user1_id === AI_BOT_ID || chat.user2_id === AI_BOT_ID)).map((chat) => {
      const isGroup = chat.type === 'group' || chat.type === 'channel';
      const BOT_ID = '00000000-0000-0000-0000-000000000001';
      const isCustomBotChat = !isGroup && (
        (chat.user1_id === userId ? chat.user2_is_bot : chat.user1_is_bot)
      );
      const isBotChat = !isGroup && (chat.user1_id === BOT_ID || chat.user2_id === BOT_ID || isCustomBotChat);
      const isSelfChat = !isGroup && chat.user1_id === userId && chat.user2_id === userId;

      const result = {
        id: chat.id,
        chatId: chat.id,
        type: chat.type,
        name: isGroup
          ? chat.group_name
          : isSelfChat
            ? 'Избранное'
            : (chat.user1_id === userId
                  ? `${chat.user2_first_name || ''} ${chat.user2_last_name || ''}`.trim() || 'Пользователь'
                  : `${chat.user1_first_name || ''} ${chat.user1_last_name || ''}`.trim() || 'Пользователь'),
        avatar: isGroup
          ? chat.group_avatar
          : isSelfChat
            ? SELF_FAVORITES_AVATAR
            : (chat.user1_id === userId ? chat.user2_avatar : chat.user1_avatar),
        isOnline: !isGroup && !isSelfChat && (chat.user1_id === userId ? chat.user2_online : chat.user1_online),
        lastMessage: chat.last_message_content || null,
        lastMessageType: chat.last_message_type || null,
        createdAt: chat.created_at_ms ?? toDbTimestampIso(chat.created_at),
        lastMessageTime: chat.last_message_time_ms ?? chat.created_at_ms ?? toDbTimestampIso(chat.last_message_time || chat.created_at),
        groupId: chat.group_id,
        user1_id: chat.user1_id,
        user2_id: chat.user2_id,
        isBot: isBotChat,
        isAi: false,
        isSelf: isSelfChat,
        publicKey: isGroup
          ? chat.group_public_key
          : (chat.user1_id === userId ? chat.user2_public_key : chat.user1_public_key),
        username: isBotChat
          ? (chat.user1_id === userId ? chat.user2_username : chat.user1_username)
          : isSelfChat
              ? 'saved'
              : (chat.user1_id === userId ? chat.user2_username : chat.user1_username),
        userId: isSelfChat
          ? userId
          : (chat.user1_id === userId ? chat.user2_id : chat.user1_id),
        externalLink: chat.externalLink || chat.chatExternalLink || null,
        chatExternalLink: chat.chatExternalLink || null
      };

      return result;
    });

    res.json(chats);
  } catch (error) {
    console.error('[Chats] GetMyChats error:', error);
    res.status(500).json({ error: 'Ошибка при получении чатов' });
  }
};

// ============================================================================
// CREATE CHAT
// ============================================================================
export const createChat = async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Требуется ID пользователя' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Нельзя создать чат с самим собой' });
    }

    const userExists = await query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingChat = await query(
      `SELECT id FROM chats 
       WHERE type = 'private' 
       AND ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))`,
      [userId, targetUserId]
    );

    if (existingChat.rows.length > 0) {
      await query(
        `DELETE FROM chat_hidden_for_users WHERE chat_id = $1 AND user_id = $2`,
        [existingChat.rows[0].id, userId]
      );
      return res.json({ id: existingChat.rows[0].id, exists: true });
    }

    const result = await query(
      `INSERT INTO chats (id, type, user1_id, user2_id, created_at)
       VALUES ($1, 'private', $2, $3, NOW())
       RETURNING id, type, created_at, ROUND(EXTRACT(EPOCH FROM created_at::timestamptz) * 1000)::bigint as created_at_ms`,
      [uuidv4(), userId, targetUserId]
    );

    res.status(201).json({
      id: result.rows[0].id,
      type: 'private',
      exists: false,
      createdAt: result.rows[0].created_at_ms ?? toDbTimestampIso(result.rows[0].created_at)
    });
  } catch (error) {
    console.error('[Chats] CreateChat error:', error);
    res.status(500).json({ error: 'Ошибка при создании чата' });
  }
};

// ============================================================================
// GET CHAT INFO
// ============================================================================
export const getChatInfo = async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;

    const result = await query(
      `SELECT c.id, c.type, c.created_at,
              ROUND(EXTRACT(EPOCH FROM c.created_at::timestamptz) * 1000)::bigint as created_at_ms,
              u1.id as user1_id, u1.first_name as user1_first_name, u1.last_name as user1_last_name,
              u1.username as user1_username, u1.avatar_url as user1_avatar, u1.is_online as user1_online, u1.public_key as user1_public_key, u1.bio as user1_bio,
              u2.id as user2_id, u2.first_name as user2_first_name, u2.last_name as user2_last_name,
              u2.username as user2_username, u2.avatar_url as user2_avatar, u2.is_online as user2_online, u2.public_key as user2_public_key, u2.bio as user2_bio,
              g.id as group_id, g.name as group_name, g.description as group_description,
              g.avatar_url as group_avatar, g.group_public_key,
              g.external_link AS "externalLink",
              c.external_link AS "chatExternalLink",
               EXISTS(
                 SELECT 1
                 FROM contacts ctc
                 WHERE ctc.user_id = $2
                   AND ctc.contact_user_id = CASE
                     WHEN c.user1_id = $2 THEN c.user2_id
                     ELSE c.user1_id
                   END
               ) AS is_contact
       FROM chats c
       LEFT JOIN users u1 ON c.user1_id = u1.id
       LEFT JOIN users u2 ON c.user2_id = u2.id
       LEFT JOIN groups g ON c.group_id = g.id
       WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2 OR c.id IN (
         SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
       ))`,
      [chatId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    const chat = result.rows[0];
    const isGroup = chat.type === 'group' || chat.type === 'channel';
    const isSelfChat = !isGroup && chat.user1_id === userId && chat.user2_id === userId;
    const participantUserId = isGroup
      ? null
      : (chat.user1_id === userId ? chat.user2_id : chat.user1_id);
    const participantUsername = isGroup
      ? null
      : (chat.user1_id === userId ? chat.user2_username : chat.user1_username);
    const participantBio = isGroup
      ? null
      : (chat.user1_id === userId ? chat.user2_bio : chat.user1_bio);

    res.json({
      id: chat.id,
      type: chat.type,
      name: isGroup
        ? chat.group_name
        : isSelfChat
          ? 'Избранное'
          : chat.user1_id === userId
            ? `${chat.user2_first_name || ''} ${chat.user2_last_name || ''}`.trim()
            : `${chat.user1_first_name || ''} ${chat.user1_last_name || ''}`.trim(),
      avatar: isGroup
        ? chat.group_avatar
        : isSelfChat
          ? SELF_FAVORITES_AVATAR
          : (chat.user1_id === userId ? chat.user2_avatar : chat.user1_avatar),
      isOnline: !isGroup && !isSelfChat && (chat.user1_id === userId ? chat.user2_online : chat.user1_online),
      description: isGroup ? chat.group_description : (isSelfChat ? 'Ваш личный сейф.' : null),
      username: isSelfChat ? 'saved' : participantUsername,
      bio: isSelfChat ? 'Ваш личный сейф.' : participantBio,
      userId: isSelfChat ? userId : participantUserId,
      isContact: chat.is_contact === true,
      publicKey: isGroup
        ? chat.group_public_key
        : (chat.user1_id === userId ? chat.user2_public_key : chat.user1_public_key),
      isSelf: isSelfChat,
      createdAt: chat.created_at_ms ?? toDbTimestampIso(chat.created_at),
      externalLink: chat.externalLink || chat.chatExternalLink || null,
      siteVerificationStatus: chat.siteVerificationStatus || 'none'
    });
  } catch (error) {
    console.error('[Chats] GetChatInfo error:', error);
    res.status(500).json({ error: 'Ошибка при получении информации о чате' });
  }
};

// ============================================================================
// DELETE CHAT
// ============================================================================
export const deleteChat = async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;
    const requestedMode = String(
      req.query?.mode ??
      req.body?.mode ??
      req.body?.scope ??
      'self'
    ).trim().toLowerCase();
    const mode =
      requestedMode === 'all' || requestedMode === 'everyone'
        ? 'all'
        : 'self';

    const chatAccess = await query(
      `SELECT c.id, c.type, c.user1_id, c.user2_id FROM chats c
       WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
      [chatId, userId]
    );

    if (chatAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден или доступ запрещён' });
    }

    const chat = chatAccess.rows[0];

    if (mode === 'self' && chat.type === 'private') {
      await query(
        `INSERT INTO chat_hidden_for_users (chat_id, user_id, hidden_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (chat_id, user_id) DO UPDATE SET hidden_at = EXCLUDED.hidden_at`,
        [chatId, userId]
      );
      try {
        const { sendToUser } = await import('../server.js');
        sendToUser(userId, {
          type: 'chat_deleted',
          chatId,
          mode: 'self',
          scope: 'me',
          deletedBy: userId
        });
      } catch (wsError) {
        console.error('[Chats] Failed to send chat_deleted(me):', wsError);
      }
      return res.json({ success: true, scope: 'me', message: 'Чат удалён у вас' });
    }

    if (chat.type !== 'private') {
      return res.status(400).json({ error: 'Можно удалять только личные чаты' });
    }

    if (chat.user1_id === userId && chat.user2_id === userId) {
      return res.status(400).json({ error: 'Личный сейф нельзя удалить' });
    }

    await query(`UPDATE messages SET is_deleted = TRUE, deleted_at = NOW() WHERE chat_id = $1`, [chatId]);
    await query(`DELETE FROM chat_hidden_for_users WHERE chat_id = $1`, [chatId]);
    await query(`DELETE FROM chats WHERE id = $1`, [chatId]);

    try {
      const { sendToUser } = await import('../server.js');
      sendToUser(chat.user1_id, {
        type: 'chat_deleted',
        chatId,
        mode: 'all',
        scope: 'everyone',
        deletedBy: userId
      });
      sendToUser(chat.user2_id, {
        type: 'chat_deleted',
        chatId,
        mode: 'all',
        scope: 'everyone',
        deletedBy: userId
      });
    } catch (wsError) {
      console.error('[Chats] Failed to send chat_deleted(everyone):', wsError);
    }

    return res.json({ success: true, scope: 'everyone', message: 'Чат удалён у всех' });
  } catch (error) {
    console.error('[Chats] DeleteChat error:', error);
    res.status(500).json({ error: 'Ошибка при удалении чата' });
  }
};

// Simple "decrypt" for preview (client does real decryption)
const decryptMessage = (encrypted) => {
  try {
    const encryptedStr = typeof encrypted === 'object' ? encrypted.toString('utf-8') : encrypted;
    return Buffer.from(encryptedStr, 'base64').toString('utf-8');
  } catch {
    return '[Зашифрованное сообщение]';
  }
};

const ensureSystemChatsIfNeeded = async (userId) => {
  const now = Date.now();
  const lastWarmup = systemChatWarmups.get(userId) || 0;
  if (now - lastWarmup < SYSTEM_CHAT_WARMUP_TTL_MS) {
    return;
  }

  await ensureFavoritesChat(userId);
  await ensureBotChat(userId);

      'Привет! Я Aegis AI. Задай вопрос или используй /draw, чтобы я нарисовал.'
  systemChatWarmups.set(userId, now);
};
