import { Router } from 'express';

import { syncPhoneContacts } from '../controllers/usersController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/sync', syncPhoneContacts);

export default router;
