import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  beginGoogleAuth,
  checkRegistrationEmail,
  checkRegistrationUsername,
  completeOnboarding,
  confirmPasswordChange,
  getMe,
  getSessions,
  handleGoogleCallback,
  login,
  logout,
  refreshToken,
  register,
  requestPasswordChange,
  resendCode,
  resendLoginCode,
  saveFcmToken,
  setupGooglePassword,
  terminateOtherSessions,
  terminateSession,
  verifyEmail,
  verifyLoginCode
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const redactBody = (body = {}) => {
  const hidden = new Set([
    'password',
    'newPassword',
    'oldPassword',
    'refreshToken',
    'tempDataToken',
    'loginTempToken',
    'passwordChangeToken',
    'googlePasswordSetupToken',
    'code'
  ]);

  return Object.fromEntries(
    Object.entries(body || {}).map(([key, value]) => [
      key,
      hidden.has(key) ? '[redacted]' : value
    ])
  );
};

const authBurstLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.' }
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0441\u0435\u0441\u0441\u0438\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.' }
});

// Middleware для валидации ошибок
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[Auth Validation Error]', {
      path: req.path,
      body: redactBody(req.body),
      errors: errors.array()
    });
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

router.get('/google', beginGoogleAuth);
router.get('/callback/google', handleGoogleCallback);
router.get('/register/check-email', checkRegistrationEmail);
router.get('/register/check-username', checkRegistrationUsername);

// Регистрация - Шаг 1: Создание пользователя
router.post('/register', authBurstLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Неверный формат email'),
  body('username').optional().isString().trim().isLength({ min: 3, max: 50 }).withMessage('Имя пользователя должно быть от 3 до 50 символов'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Пароль должен быть от 8 до 128 символов'),
  body('firstName').optional().isString().trim().isLength({ max: 100 }).withMessage('Имя должно быть не более 100 символов'),
  body('lastName').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }).withMessage('Фамилия должна быть не более 100 символов'),
  body('publicKey').isString().notEmpty().withMessage('Требуется публичный ключ'),
  body('publicKeySignature').isString().notEmpty().withMessage('Требуется подпись публичного ключа'),
  validate
], register);

// Подтверждение email - Шаг 2: Ввод кода и создание пользователя
router.post('/verify-email', authBurstLimiter, [
  body('code').isString().isLength({ min: 6, max: 6 }).withMessage('Код должен состоять из 6 цифр'),
  body('tempDataToken').isString().notEmpty().withMessage('Требуется токен данных'),
  validate
], verifyEmail);

// Повторная отправка кода
router.post('/resend-code', authBurstLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Неверный формат email'),
  validate
], resendCode);

// Вход
router.post('/login', authBurstLimiter, [
  body('phone').optional().isString().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('username').optional().isString().trim(),
  body().custom((value) => {
    const hasIdentifier = Boolean(
      String(value?.phone || '').trim() ||
      String(value?.email || '').trim() ||
      String(value?.username || '').trim()
    );

    if (!hasIdentifier) {
      throw new Error('Требуется телефон, email или имя пользователя');
    }

    return true;
  }),
  body('password').isString().trim().notEmpty().withMessage('Требуется пароль'),
  validate
], login);

// Подтверждение кода входа
router.post('/verify-login-code', authBurstLimiter, [
  body('code').isString().isLength({ min: 6, max: 6 }).withMessage('Код должен состоять из 6 цифр'),
  body('loginTempToken').isString().notEmpty().withMessage('Требуется токен входа'),
  validate
], verifyLoginCode);

// Повторная отправка кода входа
router.post('/resend-login-code', authBurstLimiter, [
  body('loginTempToken').isString().notEmpty().withMessage('Требуется токен входа'),
  validate
], resendLoginCode);

// Обновление токена
router.post('/refresh', refreshLimiter, [
  body('refreshToken').isString().notEmpty().withMessage('Требуется refresh токен'),
  validate
], refreshToken);

// Выход
router.post('/logout', refreshLimiter, [
  body('refreshToken').isString().notEmpty().withMessage('Требуется refresh токен'),
  validate
], logout);

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

// Получить данные текущего пользователя
router.get('/me', authenticate, getMe);

// ============================================================================
// SESSIONS (active devices)
// ============================================================================
router.get('/sessions', authenticate, getSessions);
router.post('/fcm-token', authenticate, [
  body('fcmToken').isString().trim().notEmpty().withMessage('Требуется FCM токен'),
  validate
], saveFcmToken);

router.delete('/sessions/:sessionId', authenticate, [
  param('sessionId').isUUID().withMessage('Неверный формат sessionId'),
  validate
], terminateSession);

router.post('/sessions/terminate-others', authenticate, terminateOtherSessions);

// Запрос на смену пароля
router.post('/password/change-request', authenticate, [
  body('oldPassword').isString().isLength({ min: 8, max: 128 }).withMessage('Текущий пароль обязателен'),
  validate
], requestPasswordChange);

// Подтверждение смены пароля
router.post('/password/change-confirm', authenticate, [
  body('code').isString().isLength({ min: 4, max: 10 }).withMessage('Неверный формат кода'),
  body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('Пароль должен быть от 8 до 128 символов'),
  body('passwordChangeToken').isString().notEmpty().withMessage('Отсутствует токен смены пароля'),
  validate
], confirmPasswordChange);

router.post('/google/setup-password', authenticate, [
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Пароль должен быть от 8 до 128 символов'),
  body('googlePasswordSetupToken').isString().notEmpty().withMessage('Отсутствует setup token'),
  validate
], setupGooglePassword);

router.post('/onboarding/complete', authenticate, completeOnboarding);

export default router;
