import { query } from '../db/index.js';
import { generateOTP, sendVerificationEmail } from '../services/emailService.js';

const VERIFICATION_RESEND_COOLDOWN_SECONDS = 180;

const getVerificationRetryAfter = (createdAt) => {
  const sentAtMs = new Date(createdAt).getTime();

  if (!Number.isFinite(sentAtMs)) {
    return VERIFICATION_RESEND_COOLDOWN_SECONDS;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - sentAtMs) / 1000));
  return Math.max(0, Math.min(VERIFICATION_RESEND_COOLDOWN_SECONDS, VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds));
};

// ============================================================================
// SEND VERIFICATION CODE - Отправить код подтверждения на email
// ============================================================================
export const sendVerificationCode = async (req, res) => {
  try {
    const userId = req.userId;
    const { email, purpose } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    const validPurposes = ['registration', 'email_change', '2fa'];
    const codePurpose = purpose || 'registration';

    if (!validPurposes.includes(codePurpose)) {
      return res.status(400).json({ error: 'Неверный тип верификации' });
    }

    // Проверка: не занята ли эта почта (для регистрации)
    if (codePurpose === 'registration') {
      const existingUser = await query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
      }
    }

    // Проверка rate limiting: не больше 3 кодов в час на email
    const rateLimitCheck = await query(
      `SELECT COUNT(*) as count 
       FROM email_verifications 
       WHERE email = $1 
       AND purpose = $2 
       AND created_at > NOW() - INTERVAL '1 hour' 
       AND used = FALSE`,
      [email, codePurpose]
    );

    if (parseInt(rateLimitCheck.rows[0].count) >= 3) {
      return res.status(429).json({ 
        error: 'Слишком много запросов. Попробуйте через час',
        retryAfter: 3600 
      });
    }

    // Генерация кода
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Сохранение кода в БД
    const result = await query(
      `INSERT INTO email_verifications (user_id, email, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId || null, email, code, codePurpose, expiresAt]
    );

    // Отправка email (в фоне, без await - не ждём завершения)
    sendVerificationEmail(email, code, codePurpose)
      .then((result) => {
        if (result.success) {
          console.log('[Email] Verification code sent:', email);
        } else {
          console.error('[Email] Failed to send:', result.error);
        }
      })
      .catch((err) => {
        console.error('[Email] Send error:', err);
      });

    // Очистка старых неиспользованных кодов
    await query(
      `DELETE FROM email_verifications 
       WHERE email = $1 
       AND purpose = $2 
       AND (used = TRUE OR expires_at < NOW())`,
      [email, codePurpose]
    );

    res.json({
      message: 'Код отправлен на email',
      expiresAt: expiresAt.toISOString(),
      codeId: result.rows[0].id
    });

  } catch (error) {
    console.error('[Verification] SendCode error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ============================================================================
// VERIFY CODE - Проверить код подтверждения
// ============================================================================
export const verifyCode = async (req, res) => {
  try {
    const { email, code, purpose } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Требуется email и код' });
    }

    const validPurposes = ['registration', 'email_change', '2fa'];
    const codePurpose = purpose || 'registration';

    if (!validPurposes.includes(codePurpose)) {
      return res.status(400).json({ error: 'Неверный тип верификации' });
    }

    // Поиск кода в БД
    const result = await query(
      `SELECT id, user_id, code, expires_at, attempt_count, used
       FROM email_verifications
       WHERE email = $1 
       AND purpose = $2 
       AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, codePurpose]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Код не найден' });
    }

    const verification = result.rows[0];

    // Проверка: не использован ли код
    if (verification.used) {
      return res.status(400).json({ error: 'Код уже был использован' });
    }

    // Проверка: не истёк ли код
    if (new Date() > verification.expires_at) {
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    // Проверка: не больше 5 попыток
    if (verification.attempt_count >= 5) {
      return res.status(400).json({ error: 'Слишком много попыток. Запросите новый код' });
    }

    // Проверка кода
    if (verification.code !== code) {
      // Увеличиваем счётчик попыток
      await query(
        `UPDATE email_verifications SET attempt_count = attempt_count + 1 WHERE id = $1`,
        [verification.id]
      );

      return res.status(400).json({ 
        error: 'Неверный код',
        attemptsLeft: 5 - verification.attempt_count - 1
      });
    }

    // Код верный - помечаем как использованный
    await query(
      `UPDATE email_verifications 
       SET used = TRUE, used_at = NOW() 
       WHERE id = $1`,
      [verification.id]
    );

    res.json({
      message: 'Код подтверждён',
      verified: true,
      userId: verification.user_id
    });

  } catch (error) {
    console.error('[Verification] VerifyCode error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ============================================================================
// RESEND CODE - Повторная отправка кода
// ============================================================================
export const resendCode = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Требуется email' });
    }

    const codePurpose = purpose || 'registration';

    // Проверка: был ли отправлен код ранее
    const lastCode = await query(
      `SELECT id, created_at, attempt_count 
       FROM email_verifications 
       WHERE email = $1 
       AND purpose = $2 
       AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, codePurpose]
    );

    if (lastCode.rows.length === 0) {
      return res.status(404).json({ error: 'Сначала запросите код' });
    }

    // Cooldown: 3 минуты между запросами
    const retryAfter = getVerificationRetryAfter(lastCode.rows[0].created_at);

    if (retryAfter > 0) {
      return res.status(429).json({ 
        error: `Повторная отправка доступна через ${retryAfter} сек`,
        retryAfter
      });
    }

    // Генерация нового кода
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Обновление существующего кода (или создание нового)
    await query(
      `UPDATE email_verifications 
       SET code = $1, expires_at = $2, created_at = NOW(), attempt_count = 0
       WHERE id = $3`,
      [code, expiresAt, lastCode.rows[0].id]
    );

    // Отправка email (в фоне, без await - не ждём завершения)
    sendVerificationEmail(email, code, codePurpose)
      .then((result) => {
        if (result.success) {
          console.log('[Email] Verification code resent:', email);
        } else {
          console.error('[Email] Failed to resend:', result.error);
        }
      })
      .catch((err) => {
        console.error('[Email] Resend error:', err);
      });

    res.json({
      message: 'Код отправлен повторно',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('[Verification] ResendCode error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};
