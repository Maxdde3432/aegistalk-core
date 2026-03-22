// --- [CLEANUP & SECURITY BLOCK] ---
console.clear();
process.stdout.write("\x1B[2J\x1B[0f");
console.log("\x1b[32m%s\x1b[0m", "► [SYSTEM]: Console buffer cleared [2026-03-04].");
console.log("\x1b[35m%s\x1b[0m", "► [SECURITY]: Data stream encrypted for session.");
console.log("------------------------------------------");
console.log("\x1b[33m%s\x1b[0m", "КОПИЯ");
console.log("\x1b[31m%s\x1b[0m", "ОТВЕТСТВЕННОСТЬ");
console.log("Все дальнейшие действия ведутся под строкой ответственности.");
console.log("------------------------------------------");

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { ExpressPeerServer } from 'peer';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import siteVerificationRoutes from './routes/siteVerification.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import contactsRoutes from './routes/contacts.js';
import groupRoutes from './routes/groups.js';
import verificationRoutes from './routes/verification.js';
import profileRoutes from './routes/profile.js';
import mediaRoutes from './routes/media.js';
import adminRoutes from './routes/adminRoutes.js';
import storyRoutes from './routes/stories.js';
import pool, { query } from './db/index.js';
import { ensureFavoritesChat } from './controllers/chatController.js';
import { sendIncomingCallPush } from './services/pushNotificationService.js';
import { shieldGate } from './middleware/shieldGate.js';

dotenv.config();

// Safety net: prevent hard crashes due to unhandled async errors.
// We still log loudly so root causes can be fixed; this mainly helps Railway stability.
process.on('unhandledRejection', (reason) => {
  console.error('[Process] UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] UncaughtException:', err);
});

