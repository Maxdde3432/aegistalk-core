import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { Readable } from 'node:stream';
import { resolveUserIdFromRequest, redirectToLogin } from '../middleware/auth.js';
import { sendChatPushNotification } from '../services/pushNotificationService.js';

const isLocalMediaUrl = (url) => typeof url === 'string' && (url.startsWith('/uploads/') || url.startsWith('/api/media/'));
const FORCE_DOWNLOAD_MIMES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript'
]);

const buildPushPreview = (type, content) => {
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedContent = String(content || '').trim().toLowerCase();
  if (normalizedContent.includes('"render":"voice"')) {
    return 'Голосовое сообщение';
  }
  if (normalizedContent.includes('"render":"circle"')) {
    return 'Видеосообщение';
  }
  if (normalizedType === 'voice' || normalizedType === 'audio') {
    return 'Голосовое сообщение';
  }
  if (normalizedType === 'image' || normalizedType === 'photo') {
    return 'Фотография';
  }
  if (normalizedType === 'video-circle') {
    return 'Видеосообщение';
  }

  return 'Новое зашифрованное сообщение';
};

const buildMediaRedirectUrl = (req, mediaUrl, messageId, download = false, fileName = '') => {
  const base = mediaUrl.startsWith('http')
    ? new URL(mediaUrl)
    : new URL(mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`, `${req.protocol}://${req.get('host')}`);

  const tokenFromHeader = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : '';
  const token = req.query.token || tokenFromHeader || '';

  if (token) base.searchParams.set('token', token);
  if (messageId) base.searchParams.set('messageId', messageId);
  if (download) base.searchParams.set('download', '1');
  if (download && fileName) base.searchParams.set('filename', fileName);

  return base.toString();
};

// ============================================================================
// GET MESSAGES - Получить историю сообщений чата
// ============================================================================
export const getMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Проверяем доступ к чату - поддерживаем как chatId так и groupId
    const chatAccess = await query(
      `SELECT c.id FROM chats c
       WHERE (c.id = $1 OR c.group_id = $1) AND (c.user1_id = $2 OR c.user2_id = $2 OR c.group_id IN (
         SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
       ))`,
      [chatId, userId]
    );

    if (chatAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден или доступ запрещён' });
    }

    // Получаем сообщения
    const result = await query(
      `SELECT m.id, m.chat_id, m.sender_id, m.message_type, m.content_encrypted,
              m.nonce, m.sender_public_key, m.signature,
              m.media_url, m.media_thumbnail_url, m.media_mime_type, m.media_size_bytes,
              m.status, m.is_edited, m.edited_at, m.is_deleted, m.deleted_at, m.created_at,
              u.first_name, u.last_name, u.avatar_url,
              c.type, g.name as group_name, g.avatar_url as group_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       JOIN chats c ON m.chat_id = c.id
       LEFT JOIN groups g ON c.group_id = g.id
       WHERE m.chat_id = $1 AND m.is_deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chatId, parseInt(limit), parseInt(offset)]
    );

    const reactionPayload = {};
    if (result.rows.length > 0) {
      const reactionRows = await query(
        `SELECT mr.message_id, mr.emoji, COUNT(*)::int AS count
         FROM message_reactions mr
         WHERE mr.message_id = ANY($1::uuid[])
         GROUP BY mr.message_id, mr.emoji
         ORDER BY mr.message_id ASC, MIN(mr.created_at) ASC`,
        [result.rows.map((row) => row.id)]
      );

      reactionRows.rows.forEach((row) => {
        if (!reactionPayload[row.message_id]) {
          reactionPayload[row.message_id] = [];
        }
        reactionPayload[row.message_id].push({
          emoji: row.emoji,
          count: row.count
        });
      });
    }

    const messages = result.rows.map(msg => ({
      id: msg.id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName: `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || 'Пользователь',
      senderAvatar: msg.avatar_url,
      type: msg.message_type,
      content: msg.content_encrypted,
      nonce: msg.nonce,
      senderPublicKey: msg.sender_public_key,
      signature: msg.signature,
      mediaUrl: msg.media_url,
      imageUrl: msg.media_url,
      mediaThumbnailUrl: msg.media_thumbnail_url,
      mediaMimeType: msg.media_mime_type,
      mediaSizeBytes: msg.media_size_bytes,
      status: msg.status,
      reactions: reactionPayload[msg.id] || [],
      isEdited: msg.is_edited,
      editedAt: msg.edited_at,
      isDeleted: msg.is_deleted,
      createdAt: msg.created_at,
      // Для каналов добавляем информацию о канале
      isChannelPost: msg.type === 'channel',
      channelName: msg.group_name,
      channelAvatar: msg.group_avatar
    })).reverse(); // Переворачиваем чтобы были по порядку

    res.json(messages);

  } catch (error) {
    console.error('[Messages] GetMessages error:', error);
    res.status(500).json({ error: 'Ошибка при получении сообщений' });
  }
};

