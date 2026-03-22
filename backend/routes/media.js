import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { resolveUserIdFromRequest, redirectToLogin } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();
const uploadsRoot = path.join(process.cwd(), 'uploads');

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf'
};

const STREAMABLE_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.ogg', '.m4a']);
const FORCE_DOWNLOAD_MIMES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript'
]);

const normalizeRelativePath = (rawPath = '') => {
  const normalized = path.normalize(String(rawPath || ''));
  const stripped = normalized.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
  return stripped;
};

const resolveLocalFilePath = (relativePath) => {
  const storagePath = normalizeRelativePath(relativePath);
  if (!storagePath) return null;

  const absolutePath = path.join(uploadsRoot, storagePath);
  const relativeFromRoot = path.relative(uploadsRoot, absolutePath);
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null;
  }

  return { storagePath, absolutePath };
};

const verifyChatMembershipIfNeeded = async (messageId, userId) => {
  if (!messageId || !userId) return true;

  const access = await query(
    `SELECT 1
     FROM messages m
     JOIN chats c ON m.chat_id = c.id
     WHERE m.id = $1
       AND (
         c.user1_id = $2 OR c.user2_id = $2 OR
         c.group_id IN (
           SELECT group_id FROM group_members WHERE user_id = $2 AND is_active = TRUE
         )
       )
     LIMIT 1`,
    [messageId, userId]
  );

  return access.rowCount > 0;
};

const handleUnauthorized = (req, res) => {
  const wantsRedirect = req.query.redirect === '1' || req.headers.accept?.includes('text/html');
  if (wantsRedirect) {
    return redirectToLogin(req, res);
  }
  return res.status(403).json({ error: 'Authorization required' });
};

const serveLocalFile = async (req, res) => {
  const relativePath = req.params[0] || '';
  const resolved = resolveLocalFilePath(relativePath);

  if (!resolved) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  const { absolutePath, storagePath } = resolved;
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stats = fs.statSync(absolutePath);
  const ext = path.extname(storagePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const range = req.headers.range;
  const shouldDownload = req.query.download === '1' || FORCE_DOWNLOAD_MIMES.has(mime);
  const downloadName = (req.query.filename || path.basename(storagePath)).replace(/["]/g, '_');

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (shouldDownload) {
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  }

  if (range && STREAMABLE_EXTENSIONS.has(ext)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return res.status(416).send('Malformed Range header');
    }

    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : stats.size - 1;
    const end = Math.min(requestedEnd, stats.size - 1);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stats.size) {
      res.setHeader('Content-Range', `bytes */${stats.size}`);
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(absolutePath, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', stats.size);
  return fs.createReadStream(absolutePath).pipe(res);
};

const mediaRequestHandler = async (req, res) => {
  try {
    const isNavigation =
      req.headers['sec-fetch-site'] === 'none' ||
      req.headers['sec-fetch-mode'] === 'navigate' ||
      req.headers['sec-fetch-dest'] === 'document' ||
      req.headers.accept?.includes('text/html');

    let userId = null;
    try {
      userId = resolveUserIdFromRequest(req);
    } catch {
      userId = null;
    }

    if (isNavigation) {
      if (!userId) {
        return redirectToLogin(req, res);
      }
      return res.redirect('/');
    }

    if (!userId) {
      return handleUnauthorized(req, res);
    }

    const messageId = req.query.messageId;
    const hasAccess = await verifyChatMembershipIfNeeded(messageId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return await serveLocalFile(req, res);
  } catch (error) {
    console.error('[Media] Failed to serve file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }
};

router.get('/api/media/*', mediaRequestHandler);
router.get('/uploads/*', mediaRequestHandler);

export default router;
