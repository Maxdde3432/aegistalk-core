import fs from 'fs';
import path from 'path';
import { Buffer } from 'node:buffer';

const uploadDir = path.join(process.cwd(), 'uploads', 'messages');

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

export const storeMessageMediaBuffer = async ({ fileName, buffer }) => {
  if (!fileName) throw new Error('fileName required');
  if (!buffer) throw new Error('buffer required');

  ensureUploadDir();
  const absolutePath = path.join(uploadDir, fileName);
  fs.writeFileSync(absolutePath, buffer);

  return {
    storagePath: `messages/${fileName}`,
    url: `/uploads/messages/${fileName}`
  };
};

const stripQueryString = (raw = '') => String(raw || '').split('?')[0];

const extractStoragePathFromMediaUrl = (mediaUrl) => {
  const raw = stripQueryString(mediaUrl);
  if (!raw) return null;

  if (raw.startsWith('/uploads/')) return raw.slice('/uploads/'.length);
  if (raw.startsWith('/api/media/')) return raw.slice('/api/media/'.length);
  if (/^[a-z0-9_-]+\/.+/i.test(raw) && !raw.startsWith('http')) return raw.replace(/^\/+/, '');

  return null;
};

export const loadMessageMediaBuffer = async (mediaUrl) => {
  if (!mediaUrl) throw new Error('mediaUrl required');

  if (/^https?:\/\//i.test(mediaUrl)) {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const storagePath = extractStoragePathFromMediaUrl(mediaUrl);
  if (!storagePath) throw new Error('Unsupported mediaUrl');

  const localFile = path.join(process.cwd(), 'uploads', storagePath);
  if (!fs.existsSync(localFile)) throw new Error('File not found');
  return fs.readFileSync(localFile);
};
