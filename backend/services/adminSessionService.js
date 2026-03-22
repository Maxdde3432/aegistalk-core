import jwt from 'jsonwebtoken';

const TTL_SEC = 20 * 60; // 20 minutes
const MAX_FAILS = 3;
const LOCK_MS = 30 * 60 * 1000; // 30 minutes

const attempts = new Map(); // ip -> { fails, lockUntil, lastFailAt }

const now = () => Date.now();

export const getAdminPassword = () => String(process.env.ADMIN_PASSWORD || '').trim();

export const isIpLocked = (ip) => {
  const key = String(ip || 'unknown');
  const entry = attempts.get(key);
  if (!entry) return { locked: false, retryAfterSec: 0, fails: 0 };
  const t = now();
  if (entry.lockUntil && entry.lockUntil > t) {
    return { locked: true, retryAfterSec: Math.ceil((entry.lockUntil - t) / 1000), fails: entry.fails || 0 };
  }
  if (entry.lockUntil && entry.lockUntil <= t) {
    attempts.delete(key);
    return { locked: false, retryAfterSec: 0, fails: 0 };
  }
  return { locked: false, retryAfterSec: 0, fails: entry.fails || 0 };
};

export const recordAdminPasswordFailure = (ip) => {
  const key = String(ip || 'unknown');
  const t = now();
  const entry = attempts.get(key) || { fails: 0, lockUntil: 0, lastFailAt: 0 };
  entry.fails = (entry.fails || 0) + 1;
  entry.lastFailAt = t;
  if (entry.fails >= MAX_FAILS) {
    entry.lockUntil = t + LOCK_MS;
  }
  attempts.set(key, entry);
  return {
    fails: entry.fails,
    locked: Boolean(entry.lockUntil && entry.lockUntil > t),
    retryAfterSec: entry.lockUntil && entry.lockUntil > t ? Math.ceil((entry.lockUntil - t) / 1000) : 0
  };
};

export const clearAdminPasswordFailures = (ip) => {
  attempts.delete(String(ip || 'unknown'));
};

export const issueAdminToken = ({ userId, sessionId, owner }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  if (!userId) throw new Error('userId required');

  return jwt.sign(
    {
      scope: 'admin',
      isAdmin: true,
      role: 'admin',
      owner: owner === true,
      userId: String(userId),
      sessionId: sessionId ? String(sessionId) : null
    },
    secret,
    { expiresIn: TTL_SEC }
  );
};

export const verifyAdminToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  const decoded = jwt.verify(String(token || ''), secret);
  if (!decoded || decoded.scope !== 'admin' || decoded.isAdmin !== true || decoded.role !== 'admin' || !decoded.userId) {
    throw new Error('invalid admin token');
  }
  return decoded;
};

export const ADMIN_TOKEN_TTL_SEC = TTL_SEC;
