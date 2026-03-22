import { Router } from 'express';
import {
  body,
  param,
  query as queryParam,
  validationResult
} from 'express-validator';
import {
  getMyChats,
  createChat,
  getChatInfo,
  deleteChat
} from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

router.use(authenticate);

router.get('/', getMyChats);

router.post('/', [
  body('targetUserId')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('Invalid targetUserId'),
  body('scope').optional().isIn(['me', 'everyone']).withMessage('Invalid scope'),
  validate
], createChat);

router.get('/:chatId', [
  param('chatId').isUUID().withMessage('Invalid chatId'),
  validate
], getChatInfo);

router.delete('/:chatId', [
  param('chatId').isUUID().withMessage('Invalid chatId'),
  queryParam('mode').optional().isIn(['self', 'all']).withMessage('Invalid delete mode'),
  validate
], deleteChat);

export default router;
