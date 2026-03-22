import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const LOG_PATH = path.join(DATA_DIR, 'security-logs.jsonl');

const safeString = (v) => {
  const s = String(v ?? '').trim();
  return s.length > 4000 ? `${s.slice(0, 4000)}...` : s;
};

const resolveIp = (req) => {
  // trust proxy is enabled in server.js; req.ip should be fine.
  return safeString(req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || '');
};

export const logSecurityEvent = ({ level = 'info', type = 'event', message = '', req = null, meta = {} } = {}) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const entry = {
      time: new Date().toISOString(),
      level: safeString(level),
      type: safeString(type),
      message: safeString(message),
      ip: req ? resolveIp(req) : '',
      path: safeString(req?.originalUrl || req?.url || ''),
      method: safeString(req?.method || ''),
      userId: safeString(req?.user?.id || req?.userId || ''),
      ua: safeString(req?.headers?.['user-agent'] || ''),
      meta: meta && typeof meta === 'object' ? meta : {}
    };
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (e) {
    console.error('[SecurityLog] Failed to write log:', e?.message || e);
  }
};

export const getRecentSecurityLogs = async (limit = 50) => {
  const n = Math.max(1, Math.min(200, Number(limit) || 50));
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const tail = lines.slice(-n);
    return tail
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
};

