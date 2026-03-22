import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  getMyGroups,
  createGroup,
  getGroupInfo,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  leaveGroup,
  rejoinGroup,
  promoteMember,
  demoteMember,
  updateMemberRole,
  generateInviteLink,
  joinByInviteLink,
  joinPublicChannel,
  getPublicChannels,
  getGroupByInvite,
  getCommonChats,
  getInviteLinks,
  createInviteLink,
  deleteInviteLink,
  getAdminLogs,
  linkDiscussionGroup
} from '../controllers/groupController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

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

// ============================================================================
// PUBLIC ROUTES (без авторизации)
// ============================================================================

// Получить информацию о группе по invite-ссылке (без auth)
router.get('/invite/:inviteToken', getGroupByInvite);

// Получить список публичных каналов
router.get('/public', getPublicChannels);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================
router.use(authenticate);

// Получить все мои группы
router.get('/', getMyGroups);

// Создать группу/канал
router.post('/', [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Название от 2 до 100 символов'),
  body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Описание до 500 символов'),
  body('type').optional().isIn(['group', 'channel']).withMessage('Тип: group или channel'),
  body('isPublic').optional().isBoolean().withMessage('isPublic должен быть boolean'),
  body('titleColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('titleColor должен быть HEX цветом'),
  body('backgroundColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('backgroundColor должен быть HEX цветом'),
  validate
], createGroup);

// Получить информацию о группе
router.get('/:groupId', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  validate
], getGroupInfo);

// Обновить настройки группы
router.put('/:groupId', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Название от 2 до 100 символов'),
  body('description').optional().isString().trim().isLength({ max: 500 }).withMessage('Описание до 500 символов'),
  body('isPublic').optional().isBoolean().withMessage('isPublic должен быть boolean'),
  body('avatarUrl').optional().isString().withMessage('avatarUrl должен быть строкой'),
  body('animatedAvatarUrl').optional().isString().withMessage('animatedAvatarUrl должен быть строкой'),
  body('titleColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('titleColor должен быть HEX цветом'),
  body('backgroundColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('backgroundColor должен быть HEX цветом'),
  body('createDiscussion').optional().isBoolean().withMessage('createDiscussion должен быть boolean'),
  body('reactionsEnabled').optional().isBoolean().withMessage('reactionsEnabled должен быть boolean'),
  body('allowedReactions').optional().isArray().withMessage('allowedReactions должен быть массивом'),
  validate
], updateGroup);

// Удалить группу
router.delete('/:groupId', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  validate
], deleteGroup);

// Добавить участника
router.post('/:groupId/members', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  body('targetUserId').isString().trim().notEmpty().withMessage('Неверный формат ID пользователя'),
  validate
], addMember);

// Удалить участника
router.delete('/:groupId/members/:targetUserId', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  param('targetUserId').isString().trim().notEmpty().withMessage('Неверный формат ID пользователя'),
  validate
], removeMember);

// ???????? ???? ?????????
router.patch('/:groupId/members/:targetUserId/role', [
  param('groupId').isString().trim().notEmpty().withMessage('???????? ?????? ID ??????'),
  param('targetUserId').isString().trim().notEmpty().withMessage('???????? ?????? ID ????????????'),
  body('role').isIn(['member', 'moderator', 'admin']).withMessage('???? ?????? ???? member, moderator ??? admin'),
  validate
], updateMemberRole);

// Выйти из группы
router.post('/:groupId/leave', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  validate
], leaveGroup);

// Вернуться в группу (если вышел сам)
router.post('/:groupId/rejoin', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  validate
], rejoinGroup);

// Повысить участника до админа
router.post('/:groupId/members/:targetUserId/promote', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  param('targetUserId').isString().trim().notEmpty().withMessage('Неверный формат ID пользователя'),
  validate
], promoteMember);

// Понизить админа до участника
router.post('/:groupId/members/:targetUserId/demote', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  param('targetUserId').isString().trim().notEmpty().withMessage('Неверный формат ID пользователя'),
  validate
], demoteMember);

// Создать invite-ссылку
router.post('/:groupId/invite', [
  param('groupId').isString().trim().notEmpty().withMessage('Неверный формат ID группы'),
  validate
], generateInviteLink);

// Вступить по invite-ссылке (требуется авторизация)
router.post('/join', joinByInviteLink);

// Получить общие чаты с пользователем (до /public/:id чтобы не перехватывалось)
router.get('/common/:otherUserId', [
  param('otherUserId').isString().trim().notEmpty().withMessage('Неверный формат ID пользователя'),
  authenticate,
  validate
], getCommonChats);

// Вступить в публичный канал (в самом конце чтобы не перехватывалось /public GET)
router.post('/public/:id/join', [
  param('id').isString().trim().notEmpty().withMessage('Неверный формат ID канала'),
  authenticate,
  validate
], (req, res, next) => {
  console.log('🔥 ЗАПРОС ДОШЕЛ ДО РОУТА! Method:', req.method, 'URL:', req.url, 'ID:', req.params.id);
  return joinPublicChannel(req, res, next);
});

// === ADMIN PANEL ROUTES ===

// Получить пригласительные ссылки
router.get('/:groupId/invite-links', [
  param('groupId').isString().trim().notEmpty(),
  authenticate,
  validate
], getInviteLinks);

// Создать пригласительную ссылку
router.post('/:groupId/invite-links', [
  param('groupId').isString().trim().notEmpty(),
  body('name').optional().isString().trim(),
  authenticate,
  validate
], createInviteLink);

// Удалить пригласительную ссылку
router.delete('/:groupId/invite-links/:linkId', [
  param('groupId').isString().trim().notEmpty(),
  param('linkId').isString().trim().notEmpty(),
  authenticate,
  validate
], deleteInviteLink);

// Получить журнал событий
router.get('/:groupId/admin-logs', [
  param('groupId').isString().trim().notEmpty(),
  authenticate,
  validate
], getAdminLogs);

// Связать группу обсуждений
router.post('/:groupId/discussion', [
  param('groupId').isString().trim().notEmpty(),
  body('discussionGroupId').optional().isString().trim().notEmpty(),
  authenticate,
  validate
], linkDiscussionGroup);

export default router;
