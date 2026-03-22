import { Router } from 'express';
import { isAdmin } from '../middleware/isAdmin.js';
import {
  adminGetHelpText,
  adminGetLogs,
  adminGetStatus,
  adminLogin,
  adminToggleShield,
  adminUpdateHelpText,
  adminUpdateWhitelist
} from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Critical: enforce order per endpoint: auth first, then isAdmin.
router.post('/login', authenticate, adminLogin);
router.get('/status', isAdmin, adminGetStatus);
router.post('/toggle-shield', isAdmin, adminToggleShield);
router.get('/logs', isAdmin, adminGetLogs);
router.get('/help-text', isAdmin, adminGetHelpText);
router.post('/help-text', isAdmin, adminUpdateHelpText);
router.post('/whitelist', isAdmin, adminUpdateWhitelist);

export default router;
