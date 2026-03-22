import jwt from 'jsonwebtoken';

const isQueryTokenAllowed = (req) => {
  const path = String(req.path || req.originalUrl || '');
  return (
    path.startsWith('/api/media/') ||
    path.startsWith('/uploads/') ||
    path.includes('/media/view') ||
    path.includes('/media/download')
  );
};

const extractTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (isQueryTokenAllowed(req) && typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
};

export const resolveUserIdFromRequest = (req) => {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded || !decoded.userId) return null;

  return decoded.userId;
};

export const redirectToLogin = (req, res) => {
  const redirectPath = encodeURIComponent(req.originalUrl || '/chat');
  return res.redirect(302, `/login?redirect=${redirectPath}`);
};

export const authenticate = (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId || null;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Токен истёк',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    console.error('[Auth Middleware] Error:', error);
    return res.status(500).json({ error: 'Ошибка авторизации' });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded && decoded.userId) {
        req.userId = decoded.userId;
        req.sessionId = decoded.sessionId || null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
