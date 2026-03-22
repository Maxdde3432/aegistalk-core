import fs from 'fs';

import { query } from '../db/index.js';

const mapUserRow = (user) => ({
  id: user.id,
  phone: user.phone,
  email: user.email,
  username: user.username,
  firstName: user.first_name,
  lastName: user.last_name,
  displayName:
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.display_name ||
    user.username ||
    user.phone ||
    'Пользователь',
  avatarUrl: user.avatar_url,
  isOnline: user.is_online,
  lastSeen: user.last_seen,
  isBot: user.is_bot,
  bio: user.bio || null,
  isContact: user.is_contact === true
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  let normalized = digits;
  if (normalized.startsWith('00') && normalized.length > 2) {
    normalized = normalized.slice(2);
  }
  if (normalized.length === 11 && normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.length === 10) {
    normalized = `7${normalized}`;
  }

  return normalized;
};

// ============================================================================
// GET ALL USERS
// ============================================================================
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;

    const result = await query(
       `SELECT u.id, u.phone, u.email, u.username, u.first_name, u.last_name, u.avatar_url, u.is_online, u.last_seen,
               COALESCE(is_bot, FALSE) AS is_bot
       FROM contacts c
       JOIN users u ON u.id = c.contact_user_id
       WHERE c.user_id = $1
         AND u.id != $1
         AND u.is_active = TRUE
       ORDER BY COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.phone), u.last_name`,
      [currentUserId]
    );

    const users = result.rows.map(mapUserRow);

    res.json(users);
  } catch (error) {
    console.error('[Users] GetAllUsers error:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
};

export const syncPhoneContacts = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];

    if (contacts.length === 0) {
      return res.json([]);
    }

    const phoneMap = new Map();
    const fullNumbers = new Set();
    const tailNumbers = new Set();

    for (const entry of contacts) {
      const contactName = String(entry?.name || '').trim();
      const phones = Array.isArray(entry?.phones) ? entry.phones : [];
      for (const phone of phones) {
        const normalized = normalizePhone(phone);
        if (!normalized) continue;

        if (!phoneMap.has(normalized)) {
          phoneMap.set(normalized, {
            name: contactName,
            phoneNumber: normalized
          });
        }

        fullNumbers.add(normalized);
        if (normalized.length >= 10) {
          tailNumbers.add(normalized.slice(-10));
        }
      }
    }

    if (fullNumbers.size === 0) {
      return res.json([]);
    }

    const result = await query(
      `SELECT u.id, u.phone, u.username, u.first_name, u.last_name, u.avatar_url, u.is_online,
              COALESCE(u.is_bot, FALSE) AS is_bot
       FROM users u
       WHERE u.id != $1
         AND u.is_active = TRUE
         AND COALESCE(u.phone, '') <> ''
         AND (
           REGEXP_REPLACE(u.phone, '\\D', '', 'g') = ANY($2::text[])
           OR RIGHT(REGEXP_REPLACE(u.phone, '\\D', '', 'g'), 10) = ANY($3::text[])
         )
       ORDER BY u.is_online DESC, u.first_name NULLS LAST, u.username NULLS LAST`,
      [currentUserId, [...fullNumbers], [...tailNumbers]]
    );

    const matches = [];
    const seenUserIds = new Set();

    for (const row of result.rows) {
      const normalizedPhone = normalizePhone(row.phone);
      const fallbackTail =
        normalizedPhone.length >= 10 ? normalizedPhone.slice(-10) : normalizedPhone;

      const localMatch =
        phoneMap.get(normalizedPhone) ||
        [...phoneMap.entries()]
          .find(([key]) => key.length >= 10 && key.slice(-10) === fallbackTail)?.[1];

      if (!localMatch || seenUserIds.has(row.id)) {
        continue;
      }

      seenUserIds.add(row.id);
      matches.push({
        userId: row.id,
        contactName: localMatch.name,
        appDisplayName:
          `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
          row.username ||
          'Пользователь',
        username: row.username,
        avatarUrl: row.avatar_url,
        isOnline: row.is_online === true,
        isBot: row.is_bot === true,
        phoneNumber: localMatch.phoneNumber
      });
    }

    return res.json(matches);
  } catch (error) {
    console.error('[Users] SyncPhoneContacts error:', error);
    return res.status(500).json({ error: 'Ошибка при синхронизации контактов' });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { id } = req.params;
    const normalizedId = typeof id === 'string' ? id.trim() : '';

    if (!normalizedId) {
      return res.status(400).json({ error: 'Missing user identifier' });
    }

    const result = await query(
      `SELECT u.id, u.phone, u.email, u.username, u.first_name, u.last_name,
              u.avatar_url, u.is_online, u.last_seen, u.bio,
              COALESCE(u.is_bot, FALSE) AS is_bot,
               EXISTS(
                 SELECT 1
                 FROM contacts c
                 WHERE c.user_id = $1
                   AND c.contact_user_id = u.id
               ) AS is_contact
        FROM users u
        WHERE (
            ($2::text <> '' AND u.id::text = $2::text)
            OR
            ($3::text <> '' AND LOWER(u.username) = LOWER($3::text))
          )
          AND u.is_active = TRUE
       LIMIT 1`,
      [
        currentUserId,
        UUID_PATTERN.test(normalizedId) ? normalizedId : '',
        UUID_PATTERN.test(normalizedId) ? '' : normalizedId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    return res.json(mapUserRow(result.rows[0]));
  } catch (error) {
    console.error('[Users] GetUserProfile error:', error);
    return res.status(500).json({ error: 'Ошибка при получении профиля пользователя' });
  }
};

export const addContact = async (req, res) => {
  try {
    const userId = req.userId;
    const { id: contactUserId } = req.params;

    if (!contactUserId || contactUserId === userId) {
      return res.status(400).json({ error: 'Нельзя добавить себя в контакты' });
    }

    const target = await query(
      `SELECT id FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [contactUserId]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await query(
      `INSERT INTO contacts (user_id, contact_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, contact_user_id)
       DO NOTHING`,
      [userId, contactUserId]
    );

    return res.json({ success: true, isContact: true });
  } catch (error) {
    console.error('[Users] AddContact error:', error);
    return res.status(500).json({ error: 'Ошибка при добавлении контакта' });
  }
};

export const removeContact = async (req, res) => {
  try {
    const userId = req.userId;
    const { id: contactUserId } = req.params;

    await query(
      `DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2`,
      [userId, contactUserId]
    );

    return res.json({ success: true, isContact: false });
  } catch (error) {
    console.error('[Users] RemoveContact error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении контакта' });
  }
};

