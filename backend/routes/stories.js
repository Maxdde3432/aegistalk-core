import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import {
  addStoryComment,
  createStory,
  deleteStory,
  getChannelStoryStats,
  listStories,
  listStoryComments,
  listStoryViews,
  markStoryViewed,
  toggleStoryLike,
  updateStorySettings
} from '../controllers/storyController.js';

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

  next();
};

router.use(authenticate);

router.get('/', listStories);

router.get(
  '/channel/:groupId/stats',
  [param('groupId').isUUID().withMessage('Неверный ID канала'), validate],
  getChannelStoryStats
);

router.post(
  '/',
  [
    body('mediaUrl').isString().notEmpty().withMessage('Нужна ссылка на файл'),
    body('mediaType').isIn(['image', 'video']).withMessage('Поддерживаются только image и video'),
    body('caption').optional().isString().isLength({ max: 280 }).withMessage('Подпись не должна быть длиннее 280 символов'),
    body('accentKey').optional().isIn(['aurora', 'ember', 'tide', 'nova', 'dusk']).withMessage('Неизвестная тема истории'),
    body('allowComments').optional().isBoolean().withMessage('allowComments должен быть boolean'),
    body('allowReactions').optional().isBoolean().withMessage('allowReactions должен быть boolean'),
    body('groupId').optional().isUUID().withMessage('Неверный ID канала'),
    validate
  ],
  createStory
);

router.post(
  '/:storyId/view',
  [param('storyId').isUUID().withMessage('Неверный ID истории'), validate],
  markStoryViewed
);

router.get(
  '/:storyId/views',
  [param('storyId').isUUID().withMessage('Неверный ID истории'), validate],
  listStoryViews
);

router.get(
  '/:storyId/comments',
  [param('storyId').isUUID().withMessage('Неверный ID истории'), validate],
  listStoryComments
);

router.post(
  '/:storyId/comments',
  [
    param('storyId').isUUID().withMessage('Неверный ID истории'),
    body('content').isString().isLength({ min: 1, max: 280 }).withMessage('Комментарий должен быть от 1 до 280 символов'),
    validate
  ],
  addStoryComment
);

router.post(
  '/:storyId/like',
  [param('storyId').isUUID().withMessage('Неверный ID истории'), validate],
  toggleStoryLike
);

router.patch(
  '/:storyId/settings',
  [
    param('storyId').isUUID().withMessage('Неверный ID истории'),
    body('allowComments').optional().isBoolean().withMessage('allowComments должен быть boolean'),
    body('allowReactions').optional().isBoolean().withMessage('allowReactions должен быть boolean'),
    validate
  ],
  updateStorySettings
);

router.delete(
  '/:storyId',
  [param('storyId').isUUID().withMessage('Неверный ID истории'), validate],
  deleteStory
);

export default router;
