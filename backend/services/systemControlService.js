import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const STATE_PATH = path.join(DATA_DIR, 'system-control.json');

const DEFAULT_HELP_TEXT = [
  'Справка AegisTalk.',
  'Команды: /help, /draw <описание>, /settings, /info.',
  'Пример для /draw: /draw киберпанк‑город в неоне.',
  'Настройки: Профиль → Настройки.',
  '????? ??????? ????, ???????? ??? ? @AegisTalkBot ? ??????? ??????????? ???????.',
  'AegisTalk — защищённый мессенджер с Aegis AI и генерацией артов.'
].join('\n');

const DEFAULT_STATE = {
  version: 1,
  updatedAt: null,
  privacyMode: 'open', // open | whitelist | lockdown
  whitelist: [],
  helpText: DEFAULT_HELP_TEXT,
  shield: {
    ddosActive: false,
    xssFilterActive: false
  }
};

let writeChain = Promise.resolve();

const normalizeUserId = (userId) => String(userId || '').trim();

const readStateSync = () => {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const privacyMode = String(parsed?.privacyMode || DEFAULT_STATE.privacyMode);
    const whitelist = Array.isArray(parsed?.whitelist) ? parsed.whitelist.map(normalizeUserId).filter(Boolean) : [];
    const helpTextRaw = parsed?.helpText;
    const helpText =
      typeof helpTextRaw === 'string' && helpTextRaw.trim() ? helpTextRaw : DEFAULT_STATE.helpText;
    const shield = {
      ddosActive: Boolean(parsed?.shield?.ddosActive ?? DEFAULT_STATE.shield.ddosActive),
      xssFilterActive: Boolean(parsed?.shield?.xssFilterActive ?? DEFAULT_STATE.shield.xssFilterActive)
    };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      privacyMode,
      whitelist: Array.from(new Set(whitelist)),
      helpText,
      shield
    };
  } catch (e) {
    return { ...DEFAULT_STATE, updatedAt: new Date().toISOString() };
  }
};

const writeStateAtomic = async (nextState) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(nextState, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_PATH);
};

const updateState = async (mutator) => {
  writeChain = writeChain.then(async () => {
    const current = readStateSync();
    const next = mutator(current);
    const nextState = {
      ...current,
      ...next,
      updatedAt: new Date().toISOString()
    };
    await writeStateAtomic(nextState);
    return nextState;
  });
  return writeChain;
};

export const getPrivacyMode = async () => {
  return readStateSync().privacyMode;
};

export const isUserWhitelisted = async (userId) => {
  const id = normalizeUserId(userId);
  if (!id) return false;
  return readStateSync().whitelist.includes(id);
};

export const updateWhitelist = async (action, userId) => {
  const act = String(action || '').trim().toLowerCase();
  const id = normalizeUserId(userId);
  if (!id) throw new Error('userId is required');
  if (act !== 'add' && act !== 'remove') throw new Error('action must be add|remove');

  const state = await updateState((s) => {
    const set = new Set(s.whitelist || []);
    if (act === 'add') set.add(id);
    if (act === 'remove') set.delete(id);
    return { whitelist: Array.from(set) };
  });

  return {
    ok: true,
    action: act,
    userId: id,
    whitelistCount: state.whitelist.length
  };
};

export const setPrivacyMode = async (level) => {
  const allowed = new Set(['open', 'whitelist', 'lockdown']);
  const nextLevel = String(level || '').trim().toLowerCase();
  if (!allowed.has(nextLevel)) {
    throw new Error(`privacy level must be one of: ${Array.from(allowed).join(', ')}`);
  }

  const state = await updateState(() => ({ privacyMode: nextLevel }));
  return {
    ok: true,
    privacyMode: state.privacyMode
  };
};

export const getShieldConfig = async () => {
  const state = readStateSync();
  return { ...state.shield };
};

export const getHelpText = async () => {
  return readStateSync().helpText || DEFAULT_HELP_TEXT;
};

export const setHelpText = async (text) => {
  const value = String(text || '').trim();
  if (!value) throw new Error('helpText is required');

  const state = await updateState(() => ({ helpText: value }));
  return { ok: true, helpText: state.helpText };
};

export const setShieldConfig = async ({ ddosActive, xssFilterActive } = {}) => {
  const state = await updateState((s) => {
    const current = s.shield || DEFAULT_STATE.shield;
    return {
      shield: {
        ddosActive: ddosActive === undefined ? Boolean(current.ddosActive) : Boolean(ddosActive),
        xssFilterActive:
          xssFilterActive === undefined ? Boolean(current.xssFilterActive) : Boolean(xssFilterActive)
      }
    };
  });

  return {
    ok: true,
    shield: { ...state.shield }
  };
};

export const getSystemStatus = async () => {
  const state = readStateSync();
  const mem = process.memoryUsage();

  return {
    ok: true,
    time: new Date().toISOString(),
    privacyMode: state.privacyMode,
    whitelistCount: state.whitelist.length,
    shield: { ...state.shield },
    runtime: {
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSec: Math.round(process.uptime())
    },
    host: {
      hostname: os.hostname(),
      loadavg: os.loadavg(),
      cpus: os.cpus()?.length || null
    },
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external
    },
    ai: getAiMetricsSnapshot()
  };
};
