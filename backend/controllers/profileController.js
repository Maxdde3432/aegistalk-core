import { query } from '../db/index.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { userSockets } from '../server.js';
import { sendVerificationCode, generateCode } from '../utils/emailService.js';

const resolveEmailDeliveryError = (error, fallbackMessage) => {
  const message = String(error?.message || '');

  if (message.includes('You can only send testing emails to your own email address')) {
    return {
      status: 502,
      error: 'Почта не настроена: Resend в тестовом режиме разрешает отправку только на адрес владельца. Подтвердите домен в Resend и укажите EMAIL_FROM на этом домене.'
    };
  }

  if (message.includes('Ошибка отправки email:')) {
    return {
      status: 502,
      error: message
    };
  }

  return {
    status: 500,
    error: fallbackMessage
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// GET PROFILE - Получить данные текущего пользователя
// ============================================================================
export const getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT id, phone, email, username, first_name, last_name,
              avatar_url, bio, public_key, is_online, last_seen, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      publicKey: user.public_key,
      isOnline: user.is_online,
      lastSeen: user.last_seen,
      createdAt: user.created_at
    });

  } catch (error) {
    console.error('[Profile] GetProfile error:', error);
    res.status(500).json({ error: 'Ошибка при получении профиля' });
  }
};

// ============================================================================
// UPDATE PROFILE - Обновить данные профиля
// ============================================================================
export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { firstName, lastName, username, bio } = req.body;

    // Проверяем уникальность username если он передан
    if (username) {
      const existingUser = await query(
        `SELECT id FROM users WHERE username = $1 AND id != $2`,
        [username, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Это имя пользователя уже занято' });
      }
    }

    // Формируем динамический UPDATE запрос
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount}`);
      values.push(firstName?.trim() || null);
      paramCount++;
    }

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount}`);
      values.push(lastName?.trim() || null);
      paramCount++;
    }

    if (username !== undefined) {
      updates.push(`username = $${paramCount}`);
      values.push(username?.trim() || null);
      paramCount++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio?.trim() || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Добавляем updated_at
    updates.push(`updated_at = NOW()`);

    // Добавляем WHERE параметры
    values.push(userId);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, first_name, last_name, bio, avatar_url`,
      values
    );

    const user = result.rows[0];

    // Отправляем WebSocket событие ВСЕМ подключенным клиентам
    try {
      const wss = req.app.get('wss');

      if (wss && wss.clients) {
        const eventData = {
          type: 'user_updated',
          userId: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url
        };

        console.log('[Profile] 📡 Broadcasting user_updated to ALL clients:', eventData);

        let sentCount = 0;
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(eventData));
            sentCount++;
          }
        });

        console.log('[Profile] ✅ Broadcast complete - sent to', sentCount, 'clients');
      }
    } catch (wsError) {
      console.error('[Profile] ❌ Failed to send WebSocket event:', wsError);
    }

    res.json({
      message: 'Профиль обновлён',
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        bio: user.bio,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('[Profile] UpdateProfile error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении профиля' });
  }
};

// ============================================================================
// REQUEST EMAIL CHANGE - Отправить код подтверждения на новый email
// ============================================================================
export const requestEmailChange = async (req, res) => {
  try {
    const userId = req.userId;
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await query(
      `SELECT email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const currentEmail = userResult.rows[0].email?.toLowerCase();
    if (currentEmail === normalizedEmail) {
      return res.status(400).json({ error: 'Указан текущий email' });
    }

    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [normalizedEmail, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Этот email уже используется' });
    }

    await query(
      `DELETE FROM email_verifications
       WHERE user_id = $1 AND purpose = 'email_change' AND used = FALSE`,
      [userId]
    );

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO email_verifications (user_id, email, code, purpose, expires_at, created_at)
       VALUES ($1, $2, $3, 'email_change', $4, NOW())`,
      [userId, normalizedEmail, code, expiresAt]
    );

    await sendVerificationCode(normalizedEmail, code, 'email_change');

    res.json({
      message: 'Код подтверждения отправлен на новый email',
      email: normalizedEmail,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('[Profile] RequestEmailChange error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка при отправке кода подтверждения');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

// ============================================================================
// CONFIRM EMAIL CHANGE - Подтвердить код и обновить email
// ============================================================================
export const confirmEmailChange = async (req, res) => {
  try {
    const userId = req.userId;
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Требуются email и код подтверждения' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [normalizedEmail, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Этот email уже используется' });
    }

    const verificationResult = await query(
      `SELECT id, code, expires_at, used
       FROM email_verifications
       WHERE user_id = $1 AND email = $2 AND purpose = 'email_change'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, normalizedEmail]
    );

    if (verificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Код подтверждения не найден' });
    }

    const verification = verificationResult.rows[0];

    if (verification.used) {
      return res.status(400).json({ error: 'Код уже был использован' });
    }

    if (new Date() > verification.expires_at) {
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    if (String(code).trim() !== String(verification.code)) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    await query(
      `UPDATE email_verifications SET used = TRUE, used_at = NOW() WHERE id = $1`,
      [verification.id]
    );

    const updateResult = await query(
      `UPDATE users
       SET email = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, username, first_name, last_name, avatar_url, bio`,
      [normalizedEmail, userId]
    );

    const user = updateResult.rows[0];

    res.json({
      message: 'Email успешно изменён',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('[Profile] ConfirmEmailChange error:', error);
    res.status(500).json({ error: 'Ошибка при смене email' });
  }
};

// ============================================================================
// UPLOAD AVATAR - Загрузить аватар
// ============================================================================
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не найден' });
    }

    // Проверяем тип файла
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Недопустимый формат файла. Разрешены: JPEG, PNG, GIF, WebP' });
    }

    // Проверяем размер (макс 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: 'Файл слишком большой. Максимум 5MB' });
    }

    // Конвертируем файл в base64 data URL
    const base64Data = req.file.buffer.toString('base64');
    const avatarUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    console.log('[Profile] Converted avatar to base64, length:', avatarUrl.length);

    // Обновляем запись в БД
    await query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
      [avatarUrl, userId]
    );

    console.log('[Profile] Avatar saved to database');

    // Отправляем WebSocket событие ВСЕМ релевантным пользователям
    try {
      const wss = req.app.get('wss');
      
      if (wss && wss.clients) {
        // Находим релевантных пользователей
        const relevantUserIds = new Set();
        relevantUserIds.add(userId);
        
        const chatsResult = await query(
          `SELECT c.id, c.type, c.user1_id, c.user2_id, c.group_id
           FROM chats c
           WHERE c.user1_id = $1 OR c.user2_id = $1 OR c.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = $1 AND is_active = TRUE
           )`,
          [userId]
        );
        
        for (const chat of chatsResult.rows) {
          if (chat.type === 'private') {
            const otherUserId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;
            if (otherUserId) relevantUserIds.add(otherUserId);
          } else if (chat.type === 'group' || chat.type === 'channel') {
            const membersResult = await query(
              `SELECT user_id FROM group_members 
               WHERE group_id = $1 AND is_active = TRUE AND user_id != $2`,
              [chat.group_id, userId]
            );
            for (const member of membersResult.rows) {
              relevantUserIds.add(member.user_id);
            }
          }
        }
        
        const eventData = {
          type: 'user_updated',
          userId,
          firstName: null,
          lastName: null,
          avatarUrl
        };
        
        console.log('[Profile] 📡 Sending avatar update to', relevantUserIds.size, 'relevant users');

        let sentCount = 0;
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            let shouldSend = false;
            for (const [connectedUserId, userInfo] of userSockets.entries()) {
              if (userInfo.socket === client && relevantUserIds.has(connectedUserId)) {
                shouldSend = true;
                break;
              }
            }

            if (shouldSend) {
              client.send(JSON.stringify(eventData));
              sentCount++;
            }
          }
        });

        console.log('[Profile] ✅ Avatar update sent to', sentCount, 'clients');
      }
    } catch (wsError) {
      console.error('[Profile] ❌ Failed to send WebSocket event:', wsError);
    }

    res.json({
      message: 'Аватар загружен',
      avatarUrl
    });

  } catch (error) {
    console.error('[Profile] UploadAvatar error:', error);
    res.status(500).json({ error: 'Ошибка при загрузке аватара' });
  }
};

