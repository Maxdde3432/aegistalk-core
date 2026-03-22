import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClient, query } from '../db/index.js';
import { ensureBotChat } from '../controllers/chatController.js';

export const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000001';
const BOT_TOKEN_PREFIX = 'agtb';
const BOT_AVATAR_URL = '/aegistalk-bot.svg';

const RESERVED_BOT_USERNAMES = new Set([
  'aegistalkbot',
  'aegisbot',
  'aegis',
  'support',
  'admin',
  'system',
  'root',
  'official',
  'bot',
  'bots'
]);

const toBase64Url = (buffer) => buffer
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const hashSecret = (secret) => crypto
  .createHash('sha256')
  .update(String(secret))
  .digest('hex');

const normalizeUsername = (value) => String(value || '')
  .trim()
  .replace(/^@+/, '')
  .toLowerCase();

const normalizeBotName = (value) => String(value || '').trim().toLowerCase();

export const validateBotUsername = (value) => {
  const normalized = normalizeUsername(value);

  if (!normalized) {
    return { valid: false, normalized, error: 'Укажите username бота' };
  }

  if (normalized.length < 5 || normalized.length > 32) {
    return { valid: false, normalized, error: 'Username бота должен быть от 5 до 32 символов' };
  }

  if (!/^[a-z][a-z0-9_]*[a-z0-9]$/.test(normalized) || normalized.includes('__')) {
    return {
      valid: false,
      normalized,
      error: 'Username бота может содержать только латиницу, цифры и _, начинаться с буквы и не заканчиваться _'
    };
  }

  if (RESERVED_BOT_USERNAMES.has(normalized)) {
    return { valid: false, normalized, error: 'Этот username бота зарезервирован' };
  }

  return { valid: true, normalized };
};

const buildBotToken = (botId, secret) => `${BOT_TOKEN_PREFIX}_${botId}_${secret}`;
const issueTokenSecret = () => toBase64Url(crypto.randomBytes(24));

const formatBotRow = (row) => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  name: row.name,
  username: row.username,
  description: row.description || '',
  isActive: row.is_active,
  tokenLast4: row.token_last4,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastTokenIssuedAt: row.last_token_issued_at
});

export const listUserBots = async (ownerUserId) => {
  const result = await query(
    `SELECT id, owner_user_id, name, username, description, is_active, token_last4, created_at, updated_at, last_token_issued_at
     FROM user_bots
     WHERE owner_user_id = $1
     ORDER BY created_at DESC`,
    [ownerUserId]
  );

  return result.rows.map(formatBotRow);
};

const assertBotUsernameAvailable = async (client, normalizedUsername) => {
  const conflict = await client.query(
    `SELECT source
     FROM (
       SELECT 'user_bots'::text AS source FROM user_bots WHERE LOWER(username) = $1
       UNION ALL
       SELECT 'users'::text AS source FROM users WHERE LOWER(username) = $1
     ) AS conflicts
     LIMIT 1`,
    [normalizedUsername]
  );

  if (conflict.rowCount > 0) {
    throw new Error('Этот username уже занят');
  }
};

const assertBotNameAvailable = async (client, normalizedName) => {
  const conflict = await client.query(
    `SELECT id FROM user_bots WHERE LOWER(name) = $1 LIMIT 1`,
    [normalizedName]
  );

  if (conflict.rowCount > 0) {
    throw new Error('Это имя бота уже занято');
  }
};