// ============================================================================
// SEND MESSAGE - Отправить сообщение
// ============================================================================
export const sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId, content, type = 'text', nonce, senderPublicKey, signature, mediaUrl, mediaThumbnailUrl, mediaMimeType, mediaSizeBytes } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({ error: 'Требуется chatId и content' });
    }

    // Проверяем доступ к чату - поддерживаем как chatId так и groupId
    const chatAccess = await query(
      `SELECT c.id, c.type FROM chats c
       WHERE (c.id = $1 OR c.group_id = $1) AND (c.user1_id = $2 OR c.user2_id = $2 OR c.group_id IN (
         SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
       ))`,
      [chatId, userId]
    );

    if (chatAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден или доступ запрещён' });
    }

    const chatType = chatAccess.rows[0].type;
    const actualChatId = chatAccess.rows[0].id; // Реальный ID чата из БД

    // ПРОВЕРКА: В каналах только owner/admin могут писать
    if (chatType === 'channel') {
      const groupResult = await query(
        `SELECT group_id FROM chats WHERE id = $1`,
        [actualChatId]
      );
      const groupId = groupResult.rows[0]?.group_id;
      
      if (groupId) {
        const memberCheck = await query(
          `SELECT role FROM group_members 
           WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
          [groupId, userId]
        );
        
        const role = memberCheck.rows[0]?.role;
        if (role !== 'owner' && role !== 'admin') {
          return res.status(403).json({ 
            error: 'Только администраторы могут писать в канале' 
          });
        }
      }
    }

    // Для групп нужно найти groupId для WebSocket
    let groupId = null;
    if (chatType === 'group' || chatType === 'channel') {
      const groupResult = await query(
        `SELECT group_id FROM chats WHERE id = $1`,
        [actualChatId]
      );
      groupId = groupResult.rows[0]?.group_id;
    }

    // Шифруем контент (в реальности шифрование на клиенте)
    const encryptedContent = String(content);

    // Создаём сообщение
    const result = await query(
      `INSERT INTO messages (
        id, chat_id, sender_id, message_type, content_encrypted,
        nonce, sender_public_key, signature,
        media_url, media_thumbnail_url, media_mime_type, media_size_bytes,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING id, chat_id, sender_id, message_type, content_encrypted,
                nonce, sender_public_key, signature, status, created_at`,
      [
        uuidv4(),
        actualChatId,
        userId,
        type,
        encryptedContent,
        nonce || '',
        senderPublicKey || '',
        signature || '',
        mediaUrl || null,
        mediaThumbnailUrl || null,
        mediaMimeType || null,
        mediaSizeBytes || null,
        'sent'
      ]
    );

    const message = result.rows[0];

    // Для групп отправляем groupId в WebSocket (так же как при подписке на frontend)
    const wsChatId = groupId || actualChatId;

    // Обновляем last_message_at в чате
    await query(
      `UPDATE chats SET last_message_at = NOW() WHERE id = $1`,
      [actualChatId]
    );

    if (chatType === 'private') {
      await query(`DELETE FROM chat_hidden_for_users WHERE chat_id = $1`, [actualChatId]);
    }

    // Гарантированно добавляем отправителя в chatMembers чтобы он получил сообщение
    if (chatType === 'private') {
      await query(`DELETE FROM chat_hidden_for_users WHERE chat_id = $1`, [actualChatId]);
    }

    const { sendMessageToChat, ensureUserInChatMembers, userSockets } = await import('../server.js');
    ensureUserInChatMembers(userId, wsChatId);
    let otherUserId = null;
    
    // Для личных чатов - добавляем получателя (user2)
    if (chatType === 'private') {
      const chatInfo = await query(
        `SELECT user1_id, user2_id FROM chats WHERE id = $1`,
        [actualChatId]
      );
      otherUserId = chatInfo.rows[0]?.user1_id === userId 
        ? chatInfo.rows[0]?.user2_id 
        : chatInfo.rows[0]?.user1_id;
      if (otherUserId) {
        ensureUserInChatMembers(otherUserId, wsChatId);
      }
    }

    if (chatType === 'private' && otherUserId && userSockets.has(otherUserId)) {
      const deliveredResult = await query(
        `UPDATE messages
         SET status = 'delivered'
         WHERE id = $1
         RETURNING status`,
        [message.id]
      );

      if (deliveredResult.rows[0]?.status) {
        message.status = deliveredResult.rows[0].status;
      }
    }
    
    // Для групп/каналов - добавляем всех участников
    if (chatType === 'group' || chatType === 'channel') {
      const members = await query(
        `SELECT user_id FROM group_members 
         WHERE group_id = $1 AND is_active = TRUE AND user_id != $2`,
        [groupId, userId]
      );
      for (const member of members.rows) {
        ensureUserInChatMembers(member.user_id, wsChatId);
      }
    }

    // Отправляем через WebSocket всем подключенным в чате
    sendMessageToChat(wsChatId, {
      eventType: 'new_message', // Тип события WebSocket
      id: message.id,
      chatId: wsChatId, // Для групп это groupId, для личных - chatId
      senderId: message.sender_id,
      messageType: message.message_type, // Тип сообщения (text, image...)
      type: message.message_type,
      content: encryptedContent,
      nonce: message.nonce,
      senderPublicKey: message.sender_public_key,
      signature: message.signature,
      mediaUrl: mediaUrl || null,
      mediaThumbnailUrl: mediaThumbnailUrl || null,
      mediaMimeType: mediaMimeType || null,
      mediaSizeBytes: mediaSizeBytes || null,
      status: message.status,
      createdAt: message.created_at
    }, chatType);

    if (chatType === 'private' && otherUserId && !userSockets.has(otherUserId)) {
      try {
        const pushTargetResult = await query(
          `SELECT
             recipient.fcm_token AS recipient_fcm_token,
             sender.first_name AS sender_first_name,
             sender.last_name AS sender_last_name
           FROM users recipient
           JOIN users sender ON sender.id = $2
           WHERE recipient.id = $1`,
          [otherUserId, userId]
        );

        const pushTarget = pushTargetResult.rows[0];
        const recipientToken = String(pushTarget?.recipient_fcm_token || '').trim();
        if (recipientToken) {
          const senderName =
              `${pushTarget?.sender_first_name || ''} ${pushTarget?.sender_last_name || ''}`
                  .trim() || 'AegisTalk';

          void sendChatPushNotification({
            token: recipientToken,
            senderName,
            body: buildPushPreview(message.message_type, encryptedContent),
            data: {
              chatId: actualChatId,
              messageId: message.id,
              senderId: userId,
              senderName,
              messageType: message.message_type,
              content: encryptedContent
            }
          });
        }
      } catch (pushError) {
        console.error('[Messages] Push send error:', pushError);
      }
    }

    res.status(201).json({
      id: message.id,
      chatId: message.chat_id,
      senderId: message.sender_id,
      type: message.message_type,
      content: encryptedContent,
      nonce: message.nonce,
      senderPublicKey: message.sender_public_key,
      signature: message.signature,
      mediaUrl: mediaUrl || null,
      mediaThumbnailUrl: mediaThumbnailUrl || null,
      mediaMimeType: mediaMimeType || null,
      mediaSizeBytes: mediaSizeBytes || null,
      status: message.status,
      createdAt: message.created_at
    });

  } catch (error) {
    console.error('[Messages] SendMessage error:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения' });
  }
};

// ============================================================================
// UPDATE MESSAGE STATUS - Обновить статус сообщения (delivered/read)
// ============================================================================
export const updateMessageStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId, status } = req.body;

    if (!messageId || !['delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Требуется messageId и статус (delivered/read)' });
    }

    const result = await query(
      `UPDATE messages 
       SET status = $1 
       WHERE id = $2 AND (
         chat_id IN (SELECT id FROM chats WHERE user2_id = $3)
       )
       RETURNING id, status`,
      [status, messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    res.json({
      messageId: result.rows[0].id,
      status: result.rows[0].status
    });

  } catch (error) {
    console.error('[Messages] UpdateStatus error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении статуса' });
  }
};

// ============================================================================
// DELETE MESSAGE - Удалить сообщение
// ============================================================================
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;

    // Получаем информацию о сообщении и чате
    const messageAccess = await query(
      `SELECT m.id, m.chat_id, m.sender_id, c.type, c.group_id
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const message = messageAccess.rows[0];

    // Проверка прав
    const isSender = message.sender_id === userId;
    let isAdmin = false;

    // Для групп и каналов проверяем роль
    if (message.type === 'group' || message.type === 'channel') {
      const memberCheck = await query(
        `SELECT role FROM group_members
         WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
        [message.group_id, userId]
      );
      const role = memberCheck.rows[0]?.role;
      isAdmin = role === 'owner' || role === 'admin';
    }

    // Удалять можно только свои сообщения ИЛИ если админ/владелец в группе/канале
    if (!isSender && !isAdmin) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления сообщения' });
    }

    const result = await query(
      `UPDATE messages
       SET is_deleted = TRUE, deleted_at = NOW()
       WHERE id = $1
       RETURNING id, is_deleted, deleted_at`,
      [messageId]
    );

    // Обновляем last_message_at — находим последнее не удаленное сообщение
    const lastMessage = await query(
      `SELECT created_at FROM messages 
       WHERE chat_id = $1 AND is_deleted = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [message.chat_id]
    );
    
    if (lastMessage.rows.length > 0) {
      await query(
        `UPDATE chats SET last_message_at = $1 WHERE id = $2`,
        [lastMessage.rows[0].created_at, message.chat_id]
      );
    } else {
      // Если сообщений не осталось — сбрасываем last_message_at на created_at
      await query(
        `UPDATE chats SET last_message_at = created_at WHERE id = $1`,
        [message.chat_id]
      );
    }

    // ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕЗ WEBSOCKET
    const { sendMessageToChat } = await import('../server.js');
    
    let wsChatId = message.chat_id;
    if (message.type === 'group' || message.type === 'channel') {
      const groupResult = await query(
        `SELECT group_id FROM chats WHERE id = $1`,
        [message.chat_id]
      );
      const groupId = groupResult.rows[0]?.group_id;
      if (groupId) {
        wsChatId = groupId;
      }
    }

    sendMessageToChat(wsChatId, {
      eventType: 'delete_message',
      chatId: wsChatId,
      messageId,
      deletedBy: userId
    }, message.type);

    res.json({
      messageId: result.rows[0].id,
      isDeleted: result.rows[0].is_deleted,
      deletedAt: result.rows[0].deleted_at
    });

  } catch (error) {
    console.error('[Messages] DeleteMessage error:', error);
    res.status(500).json({ error: 'Ошибка при удалении сообщения' });
  }
};

// ============================================================================
// EDIT MESSAGE - Редактировать сообщение
// ============================================================================
export const editMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params; // Берём из URL параметра
    let { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Требуется content' });
    }

    // Получаем информацию о сообщении и чате
    const messageAccess = await query(
      `SELECT m.id, m.chat_id, m.sender_id, m.content_encrypted, c.type, c.group_id
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const message = messageAccess.rows[0];

    // Проверка прав
    const isSender = message.sender_id === userId;
    let isAdmin = false;

    // Для групп и каналов проверяем роль
    if (message.type === 'group' || message.type === 'channel') {
      const memberCheck = await query(
        `SELECT role FROM group_members
         WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
        [message.group_id, userId]
      );
      const role = memberCheck.rows[0]?.role;
      isAdmin = role === 'owner' || role === 'admin';
    }

    // Редактировать можно только свои сообщения ИЛИ если админ/владелец в группе/канале
    if (!isSender && !isAdmin) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования сообщения' });
    }

    // Шифруем новый контент
    const encryptedContent = String(content);
    content = encryptedContent;

    const result = await query(
      `UPDATE messages
       SET content_encrypted = $1, is_edited = TRUE, edited_at = NOW()
       WHERE id = $2
       RETURNING id, is_edited, edited_at`,
      [encryptedContent, messageId]
    );

    // ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕЗ WEBSOCKET
    const { sendMessageToChat } = await import('../server.js');
    
    let wsChatId = message.chat_id;
    if (message.type === 'group' || message.type === 'channel') {
      const groupResult = await query(
        `SELECT group_id FROM chats WHERE id = $1`,
        [message.chat_id]
      );
      const groupId = groupResult.rows[0]?.group_id;
      if (groupId) {
        wsChatId = groupId;
      }
    }

    sendMessageToChat(wsChatId, {
      eventType: 'edit_message',
      chatId: wsChatId,
      messageId,
      content, // Отправляем расшифрованный контент
      editedBy: userId
    }, message.type);

    res.json({
      messageId: result.rows[0].id,
      isEdited: result.rows[0].is_edited,
      editedAt: result.rows[0].edited_at,
      content
    });

  } catch (error) {
    console.error('[Messages] EditMessage error:', error);
    res.status(500).json({ error: 'Ошибка при редактировании сообщения' });
  }
};