// ============================================================================
// UPLOAD AVATAR
// ============================================================================
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const fileData = fs.readFileSync(req.file.path);
    const base64Data = fileData.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    console.log('[Users] UploadAvatar:', {
      userId,
      mimeType,
      fileSize: req.file.size,
      dataUrlLength: dataUrl.length,
      dataUrlPreview: `${dataUrl.slice(0, 50)}...`,
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.error('[Users] Failed to delete temp file:', unlinkError);
    }

    await query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
      [dataUrl, userId]
    );

    console.log('[Users] Avatar saved to DB for user:', userId);

    return res.json({
      message: 'Аватар загружен',
      avatarUrl: dataUrl,
    });
  } catch (error) {
    console.error('[Users] UploadAvatar error:', error);

    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[Users] Failed to delete temp file after error:', unlinkError);
      }
    }

    return res.status(500).json({ error: 'Ошибка при загрузке аватара' });
  }
};

// ============================================================================
// REMOVE AVATAR
// ============================================================================
export const removeAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    await query(
      `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    res.json({ message: 'Аватар удалён' });
  } catch (error) {
    console.error('[Users] RemoveAvatar error:', error);
    res.status(500).json({ error: 'Ошибка при удалении аватара' });
  }
};

// ============================================================================
// SEARCH USERS
// ============================================================================
export const searchUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { q } = req.query;

    const rawQueryText = typeof q === 'string' ? q.trim() : '';
    const queryText = rawQueryText.startsWith('@')
      ? rawQueryText.slice(1).trim()
      : rawQueryText;

    if (!queryText || queryText.length < 2) {
      return res.json([]);
    }

    const searchPattern = `%${queryText}%`;
    const prefixPattern = `${queryText}%`;
    const normalizedUsername = queryText.toLowerCase();

    const result = await query(
      `SELECT id, username, first_name, last_name, avatar_url, is_online, last_seen,
              COALESCE(is_bot, FALSE) AS is_bot
       FROM users
       WHERE id != $1
         AND is_active = TRUE
         AND (
           username ILIKE $2 OR
           first_name ILIKE $2 OR
           last_name ILIKE $2 OR
           CONCAT_WS(' ', first_name, last_name) ILIKE $2
         )
       ORDER BY
         CASE
           WHEN LOWER(username) = $4 THEN 0
           WHEN username ILIKE $3 THEN 1
           WHEN first_name ILIKE $3 THEN 2
           WHEN last_name ILIKE $3 THEN 3
           WHEN CONCAT_WS(' ', first_name, last_name) ILIKE $3 THEN 4
           ELSE 5
         END,
         username NULLS LAST,
         first_name NULLS LAST,
         last_name NULLS LAST
       LIMIT 20`,
      [currentUserId, searchPattern, prefixPattern, normalizedUsername]
    );

    const users = result.rows.map(mapUserRow);

    res.json(users);
  } catch (error) {
    console.error('[Users] SearchUsers error:', error);
    res.status(500).json({ error: 'Ошибка при поиске пользователей' });
  }
};
