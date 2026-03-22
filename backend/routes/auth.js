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

// Middleware РґР»СЏ РІР°Р»РёРґР°С†РёРё РѕС€РёР±РѕРє
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[Auth Validation Error]', {
      path: req.path,
      body: redactBody(req.body),
      errors: errors.array()
    });
    return res.status(400).json({
      error: 'РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё',
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

// Р РµРіРёСЃС‚СЂР°С†РёСЏ - РЁР°Рі 1: РЎРѕР·РґР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
router.post('/register', authBurstLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ email'),
  body('username').optional().isString().trim().isLength({ min: 3, max: 50 }).withMessage('РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РѕС‚ 3 РґРѕ 50 СЃРёРјРІРѕР»РѕРІ'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚ 8 РґРѕ 128 СЃРёРјРІРѕР»РѕРІ'),
  body('firstName').optional().isString().trim().isLength({ max: 100 }).withMessage('РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ Р±РѕР»РµРµ 100 СЃРёРјРІРѕР»РѕРІ'),
  body('lastName').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }).withMessage('Р¤Р°РјРёР»РёСЏ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РЅРµ Р±РѕР»РµРµ 100 СЃРёРјРІРѕР»РѕРІ'),
  body('publicKey').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡'),
  body('publicKeySignature').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ РїРѕРґРїРёСЃСЊ РїСѓР±Р»РёС‡РЅРѕРіРѕ РєР»СЋС‡Р°'),
  validate
], register);

// РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ email - РЁР°Рі 2: Р’РІРѕРґ РєРѕРґР° Рё СЃРѕР·РґР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
router.post('/verify-email', authBurstLimiter, [
  body('code').isString().isLength({ min: 6, max: 6 }).withMessage('РљРѕРґ РґРѕР»Р¶РµРЅ СЃРѕСЃС‚РѕСЏС‚СЊ РёР· 6 С†РёС„СЂ'),
  body('tempDataToken').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ С‚РѕРєРµРЅ РґР°РЅРЅС‹С…'),
  validate
], verifyEmail);

// РџРѕРІС‚РѕСЂРЅР°СЏ РѕС‚РїСЂР°РІРєР° РєРѕРґР°
router.post('/resend-code', authBurstLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ email'),
  validate
], resendCode);

// Р’С…РѕРґ
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
      throw new Error('РўСЂРµР±СѓРµС‚СЃСЏ С‚РµР»РµС„РѕРЅ, email РёР»Рё РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ');
    }

    return true;
  }),
  body('password').isString().trim().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ РїР°СЂРѕР»СЊ'),
  validate
], login);

// РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РєРѕРґР° РІС…РѕРґР°
router.post('/verify-login-code', authBurstLimiter, [
  body('code').isString().isLength({ min: 6, max: 6 }).withMessage('РљРѕРґ РґРѕР»Р¶РµРЅ СЃРѕСЃС‚РѕСЏС‚СЊ РёР· 6 С†РёС„СЂ'),
  body('loginTempToken').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ С‚РѕРєРµРЅ РІС…РѕРґР°'),
  validate
], verifyLoginCode);

// РџРѕРІС‚РѕСЂРЅР°СЏ РѕС‚РїСЂР°РІРєР° РєРѕРґР° РІС…РѕРґР°
router.post('/resend-login-code', authBurstLimiter, [
  body('loginTempToken').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ С‚РѕРєРµРЅ РІС…РѕРґР°'),
  validate
], resendLoginCode);

// РћР±РЅРѕРІР»РµРЅРёРµ С‚РѕРєРµРЅР°
router.post('/refresh', refreshLimiter, [
  body('refreshToken').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ refresh С‚РѕРєРµРЅ'),
  validate
], refreshToken);

// Р’С‹С…РѕРґ
router.post('/logout', refreshLimiter, [
  body('refreshToken').isString().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ refresh С‚РѕРєРµРЅ'),
  validate
], logout);

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

// РџРѕР»СѓС‡РёС‚СЊ РґР°РЅРЅС‹Рµ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
router.get('/me', authenticate, getMe);

// ============================================================================
// SESSIONS (active devices)
// ============================================================================
router.get('/sessions', authenticate, getSessions);
router.post('/fcm-token', authenticate, [
  body('fcmToken').isString().trim().notEmpty().withMessage('РўСЂРµР±СѓРµС‚СЃСЏ FCM С‚РѕРєРµРЅ'),
  validate
], saveFcmToken);

router.delete('/sessions/:sessionId', authenticate, [
  param('sessionId').isUUID().withMessage('РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ sessionId'),
  validate
], terminateSession);

router.post('/sessions/terminate-others', authenticate, terminateOtherSessions);

// Р—Р°РїСЂРѕСЃ РЅР° СЃРјРµРЅСѓ РїР°СЂРѕР»СЏ
router.post('/password/change-request', authenticate, [
  body('oldPassword').isString().isLength({ min: 8, max: 128 }).withMessage('РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ РѕР±СЏР·Р°С‚РµР»РµРЅ'),
  validate
], requestPasswordChange);

// РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ
router.post('/password/change-confirm', authenticate, [
  body('code').isString().isLength({ min: 4, max: 10 }).withMessage('РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ РєРѕРґР°'),
  body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚ 8 РґРѕ 128 СЃРёРјРІРѕР»РѕРІ'),
  body('passwordChangeToken').isString().notEmpty().withMessage('РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ С‚РѕРєРµРЅ СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ'),
  validate
], confirmPasswordChange);

router.post('/google/setup-password', authenticate, [
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚ 8 РґРѕ 128 СЃРёРјРІРѕР»РѕРІ'),
  body('googlePasswordSetupToken').isString().notEmpty().withMessage('РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ setup token'),
  validate
], setupGooglePassword);

router.post('/onboarding/complete', authenticate, completeOnboarding);

export default router;