// ============================================================================
// ADD REACTION - Добавить реакцию на сообщение
// ============================================================================
export const addReaction = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId, emoji } = req.body;

    if (!messageId || !emoji) {
      return res.status(400).json({ error: 'Требуется messageId и emoji' });
    }

    // Проверяем доступ к сообщению
    const messageAccess = await query(
      `SELECT m.id, m.chat_id, c.type, c.group_id
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1 AND (
         c.user1_id = $2 OR c.user2_id = $2 OR
         c.group_id IN (SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE)
       )`,
      [messageId, userId]
    );

    if (messageAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const message = messageAccess.rows[0];

    // Добавляем реакцию
    const result = await query(
      `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (message_id, user_id, emoji) DO UPDATE SET created_at = NOW()
       RETURNING id, emoji, created_at`,
      [uuidv4(), messageId, userId, emoji]
    );

    // Получаем все реакции для этого сообщения
    const reactions = await getReactionsForMessage(messageId);

    // ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕZ WEBSOCKET
    const { sendMessageToChat } = await import('../server.js');
    
    // Определяем chatId для WebSocket (groupId для групп/каналов)
    let wsChatId = message.chat_id;
    if (message.type === 'group' || message.type === 'channel') {
      const groupResult = await query(
        `SELECT group_id FROM chats WHERE id = $1`,
        [message.chat_id]
      );
      const groupId = groupResult.rows[0]?.group_id;
      if (groupId) {
        wsChatId = groupId;
      }
    }

    sendMessageToChat(wsChatId, {
      eventType: 'new_reaction',
      chatId: wsChatId, // Добавляем chatId для сравнения на frontend
      messageId,
      reaction: result.rows[0],
      reactions,
      userId
    }, message.type);

    res.json({
      reaction: result.rows[0],
      reactions
    });

  } catch (error) {
    console.error('[Messages] AddReaction error:', error);
    res.status(500).json({ error: 'Ошибка при добавлении реакции' });
  }
};

