import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import {
  createBot,
  listBots,
  regenerateBotToken,
  updateBot
} from '../controllers/botPlatformController.js';

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: errors.array().map((entry) => ({
        field: entry.path,
        message: entry.msg
      }))
    });
  }

  return next();
};

router.use(authenticate);

router.get('/bots', listBots);

router.post(
  '/bots',
  [
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Название бота должно быть от 2 до 80 символов'),
    body('username').isString().trim().isLength({ min: 5, max: 32 }).withMessage('Username бота должен быть от 5 до 32 символов'),
    body('description').optional({ nullable: true }).isString().isLength({ max: 240 }).withMessage('Описание не должно быть длиннее 240 символов'),
    validate
  ],
  createBot
);

router.post(
  '/bots/:botId/regenerate-token',
  [param('botId').isUUID().withMessage('Неверный ID бота'), validate],
  regenerateBotToken
);

router.patch(
  '/bots/:botId',
  [
    param('botId').isUUID().withMessage('Неверный ID бота'),
    body('isActive').isBoolean().withMessage('isActive должен быть boolean'),
    validate
  ],
  updateBot
);

export default router;
