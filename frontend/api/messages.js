import { getApiBaseUrl } from './runtimeConfig.js';
const API_URL = getApiBaseUrl();
import { secureStorage } from '../utils/secureStorage.js';
import { authAPI, clearTokens } from './auth.js';

const getAccessToken = () => secureStorage.getItem('accessToken');

export const buildProtectedMediaUrl = (reference, modeOrOptions = 'view', maybeOptions = {}) => {
  if (!reference) return '';

  const mode = typeof modeOrOptions === 'string' ? modeOrOptions : 'view';
  const options = typeof modeOrOptions === 'object' && !Array.isArray(modeOrOptions)
    ? modeOrOptions
    : maybeOptions || {};

  const token = getAccessToken();
  const params = new URLSearchParams();
  if (token) params.append('token', token);
  if (options.messageId) params.append('messageId', options.messageId);

  const appendParams = (url) => {
    const query = params.toString();
    if (!query) return url;
    return url.includes('?') ? url + '&' + query : url + '?' + query;
  };

  if (typeof reference === 'string' && reference.startsWith('/uploads/')) {
    const cleaned = reference.replace(/^\/+/, '').replace(/^uploads\//, '');
    return appendParams(API_URL + '/api/media/' + cleaned);
  }

  if (typeof reference === 'string' && reference.startsWith('/api/media/')) {
    const base = reference.startsWith(API_URL) ? reference : API_URL + reference;
    return appendParams(base);
  }

  if (typeof reference === 'string' && reference.startsWith('http')) {
    return reference;
  }

  const baseUrl = API_URL + '/api/messages/' + reference + '/media/' + mode;
  return appendParams(baseUrl);
};

import { decryptArrayBuffer } from '../utils/fileCrypto.js';

export const fetchProtectedMediaBlobUrl = async (messageId, mode = 'view', decryptInfo = null) => {
  const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}/media/${mode}`, {
    headers: {}
  });

  if (!response.ok) {
    let message = 'Не удалось получить приватный файл';
    try {
      const error = await response.json();
      message = error.error || message;
    } catch {
      // ignore json parse errors for binary responses
    }
    throw new Error(message);
  }

  if (!decryptInfo?.key || !decryptInfo?.iv) {
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  const cipherBuffer = await response.arrayBuffer();
  const decrypted = await decryptArrayBuffer(cipherBuffer, decryptInfo.key, decryptInfo.iv);
  const blob = new Blob([decrypted], { type: decryptInfo.mime || 'application/octet-stream' });
  return URL.createObjectURL(blob);
};

export const downloadProtectedMedia = async (messageId, fileName = 'download', decryptInfo = null) => {
  const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}/media/download`, {
    headers: {}
  });

  if (!response.ok) {
    let message = 'Не удалось скачать приватный файл';
    try {
      const error = await response.json();
      message = error.error || message;
    } catch {
      // ignore json parse errors for binary responses
    }
    throw new Error(message);
  }

  let blob;
  if (decryptInfo?.key && decryptInfo?.iv) {
    const cipher = await response.arrayBuffer();
    const decrypted = await decryptArrayBuffer(cipher, decryptInfo.key, decryptInfo.iv);
    blob = new Blob([decrypted], { type: decryptInfo.mime || 'application/octet-stream' });
  } else {
    blob = await response.blob();
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Helper для выполнения запросов с авто-обновлением токена
const fetchWithAuth = async (url, options = {}) => {
  let token = getAccessToken();

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  let response = await fetch(url, { ...options, headers: defaultHeaders });

  // Если токен истёк - пробуем обновить
  if (response.status === 401) {
    try {
      await authAPI.refreshToken();
      token = getAccessToken();

      // Повторяем запрос с новым токеном
      const newHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      };
      response = await fetch(url, { ...options, headers: newHeaders });
    } catch (e) {
      clearTokens();
      secureStorage.clear();
      // Вместо window.location.href используем событие для React Router
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }));
      throw new Error('Session expired');
    }
  }

  return response;
};

// ============================================================================
// MESSAGES API
// ============================================================================
export const messagesAPI = {
  // Получить сообщения
  getMessages: async (chatId, limit = 50, offset = 0) => {
    const response = await fetchWithAuth(
      `${API_URL}/api/messages/chat/${chatId}?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) throw new Error('Failed to get messages');
    return await response.json();
  },

  // Отправить сообщение
  sendMessage: async (chatId, content, options = {}) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        content,
        type: options.type || 'text',
        nonce: options.nonce || '',
        senderPublicKey: options.senderPublicKey || '',
        signature: options.signature || ''
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to send message');
    return result;
  },

  // Обновить статус
  updateStatus: async (messageId, status) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/status`, {
      method: 'PATCH',
      body: JSON.stringify({ messageId, status })
    });

    if (!response.ok) throw new Error('Failed to update status');
    return await response.json();
  },

  // Удалить сообщение
  deleteMessage: async (messageId) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete message');
    return await response.json();
  },

  // Редактировать сообщение
  editMessage: async (messageId, content) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ messageId, content })
    });

    if (!response.ok) throw new Error('Failed to edit message');
    return await response.json();
  },

  // Добавить реакцию
  addReaction: async (messageId, emoji) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/reaction`, {
      method: 'POST',
      body: JSON.stringify({ messageId, emoji })
    });

    if (!response.ok) throw new Error('Failed to add reaction');
    return await response.json();
  },

  // Удалить реакцию
  removeReaction: async (messageId, emoji) => {
    console.log('[API] removeReaction:', { messageId, emoji })
    const response = await fetchWithAuth(`${API_URL}/api/messages/reaction/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, emoji })
    });

    console.log('[API] removeReaction response:', response.status)
    if (!response.ok) {
      const error = await response.json()
      console.error('[API] removeReaction error:', error)
      throw new Error(error.error || 'Failed to remove reaction')
    }
    return await response.json();
  },

  // Получить реакции (опционально, можно загружать с сообщениями)
  getReactionsBatch: async (messageIds) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return {};
    }

    const normalizedIds = messageIds.filter((id) => typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id));
    if (normalizedIds.length === 0) {
      return {};
    }

    const response = await fetchWithAuth(`${API_URL}/api/messages/reactions/batch`, {
      method: 'POST',
      body: JSON.stringify({ messageIds: normalizedIds })
    });
    if (!response.ok) throw new Error('Failed to get reactions batch');
    return await response.json();
  },

  getReactions: async (messageId) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}/reactions`);
    if (!response.ok) throw new Error('Failed to get reactions');
    return await response.json();
  }
};
