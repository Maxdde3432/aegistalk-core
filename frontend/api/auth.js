import { getApiBaseUrl, isNativeApp } from './runtimeConfig.js';
const API_URL = getApiBaseUrl();
import { secureStorage } from '../utils/secureStorage.js';
import { generateUserKeyPair } from '../utils/e2ee.js';
const GOOGLE_AUTH_URL = `${API_URL}/api/auth/google`;
let refreshTokenPromise = null;

const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
};

const withTimezoneHeader = (headers = {}) => ({
  ...headers,
  'X-Timezone': getClientTimezone()
});

const buildGoogleAuthUrl = (next = '/chat') => {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('next', next);
  url.searchParams.set('tz', getClientTimezone());

  if (isNativeApp()) {
    url.searchParams.set('mode', 'native');
  }

  return url.toString();
};

const openGoogleAuthFlow = async (next = '/chat') => {
  const url = buildGoogleAuthUrl(next);

  window.location.href = url;
};

const normalizeAuthErrorMessage = (message, fallback = 'Произошла ошибка авторизации') => {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return fallback;
  }

  if (
    /google/.test(lower) && (
      text.includes('Этот аккаунт создан через Google') ||
      lower.includes('created through google') ||
      lower.includes('created via google')
    )
  ) {
    return 'Этот аккаунт создан через Google. Используйте кнопку "Войти через Google".';
  }

  if (
    text.includes('Неверные учётные данные') ||
    text.includes('Неверные учетные данные') ||
    lower.includes('invalid credentials')
  ) {
    return 'Неверные учётные данные';
  }

  if (text.includes('Неверный код') || lower.includes('invalid code')) {
    return 'Неверный код';
  }

  if (text.includes('Код не найден') || lower.includes('code not found')) {
    return 'Код не найден';
  }

  return text;
};

const decodeBase64Json = (value) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    const utf8 = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    return JSON.parse(utf8);
  } catch (error) {
    throw new Error('Не удалось прочитать данные подтверждения');
  }
};

// fetchWithAuth - запрос с автоматическим обновлением токена
const fetchWithAuth = async (url, options = {}) => {
  let token = getAccessToken();
  
  if (!token) {
    // Без токена не дергаем защищённые эндпоинты
    window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }));
    throw new Error('No authorization token');
  }

  const response = await fetch(url, {
    ...options,
    headers: withTimezoneHeader({
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    })
  });

  // Если 401 - пробуем обновить токен
  if (response.status === 401) {
    try {
      await authAPI.refreshToken();
      token = getAccessToken();

      // Повторяем запрос
      const retryResponse = await fetch(url, {
        ...options,
        headers: withTimezoneHeader({
          ...options.headers,
          'Authorization': `Bearer ${token}`
        })
      });

      return retryResponse;
    } catch (e) {
      clearTokens();
      throw e;
    }
  }

  return response;
};

// Генерация ключей шифрования (упрощённо для демонстрации)
const generateKeyPair = async () => generateUserKeyPair();

