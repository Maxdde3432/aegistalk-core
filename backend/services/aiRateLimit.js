const WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 3;

const buckets = new Map(); // userId -> [timestamps]

const prune = (timestamps, now) => timestamps.filter((t) => now - t < WINDOW_MS);

export const checkAiRateLimit = (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const key = String(userId || '').trim();
  if (!key) return { allowed: true, retryAfterSec: 0, remaining: limit };

  const now = Date.now();
  const current = prune(buckets.get(key) || [], now);

  if (current.length >= limit) {
    buckets.set(key, current);
    const oldest = Math.min(...current);
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  current.push(now);
  buckets.set(key, current);
  return { allowed: true, retryAfterSec: 0, remaining: Math.max(0, limit - current.length) };
};

export const AI_RATE_LIMIT_MESSAGE = 'ИИ взял перерыв на кофе, попробуйте через минуту';
