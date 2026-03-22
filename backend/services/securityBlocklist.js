const blocks = new Map(); // key -> { untilMs, reason }

const nowMs = () => Date.now();

const normalizeKey = (key) => String(key || '').trim();

export const blockKey = (key, durationMs, reason = 'blocked') => {
  const k = normalizeKey(key);
  if (!k) return;
  const ms = Math.max(0, Number(durationMs) || 0);
  blocks.set(k, { untilMs: nowMs() + ms, reason: String(reason || 'blocked') });
};

export const getBlock = (key) => {
  const k = normalizeKey(key);
  if (!k) return null;
  const b = blocks.get(k);
  if (!b) return null;
  if (nowMs() >= b.untilMs) {
    blocks.delete(k);
    return null;
  }
  return { key: k, ...b, retryAfterSec: Math.ceil((b.untilMs - nowMs()) / 1000) };
};

export const getFirstActiveBlock = (keys = []) => {
  for (const k of keys) {
    const b = getBlock(k);
    if (b) return b;
  }
  return null;
};

