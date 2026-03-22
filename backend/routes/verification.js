import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode, resendCode } from '../controllers/verificationController.js';

const router = Router();

// Отправить код подтверждения (требуется авторизация для email_change и 2fa)
router.post('/send', authenticate, sendVerificationCode);

// Проверить код (не требует авторизации для registration)
router.post('/verify', verifyCode);

// Повторная отправка кода
router.post('/resend', authenticate, resendCode);

export default router;
