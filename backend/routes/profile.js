import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { getProfile, updateProfile, uploadAvatar, removeAvatar, deleteAccount, requestEmailChange, confirmEmailChange } from '../controllers/profileController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Настройка multer для загрузки аватаров (в память)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый формат файла'), false);
    }
  }
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

// Получить данные профиля
router.get('/me', authenticate, getProfile);

// Обновить данные профиля
router.put('/me', authenticate, updateProfile);

// Запросить код для смены email
router.post('/email/change-request', authenticate, requestEmailChange);

// Подтвердить смену email
router.post('/email/change-confirm', authenticate, confirmEmailChange);

// Удалить (деактивировать) аккаунт
router.delete('/me', authenticate, deleteAccount);

// Загрузить аватар
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);

// Удалить аватар
router.delete('/avatar', authenticate, removeAvatar);

export default router;
