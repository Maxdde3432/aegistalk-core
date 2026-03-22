import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { sendVerificationCode, generateCode, sendGoogleWelcomeEmail } from '../utils/emailService.js';
import { ensureBotChat, ensureFavoritesChat } from './chatController.js';
import {
  notifyLoginThroughAegisBot,
  notifyPasswordChangedThroughAegisBot
} from './botPlatformController.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-key-for-production-use-env-var';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/google';
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 180;
const ONBOARDING_BACKFILL_CUTOFF = '2026-03-18 00:00:00';

let onboardingSchemaPromise = null;

const ensureOnboardingSchema = async () => {
  if (!onboardingSchemaPromise) {
    onboardingSchemaPromise = (async () => {
      const userTriggers = await query(`
        SELECT
          n.nspname AS schema_name,
          p.proname AS function_name,
          pg_get_functiondef(p.oid) AS function_def
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE c.relname = 'users'
          AND NOT t.tgisinternal
      `);

      for (const triggerRow of userTriggers.rows) {
        const functionDef = String(triggerRow.function_def || '');
        if (!/last_active_at/i.test(functionDef)) {
          continue;
        }

        await query(`
          CREATE OR REPLACE FUNCTION ${triggerRow.schema_name}.${triggerRow.function_name}()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `);
      }

      await query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP
      `);
    })().catch((error) => {
      onboardingSchemaPromise = null;
      throw error;
    });
  }

  return onboardingSchemaPromise;
};

const getVerificationRetryAfter = (createdAt) => {
  const sentAtMs = new Date(createdAt).getTime();

  if (!Number.isFinite(sentAtMs)) {
    return VERIFICATION_RESEND_COOLDOWN_SECONDS;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - sentAtMs) / 1000));
  return Math.max(0, Math.min(VERIFICATION_RESEND_COOLDOWN_SECONDS, VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds));
};

// Генерация JWT токенов
// sessionId добавляем для управления активными сессиями (выход из конкретного устройства и т.д.)
const generateTokens = (userId, sessionId = null) => {
  const payload = sessionId ? { userId, sessionId } : { userId };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

  return { accessToken, refreshToken };
};

// xеширование refresh токена для хранения в БД
const hashRefreshToken = async (token) => {
  return await bcrypt.hash(token, 10);
};

// Проверка refresh токена
const verifyRefreshToken = async (token, storedHash) => {
  return await bcrypt.compare(token, storedHash);
};

const resolveClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const candidate = typeof raw === 'string' ? raw.split(',')[0].trim() : '';

  const ip = candidate || req.ip || req.connection?.remoteAddress || '';
  // Express может вернуть IPv6-mapped IPv4 (::ffff:127.0.0.1)
  return String(ip).replace(/^::ffff:/, '');
};

const resolveUserAgent = (req) => {
  return String(req.headers['user-agent'] || '').slice(0, 500);
};

const deriveDeviceInfoFromUserAgent = (userAgent) => {
  const ua = String(userAgent || '');

  // Browser
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  // OS
  let os = 'Unknown OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Device type
  let deviceType = 'desktop';
  if (/iPad/i.test(ua) || /Tablet/i.test(ua)) deviceType = 'tablet';
  else if (/Mobi/i.test(ua) || /Android/i.test(ua) || /iPhone|iPod/i.test(ua)) deviceType = 'mobile';

  return {
    deviceName: `${browser} on ${os}`,
    deviceType
  };
};

const DEFAULT_CLIENT_TIMEZONE = 'Europe/Moscow';
const APP_FRONTEND_CALLBACK_URL = process.env.APP_GOOGLE_FRONTEND_CALLBACK_URL || 'aegistalk://auth/google/callback';

const normalizeGoogleClientMode = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return candidate === 'native' ? 'native' : 'web';
};

const normalizeClientTimezone = (value) => {
  const candidate = String(value || '').trim();

  if (!candidate) {
    return DEFAULT_CLIENT_TIMEZONE;
  }

  try {
    Intl.DateTimeFormat('ru-RU', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_CLIENT_TIMEZONE;
  }
};

const resolveClientTimezone = (req, fallback = DEFAULT_CLIENT_TIMEZONE) => {
  const headerValue = req.headers['x-timezone'];
  const queryValue = req.query?.tz;
  const rawValue = Array.isArray(headerValue) ? headerValue[0] : (headerValue || queryValue || fallback);
  return normalizeClientTimezone(rawValue || fallback);
};

const resolveSessionMeta = (req, overrides = {}) => {
  const userAgent = resolveUserAgent(req);
  const ipAddress = resolveClientIp(req);
  const derived = deriveDeviceInfoFromUserAgent(userAgent);
  const timeZone = normalizeClientTimezone(overrides.timeZone || resolveClientTimezone(req));

  return {
    at: overrides.at || new Date(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    deviceName: derived.deviceName,
    deviceType: derived.deviceType,
    timeZone
  };
};

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

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'owner', 'mod', 'moderator',
  'support', 'help', 'security', 'settings', 'profile', 'system',
  'user', 'users', 'me', 'id', 'bot', 'official', 'team',
  'aegistalk', 'aegis', 'aethel'
]);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeUsername = (username) => String(username || '')
  .trim()
  .replace(/^@+/, '')
  .toLowerCase();

const validateUsername = (username) => {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return { valid: true, normalized: '' };
  }

  if (normalized.length < 5 || normalized.length > 32) {
    return { valid: false, normalized, error: 'Username должен быть от 5 до 32 символов' };
  }

  if (!/^[a-z][a-z0-9_]*[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Username может содержать только латинские буквы, цифры и _, начинаться с буквы и не заканчиваться _'
    };
  }

  if (normalized.includes('__')) {
    return { valid: false, normalized, error: 'Username не должен содержать подряд два символа _' };
  }

  if (RESERVED_USERNAMES.has(normalized)) {
    return { valid: false, normalized, error: 'Этот username зарезервирован' };
  }

  return { valid: true, normalized };
};

const resolveOnboardingCompletedAt = (user) => {
  if (user?.onboarding_completed_at) {
    return user.onboarding_completed_at;
  }

  const createdAtMs = new Date(user?.created_at || 0).getTime();
  const cutoffMs = new Date(ONBOARDING_BACKFILL_CUTOFF).getTime();

  if (Number.isFinite(createdAtMs) && Number.isFinite(cutoffMs) && createdAtMs < cutoffMs) {
    return user?.created_at || new Date(cutoffMs).toISOString();
  }

  return null;
};

const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  firstName: user.first_name,
  lastName: user.last_name,
  avatarUrl: user.avatar_url,
  bio: user.bio,
  publicKey: user.public_key,
  isOnline: user.is_online,
  lastSeen: user.last_seen,
  createdAt: user.created_at,
  onboardingCompletedAt: resolveOnboardingCompletedAt(user)
});

const fetchUserById = async (userId) => {
  await ensureOnboardingSchema();

  const result = await query(
    `SELECT id, phone, email, username, first_name, last_name,
            avatar_url, bio, public_key, is_online, last_seen, created_at, onboarding_completed_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0] || null;
};

let lastSessionsCleanupAt = 0;
const cleanupOldSessionsIfNeeded = async () => {
  const now = Date.now();
  if (now - lastSessionsCleanupAt < 6 * 60 * 60 * 1000) return; // at most once per 6h per process
  lastSessionsCleanupAt = now;

  try {
    await query(
      `DELETE FROM sessions
       WHERE COALESCE(last_active_at, created_at) < NOW() - (30 * INTERVAL '1 day')`
    );
  } catch (error) {
    console.warn('[Auth] cleanupOldSessionsIfNeeded error:', error);
  }
};

const normalizeInet = (value) => {
  if (!value) return null;
  const first = String(value).split(',')[0].trim();
  // Handle "1.2.3.4:12345" from some proxies; inet doesn't accept the port.
  if (/^\\d{1,3}(?:\\.\\d{1,3}){3}:\\d+$/.test(first)) return first.split(':')[0];
  return first || null;
};

const createAuthSession = async (userId, meta = {}) => {
  await cleanupOldSessionsIfNeeded();

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const deviceName = meta.deviceName || 'Web Browser';
  const deviceType = meta.deviceType || 'desktop';
  const ipAddress = normalizeInet(meta.ipAddress);
  const userAgent = meta.userAgent || null;

  // Prevent session spam: reuse an existing session for the same browser/device.
  let existingSessionId = null;
  if (userAgent) {
    const existing = await query(
      `SELECT id
       FROM sessions
       WHERE user_id = $1 AND user_agent = $2 AND device_type = $3 AND expires_at > NOW()
       ORDER BY last_active_at DESC
       LIMIT 1`,
      [userId, userAgent, deviceType]
    );
    existingSessionId = existing.rows[0]?.id || null;
  }

  const sessionId = existingSessionId || uuidv4();
  const { accessToken, refreshToken } = generateTokens(userId, sessionId);
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  if (existingSessionId) {
    await query(
      `UPDATE sessions
       SET refresh_token_hash = $1,
           expires_at = $2,
           last_active_at = NOW(),
           device_name = $3,
           device_type = $4,
           ip_address = $5,
           user_agent = $6
       WHERE id = $7 AND user_id = $8`,
      [refreshTokenHash, expiresAt, deviceName, deviceType, ipAddress, userAgent, sessionId, userId]
    );

    // Drop duplicates for the same browser fingerprint.
    await query(
      `DELETE FROM sessions
       WHERE user_id = $1 AND user_agent = $2 AND device_type = $3 AND id <> $4`,
      [userId, userAgent, deviceType, sessionId]
    );
  } else {
    await query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, device_name, device_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, userId, refreshTokenHash, expiresAt, deviceName, deviceType, ipAddress, userAgent]
    );
  }

  return { accessToken, refreshToken, sessionId };
};

