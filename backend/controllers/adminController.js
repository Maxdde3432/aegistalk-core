import {
  getSystemStatus,
  setShieldConfig,
  getShieldConfig,
  setPrivacyMode,
  getPrivacyMode,
  getHelpText,
  setHelpText,
  updateWhitelist
} from '../services/systemControlService.js';
import { getRecentSecurityLogs, logSecurityEvent } from '../services/securityLogService.js';
import {
  ADMIN_TOKEN_TTL_SEC,
  clearAdminPasswordFailures,
  getAdminPassword,
  isIpLocked,
  issueAdminToken,
  recordAdminPasswordFailure
} from '../services/adminSessionService.js';
import { query } from '../db/index.js';

const getOwnerId = () => String(process.env.OWNER_ID || '').trim();

let warnedMissingUserRole = false;
const getUserRole = async (userId) => {
  try {
    const { rows } = await query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
    return rows[0]?.role ? String(rows[0].role) : '';
  } catch (e) {
    if (e?.code === '42703') {
      if (!warnedMissingUserRole) {
        warnedMissingUserRole = true;
        console.warn('[adminLogin] users.role column missing; admin role check skipped');
      }
      return '';
    }
    throw e;
  }
};

const normalizeShieldKey = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'ddos' || s === 'ddosActive') return 'ddos';
  if (s === 'xss' || s === 'xssFilter' || s === 'xssFilterActive') return 'xss';
  if (s === 'whitelist' || s === 'whitelistonly' || s === 'whitelist_only') return 'whitelistOnly';
  return 'ddos';
};

export const adminLogin = async (req, res) => {
  console.log('LOGIN ATTEMPT - Body:', req.body);
  const ownerId = getOwnerId();
  const userId = String(req.userId || '');
  let isPrivileged = userId === ownerId;
  if (!isPrivileged) {
    const role = await getUserRole(userId).catch(() => '');
    isPrivileged = role === 'admin' || role === 'owner';
  }
  if (!isPrivileged) {
    logSecurityEvent({
      level: 'critical',
      type: 'admin_login_denied',
      message: 'Critical Security Alert: non-owner attempted /api/admin/login',
      req
    });
    return res.status(403).json({ error: 'forbidden' });
  }

  const lock = isIpLocked(req.ip);
  if (lock.locked) {
    res.setHeader('Retry-After', String(lock.retryAfterSec));
    logSecurityEvent({
      level: 'critical',
      type: 'admin_ip_locked',
      message: 'Critical Security Alert: locked IP attempted /api/admin/login',
      req,
      meta: { retryAfterSec: lock.retryAfterSec }
    });
    return res.status(429).json({ error: 'ip_locked', retryAfterSec: lock.retryAfterSec });
  }

  const password = String(req.body?.password || '');
  const expected = getAdminPassword();
  if (!expected) {
    logSecurityEvent({
      level: 'critical',
      type: 'admin_password_missing',
      message: 'Critical Security Alert: ADMIN_PASSWORD not configured',
      req
    });
    return res.status(500).json({ error: 'admin_password_not_configured' });
  }

  if (password !== expected) {
    const next = recordAdminPasswordFailure(req.ip);
    const level = next.locked ? 'critical' : 'warn';
    logSecurityEvent({
      level,
      type: next.locked ? 'admin_password_lock' : 'admin_password_failed',
      message: next.locked
        ? 'Critical Security Alert: admin password failed 3 times, IP locked for 30 minutes'
        : 'Admin password failed',
      req,
      meta: { fails: next.fails, retryAfterSec: next.retryAfterSec }
    });
    if (next.locked) {
      res.setHeader('Retry-After', String(next.retryAfterSec));
      return res.status(429).json({ error: 'ip_locked', retryAfterSec: next.retryAfterSec });
    }
    return res.status(401).json({ error: 'invalid_password', attemptsLeft: Math.max(0, 3 - next.fails) });
  }

  clearAdminPasswordFailures(req.ip);
  const adminToken = issueAdminToken({
    userId: userId,
    sessionId: req.sessionId,
    owner: userId === ownerId
  });
  logSecurityEvent({
    level: 'info',
    type: 'admin_login_ok',
    message: 'Admin password verified, admin session granted',
    req
  });

  // Return a signed JWT token with isAdmin:true in payload.
  return res.json({ ok: true, token: adminToken, adminToken, expiresInSec: ADMIN_TOKEN_TTL_SEC });
};

export const adminGetStatus = async (req, res) => {
  const status = await getSystemStatus();
  const recentLogs = await getRecentSecurityLogs(50);
  const typeCounts = {};
  const ips = new Set();
  for (const l of recentLogs) {
    const t = String(l?.type || 'unknown');
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    if (l?.ip) ips.add(String(l.ip));
  }
  return res.json({
    ok: true,
    shield: status.shield,
    privacyMode: status.privacyMode,
    ai: status.ai,
    runtime: status.runtime,
    memory: status.memory,
    security: {
      recentLogCount: recentLogs.length,
      uniqueIpCount: ips.size,
      typeCounts
    }
  });
};

export const adminToggleShield = async (req, res) => {
  const shieldKey = normalizeShieldKey(req.body?.shield || req.body?.type || 'ddos');
  const currentShield = await getShieldConfig();
  const currentMode = await getPrivacyMode().catch(() => 'open');

  let result = null;

  if (shieldKey === 'ddos') {
    const next = req.body?.enabled === undefined ? !currentShield.ddosActive : Boolean(req.body.enabled);
    result = await setShieldConfig({ ddosActive: next });
  } else if (shieldKey === 'xss') {
    const next = req.body?.enabled === undefined ? !currentShield.xssFilterActive : Boolean(req.body.enabled);
    result = await setShieldConfig({ xssFilterActive: next });
  } else if (shieldKey === 'whitelistOnly') {
    const next = req.body?.enabled === undefined ? currentMode !== 'whitelist' : Boolean(req.body.enabled);
    await setPrivacyMode(next ? 'whitelist' : 'open');
    result = { ok: true, privacyMode: next ? 'whitelist' : 'open' };
  }

  logSecurityEvent({
    level: 'info',
    type: 'admin_toggle_shield',
    message: `Admin toggled ${shieldKey}`,
    req,
    meta: { body: req.body || null, result }
  });

  const status = await getSystemStatus();
  return res.json({ ok: true, result, status });
};

export const adminGetLogs = async (req, res) => {
  const logs = await getRecentSecurityLogs(50);
  return res.json({ ok: true, logs });
};

export const adminGetHelpText = async (req, res) => {
  const helpText = await getHelpText();
  return res.json({ ok: true, helpText });
};

export const adminUpdateHelpText = async (req, res) => {
  const helpText = String(req.body?.helpText || req.body?.text || '').trim();
  if (!helpText) return res.status(400).json({ error: 'helpText is required' });

  const result = await setHelpText(helpText);
  logSecurityEvent({
    level: 'info',
    type: 'admin_update_help_text',
    message: 'Admin updated help text',
    req
  });
  return res.json({ ok: true, helpText: result.helpText });
};

export const adminUpdateWhitelist = async (req, res) => {
  const { action = 'add', userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const result = await updateWhitelist(action, userId);
  logSecurityEvent({
    level: 'info',
    type: 'admin_update_whitelist',
    message: `Admin whitelist ${result.action} ${result.userId}`,
    req
  });
  return res.json({ ok: true, result });
};
