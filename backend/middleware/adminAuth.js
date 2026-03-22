import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../services/securityLogService.js';

const extractTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
};

export const adminAuthenticate = (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      logSecurityEvent({
        level: 'critical',
        type: 'admin_unauthenticated_attempt',
        message: 'Critical Security Alert: unauthenticated /api/admin access attempt',
        req
      });
      return res.status(401).json({ error: 'unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      logSecurityEvent({
        level: 'critical',
        type: 'admin_invalid_token',
        message: 'Critical Security Alert: invalid token for /api/admin',
        req
      });
      return res.status(401).json({ error: 'unauthorized' });
    }

    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId || null;
    req.user = { id: decoded.userId };
    return next();
  } catch (error) {
    const code = error?.name || 'AuthError';
    logSecurityEvent({
      level: 'critical',
      type: 'admin_auth_error',
      message: `Critical Security Alert: ${code} for /api/admin`,
      req
    });

    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'unauthorized' });
  }
};