const completeAuth = async (userId, meta = {}) => {
  const user = await fetchUserById(userId);

  if (!user) {
    throw new Error('Пользователь не найден после авторизации');
  }

  const tokens = await createAuthSession(userId, meta);
  void notifyLoginThroughAegisBot(userId, meta);

  return {
    ...tokens,
    user: serializeUser(user)
  };
};

const generateGooglePasswordSetupToken = (userId) => jwt.sign(
  { userId, step: 'google_password_setup' },
  JWT_SECRET,
  { expiresIn: '20m' }
);

const slugifyUsername = (value) => {
  const fallback = `user${Math.floor(1000 + Math.random() * 9000)}`;
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return base || fallback;
};

const ensureUniqueUsername = async (rawValue) => {
  const base = slugifyUsername(rawValue);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const existing = await query(
      `SELECT id FROM users WHERE username = $1`,
      [candidate]
    );

    if (existing.rows.length === 0) {
      return candidate;
    }
  }

  return `${base}_${Date.now().toString().slice(-6)}`;
};

const buildGoogleCallbackState = (
  nextPath = '/chat',
  timeZone = DEFAULT_CLIENT_TIMEZONE,
  clientMode = 'web'
) => jwt.sign(
  {
    nextPath: nextPath.startsWith('/') ? nextPath : '/chat',
    timeZone: normalizeClientTimezone(timeZone),
    clientMode: normalizeGoogleClientMode(clientMode)
  },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const parseGoogleCallbackState = (value) => {
  if (!value) {
    return { nextPath: '/chat', timeZone: DEFAULT_CLIENT_TIMEZONE, clientMode: 'web' };
  }

  try {
    const decoded = jwt.verify(value, JWT_SECRET);
    return {
      nextPath: typeof decoded?.nextPath === 'string' && decoded.nextPath.startsWith('/')
        ? decoded.nextPath
        : '/chat',
      timeZone: normalizeClientTimezone(decoded?.timeZone),
      clientMode: normalizeGoogleClientMode(decoded?.clientMode)
    };
  } catch {
    return { nextPath: '/chat', timeZone: DEFAULT_CLIENT_TIMEZONE, clientMode: 'web' };
  }
};

const buildFrontendAuthRedirect = ({
  accessToken,
  refreshToken,
  error,
  nextPath = '/chat',
  extraHash = {},
  clientMode = 'web'
}) => {
  const callbackBase = normalizeGoogleClientMode(clientMode) === 'native'
    ? APP_FRONTEND_CALLBACK_URL
    : `${FRONTEND_URL}/auth/google/callback`;

  if (error) {
    return `${callbackBase}?error=${encodeURIComponent(error)}`;
  }

  const hash = new URLSearchParams({
    accessToken,
    refreshToken,
    next: nextPath,
    ...Object.fromEntries(
      Object.entries(extraHash).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )
  }).toString();

  return `${callbackBase}#${hash}`;
};

/**
 * Для native-клиентов (Flutter) вместо HTTP 302 redirect на custom scheme (aegistalk://)
 * отдаём HTML-страницу с JavaScript redirect. Chrome Custom Tabs не всегда корректно
 * обрабатывает 302 redirect на custom scheme, но JavaScript window.location.href
 * надёжно триггерит intent-filter в AndroidManifest.
 */
const sendNativeRedirectHtml = (res, redirectUrl) => {
  const safeUrl = JSON.stringify(redirectUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AegisTalk</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #050816;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    }
    .container { padding: 24px; }
    .spinner {
      width: 40px; height: 40px; margin: 0 auto 16px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 16px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Возвращаемся в приложение…</p>
  </div>
  <script>window.location.href = ${safeUrl};</script>
</body>
</html>`);
};

const exchangeGoogleCode = async (code) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code'
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    console.error('[Auth] Google token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      payload,
      callbackUrl: GOOGLE_CALLBACK_URL,
      clientConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      clientIdSuffix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.slice(-12) : '(missing)'
    });

    throw new Error(
      payload?.error_description ||
      payload?.error ||
      `Google token exchange failed with status ${response.status}`
    );
  }

  return payload;
};

const fetchGoogleUserInfo = async (accessToken) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || 'Не удалось получить профиль Google');
  }

  return payload;
};

const findOrCreateGoogleUser = async (profile) => {
  await ensureOnboardingSchema();

  if (!profile?.sub || !profile?.email) {
    throw new Error('Google не вернул обязательные данные профиля');
  }

  if (profile.email_verified === false) {
    throw new Error('В Google-аккаунте должен быть подтверждён email');
  }

  const existing = await query(
    `SELECT id, email, username, first_name, last_name, avatar_url, google_id, password_hash
     FROM users
     WHERE google_id = $1 OR email = $2
     ORDER BY CASE WHEN google_id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [profile.sub, profile.email]
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];

    await query(
      `UPDATE users
       SET google_id = COALESCE(google_id, $1),
           email = $2,
           first_name = COALESCE(first_name, $3),
           last_name = COALESCE(last_name, $4),
           avatar_url = COALESCE(avatar_url, $5),
           updated_at = NOW()
       WHERE id = $6`,
      [profile.sub, profile.email, profile.given_name || null, profile.family_name || null, profile.picture || null, user.id]
    );

    return {
      userId: user.id,
      isNewUser: false,
      needsPasswordSetup: !user.password_hash,
      email: profile.email,
      firstName: user.first_name || profile.given_name || profile.name || user.username || null
    };
  }

  const username = await ensureUniqueUsername(
    profile.email?.split('@')[0] || profile.given_name || profile.name || 'google_user'
  );

  const inserted = await query(
    `INSERT INTO users (
      id, email, username, password_hash, first_name, last_name, avatar_url, google_id, is_active
    ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, TRUE)
    RETURNING id`,
    [
      uuidv4(),
      profile.email,
      username,
      profile.given_name || profile.name || username,
      profile.family_name || null,
      profile.picture || null,
      profile.sub
    ]
  );

  return {
    userId: inserted.rows[0].id,
    isNewUser: true,
    needsPasswordSetup: true,
    email: profile.email,
    firstName: profile.given_name || profile.name || username
  };
};

// ============================================================================
// REGISTER - Шаг 1: Отправка кода на email (без создания пользователя)
// ============================================================================
export const register = async (req, res) => {
  try {
    let { email, username, password, firstName, lastName, publicKey, publicKeySignature } = req.body;
    email = normalizeEmail(email);
    const usernameValidation = validateUsername(username || '');
    username = usernameValidation.normalized || null;

    // Валидация
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Требуется корректный email'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        error: 'Пароль должен быть не менее 8 символов'
      });
    }

    if (!publicKey || !publicKeySignature) {
      return res.status(400).json({
        error: 'Требуется публичный ключ для шифрования'
      });
    }

    if (!usernameValidation.valid) {
      return res.status(400).json({
        error: usernameValidation.error
      });
    }

    if (username) {
      const existingUsername = await query(
        `SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1`,
        [username]
      );

      if (existingUsername.rows.length > 0) {
        return res.status(409).json({
          error: 'Этот username уже занят'
        });
      }
    }

    // Проверка email на существование
    const existingUser = await query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Пользователь с таким email уже существует'
      });
    }

    // Проверка: есть ли уже неподтверждённая регистрация на этот email
    const pendingVerification = await query(
      `SELECT id, created_at FROM email_verifications 
       WHERE email = $1 AND purpose = 'registration' AND used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    // Cooldown: 3 минуты между запросами
    if (pendingVerification.rows.length > 0) {
      const retryAfter = getVerificationRetryAfter(pendingVerification.rows[0].created_at);

      if (retryAfter > 0) {
        return res.status(429).json({
          error: `Повторная отправка доступна через ${retryAfter} сек`,
          retryAfter
        });
      }
    }

    // Генерация 6-значного кода
    const buffer = crypto.randomBytes(3);
    const codeNumber = buffer.readUIntBE(0, 3) % 1000000;
    const verificationCode = codeNumber.toString().padStart(6, '0');

    // Сохранение кода верификации + данных пользователя
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Сначала удаляем старые неиспользованные коды для этого email
    await query(
      `DELETE FROM email_verifications WHERE email = $1 AND purpose = 'registration' AND used = FALSE`,
      [email]
    );
    
    // Вставляем новый код
    await query(
      `INSERT INTO email_verifications 
       (email, code, purpose, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [email, verificationCode, 'registration', expiresAt]
    );

    // Сохраняем временные данные в токен (для шага 2)
    const tempUserData = {
      email,
      username,
      passwordHash,
      firstName,
      lastName,
      publicKey,
      publicKeySignature
    };

    // Кодируем данные в base64 для передачи клиенту
    const tempDataToken = Buffer.from(JSON.stringify(tempUserData)).toString('base64');

    // Отправка email с кодом через SMTP (БЕЗ await - не ждём завершения)
    // Отправляем в фоне, чтобы не блокировать ответ клиенту
    await sendVerificationCode(email, verificationCode, 'registration');

    // Отправляем ответ сразу после записи в БД
    res.status(201).json({
      message: 'Код отправлен на email',
      email: email,
      tempDataToken: tempDataToken,
      requiresVerification: true
    });

  } catch (error) {
    console.error('[Auth] Register error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка сервера при регистрации');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

export const beginGoogleAuth = async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth не настроен на сервере' });
  }

  const nextPath = typeof req.query.next === 'string' ? req.query.next : '/chat';
  const timeZone = resolveClientTimezone(req);
  const clientMode = normalizeGoogleClientMode(req.query.mode);
  const state = buildGoogleCallbackState(nextPath, timeZone, clientMode);
  const redirectUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  redirectUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  redirectUrl.searchParams.set('redirect_uri', GOOGLE_CALLBACK_URL);
  redirectUrl.searchParams.set('response_type', 'code');
  redirectUrl.searchParams.set('scope', 'openid email profile');
  redirectUrl.searchParams.set('prompt', 'select_account');
  redirectUrl.searchParams.set('state', state);

  res.redirect(redirectUrl.toString());
};