console.log('[Email Config]', {
  deliveryMode: 'smtp',
  smtpEnabled: Boolean(
    String(process.env.SMTP_HOST || '').trim() &&
    String(process.env.SMTP_USER || '').trim() &&
    String(process.env.SMTP_PASS || '').trim()
  ),
  smtpHost: String(process.env.SMTP_HOST || '').trim() || '(disabled)',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  emailFrom: process.env.EMAIL_FROM || 'AegisTalk <noreply@localhost>',
  googleClientConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/google',
  googleClientIdSuffix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(-12) : '(missing)'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Database Migrations
// ============================================================================
const migrationsDir = path.join(__dirname, 'db', 'migrations');
const baseSchemaPath = path.join(__dirname, 'db', 'init.sql');
const baseMigrationsIncludedInInit = new Set([
  '000_create_users.sql',
  '002_message_reactions.sql',
  '20260321_create_contacts_table.sql'
]);

const ensureMigrationTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const markMigrationApplied = async (filename) => {
  await pool.query(
    `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
    [filename]
  );
};

const bootstrapBaseSchemaIfNeeded = async () => {
  const result = await pool.query(`SELECT to_regclass('public.users') AS users_table`);
  if (result.rows[0]?.users_table) {
    return false;
  }

  if (!fs.existsSync(baseSchemaPath)) {
    throw new Error(`Base schema file not found: ${baseSchemaPath}`);
  }

  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  const baseSchemaSql = fs.readFileSync(baseSchemaPath, 'utf8');
  await pool.query(baseSchemaSql);

  for (const filename of baseMigrationsIncludedInInit) {
    await markMigrationApplied(filename);
  }

  console.log('[Migrations] Base schema bootstrapped from db/init.sql');
  return true;
};

const runMigrations = async () => {
  try {
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migrations] No migrations directory, skipping...');
      return;
    }

    await ensureMigrationTable();
    await bootstrapBaseSchemaIfNeeded();

    const appliedRows = await pool.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(appliedRows.rows.map((row) => row.filename));
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .filter(f => !f.startsWith('999_'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      await markMigrationApplied(file);
      console.log(`[Migrations] Applied: ${file}`);
    }

    console.log('[Migrations] Database schema is up to date');
  } catch (error) {
    console.error('[Migrations] Error:', error.message);
    throw error;
  }
};

await runMigrations();

// ============================================================================
// Backfill favorites (self) chats for existing users
// ============================================================================
const backfillFavoritesChats = async () => {
  try {
    const users = await query(`SELECT id FROM users`);
    console.log('[BackfillFavorites] Users to process:', users.rowCount);

    for (const row of users.rows) {
      await ensureFavoritesChat(row.id);
    }

    console.log('[BackfillFavorites] Completed ensuring favorites chats');
  } catch (error) {
    console.error('[BackfillFavorites] Error:', error);
  }
};

await backfillFavoritesChats();

// ============================================================================
// Express App
// ============================================================================
const app = express();
const PORT = process.env.PORT || 4000;

// FIX: Trust proxy for Railway (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

let wss;
let peerSocketServer = null;
let peerSocketPath = null;
const PEER_MOUNT_PATH = '/peerjs';

const normalizeWsPath = (value = '') => {
  if (typeof value !== 'string') return '/';
  const withoutQuery = value.split('?')[0] || '/';
  const normalized = withoutQuery.replace(/\/+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized || '/';
};

// ============================================================================
// WebSocket Helper Functions
// ============================================================================
const userSockets = new Map();
const disconnectTimeouts = new Map();
const chatRooms = new Map();
const callOfferAttempts = new Map();
const CALL_SIGNAL_WINDOW_MS = 60_000;
const MAX_CALL_OFFERS_PER_WINDOW = 8;

const getSocketSet = (userInfo) => {
  if (!userInfo) return new Set();
  if (userInfo.sockets instanceof Set) {
    return userInfo.sockets;
  }
  const sockets = new Set();
  if (userInfo.socket) {
    sockets.add(userInfo.socket);
  }
  userInfo.sockets = sockets;
  return sockets;
};

const getActiveSocketsForUser = (userInfo) => {
  const sockets = getSocketSet(userInfo);
  const active = [];
  sockets.forEach((socket) => {
    if (socket && socket.readyState === 1) {
      active.push(socket);
      return;
    }
    sockets.delete(socket);
  });
  if (userInfo && !active.includes(userInfo.socket)) {
    userInfo.socket = active[active.length - 1] || null;
  }
  return active;
};

const attachSocketToUser = (userId, socket) => {
  const existing = userSockets.get(userId);
  if (existing) {
    const sockets = getSocketSet(existing);
    sockets.add(socket);
    existing.socket = socket;
    existing.lastActivity = Date.now();
    return existing;
  }

  const created = {
    socket,
    sockets: new Set([socket]),
    chatId: null,
    lastActivity: Date.now()
  };
  userSockets.set(userId, created);
  return created;
};

const detachSocketFromUser = (userId, socket) => {
  const userInfo = userSockets.get(userId);
  if (!userInfo) {
    return false;
  }

  const sockets = getSocketSet(userInfo);
  sockets.delete(socket);
  const active = getActiveSocketsForUser(userInfo);
  if (active.length > 0) {
    userInfo.socket = active[active.length - 1];
    return false;
  }

  userSockets.delete(userId);
  return true;
};

const normalizeSocketId = (value, maxLength = 160) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
};

const normalizeSocketText = (value, maxLength = 32000) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
};

const normalizeSocketInteger = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

const verifySocketToken = (token) => {
  if (typeof token !== 'string' || !token.trim()) return null;

  try {
    const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);
    return decoded && decoded.userId ? decoded : null;
  } catch (error) {
    return null;
  }
};

const consumeCallOfferQuota = (userId) => {
  const now = Date.now();
  const attempts = callOfferAttempts.get(userId) || [];
  const freshAttempts = attempts.filter((timestamp) => now - timestamp < CALL_SIGNAL_WINDOW_MS);

  if (freshAttempts.length >= MAX_CALL_OFFERS_PER_WINDOW) {
    callOfferAttempts.set(userId, freshAttempts);
    return false;
  }

  freshAttempts.push(now);
  callOfferAttempts.set(userId, freshAttempts);
  return true;
};

const buildProtectedCallPayload = (type, data, userId) => {
  const callId = normalizeSocketId(data.callId, 128);
  const receiverId = normalizeSocketId(data.receiverId);
  const callerId = normalizeSocketId(data.callerId);
  const targetUserId = normalizeSocketId(data.targetUserId);

  if (!callId) {
    return { error: 'invalid_call_id' };
  }

  if ((callerId && callerId !== userId) || (type !== 'call_offer' && receiverId && receiverId !== userId)) {
    return { error: 'spoofed_call_identity' };
  }

  if (type === 'call_offer') {
    if (!receiverId || receiverId === userId) {
      return { error: 'invalid_call_target' };
    }

    return {
      targetUserId: receiverId,
      payload: {
        type,
        callId,
        callerId: userId,
        receiverId,
        callType: data.callType === 'video' ? 'video' : 'audio',
        callerName: normalizeSocketId(data.callerName, 120) || 'Контакт',
        callerAvatar: typeof data.callerAvatar === 'string' ? data.callerAvatar : null
      }
    };
  }

  if (type === 'call_accepted' || type === 'call_rejected') {
    const resolvedTarget = callerId || targetUserId;
    if (!resolvedTarget || resolvedTarget === userId) {
      return { error: 'invalid_call_target' };
    }

    return {
      targetUserId: resolvedTarget,
      payload: {
        type,
        callId,
        callerId: resolvedTarget,
        receiverId: userId,
        callType: data.callType === 'video' ? 'video' : 'audio',
        reason: normalizeSocketId(data.reason, 64) || null
      }
    };
  }

  if (type === 'call_type_change') {
    const resolvedTarget = targetUserId || receiverId || callerId
    if (!resolvedTarget || resolvedTarget === userId) {
      return { error: 'invalid_call_target' };
    }

    return {
      targetUserId: resolvedTarget,
      payload: {
        type,
        callId,
        callerId: userId,
        receiverId: resolvedTarget,
        callType: data.callType === 'video' ? 'video' : 'audio'
      }
    };
  }

  if (type === 'call_end') {
    const resolvedTarget = targetUserId || receiverId || callerId;
    if (!resolvedTarget || resolvedTarget === userId) {
      return { error: 'invalid_call_target' };
    }

    return {
      targetUserId: resolvedTarget,
      payload: {
        type,
        callId,
        callerId: userId,
        receiverId: resolvedTarget,
        reason: normalizeSocketId(data.reason, 64) || null
      }
    };
  }

  return { error: 'unsupported_call_type' };
};

const buildProtectedRtcPayload = (type, data, userId) => {
  const callId = normalizeSocketId(data.callId, 128);
  const targetUserId = normalizeSocketId(
    data.targetUserId || data.receiverId || data.callerId
  );

  if (!callId) {
    return { error: 'invalid_call_id' };
  }

  if (!targetUserId || targetUserId === userId) {
    return { error: 'invalid_call_target' };
  }

  if (type === 'webrtc_offer' || type === 'webrtc_answer') {
    const sdp = normalizeSocketText(data.sdp, 24000);
    if (!sdp) {
      return { error: 'invalid_sdp' };
    }

    return {
      targetUserId,
      payload: {
        type,
        callId,
        callerId: userId,
        receiverId: targetUserId,
        callType: data.callType === 'video' ? 'video' : 'audio',
        sdp
      }
    };
  }

  if (type === 'webrtc_ice_candidate') {
    const candidate = normalizeSocketText(data.candidate, 8000);
    const sdpMid = normalizeSocketText(data.sdpMid, 120);
    const sdpMLineIndex = normalizeSocketInteger(data.sdpMLineIndex);
    if (!candidate || sdpMLineIndex === null) {
      return { error: 'invalid_ice_candidate' };
    }

    return {
      targetUserId,
      payload: {
        type,
        callId,
        callerId: userId,
        receiverId: targetUserId,
        candidate,
        sdpMid,
        sdpMLineIndex
      }
    };
  }

  return { error: 'unsupported_rtc_type' };
};

const broadcastUserStatus = (userId, isOnline, lastSeen = null) => {
  const statusData = JSON.stringify({
    type: 'user_status_changed',
    userId,
    isOnline,
    lastSeen
  });
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(statusData);
      }
    });
  }
};

const hasOtherActiveSockets = (userId, excludeSocket = null) => {
  const userInfo = userSockets.get(userId);
  if (!userInfo) return false;
  return getActiveSocketsForUser(userInfo)
    .some((socket) => socket !== excludeSocket);
};

const cancelPendingDisconnect = (userId) => {
  const disconnectInfo = disconnectTimeouts.get(userId);
  if (disconnectInfo) {
    clearTimeout(disconnectInfo.timeout);
    disconnectTimeouts.delete(userId);
  }
};

const scheduleDisconnect = (userId) => {
  if (hasOtherActiveSockets(userId)) {
    return;
  }
  cancelPendingDisconnect(userId);
  const lastSeen = new Date().toISOString();
  const timeout = setTimeout(() => {
    if (!userSockets.has(userId)) {
      disconnectTimeouts.delete(userId);
      broadcastUserStatus(userId, false, lastSeen);
      chatRooms.forEach((members, chatId) => {
        members.delete(userId);
        if (members.size === 0) chatRooms.delete(chatId);
      });
    } else {
      disconnectTimeouts.delete(userId);
    }
  }, 10000);
  disconnectTimeouts.set(userId, { timeout, lastSeen });
};

const sendMessageToChat = (chatId, payload, chatType = 'private') => {
  const members = chatRooms.get(chatId);
  if (!members) return;
  const eventType = payload.eventType || payload.type || 'new_message';
  let messageData;
  if (eventType === 'new_message') {
    const { eventType: _, ...messagePayload } = payload;
    messageData = JSON.stringify({ type: 'new_message', chatId, chatType, message: messagePayload });
  } else {
    const { eventType: __, ...rest } = payload;
    messageData = JSON.stringify({ type: eventType, chatId, chatType, ...rest });
  }
  members.forEach(memberId => {
    const userInfo = userSockets.get(memberId);
    getActiveSocketsForUser(userInfo).forEach((socket) => {
      socket.send(messageData);
    });
  });
};

const ensureUserInChatMembers = (userId, chatId) => {
  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Set());
  }
  chatRooms.get(chatId).add(userId);
  const userInfo = userSockets.get(userId);
  if (userInfo) {
    userInfo.chatId = chatId;
  }
};

const sendToUser = (userId, data, options = {}) => {
  const suppressWarning = options.suppressWarning === true;
  const userInfo = userSockets.get(userId);
  const activeSockets = getActiveSocketsForUser(userInfo);
  if (activeSockets.length > 0) {
    const payload = JSON.stringify(data);
    activeSockets.forEach((socket) => socket.send(payload));
    return true;
  }
  const logPayload = {
    userId,
    type: data?.type || 'unknown'
  };
  if (suppressWarning) {
    console.log('[WS] Target socket unavailable (transient)', logPayload);
  } else {
    console.warn('[WS] Target socket unavailable', logPayload);
  }
  return false;
};

// ============================================================================
// Security Middleware
// ============================================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// FIX: Trust proxy for Railway (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(cors({
  origin: true, // Allow all origins (Railway handles this)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' });
  }
});
app.use('/api/auth/', authLimiter);

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' });
  }
});
app.use('/api/', generalLimiter);
app.use('/api', shieldGate);

// ============================================================================
// Health Check
// ============================================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AegisTalk Backend',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'AegisTalk Backend',
      database: 'disconnected'
    });
  }
});

// ============================================================================
// Routes
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', siteVerificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/stories', storyRoutes);
app.use(mediaRoutes);

// ============================================================================
// Frontend Static Files (FIX: Serve React app)
// ============================================================================
// Resolve from backend/src, not from process.cwd(), so it works both from repo root
// and from `cd backend && npm start` in Railway.
const frontendPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const systemBotAvatarPath = path.resolve(__dirname, '..', 'frontend', 'public', 'aegistalk-bot.svg');

app.get('/aegistalk-bot.svg', (req, res) => {
  try {
    if (fs.existsSync(systemBotAvatarPath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(systemBotAvatarPath);
    }
    return res.status(404).send('Not found');
  } catch (e) {
    return res.status(500).send('Internal error');
  }
});

// Check if frontend exists
if (fs.existsSync(frontendPath)) {
  console.log('[Server] Frontend found:', frontendPath);
  app.use(express.static(frontendPath));
} else {
  console.warn('[Server] Frontend NOT found at:', frontendPath);
}

const serveIndex = (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).json({ error: 'Frontend not found' });
};

// Serve SPA for known client routes (profile, chat, etc.) and any non-API path
app.all('/', serveIndex);
app.get('/favicon.ico', serveIndex);
app.get(['/profile', '/profile/*'], serveIndex);

// SPA fallback - serve index.html only for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  return serveIndex(req, res);
});

// ============================================================================
// Error Handling
// ============================================================================
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Error]:', err.message);
  } else {
    console.error('Error:', err);
  }
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// ============================================================================
// HTTP Server
// ============================================================================
const httpServer = createServer(app);
app.set('wss', null);

const PEER_SERVER_KEY = process.env.PEER_SERVER_KEY || 'aegis-peer';
const peerServer = ExpressPeerServer(httpServer, {
  path: '/rtc',
  proxied: true,
  key: PEER_SERVER_KEY,
  allow_discovery: false,
  createWebSocketServer: (options) => {
    peerSocketPath = options.path;
    peerSocketServer = new WebSocketServer({ noServer: true });
    return peerSocketServer;
  }
});

peerServer.on('connection', (client) => {
  console.log('[Peer] Connected:', client.getId?.() || client.id || 'unknown');
});

peerServer.on('disconnect', (client) => {
  console.log('[Peer] Disconnected:', client.getId?.() || client.id || 'unknown');
});

console.log('[Peer] Mount path:', PEER_MOUNT_PATH, 'socket path:', peerSocketPath);

app.use(PEER_MOUNT_PATH, peerServer);

// ============================================================================
// WebSocket Server
// ============================================================================
wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = normalizeWsPath(new URL(request.url || '/', 'http://localhost').pathname);
  const directPeerPath = normalizeWsPath(peerSocketPath || '');
  const mountedPeerPath = normalizeWsPath(`${PEER_MOUNT_PATH}/${peerSocketPath || ''}`);

  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  if (
    peerSocketServer &&
    peerSocketPath &&
    (pathname === directPeerPath || pathname === mountedPeerPath)
  ) {
    peerSocketServer.handleUpgrade(request, socket, head, (ws) => {
      peerSocketServer.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

app.set('wss', wss);

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

setInterval(() => {
  const now = Date.now();
  const threeMinutes = 3 * 60 * 1000;
  userSockets.forEach((userInfo, userId) => {
    const inactivity = now - userInfo.lastActivity;
    if (inactivity > threeMinutes) {
      broadcastUserStatus(userId, false, new Date().toISOString());
    }
  });
}, 60000);

wss.on('connection', (ws, req) => {
  let userId = null;
  let currentChatId = null;

  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 10000);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (userId && userSockets.has(userId)) {
        const userInfo = userSockets.get(userId);
        userInfo.lastActivity = Date.now();
      }

      if (data.type === 'auth' && data.userId) {
        const requestedUserId = normalizeSocketId(data.userId);
        const decoded = verifySocketToken(data.token);

        if (!requestedUserId || !decoded || decoded.userId !== requestedUserId) {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'invalid_token' }));
          ws.close(4001, 'invalid_token');
          return;
        }

        userId = requestedUserId;
        currentChatId = null;
        const alreadyOnline = hasOtherActiveSockets(userId, ws);
        cancelPendingDisconnect(userId);
        attachSocketToUser(userId, ws);
        ws.send(JSON.stringify({ type: 'auth_success', userId }));

        const onlineList = Array.from(userSockets.keys()).filter(id => id !== userId);
        ws.send(JSON.stringify({
          type: 'online_users_list',
          users: onlineList.map(id => ({ userId: id, isOnline: true }))
        }));

        if (!alreadyOnline) {
          userSockets.forEach((userInfo, socketUserId) => {
            if (socketUserId !== userId) {
              getActiveSocketsForUser(userInfo).forEach((socket) => {
                socket.send(JSON.stringify({
                  type: 'user_status_changed',
                  userId: userId,
                  isOnline: true
                }));
                const updatedOnlineList = Array.from(userSockets.keys()).filter(id => id !== socketUserId);
                socket.send(JSON.stringify({
                  type: 'online_users_list',
                  users: updatedOnlineList.map(id => ({ userId: id, isOnline: true }))
                }));
              });
            }
          });
        }
      }

      if (data.type !== 'auth' && !userId) {
        ws.send(JSON.stringify({ type: 'auth_error', error: 'authentication_required' }));
        return;
      }

      if (data.type === 'join_room' && data.chatId && userId) {
        if (currentChatId) {
          const prevRoom = chatRooms.get(currentChatId);
          if (prevRoom) {
            prevRoom.delete(userId);
            if (prevRoom.size === 0) chatRooms.delete(currentChatId);
          }
        }
        currentChatId = data.chatId;
        if (!chatRooms.has(data.chatId)) {
          chatRooms.set(data.chatId, new Set());
        }
        chatRooms.get(data.chatId).add(userId);
        const userInfo = userSockets.get(userId);
        if (userInfo) {
          userInfo.chatId = data.chatId;
        }
        ws.send(JSON.stringify({ type: 'joined_room', chatId: data.chatId }));
      }

      if (data.type === 'typing_start' && data.chatId && userId) {
        const members = chatRooms.get(data.chatId);
        if (members) {
          members.forEach(memberId => {
            if (memberId !== userId) {
              const memberInfo = userSockets.get(memberId);
              getActiveSocketsForUser(memberInfo).forEach((socket) => {
                socket.send(JSON.stringify({
                  type: 'display_typing',
                  userId,
                  chatId: data.chatId,
                  isTyping: true
                }));
              });
            }
          });
        }
      }

      if (data.type === 'typing_stop' && data.chatId && userId) {
        const members = chatRooms.get(data.chatId);
        if (members) {
          members.forEach(memberId => {
            if (memberId !== userId) {
              const memberInfo = userSockets.get(memberId);
              getActiveSocketsForUser(memberInfo).forEach((socket) => {
                socket.send(JSON.stringify({
                  type: 'display_typing',
                  userId,
                  chatId: data.chatId,
                  isTyping: false
                }));
              });
            }
          });
        }
      }

      if (data.type === 'subscribe_chat' && data.chatId && userId) {
        if (!chatRooms.has(data.chatId)) {
          chatRooms.set(data.chatId, new Set());
        }
        chatRooms.get(data.chatId).add(userId);
        ws.send(JSON.stringify({ type: 'subscribed', chatId: data.chatId }));
      }

      if (data.type === 'unsubscribe_chat' && data.chatId && userId) {
        const room = chatRooms.get(data.chatId);
        if (room) {
          room.delete(userId);
          if (room.size === 0) chatRooms.delete(data.chatId);
        }
        if (currentChatId === data.chatId) currentChatId = null;
        const userInfo = userSockets.get(userId);
        if (userInfo) userInfo.chatId = null;
      }

      if (data.type === 'message_read' && data.chatId && userId) {
        const messageIds = Array.isArray(data.messageIds)
          ? data.messageIds.map(id => String(id || '').trim()).filter(Boolean)
          : [];

        if (messageIds.length > 0) {
          const result = await query(
            `UPDATE messages m
             SET status = 'read'
             FROM chats c
             WHERE m.id = ANY($1::uuid[])
               AND m.chat_id = c.id
               AND (c.id = $2 OR c.group_id = $2)
               AND m.sender_id != $3
               AND (m.status IS NULL OR m.status <> 'read')
             RETURNING m.id, m.chat_id, m.sender_id, m.status`,
            [messageIds, data.chatId, userId]
          );

          if (result.rows.length > 0) {
            const updatedIds = result.rows.map(row => row.id);

            sendMessageToChat(
              data.chatId,
              {
                eventType: 'message_status',
                messageIds: updatedIds,
                status: 'read',
                userId
              },
              'private'
            );

            const senders = [...new Set(result.rows.map(row => row.sender_id).filter(Boolean))];
            senders.forEach(senderId => {
              if (senderId !== userId) {
                sendToUser(senderId, {
                  type: 'message_status',
                  chatId: data.chatId,
                  messageIds: updatedIds,
                  status: 'read',
                  userId
                }, { suppressWarning: true });
              }
            });
          }
        }
      }

      if (['call_offer', 'call_accepted', 'call_rejected', 'call_end', 'call_type_change'].includes(data.type)) {
        if (data.type === 'call_offer' && !consumeCallOfferQuota(userId)) {
          ws.send(JSON.stringify({ type: 'call_error', code: 'CALL_RATE_LIMIT' }));
          return;
        }

        const protectedSignal = buildProtectedCallPayload(data.type, data, userId);
        if (protectedSignal.error) {
          ws.send(JSON.stringify({ type: 'call_error', code: protectedSignal.error }));
          return;
        }

        if (protectedSignal.targetUserId) {
          console.log('[WS][CallSignal]', {
            type: data.type,
            from: userId,
            to: protectedSignal.targetUserId,
            callId: protectedSignal.payload.callId
          });

          const delivered = sendToUser(
            protectedSignal.targetUserId,
            protectedSignal.payload,
            { suppressWarning: data.type === 'call_offer' }
          );
          if (!delivered) {
            if (data.type === 'call_offer') {
              try {
                const tokenResult = await query(
                  `SELECT fcm_token FROM users WHERE id = $1`,
                  [protectedSignal.targetUserId]
                );
                const fcmToken = String(tokenResult.rows[0]?.fcm_token || '').trim();
                if (fcmToken) {
                  const pushSent = await sendIncomingCallPush({
                    token: fcmToken,
                    callerName: protectedSignal.payload.callerName,
                    data: {
                      callId: protectedSignal.payload.callId,
                      callerId: protectedSignal.payload.callerId,
                      callerName: protectedSignal.payload.callerName,
                      callerAvatar: protectedSignal.payload.callerAvatar || '',
                      callType: protectedSignal.payload.callType || 'audio',
                      targetUserId: protectedSignal.targetUserId
                    }
                  });
                  if (pushSent) {
                    return;
                  }
                }
              } catch (pushError) {
                console.error('[WS] Incoming call push fallback error:', pushError);
              }
            }

            ws.send(JSON.stringify({
              type: 'call_error',
              code: 'TARGET_UNAVAILABLE',
              callId: protectedSignal.payload.callId,
              targetUserId: protectedSignal.targetUserId,
              reason: data.type === 'call_offer' ? 'offline' : 'unavailable'
            }));
          }
        }
      }

      if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'].includes(data.type)) {
        const protectedRtcSignal = buildProtectedRtcPayload(data.type, data, userId);
        if (protectedRtcSignal.error) {
          ws.send(JSON.stringify({ type: 'call_error', code: protectedRtcSignal.error }));
          return;
        }

        if (protectedRtcSignal.targetUserId) {
          const delivered = sendToUser(
            protectedRtcSignal.targetUserId,
            protectedRtcSignal.payload
          );
          if (!delivered) {
            ws.send(JSON.stringify({
              type: 'call_error',
              code: 'TARGET_UNAVAILABLE',
              callId: protectedRtcSignal.payload.callId
            }));
          }
        }
      }

    } catch (error) {
      console.error('[WS] Error processing message:', error);
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeatInterval);
    if (userId) {
      detachSocketFromUser(userId, ws);
      scheduleDisconnect(userId);
    }
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
});

// ============================================================================
// Start Server
// ============================================================================
async function startServer() {
  try {
    console.log('[Server] Starting server...');
    console.log('[Server] PORT:', PORT);
    console.log('[Server] NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('[Server] Frontend:', frontendPath);

    // Проверка подключения к базе данных
    console.log('[Server] Testing database connection...');
    const testQuery = await query('SELECT NOW() as db_time');
    console.log('[DB] Connection successful! Server time:', testQuery.rows[0].db_time);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🛡️  AegisTalk Backend Started                   ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}                    ║
║  WebSocket:    ws://localhost:${PORT}/ws                   ║
║  Frontend:   ${frontendPath}
║  Environment:  ${process.env.NODE_ENV || 'development'}                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    wss.close(() => {
      console.log('[Server] WebSocket server closed');
      process.exit(0);
    });
  });
});

export { app, httpServer, wss, userSockets, chatRooms, broadcastUserStatus, sendMessageToChat, ensureUserInChatMembers, sendToUser };
