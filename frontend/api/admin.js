import { getApiBaseUrl } from './runtimeConfig.js';
import { secureStorage } from '../utils/secureStorage.js';
import { authAPI } from './auth.js';

const API_URL = getApiBaseUrl();
const ADMIN_TOKEN_KEY = 'admin_token';

export const getAdminToken = () => {
  try {
    return String(localStorage.getItem(ADMIN_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setAdminToken = (token) => {
  try {
    if (!token) localStorage.removeItem(ADMIN_TOKEN_KEY);
    else localStorage.setItem(ADMIN_TOKEN_KEY, String(token));
  } catch {}
};

const fetchWithUserAuth = async (url, options = {}) => {
  let token = secureStorage.getItem('accessToken');
  const headers = {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    try {
      await authAPI.refreshToken();
      token = secureStorage.getItem('accessToken');
      response = await fetch(url, {
        ...options,
        headers: { ...headers, Authorization: token ? `Bearer ${token}` : '' },
      });
    } catch (err) {
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }));
      throw err;
    }
  }

  return response;
};

const attachAdminAuth = (options = {}) => {
  const adminToken = localStorage.getItem('admin_token');
  if (typeof window !== 'undefined') {
    const preview = adminToken ? `${String(adminToken).slice(0, 12)}…` : 'missing';
    console.log('[AdminAPI] Authorization token:', preview);
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  headers.Authorization = `Bearer ${adminToken || ''}`;
  return { ...options, headers };
};

const fetchWithAdminToken = async (url, options = {}) => {
  return fetch(url, attachAdminAuth(options));
};

export const adminAPI = {
  login: async (password) => {
    const res = await fetchWithUserAuth(`${API_URL}/api/admin/login`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Admin login failed');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    const token = data?.token || data?.adminToken || '';
    if (token) setAdminToken(token);
    return data;
  },

  getStatus: async () => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/status`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to load admin status');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },

  toggleShield: async ({ shield = 'ddos', enabled } = {}) => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/toggle-shield`, {
      method: 'POST',
      body: JSON.stringify({ shield, enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to toggle shield');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },

  getLogs: async () => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/logs`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to load logs');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },

  getHelpText: async () => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/help-text`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to load help text');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },

  updateHelpText: async (helpText) => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/help-text`, {
      method: 'POST',
      body: JSON.stringify({ helpText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to update help text');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },

  updateWhitelist: async ({ action = 'add', userId } = {}) => {
    const res = await fetchWithAdminToken(`${API_URL}/api/admin/whitelist`, {
      method: 'POST',
      body: JSON.stringify({ action, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'Failed to update whitelist');
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  },
};

export default adminAPI;