export const checkRegistrationEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ available: false, error: 'Введите корректный email' });
    }

    const existingUser = await query(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    res.json({
      available: existingUser.rows.length === 0
    });
  } catch (error) {
    console.error('[Auth] checkRegistrationEmail error:', error);
    res.status(500).json({ available: false, error: 'Не удалось проверить email' });
  }
};

export const checkRegistrationUsername = async (req, res) => {
  try {
    const validation = validateUsername(req.query.username || '');

    if (!validation.valid) {
      return res.json({
        available: false,
        normalized: validation.normalized,
        error: validation.error
      });
    }

    if (!validation.normalized) {
      return res.json({
        available: true,
        normalized: ''
      });
    }

    const existingUser = await query(
      `SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1`,
      [validation.normalized]
    );

    res.json({
      available: existingUser.rows.length === 0,
      normalized: validation.normalized,
      error: existingUser.rows.length > 0 ? 'Этот username уже занят' : null
    });
  } catch (error) {
    console.error('[Auth] checkRegistrationUsername error:', error);
    res.status(500).json({ available: false, error: 'Не удалось проверить username' });
  }
};

export const handleGoogleCallback = async (req, res) => {
  const { nextPath, timeZone, clientMode } = parseGoogleCallbackState(req.query.state);
  const isNative = normalizeGoogleClientMode(clientMode) === 'native';

  // Для native-клиентов используем HTML-страницу с JS redirect вместо HTTP 302,
  // т.к. Chrome Custom Tabs не всегда корректно обрабатывает 302 на custom scheme.
  const sendRedirect = (url) => {
    if (isNative) {
      return sendNativeRedirectHtml(res, url);
    }
    return res.redirect(url);
  };

  if (req.query.error) {
    return sendRedirect(buildFrontendAuthRedirect({
      error: 'Google авторизация была отменена',
      nextPath,
      clientMode
    }));
  }

  if (!req.query.code) {
    return sendRedirect(buildFrontendAuthRedirect({
      error: 'Google не вернул код авторизации',
      nextPath,
      clientMode
    }));
  }

  try {
    await ensureOnboardingSchema();

    const tokenPayload = await exchangeGoogleCode(String(req.query.code));
    const googleProfile = await fetchGoogleUserInfo(tokenPayload.access_token);
    const googleAuthResult = await findOrCreateGoogleUser(googleProfile);
    const userId = googleAuthResult.userId;

    try {
      await ensureFavoritesChat(userId);
      await ensureBotChat(userId);
    } catch (botError) {
      console.error('[Auth] Failed to ensure bot/favorites chat for Google user:', botError);
    }

    const session = await completeAuth(userId, resolveSessionMeta(req, { timeZone }));

    if (googleAuthResult.isNewUser) {
      try {
        await sendGoogleWelcomeEmail({
          email: googleAuthResult.email,
          firstName: googleAuthResult.firstName
        });
      } catch (mailError) {
        console.error('[Auth] Failed to send Google welcome email:', mailError);
      }
    }

    return sendRedirect(buildFrontendAuthRedirect({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      extraHash: googleAuthResult.needsPasswordSetup ? {
        requiresPasswordSetup: '1',
        googlePasswordSetupToken: generateGooglePasswordSetupToken(userId)
      } : {},
      nextPath,
      clientMode
    }));
  } catch (error) {
    console.error('[Auth] Google callback error:', error);
    return sendRedirect(buildFrontendAuthRedirect({
      error: error.message || 'Ошибка входа через Google',
      nextPath,
      clientMode
    }));
  }
};

