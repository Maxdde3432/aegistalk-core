import { Router } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getMessages,
  sendMessage,
  updateMessageStatus,
  deleteMessage,
  editMessage,
  addReaction,
  removeReaction,
  getReactions,
  getReactionsBatch,
  viewMedia,
  downloadMedia
} from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const blockedMimes = new Set([
      'text/html',
      'application/xhtml+xml',
      'image/svg+xml',
      'application/javascript',
      'text/javascript',
      'application/x-javascript'
    ]);

    if (blockedMimes.has(mime)) {
      return cb(new Error('Недопустимый тип файла'));
    }

    return cb(null, true);
  }
});

// Middleware для валидации
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Ошибка валидации',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// Все роуты требуют авторизации
router.get('/:messageId/media/view', [
  param('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  validate
], viewMedia);

router.get('/:messageId/media/download', [
  param('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  validate
], downloadMedia);

router.use(authenticate);

// ============================================================================
// MESSAGES ROUTES
// ============================================================================

// Загрузка медиа для сообщений
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не получен' });
  }

  const ext = path.extname(req.file.originalname) || '.bin';
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const storagePath = `messages/${fileName}`;

  try {
    const absolutePath = path.join(uploadDir, fileName);
    fs.writeFileSync(absolutePath, req.file.buffer);

    const relativePath = `/uploads/${storagePath}`;
    const protectedUrl = `/api/media/${storagePath}`;

    return res.json({
      url: protectedUrl,
      path: relativePath,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype
    });
  } catch (error) {
    console.error('[Upload] Failed to store file:', error);
    return res.status(500).json({ error: 'Не удалось сохранить файл' });
  }
});

// Получить историю сообщений чата
router.get('/chat/:chatId', [
  param('chatId').isUUID().withMessage('Неверный формат ID чата'),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit должен быть от 1 до 100'),
  queryValidator('offset').optional().isInt({ min: 0 }).withMessage('Offset должен быть >= 0'),
  validate
], getMessages);

// Отправить сообщение
router.post('/', [
  body('chatId').isUUID().withMessage('Неверный формат ID чата'),
  body('content').isString().notEmpty().withMessage('Требуется содержимое сообщения'),
  body('type').optional().isIn(['text', 'image', 'video', 'video-circle', 'audio', 'file', 'voice', 'sticker']).withMessage('Неверный тип сообщения'),
  body('nonce').optional().isString(),
  body('senderPublicKey').optional().isString(),
  body('signature').optional().isString(),
  validate
], sendMessage);

// Обновить статус сообщения
router.patch('/status', [
  body('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  body('status').isIn(['delivered', 'read']).withMessage('Статус должен быть delivered или read'),
  validate
], updateMessageStatus);

// Удалить сообщение
router.delete('/:messageId', [
  param('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  validate
], deleteMessage);

// Редактировать сообщение
router.patch('/:messageId', [
  param('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  body('content').isString().notEmpty().withMessage('Требуется содержимое сообщения'),
  validate
], editMessage);

// Добавить реакцию
router.post('/reaction', [
  body('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  body('emoji').isString().notEmpty().withMessage('Требуется emoji'),
  validate
], addReaction);

// Удалить реакцию
router.post('/reaction/remove', [
  body('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  body('emoji').isString().notEmpty().withMessage('Требуется emoji'),
  validate
], removeReaction);

// Получить реакции сообщения
// Получить реакции сразу для списка сообщений (1 запрос вместо N)
router.post('/reactions/batch', [
  body('messageIds').isArray({ min: 1, max: 100 }).withMessage('messageIds должен быть массивом (1..100)'),
  body('messageIds.*').isUUID().withMessage('Неверный формат messageId'),
  validate
], getReactionsBatch);

router.get('/:messageId/reactions', [
  param('messageId').isUUID().withMessage('Неверный формат ID сообщения'),
  validate
], getReactions);

export default router;
