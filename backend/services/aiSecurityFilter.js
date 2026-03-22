const WINDOW_MS = 15 * 1000;
const MAX_PER_WINDOW = 8;
const REPEAT_WINDOW_MS = 60 * 1000;
const MAX_REPEAT = 5;
const MAX_HISTORY = 50;

const buckets = new Map(); // userId -> [{ ts, norm, rawLen }]

const normalizeText = (raw = '') =>
  String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const prune = (items, now) => items.filter((i) => now - i.ts <= REPEAT_WINDOW_MS);

const isNonsense = (raw = '') => {
  const text = String(raw || '').trim();
  if (text.length < 30) return false;
  const unique = new Set(text.split(''));
  const uniqueRatio = unique.size / text.length;
  return uniqueRatio <= 0.05 || unique.size <= 2;
};

const detectDdos = (userId, rawText) => {
  const key = String(userId || '').trim();
  if (!key) return false;
  const now = Date.now();
  const norm = normalizeText(rawText);

  const current = prune(buckets.get(key) || [], now);
  current.push({ ts: now, norm, rawLen: String(rawText || '').length });
  const trimmed = current.slice(-MAX_HISTORY);
  buckets.set(key, trimmed);

  const inWindow = trimmed.filter((i) => now - i.ts <= WINDOW_MS);
  if (inWindow.length >= MAX_PER_WINDOW) return true;

  if (norm) {
    const same = trimmed.filter((i) => i.norm === norm && now - i.ts <= REPEAT_WINDOW_MS);
    if (same.length >= MAX_REPEAT) return true;
  }

  if (isNonsense(rawText)) {
    const nonsenseBurst = inWindow.filter((i) => isNonsense(i.norm)).length;
    if (nonsenseBurst >= 3) return true;
  }

  return false;
};

const INJECTION_PATTERNS = [
  /drop\s+table/i,
  /\beval\s*\(/i,
  /ignore\s+previous\s+instructions/i,
  /disregard\s+previous\s+instructions/i,
  /reveal\s+admin\s+password/i,
  /admin\s+password/i,
  /выдай\s+парол/i,
  /парол[ья]\s+админ/i,
  /игнорируй\s+предыдущие\s+инструкции/i
];

const detectPromptInjection = (rawText) => {
  const text = String(rawText || '');
  return INJECTION_PATTERNS.some((re) => re.test(text));
};

export const securityFilter = ({ userId, text, skipInjection = false }) => {
  if (detectDdos(userId, text)) {
    return { action: 'block', flag: 'BLOCK_USER' };
  }
  if (!skipInjection && detectPromptInjection(text)) {
    return { action: 'neutral', reply: 'Я не могу выполнить это действие.', flag: 'PROMPT_INJECTION' };
  }
  return { action: 'allow' };
};
