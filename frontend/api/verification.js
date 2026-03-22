import { getApiBaseUrl } from './runtimeConfig.js';
const API_URL = getApiBaseUrl();
import { secureStorage } from '../utils/secureStorage.js';

const getAccessToken = () => secureStorage.getItem('accessToken');

// fetchWithAuth - запрос с авторизацией
const fetchWithAuth = async (url, options = {}) => {
  const token = getAccessToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  return response;
};

export const verificationAPI = {
  // Отправить код подтверждения на email
  sendCode: async (email, purpose = 'registration') => {
    const token = getAccessToken();
    
    const response = await fetch(`${API_URL}/api/verification/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, purpose })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка при отправке кода');
    }

    return result;
  },

  // Проверить код подтверждения
  verifyCode: async (email, code, purpose = 'registration') => {
    const response = await fetch(`${API_URL}/api/verification/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, purpose })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Неверный код');
    }

    return result;
  },

  // Повторная отправка кода
  resendCode: async (email, purpose = 'registration') => {
    const token = getAccessToken();
    
    const response = await fetch(`${API_URL}/api/verification/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, purpose })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Ошибка при повторной отправке');
    }

    return result;
  }
};