// ============================================================================
// VERIFY EMAIL - Шаг 2: Подтверждение кода и создание пользователя
// ============================================================================
export const verifyEmail = async (req, res) => {
  try {
    await ensureOnboardingSchema();

    const { code, tempDataToken } = req.body;

    if (!code || !tempDataToken) {
      return res.status(400).json({ error: 'Требуется код и данные регистрации' });
    }

    // Декодируем временные данные
    let tempData;
    try {
      tempData = JSON.parse(Buffer.from(tempDataToken, 'base64').toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ error: 'Неверные данные регистрации' });
    }

    // Поиск Кода верификации
    const result = await query(
      `SELECT id, email, code, expires_at, used
       FROM email_verifications
       WHERE email = $1 AND purpose = 'registration'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tempData.email]
    );
 
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Код не найден' });
    }

    const verification = result.rows[0];
    const dbCode = verification.code;
    const inputCode = code;

    // Отладочные логи
    console.log('[VerifyEmail] Введенный код:', inputCode, '| Код из БД:', dbCode, '| Истекает в:', verification.expires_at);
    console.log('[VerifyEmail] Типы:', typeof inputCode, typeof dbCode);
    console.log('[VerifyEmail] После приведения:', String(inputCode), String(dbCode));

    // Проверка: не использован ли код
    if (verification.used) {
      console.log('[VerifyEmail] Код уже использован');
      return res.status(400).json({ error: 'Код уже был использован' });
    }

    // Проверка: не истёк ли код
    const now = new Date();
    const verificationExpiresAt = verification.expires_at;
    console.log('[VerifyEmail] Проверка времени:', {
      now: now.toISOString(),
      expiresAt: verificationExpiresAt,
      isExpired: now > verificationExpiresAt,
      timeDiff: (verificationExpiresAt - now) / 1000 + ' seconds'
    });
    
    if (now > verificationExpiresAt) {
      console.log('[VerifyEmail] Код истёк!');
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    // Сравнение кодов с приведением типов
    if (String(inputCode) !== String(dbCode)) {
      console.log('[VerifyEmail] Коды не совпадают!');
      return res.status(400).json({ error: 'Неверный код' });
    }

    console.log('[VerifyEmail] Код подтверждён, создаём пользователя...');

    // Помечаем код как использованный
    await query(
      `UPDATE email_verifications SET used = TRUE, used_at = NOW() WHERE id = $1`,
      [verification.id]
    );

    // Создаём пользователя
    const newUserResult = await query(
      `INSERT INTO users (
        id, email, username, password_hash,
        first_name, last_name, public_key, public_key_signature, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING id, email, username, first_name, last_name, onboarding_completed_at`,
      [
        uuidv4(),
        tempData.email,
        tempData.username,
        tempData.passwordHash,
        tempData.firstName,
        tempData.lastName,
        tempData.publicKey,
        tempData.publicKeySignature
      ]
    );

    const newUser = newUserResult.rows[0];

    // Создаём чаты для нового пользователя (идемпотентно)
    try {
      await ensureFavoritesChat(newUser.id);
      await ensureBotChat(newUser.id);
      console.log('[Auth] Bot & favorites chat ensured for new user:', newUser.id);
    } catch (botError) {
      console.error('[Auth] Failed to ensure bot/favorites chat:', botError);
      // Не блокируем регистрацию, если чаты не создались
    }

    const { accessToken, refreshToken } = await createAuthSession(newUser.id, resolveSessionMeta(req));

    res.json({
      message: 'Email подтверждён',
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        onboardingCompletedAt: newUser.onboarding_completed_at || null
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('[Auth] VerifyEmail error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ============================================================================
// RESEND CODE - Повторная отправка кода
// ============================================================================
export const resendCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Требуется email' });
    }

    // Поиск последней верификации
    const lastVerification = await query(
      `SELECT id, email, created_at, purpose 
       FROM email_verifications 
       WHERE email = $1 AND purpose = 'registration' AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (lastVerification.rows.length === 0) {
      return res.status(404).json({ error: 'Сначала запросите код' });
    }

    // Cooldown: 3 минуты
    const retryAfter = getVerificationRetryAfter(lastVerification.rows[0].created_at);

    if (retryAfter > 0) {
      return res.status(429).json({ 
        error: `Повторная отправка доступна через ${retryAfter} сек`,
        retryAfter
      });
    }

    // Генерация нового кода
    const buffer = crypto.randomBytes(3);
    const codeNumber = buffer.readUIntBE(0, 3) % 1000000;
    const newCode = codeNumber.toString().padStart(6, '0');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Обновление кода
    await query(
      `UPDATE email_verifications
       SET code = $1, expires_at = $2, created_at = NOW()
       WHERE id = $3`,
      [newCode, expiresAt, lastVerification.rows[0].id]
    );

    // Отправка email (в фоне, без await)
    const { sendVerificationCode } = await import('../utils/emailService.js');
    await sendVerificationCode(email, newCode, 'registration');

    res.json({
      message: 'Код отправлен повторно',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('[Auth] ResendCode error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка сервера');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

// ============================================================================
// LOGIN - Шаг 1: Проверка пароля и отправка кода на email
// ============================================================================
export const login = async (req, res) => {
  try {
    const { phone, email, username, password } = req.body;

    // Валидация
    if ((!phone && !email && !username) || !password) {
      return res.status(400).json({
        error: 'Требуется телефон/email/имя пользователя и пароль'
      });
    }

    // Поиск пользователя - проверяем только переданные значения
    let whereClause = '';
    const values = [];

    if (phone) {
      values.push(phone);
      whereClause = 'phone = $' + values.length;
    }
    if (email) {
      values.push(email);
      whereClause += whereClause ? ' OR ' : '';
      whereClause += 'email = $' + values.length;
    }
    if (username) {
      values.push(username);
      whereClause += whereClause ? ' OR ' : '';
      whereClause += 'username = $' + values.length;
    }

    values.push(password); // Для последующей проверки

    const result = await query(
      `SELECT id, password_hash, first_name, last_name, username, phone, email,
              public_key, is_active, two_factor_enabled
       FROM users
       WHERE ${whereClause}`,
      values.slice(0, -1) // Все кроме пароля
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    console.log('[Auth] Login user found:', { id: user.id, username: user.username, isActive: user.is_active });

    // Проверка активности
    if (!user.is_active) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        error: 'Этот аккаунт создан через Google. Используйте кнопку "Войти через Google".'
      });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    // Пароль верный - генерируем и отправляем код на email
    // Если email нет - используем phone как резервный вариант
    const targetEmail = user.email || user.phone;
    
    if (!targetEmail) {
      return res.status(400).json({ 
        error: 'У пользователя нет email или телефона для отправки кода' 
      });
    }

    // Генерация 6-значного кода для входа
    const buffer = crypto.randomBytes(3);
    const codeNumber = buffer.readUIntBE(0, 3) % 1000000;
    const verificationCode = codeNumber.toString().padStart(6, '0');

    // Сохранение кода верификации для входа
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Удаляем старые неиспользованные коды для этого email/phone
    await query(
      `DELETE FROM email_verifications 
       WHERE (email = $1 OR user_id = $2) AND purpose = 'login' AND used = FALSE`,
      [targetEmail, user.id]
    );

    // Вставляем новый код
    await query(
      `INSERT INTO email_verifications
       (user_id, email, code, purpose, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [user.id, targetEmail, verificationCode, 'login', expiresAt]
    );

    // Создаём временный токен для шага верификации
    const loginTempToken = jwt.sign(
      { userId: user.id, step: 'login_verification', email: targetEmail },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Отправка email с кодом (в фоне, без await)
    if (user.email) {
      const { sendVerificationCode } = await import('../utils/emailService.js');
      await sendVerificationCode(user.email, verificationCode, 'login');
    }

    console.log('[Login] Code sent to', targetEmail);

    res.json({
      message: 'Код отправлен',
      email: targetEmail,
      loginTempToken,
      requiresEmailVerification: true
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка сервера при входе');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

// ============================================================================
// VERIFY LOGIN CODE - Шаг 2: Проверка кода и выдача токенов
// ============================================================================
export const verifyLoginCode = async (req, res) => {
  try {
    await ensureOnboardingSchema();

    const { code, loginTempToken } = req.body;

    if (!code || !loginTempToken) {
      return res.status(400).json({ error: 'Требуется код и токен входа' });
    }

    // Проверка временного токена
    let decoded;
    try {
      decoded = jwt.verify(loginTempToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Неверный токен входа' });
    }

    if (decoded.step !== 'login_verification') {
      return res.status(400).json({ error: 'Неверный тип токена' });
    }

    const userId = decoded.userId;

    // Получаем данные пользователя
    const userResult = await query(
      `SELECT id, email, username, first_name, last_name, phone, public_key, is_active, onboarding_completed_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    // Проверка активности
    if (!user.is_active) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    // Поиск кода верификации
    const result = await query(
      `SELECT id, email, code, expires_at, used
       FROM email_verifications
       WHERE user_id = $1 AND purpose = 'login'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Код не найден' });
    }

    const verification = result.rows[0];
    const dbCode = verification.code;
    const inputCode = code;

    // Отладочные логи
    console.log('[VerifyLoginCode] Введенный код:', inputCode, '| Код из БД:', dbCode, '| Истекает в:', verification.expires_at);

    // Проверка: не использован ли код
    if (verification.used) {
      return res.status(400).json({ error: 'Код уже был использован' });
    }

    // Проверка: не истёк ли код
    if (new Date() > verification.expires_at) {
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    // Сравнение кодов с приведением типов
    if (String(inputCode) !== String(dbCode)) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    // Помечаем код как использованный
    await query(
      `UPDATE email_verifications SET used = TRUE, used_at = NOW() WHERE id = $1`,
      [verification.id]
    );

    // Генерация токенов + создание сессии (для управления активными устройствами)
    const { accessToken, refreshToken } = await createAuthSession(user.id, resolveSessionMeta(req));

    // Обновление статуса online
    await query(`UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1`, [user.id]);

    try {
      await ensureFavoritesChat(user.id);
      await ensureBotChat(user.id);
    } catch (e) {
      console.error('[Auth] Failed to ensure favorites/bot chat after login:', e);
    }

    void notifyLoginThroughAegisBot(user.id, resolveSessionMeta(req));

    res.json({
      message: 'Вход выполнен успешно',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        publicKey: user.public_key,
        onboardingCompletedAt: user.onboarding_completed_at || null
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('[Auth] VerifyLoginCode error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ============================================================================
// RESEND LOGIN CODE - Повторная отправка кода входа
// ============================================================================
export const resendLoginCode = async (req, res) => {
  try {
    const { loginTempToken } = req.body;

    if (!loginTempToken) {
      return res.status(400).json({ error: 'Требуется токен входа' });
    }

    // Проверка временного токена
    let decoded;
    try {
      decoded = jwt.verify(loginTempToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Неверный токен входа' });
    }

    if (decoded.step !== 'login_verification') {
      return res.status(400).json({ error: 'Неверный тип токена' });
    }

    const userId = decoded.userId;

    // Получаем email пользователя
    const userResult = await query(
      `SELECT email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const email = userResult.rows[0].email;

    // Поиск последней верификации
    const lastVerification = await query(
      `SELECT id, email, created_at
       FROM email_verifications
       WHERE user_id = $1 AND purpose = 'login' AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (lastVerification.rows.length === 0) {
      return res.status(404).json({ error: 'Код не найден' });
    }

    // Cooldown: 3 минуты
    const retryAfter = getVerificationRetryAfter(lastVerification.rows[0].created_at);

    if (retryAfter > 0) {
      return res.status(429).json({
        error: `Повторная отправка доступна через ${retryAfter} сек`,
        retryAfter
      });
    }

    // Генерация нового кода
    const buffer = crypto.randomBytes(3);
    const codeNumber = buffer.readUIntBE(0, 3) % 1000000;
    const newCode = codeNumber.toString().padStart(6, '0');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Обновление кода
    await query(
      `UPDATE email_verifications
       SET code = $1, expires_at = $2, created_at = NOW()
       WHERE id = $3`,
      [newCode, expiresAt, lastVerification.rows[0].id]
    );

    // Отправка email (в фоне, без await)
    const { sendVerificationCode } = await import('../utils/emailService.js');
    await sendVerificationCode(email, newCode, 'login');

    res.json({
      message: 'Код отправлен повторно',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('[Auth] ResendLoginCode error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка сервера');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

// ============================================================================
// LOGOUT
// ============================================================================
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Требуется refresh токен' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Неверный refresh токен' });
    }

    const userId = decoded.userId;
    let sessionId = decoded.sessionId || null;

    if (sessionId) {
      await query(`DELETE FROM sessions WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
    } else {
      const sessions = await query(
        `SELECT id, refresh_token_hash
         FROM sessions
         WHERE user_id = $1`,
        [userId]
      );

      for (const row of sessions.rows) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await verifyRefreshToken(refreshToken, row.refresh_token_hash);
        if (ok) {
          sessionId = row.id;
          break;
        }
      }

      if (sessionId) {
        await query(`DELETE FROM sessions WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
      }
    }
    
    res.json({ message: 'Выход выполнен успешно' });
    
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ error: 'Ошибка сервера при выходе' });
  }
};

// ============================================================================
// REFRESH TOKEN
// ============================================================================
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Требуется refresh токен' });
    }
    
    // Проверка токена
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Неверный refresh токен' });
    }

    const meta = resolveSessionMeta(req);
    const safeIpAddress = (() => {
      const v = meta.ipAddress;
      if (!v) return null;
      const first = String(v).split(',')[0].trim();
      if (/^\\d{1,3}(?:\\.\\d{1,3}){3}:\\d+$/.test(first)) return first.split(':')[0];
      return first || null;
    })();

    // Поиск конкретной сессии: сначала по sessionId из refresh JWT (если есть),
    // иначе подбираем по bcrypt-хешу.
    let session = null;
    if (decoded.sessionId) {
      const result = await query(
        `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, u.is_active
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND s.user_id = $2 AND s.expires_at > NOW()
         LIMIT 1`,
        [decoded.sessionId, decoded.userId]
      );
      session = result.rows[0] || null;
      if (!session) {
        return res.status(401).json({ error: 'Сессия не найдена или истекла' });
      }

      const validToken = await verifyRefreshToken(refreshToken, session.refresh_token_hash);
      if (!validToken) {
        return res.status(401).json({ error: 'Неверный refresh токен' });
      }
    } else {
      const sessions = await query(
        `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, u.is_active
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1 AND s.expires_at > NOW()
         ORDER BY s.last_active_at DESC`,
        [decoded.userId]
      );

      for (const row of sessions.rows) {
        // bcrypt.compare достаточно быстрый для небольшого количества сессий
        // (обычно 1..10), зато корректно находит нужную запись.
        // eslint-disable-next-line no-await-in-loop
        const ok = await verifyRefreshToken(refreshToken, row.refresh_token_hash);
        if (ok) {
          session = row;
          break;
        }
      }

      if (!session) {
        return res.status(401).json({ error: 'Сессия не найдена или истекла' });
      }
    }

    if (!session.is_active) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    // Генерация новых токенов (привязка к sessionId)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId, session.id);
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

    // Обновление сессии
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE sessions
       SET refresh_token_hash = $1,
           expires_at = $2,
           last_active_at = NOW(),
           device_name = $3,
           device_type = $4,
           ip_address = $5,
           user_agent = $6
       WHERE id = $7`,
      [
        newRefreshTokenHash,
        expiresAt,
        meta.deviceName,
        meta.deviceType,
        safeIpAddress,
        meta.userAgent,
        session.id
      ]
    );
    
    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
    
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении токена' });
  }
};

// ============================================================================
// SESSIONS - Список активных сессий и управление ими
// ============================================================================
export const getSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const currentSessionId = req.sessionId || null;

    // Keep session list clean: collapse duplicate sessions for the same browser fingerprint.
    await query(
      `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id, user_agent, COALESCE(device_type, '')
                  ORDER BY last_active_at DESC NULLS LAST, created_at DESC NULLS LAST
                ) AS rn
         FROM sessions
         WHERE user_id = $1 AND user_agent IS NOT NULL
       )
       DELETE FROM sessions
       WHERE id IN (SELECT id FROM ranked WHERE rn > 1)`,
      [userId]
    );

    const result = await query(
      `SELECT id, device_name, device_type, ip_address, user_agent,
              created_at, last_active_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    const sessions = result.rows.map((row) => {
      const derived = deriveDeviceInfoFromUserAgent(row.user_agent || '');
      const deviceName = row.device_name || derived.deviceName;
      const deviceType = row.device_type || derived.deviceType;
      const isCurrent = currentSessionId ? String(row.id) === String(currentSessionId) : false;

      const lastActiveAt = row.last_active_at || row.created_at;
      const isOnline = isCurrent
        || (lastActiveAt && (Date.now() - new Date(lastActiveAt).getTime() < 2 * 60 * 1000));

      return {
        id: row.id,
        deviceName,
        deviceType,
        ipAddress: row.ip_address || null,
        userAgent: row.user_agent || null,
        city: null, // город не определяем без внешних geo-сервисов (privacy-first)
        createdAt: row.created_at,
        lastActiveAt: row.last_active_at,
        expiresAt: row.expires_at,
        isCurrent,
        isOnline
      };
    });

    return res.json({ sessions, currentSessionId });
  } catch (error) {
    console.error('[Auth] getSessions error:', error);
    return res.status(500).json({ error: 'Ошибка сервера при получении сессий' });
  }
};

export const terminateSession = async (req, res) => {
  try {
    const userId = req.userId;
    const currentSessionId = req.sessionId || null;
    const { sessionId } = req.params;

    if (currentSessionId && String(sessionId) === String(currentSessionId)) {
      return res.status(400).json({ error: 'Нельзя завершить текущую сессию' });
    }

    const result = await query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    return res.json({ terminated: true });
  } catch (error) {
    console.error('[Auth] terminateSession error:', error);
    return res.status(500).json({ error: 'Ошибка сервера при завершении сессии' });
  }
};

export const terminateOtherSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const currentSessionId = req.sessionId || null;

    let keepSessionId = currentSessionId;
    if (!keepSessionId) {
      const ip = resolveClientIp(req);
      const ua = resolveUserAgent(req);
      const candidates = await query(
        `SELECT id, ip_address, user_agent
         FROM sessions
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY last_active_at DESC`,
        [userId]
      );

      const match = candidates.rows.find((row) =>
        String(row.ip_address || '') === String(ip || '') && String(row.user_agent || '') === String(ua || '')
      );
      keepSessionId = match?.id || candidates.rows[0]?.id || null;
    }

    if (!keepSessionId) {
      return res.status(400).json({ error: 'Не удалось определить текущую сессию' });
    }

    const result = await query(
      `DELETE FROM sessions WHERE user_id = $1 AND id <> $2`,
      [userId, keepSessionId]
    );

    return res.json({ terminated: result.rowCount });
  } catch (error) {
    console.error('[Auth] terminateOtherSessions error:', error);
    return res.status(500).json({ error: 'Ошибка сервера при завершении сессий' });
  }
};

// ============================================================================
// PASSWORD CHANGE - Шаг 1: Проверка старого пароля и отправка кода
// ============================================================================
export const requestPasswordChange = async (req, res) => {
  try {
    const userId = req.userId;
    const { oldPassword } = req.body;

    if (!oldPassword) {
      return res.status(400).json({ error: 'Требуется текущий пароль' });
    }

    const result = await query(
      `SELECT id, email, password_hash FROM users WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Для Google-аккаунта пароль ещё не задан' });
    }

    // Проверка старого пароля
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'У аккаунта не указан email для подтверждения' });
    }

    // Генерация кода
    const verificationCode = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Удаляем старые неиспользованные коды для смены пароля
    await query(
      `DELETE FROM email_verifications 
       WHERE user_id = $1 AND purpose = 'password_change' AND used = FALSE`,
      [userId]
    );

    // Сохраняем новый код
    await query(
      `INSERT INTO email_verifications
       (user_id, email, code, purpose, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, user.email, verificationCode, 'password_change', expiresAt]
    );

    // Временный токен смены пароля
    const passwordChangeToken = jwt.sign(
      { userId, step: 'password_change' },
      process.env.JWT_SECRET || 'fallback-jwt-secret-key-for-production-use-env-var',
      { expiresIn: '10m' }
    );

    // Отправляем код на email (в фоне)
    await sendVerificationCode(user.email, verificationCode, 'password_change');

    res.json({
      message: 'Код для смены пароля отправлен на вашу почту',
      email: user.email,
      passwordChangeToken
    });
  } catch (error) {
    console.error('[Auth] requestPasswordChange error:', error);
    const resolved = resolveEmailDeliveryError(error, 'Ошибка сервера при подготовке смены пароля');
    res.status(resolved.status).json({ error: resolved.error });
  }
};

// ============================================================================
// PASSWORD CHANGE - Шаг 2: Подтверждение кода и установка нового пароля
// ============================================================================
export const confirmPasswordChange = async (req, res) => {
  try {
    const { code, newPassword, passwordChangeToken } = req.body;

    if (!code || !newPassword || !passwordChangeToken) {
      return res.status(400).json({ error: 'Требуются код, новый пароль и токен смены пароля' });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть от 8 до 128 символов' });
    }

    // Проверяем временный токен смены пароля
    let decoded;
    try {
      decoded = jwt.verify(
        passwordChangeToken,
        process.env.JWT_SECRET || 'fallback-jwt-secret-key-for-production-use-env-var'
      );
    } catch (e) {
      return res.status(401).json({ error: 'Неверный или истёкший токен смены пароля' });
    }

    if (decoded.step !== 'password_change') {
      return res.status(400).json({ error: 'Неверный тип токена' });
    }

    const userId = decoded.userId;

    // Ищем последний код смены пароля
    const result = await query(
      `SELECT id, code, expires_at, used
       FROM email_verifications
       WHERE user_id = $1 AND purpose = 'password_change'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Код не найден. Запросите новый код' });
    }

    const verification = result.rows[0];

    if (verification.used) {
      return res.status(400).json({ error: 'Код уже был использован' });
    }

    if (new Date() > verification.expires_at) {
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    if (String(code) !== String(verification.code)) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    // Помечаем код как использованный
    await query(
      `UPDATE email_verifications SET used = TRUE, used_at = NOW() WHERE id = $1`,
      [verification.id]
    );

    // Хешируем и сохраняем новый пароль
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newPasswordHash, userId]
    );

    void notifyPasswordChangedThroughAegisBot(userId, resolveSessionMeta(req));

    res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    console.error('[Auth] confirmPasswordChange error:', error);
    res.status(500).json({ error: 'Ошибка сервера при смене пароля' });
  }
};

// ============================================================================
// GET ME (получение данных текущего пользователя)
// ============================================================================
export const setupGooglePassword = async (req, res) => {
  try {
    const { password, googlePasswordSetupToken } = req.body;
    const userId = req.userId;

    if (!password || !googlePasswordSetupToken) {
      return res.status(400).json({ error: 'Требуются пароль и setup token' });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть от 8 до 128 символов' });
    }

    let decoded;
    try {
      decoded = jwt.verify(googlePasswordSetupToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Setup token недействителен или истёк' });
    }

    if (decoded.step !== 'google_password_setup' || decoded.userId !== userId) {
      return res.status(403).json({ error: 'Setup token не подходит для этого аккаунта' });
    }

    const result = await query(
      `SELECT id, password_hash, google_id
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.google_id) {
      return res.status(400).json({ error: 'Это не Google-аккаунт' });
    }

    if (user.password_hash) {
      return res.status(400).json({ error: 'Пароль уже задан для этого аккаунта' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );

    void notifyPasswordChangedThroughAegisBot(userId, resolveSessionMeta(req));

    return res.json({ message: 'Пароль успешно задан' });
  } catch (error) {
    console.error('[Auth] setupGooglePassword error:', error);
    return res.status(500).json({ error: 'Ошибка сервера при установке пароля' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await fetchUserById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
      phone: user.phone,
      ...serializeUser(user)
    });
    
  } catch (error) {
    console.error('[Auth] GetMe error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

export const saveFcmToken = async (req, res) => {
  try {
    const userId = req.userId;
    const fcmToken = String(req.body?.fcmToken || '').trim();

    if (!fcmToken) {
      return res.status(400).json({ error: 'Требуется FCM токен' });
    }

    await query(
      `UPDATE users
       SET fcm_token = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [fcmToken, userId]
    );

    console.log(`FCM Token saved for user: ${userId}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[Auth] saveFcmToken error:', error);
    return res.status(500).json({ error: 'Не удалось сохранить FCM токен' });
  }
};

export const completeOnboarding = async (req, res) => {
  try {
    await ensureOnboardingSchema();

    await query(
      `UPDATE users
       SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [req.userId]
    );

    const user = await fetchUserById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      message: 'Онбординг завершен',
      user: {
        phone: user.phone,
        ...serializeUser(user)
      }
    });
  } catch (error) {
    console.error('[Auth] completeOnboarding error:', error);
    res.status(500).json({ error: 'Не удалось завершить онбординг' });
  }
};

