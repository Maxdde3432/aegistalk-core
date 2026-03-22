import { logSecurityEvent } from '../services/securityLogService.js';
import { verifyAdminToken } from '../services/adminSessionService.js';

const getOwnerId = () => {
  const env = String(process.env.OWNER_ID || '').trim();
  return env;
};

export const isAdmin = (req, res, next) => {
  console.log('Incoming Token:', req.headers.authorization);
  console.log('Admin Auth Attempt:', req.headers);
  const ownerId = getOwnerId();
  const authHeader = String(req.headers?.authorization || '');
  const headerToken =
    req.headers?.['admin_token'] ||
    req.headers?.['admin-token'] ||
    req.headers?.['x-admin-token'] ||
    '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : String(headerToken || '').trim();
  if (authHeader.startsWith('Bearer ') && !token) {
    console.log('Token is empty strings');
  }
  if (!token) {
    console.log('[DEBUG] No token received for Admin route.');
    logSecurityEvent({
      level: 'critical',
      type: 'admin_session_missing',
      message: 'Critical Security Alert: missing admin_token (Authorization) for /api/admin',
      req
    });
    return res.status(403).json({ error: 'admin_session_required' });
  }

  let decoded;
  try {
    decoded = verifyAdminToken(token);
  } catch (e) {
    logSecurityEvent({
      level: 'critical',
      type: 'admin_session_invalid',
      message: 'Critical Security Alert: invalid/expired admin_token (Authorization) for /api/admin',
      req,
      meta: { reason: e?.message || 'invalid' }
    });
    return res.status(403).json({ error: 'admin_session_required' });
  }

  const userId = String(decoded.userId || '').trim();
  const role = String(decoded.role || '').trim();
  const owner = decoded.owner === true;
  if (!userId || role !== 'admin') {
    logSecurityEvent({
      level: 'critical',
      type: 'admin_access_denied',
      message: 'Critical Security Alert: invalid admin_token claims for /api/admin',
      req,
      meta: { role, owner, expectedOwnerIdSuffix: ownerId ? ownerId.slice(-6) : null }
    });
    return res.status(403).json({ error: 'forbidden' });
  }

  // Provide normalized identity for downstream controllers/logs.
  req.userId = userId;
  req.user = { id: userId };
  req.adminClaims = decoded;
  return next();
};