const generateLegacyKeyPair = async () => {
  // В production использовать TweetNaCl.js для реального E2E шифрования
  const keyPair = {
    publicKey: btoa(`pubkey_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    secretKey: btoa(`seckey_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  };

  // Подпись публичного ключа
  const signature = btoa(`sig_${keyPair.publicKey}`);

  return {
    publicKey: keyPair.publicKey,
    publicKeySignature: signature,
    secretKey: keyPair.secretKey
  };
};

// Сохранение токенов
const saveTokens = (accessToken, refreshToken) => {
  try {
    // Сохраняем токены как строки (НЕ используем JSON.stringify!)
    const accessTokenStr = String(accessToken);
    const refreshTokenStr = String(refreshToken);
    
    
    // Сохраняем напрямую как строки
    const saved1 = secureStorage.setItem('accessToken', accessTokenStr);
    const saved2 = secureStorage.setItem('refreshToken', refreshTokenStr);
    
    
    if (!saved1 || !saved2) {
      console.error('[Auth] Failed to save tokens to secureStorage!');
    }
  } catch (error) {
    console.error('[Auth] saveTokens error:', error);
  }
};

// Получение токена
const getAccessToken = () => {
  const token = secureStorage.getItem('accessToken');
  
  // Проверяем что есть в localStorage
  // Возвращаем строку
  if (typeof token === 'string') {
    return token;
  }
  // Если объект (старый формат), извлекаем токен
  if (token && typeof token === 'object') {
    return token.token || token.accessToken || null;
  }
  return null;
};

// Очистка токенов
const clearTokens = () => {
  secureStorage.removeItem('accessToken');
  secureStorage.removeItem('refreshToken');
};

// API вызовы
export const authAPI = {
  getGoogleAuthUrl: (next = '/chat') => buildGoogleAuthUrl(next),
  startGoogleAuth: async (next = '/chat') => openGoogleAuthFlow(next),

  checkRegistrationEmail: async (email) => {
    const response = await fetch(`${API_URL}/api/auth/register/check-email?email=${encodeURIComponent(email)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось проверить email'));
    }

    return result;
  },

  checkRegistrationUsername: async (username) => {
    const response = await fetch(`${API_URL}/api/auth/register/check-username?username=${encodeURIComponent(username)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось проверить username'));
    }

    return result;
  },

  completeGoogleAuth: async ({ accessToken, refreshToken }) => {
    if (!accessToken || !refreshToken) {
      throw new Error('Google не вернул токены авторизации');
    }

    saveTokens(accessToken, refreshToken);

    try {
      const user = await authAPI.getMe();
      return { user, accessToken, refreshToken };
    } catch (error) {
      clearTokens();
      throw error;
    }
  },

  // Регистрация - Шаг 1: Отправка кода на email
  saveGooglePasswordSetupState: ({ googlePasswordSetupToken, next }) => {
    if (googlePasswordSetupToken) {
      secureStorage.setItem('googlePasswordSetupToken', googlePasswordSetupToken);
    }
    if (next) {
      secureStorage.setItem('googlePasswordSetupNext', next);
    }
  },

  getGooglePasswordSetupState: () => ({
    googlePasswordSetupToken: secureStorage.getItem('googlePasswordSetupToken'),
    next: secureStorage.getItem('googlePasswordSetupNext') || '/chat'
  }),

  clearGooglePasswordSetupState: () => {
    secureStorage.removeItem('googlePasswordSetupToken');
    secureStorage.removeItem('googlePasswordSetupNext');
  },

  setupGooglePassword: async ({ password }) => {
    const token = getAccessToken();
    const googlePasswordSetupToken = secureStorage.getItem('googlePasswordSetupToken');

    if (!token) {
      throw new Error('Нет активной сессии');
    }

    if (!googlePasswordSetupToken) {
      throw new Error('Не найден setup token для Google-аккаунта');
    }

    const response = await fetch(`${API_URL}/api/auth/google/setup-password`, {
      method: 'POST',
      headers: withTimezoneHeader({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }),
      body: JSON.stringify({ password, googlePasswordSetupToken })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось задать пароль'));
    }

    authAPI.clearGooglePasswordSetupState();
    return result;
  },

  register: async (data) => {
    const keyPair = await generateKeyPair();

    const requestBody = {
      ...data,
      publicKey: keyPair.publicKey,
      publicKeySignature: keyPair.publicKeySignature
    };

    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Ошибка регистрации'));
    }

    // Сохраняем временные данные и токен
    secureStorage.setItem('pendingEmail', result.email);
    secureStorage.setItem('tempDataToken', result.tempDataToken);
    secureStorage.setItem('secretKey', keyPair.secretKey);
    secureStorage.setItem('publicKey', keyPair.publicKey);

    return result;
  },

  // Подтверждение email - Шаг 2: Ввод кода и создание пользователя
  verifyEmail: async (code) => {
    const tempDataToken = secureStorage.getItem('tempDataToken');

    console.log('[Auth API] verifyEmail called with:', { code, tempDataToken });

    if (!tempDataToken) {
      throw new Error('Сначала зарегистрируйтесь');
    }

    const requestBody = { code, tempDataToken };
    console.log('[Auth API] Sending request body:', requestBody);

    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Неверный код'));
    }

    // Сохраняем токены и очищаем временные данные
    saveTokens(result.accessToken, result.refreshToken);
    secureStorage.removeItem('tempDataToken');
    secureStorage.removeItem('pendingEmail');

    return result;
  },

  // Повторная отправка кода
  resendCode: async () => {
    const tempDataToken = secureStorage.getItem('tempDataToken');

    if (!tempDataToken) {
      throw new Error('Сначала зарегистрируйтесь');
    }

    // Декодируем email из токена
    const tempData = decodeBase64Json(tempDataToken);

    const response = await fetch(`${API_URL}/api/auth/resend-code`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: tempData.email })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Ошибка при повторной отправке'));
    }

    return result;
  },

  // Вход - Шаг 1: Проверка пароля и отправка кода
  login: async (credentials) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(credentials)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Ошибка входа'));
    }

    // Если требуется верификация email - сохраняем токен
    if (result.requiresEmailVerification) {
      secureStorage.setItem('loginTempToken', result.loginTempToken);
      secureStorage.setItem('pendingLoginEmail', result.email);
    } else {
      // Если верификация не требуется - сохраняем токены
      saveTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  // Подтверждение кода входа - Шаг 2
  verifyLoginCode: async (code) => {
    const loginTempToken = secureStorage.getItem('loginTempToken');

    if (!loginTempToken) {
      throw new Error('Сначала введите логин и пароль');
    }

    const response = await fetch(`${API_URL}/api/auth/verify-login-code`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ code, loginTempToken })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Неверный код'));
    }

    // Сохраняем токены и очищаем временные данные
    saveTokens(result.accessToken, result.refreshToken);
    secureStorage.removeItem('loginTempToken');
    secureStorage.removeItem('pendingLoginEmail');

    return result;
  },

  // Повторная отправка кода входа
  resendLoginCode: async () => {
    const loginTempToken = secureStorage.getItem('loginTempToken');

    if (!loginTempToken) {
      throw new Error('Сначала введите логин и пароль');
    }

    const response = await fetch(`${API_URL}/api/auth/resend-login-code`, {
      method: 'POST',
      headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ loginTempToken })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Ошибка при повторной отправке'));
    }

    return result;
  },

  // Выход
  logout: async () => {
    const refreshToken = secureStorage.getItem('refreshToken');

    if (refreshToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {
      }
    }

    clearTokens();
    secureStorage.removeItem('secretKey');
  },

  // Обновление токена
  refreshToken: async () => {
    if (refreshTokenPromise) {
      return refreshTokenPromise;
    }

    const refreshToken = secureStorage.getItem('refreshToken');

    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    refreshTokenPromise = (async () => {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: withTimezoneHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refreshToken })
      });

      const result = await response.json();

      if (!response.ok) {
        clearTokens();
        throw new Error(normalizeAuthErrorMessage(result.error, 'Ошибка обновления токена'));
      }

      saveTokens(result.accessToken, result.refreshToken);
      return result;
    })();

    try {
      return await refreshTokenPromise;
    } finally {
      refreshTokenPromise = null;
    }
  },

  // Запрос на смену пароля (проверка старого пароля + отправка кода на email)
  requestPasswordChange: async ({ oldPassword }) => {
    const token = getAccessToken();

    if (!token) {
      throw new Error('Нет активной сессии');
    }

    const response = await fetch(`${API_URL}/api/auth/password/change-request`, {
      method: 'POST',
      headers: withTimezoneHeader({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }),
      body: JSON.stringify({ oldPassword })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось отправить код подтверждения'));
    }

    // Сохраняем временный токен смены пароля
    if (result.passwordChangeToken) {
      secureStorage.setItem('passwordChangeToken', result.passwordChangeToken);
    }
    if (result.email) {
      secureStorage.setItem('passwordChangeEmail', result.email);
    }

    return result;
  },

  // Подтверждение смены пароля (код из почты + новый пароль)
  confirmPasswordChange: async ({ code, newPassword }) => {
    const token = getAccessToken();

    if (!token) {
      throw new Error('Нет активной сессии');
    }

    const passwordChangeToken = secureStorage.getItem('passwordChangeToken');

    if (!passwordChangeToken) {
      throw new Error('Сначала запросите код для смены пароля');
    }

    const response = await fetch(`${API_URL}/api/auth/password/change-confirm`, {
      method: 'POST',
      headers: withTimezoneHeader({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }),
      body: JSON.stringify({ code, newPassword, passwordChangeToken })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось изменить пароль'));
    }

    // После успешной смены пароля очищаем временные данные
    secureStorage.removeItem('passwordChangeToken');
    secureStorage.removeItem('passwordChangeEmail');

    return result;
  },

  // Получить данные пользователя
  getMe: async () => {
    let token = getAccessToken();
    if (!token) return null;

    let response = await fetch(`${API_URL}/api/auth/me`, {
      headers: withTimezoneHeader({ Authorization: `Bearer ${token}` })
    });

    if (response.status === 401) {
      try {
        await authAPI.refreshToken();
        token = getAccessToken();
        if (!token) {
          clearTokens();
          return null;
        }

        response = await fetch(`${API_URL}/api/auth/me`, {
          headers: withTimezoneHeader({ Authorization: `Bearer ${token}` })
        });
      } catch {
        clearTokens();
        return null;
      }
    }

    if (response.status === 401) {
      clearTokens();
      return null;
    }

    if (!response.ok) throw new Error('Failed to get user data');
    return await response.json();
  },

  completeOnboarding: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/auth/onboarding/complete`, {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось завершить приветствие'));
    }

    return result.user;
  },

  // ============================================================================
  // Активные сессии (устройства)
  // ============================================================================
  getSessions: async () => {
    const token = getAccessToken();
    if (!token) throw new Error('Нет активной сессии');

    const response = await fetch(`${API_URL}/api/auth/sessions`, {
      headers: withTimezoneHeader({ Authorization: `Bearer ${token}` })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось получить список сессий'));
    }

    return result;
  },

  terminateSession: async (sessionId) => {
    const token = getAccessToken();
    if (!token) throw new Error('Нет активной сессии');

    const response = await fetch(`${API_URL}/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: withTimezoneHeader({ Authorization: `Bearer ${token}` })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось завершить сессию'));
    }

    return result;
  },

  terminateOtherSessions: async () => {
    const token = getAccessToken();
    if (!token) throw new Error('Нет активной сессии');

    const response = await fetch(`${API_URL}/api/auth/sessions/terminate-others`, {
      method: 'POST',
      headers: withTimezoneHeader({ Authorization: `Bearer ${token}` })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(normalizeAuthErrorMessage(result.error, 'Не удалось завершить другие сессии'));
    }

    return result;
  },

  // Обновить токен если истёк (для использования в других API)
  ensureValidToken: async () => {
    const token = getAccessToken();
    if (!token) return null;

    // Пробуем декодировать токен для проверки (без отправки на сервер)
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);

      // Если токен истекает в ближайшие 30 секунд - обновляем
      const now = Date.now() / 1000;
      if (decoded.exp && decoded.exp - now < 30) {
        await authAPI.refreshToken();
        return getAccessToken();
      }
      return token;
    } catch (e) {
      // Токен невалиден - пробуем обновить
      try {
        await authAPI.refreshToken();
        return getAccessToken();
      } catch (refreshError) {
        clearTokens();
        return null;
      }
    }
  },

  // Загрузить аватар
  uploadAvatar: async (avatarFile) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const token = getAccessToken();
    const response = await fetch(`${API_URL}/api/users/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload avatar');
    }

    return await response.json();
  },

  // Удалить аватар
  removeAvatar: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/users/avatar`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to remove avatar');
    }

    return await response.json();
  }
};

export { getAccessToken, clearTokens };