// ============================================================================
// REMOVE REACTION - Удалить реакцию
// ============================================================================
export const removeReaction = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId, emoji } = req.body;

    if (!messageId || !emoji) {
      return res.status(400).json({ error: 'Требуется messageId и emoji' });
    }

    // Проверяем доступ к сообщению (нужно для определения chat_id)
    const messageAccess = await query(
      `SELECT m.id, m.chat_id, c.type, c.group_id
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1 AND (
         c.user1_id = $2 OR c.user2_id = $2 OR
         c.group_id IN (SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE)
       )`,
      [messageId, userId]
    );

    const result = await query(
      `DELETE FROM message_reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3
       RETURNING id`,
      [messageId, userId, emoji]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Реакция не найдена' });
    }

    // Получаем обновлённые реакции
    const reactions = await getReactionsForMessage(messageId);

    // ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕЗ WEBSOCKET
    const { sendMessageToChat } = await import('../server.js');
    
    if (messageAccess.rows.length > 0) {
      const message = messageAccess.rows[0];
      
      // Определяем chatId для WebSocket (groupId для групп/каналов)
      let wsChatId = message.chat_id;
      if (message.type === 'group' || message.type === 'channel') {
        const groupResult = await query(
          `SELECT group_id FROM chats WHERE id = $1`,
          [message.chat_id]
        );
        const groupId = groupResult.rows[0]?.group_id;
        if (groupId) {
          wsChatId = groupId;
        }
      }

      sendMessageToChat(wsChatId, {
        eventType: 'remove_reaction',
        chatId: wsChatId, // Добавляем chatId для сравнения на frontend
        messageId,
        emoji,
        reactions,
        userId
      }, message.type);
    }

    res.json({
      removed: { emoji },
      reactions
    });

  } catch (error) {
    console.error('[Messages] RemoveReaction error:', error);
    res.status(500).json({ error: 'Ошибка при удалении реакции' });
  }
};

