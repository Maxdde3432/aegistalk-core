import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateBotToken } from '../middleware/botTokenAuth.js';
import { pushSystemBotMessage } from '../services/botPlatformService.js';

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

router.use(authenticateBotToken);

router.get('/me', (req, res) => {
  return res.json({
    bot: {
      id: req.bot.id,
      name: req.bot.name,
      username: req.bot.username,
      description: req.bot.description,
      isActive: req.bot.isActive,
      createdAt: req.bot.createdAt
    }
  });
});

router.post(
  '/notify',
  [
    body('text').isString().trim().isLength({ min: 1, max: 4000 }).withMessage('text должен быть от 1 до 4000 символов'),
    validate
  ],
  async (req, res) => {
    try {
      const text = String(req.body.text || '').trim();
      await pushSystemBotMessage(
        req.botOwnerUserId,
        [
          `**${req.bot.name} (@${req.bot.username})**`,
          '',
          text
        ].join('\n')
      );

      return res.json({ success: true });
    } catch (error) {
      console.error('[BotRuntime] notify error:', error);
      return res.status(500).json({ error: 'Не удалось отправить сообщение от бота' });
    }
  }
);

export default router;