// ============================================================================
// REMOVE AVATAR - Удалить аватар
// ============================================================================
export const removeAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    // Получаем текущий аватар
    const result = await query(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [userId]
    );

    const avatarUrl = result.rows[0]?.avatar_url;

    if (avatarUrl && avatarUrl.startsWith('/uploads/avatars/')) {
      // Удаляем файл
      const fileName = avatarUrl.replace('/uploads/avatars/', '');
      const avatarPath = path.join(__dirname, '..', 'uploads', 'avatars', fileName);
      
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
        console.log('[Profile] Deleted avatar file:', avatarPath);
      }
    }

    // Обновляем запись в БД
    await query(
      `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    // Отправляем WebSocket событие
    try {
      const { sendToUser } = await import('../server.js');
      if (typeof sendToUser === 'function') {
        sendToUser(userId, {
          type: 'user_updated',
          userId,
          user: {
            id: userId,
            avatarUrl: null
          }
        });
        console.log('[Profile] 📡 Sent user_updated event (avatar removed) to user:', userId);
      }
    } catch (wsError) {
      console.error('[Profile] ❌ Failed to send WebSocket event:', wsError);
    }

    res.json({ message: 'Аватар удалён' });

  } catch (error) {
    console.error('[Profile] RemoveAvatar error:', error);
    res.status(500).json({ error: 'Ошибка при удалении аватара' });
  }
};

// ============================================================================
// DELETE ACCOUNT - Деактивировать аккаунт текущего пользователя
// ============================================================================
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Требуется пароль для подтверждения удаления' });
    }

    const result = await query(
      `SELECT id, password_hash FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    // Деактивируем пользователя и очищаем чувствительные данные профиля
    await query(
      `UPDATE users
       SET is_active = FALSE,
           avatar_url = NULL,
           bio = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Удаляем все активные сессии пользователя
    await query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );

    res.json({
      message: 'Аккаунт деактивирован и все активные сессии завершены'
    });
  } catch (error) {
    console.error('[Profile] DeleteAccount error:', error);
    res.status(500).json({ error: 'Ошибка при удалении аккаунта' });
  }
};