export const createUserBot = async (ownerUserId, payload = {}) => {
  const validation = validateBotUsername(payload.username);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const name = String(payload.name || '').trim();
  if (!name || name.length < 2 || name.length > 80) {
    throw new Error('Название бота должно быть от 2 до 80 символов');
  }

  const normalizedName = normalizeBotName(name);
  const description = String(payload.description || '').trim().slice(0, 240);
  const botId = uuidv4();
  const secret = issueTokenSecret();
  const rawToken = buildBotToken(botId, secret);
  const secretHash = hashSecret(secret);
  const client = await getClient();

  try {
    await client.query('BEGIN');
    await assertBotUsernameAvailable(client, validation.normalized);
    await assertBotNameAvailable(client, normalizedName);

    const inserted = await client.query(
      `INSERT INTO user_bots (
         id, owner_user_id, name, username, description,
         api_secret_hash, token_last4, is_active, created_at, updated_at, last_token_issued_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW(), NOW())
       RETURNING id, owner_user_id, name, username, description, is_active, token_last4, created_at, updated_at, last_token_issued_at`,
      [botId, ownerUserId, name, validation.normalized, description || null, secretHash, secret.slice(-4)]
    );

    await client.query(
      `INSERT INTO users (
         id, email, username, first_name, last_name, avatar_url, bio,
         is_online, is_active, is_bot, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, NULL, $5, $6, FALSE, TRUE, TRUE, NOW(), NOW())`,
      [
        botId,
        `bot+${validation.normalized}@bots.aegistalk.local`,
        validation.normalized,
        name,
        BOT_AVATAR_URL,
        description || null
      ]
    );

    const chatId = uuidv4();
    await client.query(
      `INSERT INTO chats (id, type, user1_id, user2_id, created_at, last_message_at)
       VALUES ($1, 'private', $2, $3, NOW(), NOW())`,
      [chatId, ownerUserId, botId]
    );

    const welcomeText = Buffer.from(
      [
        `Привет! Я ${name}.`,
        '',
        `Мой username: @${validation.normalized}`,
        'Я уже появился в поиске и в списке чатов.',
        'API-ключ и Go starter ты получаешь в AegisTalk Bot.'
      ].join('\n'),
      'utf8'
    ).toString('base64');

    await client.query(
      `INSERT INTO messages (
         id, chat_id, sender_id, message_type, content_encrypted,
         nonce, sender_public_key, signature, status, created_at
       )
       VALUES ($1, $2, $3, 'text', $4, '', '', '', 'delivered', NOW())`,
      [uuidv4(), chatId, botId, welcomeText]
    );

    await client.query('COMMIT');

    return {
      bot: formatBotRow(inserted.rows[0]),
      rawToken,
      createdChatId: chatId
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const regenerateUserBotToken = async (ownerUserId, botId) => {
  const secret = issueTokenSecret();
  const rawToken = buildBotToken(botId, secret);
  const secretHash = hashSecret(secret);

  const result = await query(
    `UPDATE user_bots
     SET api_secret_hash = $1,
         token_last4 = $2,
         updated_at = NOW(),
         last_token_issued_at = NOW()
     WHERE id = $3 AND owner_user_id = $4
     RETURNING id, owner_user_id, name, username, description, is_active, token_last4, created_at, updated_at, last_token_issued_at`,
    [secretHash, secret.slice(-4), botId, ownerUserId]
  );

  if (result.rowCount === 0) {
    throw new Error('Бот не найден');
  }

  return {
    bot: formatBotRow(result.rows[0]),
    rawToken
  };
};

export const updateUserBotState = async (ownerUserId, botId, changes = {}) => {
  const isActiveValue = typeof changes.isActive === 'boolean' ? changes.isActive : null;

  const result = await query(
    `UPDATE user_bots
     SET is_active = COALESCE($1, is_active),
         updated_at = NOW()
     WHERE id = $2 AND owner_user_id = $3
     RETURNING id, owner_user_id, name, username, description, is_active, token_last4, created_at, updated_at, last_token_issued_at`,
    [isActiveValue, botId, ownerUserId]
  );

  if (result.rowCount === 0) {
    throw new Error('Бот не найден');
  }

  await query(
    `UPDATE users
     SET is_active = COALESCE($1, is_active), updated_at = NOW()
     WHERE id = $2`,
    [isActiveValue, botId]
  );

  return formatBotRow(result.rows[0]);
};

export const authenticateUserBotToken = async (rawToken) => {
  const token = String(rawToken || '').trim();
  const match = token.match(/^agtb_([0-9a-f-]{36})_([A-Za-z0-9_-]+)$/i);

  if (!match) {
    return null;
  }

  const [, botId, secret] = match;
  const result = await query(
    `SELECT id, owner_user_id, name, username, description, is_active, api_secret_hash, token_last4, created_at, updated_at, last_token_issued_at
     FROM user_bots
     WHERE id = $1`,
    [botId]
  );

  const bot = result.rows[0];
  if (!bot || !bot.is_active) {
    return null;
  }

  if (hashSecret(secret) !== bot.api_secret_hash) {
    return null;
  }

  return formatBotRow(bot);
};

export const pushSystemBotMessage = async (ownerUserId, text) => {
  const chatId = await ensureBotChat(ownerUserId);
  if (!chatId) {
    throw new Error('Не удалось подготовить чат с AegisTalk Bot');
  }

  const messageId = uuidv4();
  const encoded = Buffer.from(String(text || ''), 'utf8').toString('base64');

  const inserted = await query(
    `INSERT INTO messages (
       id, chat_id, sender_id, message_type, content_encrypted,
       nonce, sender_public_key, signature, status, created_at
     )
     VALUES ($1, $2, $3, 'text', $4, '', '', '', 'delivered', NOW())
     RETURNING id, created_at`,
    [messageId, chatId, SYSTEM_BOT_USER_ID, encoded]
  );

  await query(`UPDATE chats SET last_message_at = NOW() WHERE id = $1`, [chatId]);

  try {
    const { ensureUserInChatMembers, sendMessageToChat } = await import('../server.js');
    ensureUserInChatMembers(ownerUserId, chatId);
    sendMessageToChat(chatId, {
      eventType: 'new_message',
      id: messageId,
      chatId,
      senderId: SYSTEM_BOT_USER_ID,
      messageType: 'text',
      type: 'text',
      content: String(text || ''),
      nonce: '',
      senderPublicKey: '',
      signature: '',
      mediaUrl: null,
      mediaThumbnailUrl: null,
      mediaMimeType: null,
      mediaSizeBytes: null,
      status: 'delivered',
      createdAt: inserted.rows[0]?.created_at || new Date().toISOString()
    }, 'private');
  } catch (error) {
    console.error('[BotPlatform] Failed to emit system bot message over WS:', error);
  }

  return { chatId, messageId };
};

const formatMetaLine = (label, value) => value ? `- **${label}:** ${value}` : null;

export const pushSecurityNotification = async (ownerUserId, { title, lines = [] }) => {
  const text = [
    `**${title}**`,
    '',
    ...lines.filter(Boolean)
  ].join('\n');

  return pushSystemBotMessage(ownerUserId, text);
};

const formatSecurityEventTime = (timeZone, value = new Date()) => {
  const candidate = String(timeZone || '').trim() || 'Europe/Moscow';
  const source = value instanceof Date ? value : new Date(value);
  const at = Number.isNaN(source.getTime()) ? new Date() : source;

  try {
    return at.toLocaleString('ru-RU', {
      hour12: false,
      timeZone: candidate
    });
  } catch {
    return at.toLocaleString('ru-RU', {
      hour12: false,
      timeZone: 'Europe/Moscow'
    });
  }
};

export const buildLoginNotificationLines = (meta = {}) => {
  const at = formatSecurityEventTime(meta.timeZone, meta.at);
  return [
    'В аккаунт выполнен вход.',
    '',
    formatMetaLine('Устройство', meta.deviceName),
    formatMetaLine('Тип', meta.deviceType),
    formatMetaLine('IP', meta.ipAddress),
    formatMetaLine('Время', at)
  ].filter(Boolean);
};

export const buildPasswordChangedLines = (meta = {}) => {
  const at = formatSecurityEventTime(meta.timeZone, meta.at);
  return [
    'Пароль аккаунта был изменён.',
    '',
    formatMetaLine('Устройство', meta.deviceName),
    formatMetaLine('Тип', meta.deviceType),
    formatMetaLine('IP', meta.ipAddress),
    formatMetaLine('Время', at)
  ].filter(Boolean);
};
