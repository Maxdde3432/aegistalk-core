import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let encode;
try {
  ({ encode } = require('gpt-3-encoder'));
} catch {
  encode = null;
}

const safeEncode = (text) => {
  const value = String(text || '');
  if (encode) {
    try {
      return encode(value);
    } catch {
      // fall through to heuristic
    }
  }
  const approx = Math.ceil(value.length / 4);
  return new Array(approx).fill(0);
};

export const countTokens = (text) => safeEncode(text).length;

const extractTextContent = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p?.type === 'text' ? String(p.text || '') : ''))
      .filter(Boolean)
      .join(' ');
  }
  if (content && typeof content === 'object' && typeof content.text === 'string') return content.text;
  return '';
};

export const countMessageTokens = (message) => {
  const role = message?.role ? String(message.role) : '';
  const content = extractTextContent(message?.content);
  return countTokens(`${role} ${content}`.trim());
};

export const countMessagesTokens = (messages = []) =>
  messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
