import { getShieldConfig } from '../services/systemControlService.js';
import { logSecurityEvent } from '../services/securityLogService.js';

const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_WINDOW = 240;

const buckets = new Map();

const now = () => Date.now();

const getBucket = (ip) => {
  const t = now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= t) {
    const next = { count: 0, resetAt: t + WINDOW_MS };
    buckets.set(ip, next);
    return next;
  }
  return b;
};

const stringifyBody = (v) => {
  try {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return '';
  }
};

const looksLikeXss = (s) => {
  const text = String(s || '');
  return /<\s*script\b|javascript:|onerror\s*=|onload\s*=/i.test(text);
};

export const shieldGate = async (req, res, next) => {
  let shield;
  try {
    shield = await getShieldConfig();
  } catch {
    shield = { ddosActive: false, xssFilterActive: false };
  }

  if (shield.ddosActive) {
    const b = getBucket(req.ip || 'unknown');
    b.count += 1;
    if (b.count > MAX_REQ_PER_WINDOW) {
      logSecurityEvent({
        level: 'warn',
        type: 'ddos_rate_limit',
        message: 'DDoS shield triggered (rate limit)',
        req,
        meta: { windowMs: WINDOW_MS, max: MAX_REQ_PER_WINDOW, count: b.count }
      });
      return res.status(429).json({ error: 'Too many requests' });
    }
  }

  if (shield.xssFilterActive) {
    const bodyText = stringifyBody(req.body);
    const queryText = stringifyBody(req.query);
    if (looksLikeXss(bodyText) || looksLikeXss(queryText)) {
      logSecurityEvent({
        level: 'warn',
        type: 'xss_blocked',
        message: 'XSS filter blocked a request',
        req
      });
      return res.status(400).json({ error: 'Bad request' });
    }
  }

  return next();
};