// ============================================================================
// GET REACTIONS - Получить все реакции сообщения
// ============================================================================
export const getReactions = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const reactions = await getReactionsForMessage(messageId);
    res.json(reactions);
  } catch (error) {
    console.error('[Messages] GetReactions error:', error);
    res.status(500).json({ error: 'Ошибка при получении реакций' });
  }
};

// Внутренняя функция для получения реакций
// ============================================================================
// GET REACTIONS (BATCH) - Получить реакции сразу для многих сообщений
// ============================================================================
export const getReactionsBatch = async (req, res) => {
  try {
    const { messageIds } = req.body || {};

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.json({});
    }

    const uniqueIds = [...new Set(messageIds)].filter(Boolean);
    if (uniqueIds.length === 0) {
      return res.json({});
    }

    const result = await query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, mr.created_at,
              u.first_name, u.last_name
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = ANY($1::uuid[])
       ORDER BY mr.message_id ASC, mr.created_at ASC`,
      [uniqueIds]
    );

    // groupedByMessage[messageId][emoji] -> { emoji, count, users: [{userId, name}] }
    const groupedByMessage = {};
    result.rows.forEach(row => {
      const messageId = row.message_id;
      if (!groupedByMessage[messageId]) groupedByMessage[messageId] = {};

      if (!groupedByMessage[messageId][row.emoji]) {
        groupedByMessage[messageId][row.emoji] = {
          emoji: row.emoji,
          count: 0,
          users: []
        };
      }

      groupedByMessage[messageId][row.emoji].count++;
      groupedByMessage[messageId][row.emoji].users.push({
        userId: row.user_id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Пользователь'
      });
    });

    const payload = {};
    Object.entries(groupedByMessage).forEach(([messageId, emojiMap]) => {
      payload[messageId] = Object.values(emojiMap);
    });

    return res.json(payload);
  } catch (error) {
    console.error('[Messages] GetReactionsBatch error:', error);
    return res.status(500).json({ error: 'Ошибка при получении реакций' });
  }
};

export const viewMedia = async (req, res) => {
  try {
    const access = await resolveMediaAccess(req, res);
    if (!access) return;

    if (isLocalMediaUrl(access.mediaUrl)) {
      const redirectUrl = buildMediaRedirectUrl(req, access.mediaUrl, req.params.messageId, false, access.fileName);
      return res.redirect(302, redirectUrl);
    }

    const upstream = await fetch(access.mediaUrl);
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Не удалось получить приватный файл' });
    }

    const contentType = upstream.headers.get('content-type') || access.mediaMimeType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (FORCE_DOWNLOAD_MIMES.has(String(contentType).toLowerCase())) {
      res.setHeader('Content-Disposition', `attachment; filename="${access.fileName}"`);
    }

    if (!upstream.body) {
      return res.send(Buffer.from(await upstream.arrayBuffer()));
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('[Messages] viewMedia error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка при получении приватного контента' });
    }
  }
};

export const downloadMedia = async (req, res) => {
  try {
    const access = await resolveMediaAccess(req, res);
    if (!access) return;

    if (isLocalMediaUrl(access.mediaUrl)) {
      const redirectUrl = buildMediaRedirectUrl(req, access.mediaUrl, req.params.messageId, true, access.fileName);
      return res.redirect(302, redirectUrl);
    }

    const upstream = await fetch(access.mediaUrl);
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Не удалось скачать приватный файл' });
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || access.mediaMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=\"' + access.fileName + '\"');
    res.setHeader('Cache-Control', 'private, no-store');

    if (!upstream.body) {
      return res.send(Buffer.from(await upstream.arrayBuffer()));
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('[Messages] downloadMedia error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка при скачивании приватного контента' });
    }
  }
};

const getReactionsForMessage = async (messageId) => {
  const result = await query(
    `SELECT mr.emoji, mr.user_id, mr.created_at,
            u.first_name, u.last_name
     FROM message_reactions mr
     JOIN users u ON mr.user_id = u.id
     WHERE mr.message_id = $1
     ORDER BY mr.created_at ASC`,
    [messageId]
  );

  // Группируем реакции по emoji
  const grouped = {};
  result.rows.forEach(row => {
    if (!grouped[row.emoji]) {
      grouped[row.emoji] = {
        emoji: row.emoji,
        count: 0,
        users: []
      };
    }
    grouped[row.emoji].count++;
    grouped[row.emoji].users.push({
      userId: row.user_id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Пользователь'
    });
  });

  return Object.values(grouped);
};

// Простая "дешифровка" для отображения
const resolveMediaAccess = async (req, res) => {
  let userId = null;
  try {
    userId = resolveUserIdFromRequest(req);
  } catch (error) {
    userId = null;
  }

  if (!userId) {
    redirectToLogin(req, res);
    return null;
  }

  const { messageId } = req.params;
  const result = await query(
    `SELECT m.id, m.message_type, m.content_encrypted, m.media_url, m.media_mime_type
     FROM messages m
     JOIN chats c ON m.chat_id = c.id
     WHERE m.id = $1
       AND (
         c.user1_id = $2 OR c.user2_id = $2 OR
         c.group_id IN (
           SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
         )
       )
     LIMIT 1`,
    [messageId, userId]
  );

  if (result.rows.length === 0) {
    res.status(403).json({ error: 'У вас нет доступа к этому приватному контенту' });
    return null;
  }

  const row = result.rows[0];
  const decryptedContent = decryptMessage(row.content_encrypted);
  let mediaData = null;

  try {
    if (decryptedContent && decryptedContent.trim().startsWith('{')) {
      mediaData = JSON.parse(decryptedContent);
    }
  } catch (error) {
    mediaData = null;
  }

  const mediaUrl = mediaData?.url || row.media_url;
  if (!mediaUrl) {
    res.status(404).json({ error: 'Файл не найден' });
    return null;
  }

  return {
    mediaUrl,
    mediaMimeType: row.media_mime_type,
    fileName: buildMediaFileName(mediaData, row.message_type, mediaUrl)
  };
};

const buildMediaFileName = (mediaData, messageType, mediaUrl) => {
  const explicitName = mediaData?.name || mediaData?.fileName;
  if (explicitName) {
    return explicitName.replace(/["\r\n]/g, '_');
  }

  const extMatch = String(mediaUrl).match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  const extension = extMatch ? extMatch[1] : 'bin';
  const base =
    messageType === 'image'
      ? 'image'
      : messageType === 'video' || messageType === 'video-circle'
        ? 'video'
        : messageType === 'voice' || messageType === 'audio'
          ? 'audio'
          : 'file';

  return `${base}-${Date.now()}.${extension}`.replace(/["\r\n]/g, '_');
};

const decryptMessage = (encrypted) => {
  try {
    // Преобразуем Buffer в строку если нужно
    const encryptedStr = typeof encrypted === 'object' ? encrypted.toString('utf-8') : encrypted;
    return Buffer.from(encryptedStr, 'base64').toString('utf-8');
  } catch {
    return '[Зашифрованное сообщение]';
  }
};

