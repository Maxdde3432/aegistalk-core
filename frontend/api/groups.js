import { getApiBaseUrl } from './runtimeConfig.js';
const API_URL = getApiBaseUrl();
import { secureStorage } from '../utils/secureStorage.js';
import { authAPI } from './auth.js';

const getAccessToken = () => secureStorage.getItem('accessToken');
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
      // Не удалось обновить - редирект на логин
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }));
      throw new Error('Session expired');
    }
  }

  return response;
};

// ============================================================================
// GROUPS API
// ============================================================================
export const groupsAPI = {
  // Получить все мои группы
  getMyGroups: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/groups`);

    if (!response.ok) {
      throw new Error('Failed to get groups');
    }

    return await response.json();
  },

  // Подтверждение сайта
  verifySite: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/verify-site`, {
      method: 'POST'
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to verify site');
    }
    return result;
  },

  // Создать группу/канал
  createGroup: async (data) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create group');
    }

    return result;
  },

  // Получить информацию о группе
  getGroupInfo: async (groupId) => {
    console.log('[GroupsAPI] getGroupInfo called for groupId:', groupId);
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[GroupsAPI] getGroupInfo failed:', response.status, errorData);
      
      // Если 404 — пробрасываем ошибку с кодом для обработки на UI
      if (response.status === 404) {
        const error = new Error(errorData.error || 'Группа не найдена');
        error.status = 404;
        throw error;
      }
      
      throw new Error(errorData.error || 'Failed to get group info');
    }

    const data = await response.json();
    console.log('[GroupsAPI] getGroupInfo success:', { id: data.id, name: data.name });
    return data;
  },

  // Обновить настройки группы
  updateGroup: async (groupId, data) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update group');
    }

    return result;
  },

  // Удалить группу
  deleteGroup: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete group');
    }

    return await response.json();
  },

  // Добавить участника
  addMember: async (groupId, targetUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to add member');
    }

    return result;
  },

  // Удалить участника
  removeMember: async (groupId, targetUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/members/${targetUserId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to remove member');
    }

    return await response.json();
  },

  // Выйти из группы
  leaveGroup: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/leave`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to leave group');
    }

    return await response.json();
  },

  // Вернуться в группу (если вышел сам)
  rejoinGroup: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/rejoin`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to rejoin group');
    }

    return await response.json();
  },

  // Повысить до админа
  promoteMember: async (groupId, targetUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/members/${targetUserId}/promote`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to promote member');
    }

    return await response.json();
  },

  // Понизить до участника
  demoteMember: async (groupId, targetUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/members/${targetUserId}/demote`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to demote member');
    }

    return await response.json();
  },

  // ???????? ???? ?????????
  updateMemberRole: async (groupId, targetUserId, role) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/members/${targetUserId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update member role');
    }

    return result;
  },

  // Создать invite-ссылку
  generateInviteLink: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/invite`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to generate invite link');
    }

    return await response.json();
  },

  // Вступить по invite-ссылке
  joinByInviteLink: async (inviteToken) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteToken })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to join by invite link');
    }

    return await response.json();
  },

  // Вступить в публичный канал (без invite-токена)
  joinPublicChannel: async (channelId) => {
    const url = `${API_URL}/api/groups/public/${channelId}/join`
    console.log('🚀 [joinPublicChannel] Отправляю запрос:', url, 'Method: POST')
    
    const response = await fetchWithAuth(url, {
      method: 'POST'
    });

    console.log('📥 [joinPublicChannel] Ответ:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [joinPublicChannel] Ошибка:', errorData)
      throw new Error(errorData.error || 'Failed to join public channel');
    }

    const result = await response.json();
    console.log('✅ [joinPublicChannel] Успех:', result)
    return result;
  },

  // Получить информацию о группе по invite-ссылке (с авторизацией для проверки isMember)
  getGroupByInvite: async (inviteToken) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/invite/${encodeURIComponent(inviteToken)}`);

    if (!response.ok) {
      throw new Error('Группа не найдена или invite-ссылка недействительна');
    }

    return await response.json();
  },

  // Получить список публичных каналов
  getPublicChannels: async (search = '') => {
    const url = new URL(`${API_URL}/api/groups/public`);
    if (search) {
      url.searchParams.set('search', search);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error('Failed to get public channels');
    }

    return await response.json();
  },

  // Получить общие чаты с пользователем
  getCommonChats: async (otherUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/common/${otherUserId}`);

    if (!response.ok) {
      throw new Error('Failed to get common chats');
    }

    return await response.json();
  },

  // Получить пригласительные ссылки
  getInviteLinks: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/invite-links`);
    if (!response.ok) {
      throw new Error('Failed to get invite links');
    }
    return await response.json();
  },

  // Создать пригласительную ссылку
  createInviteLink: async (groupId, name = '') => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/invite-links`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    if (!response.ok) {
      throw new Error('Failed to create invite link');
    }
    return await response.json();
  },

  // Удалить пригласительную ссылку
  deleteInviteLink: async (groupId, linkId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/invite-links/${linkId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete invite link');
    }
    return await response.json();
  },

  // Получить журнал событий
  getAdminLogs: async (groupId) => {
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/admin-logs`);
    if (!response.ok) {
      throw new Error('Failed to get admin logs');
    }
    return await response.json();
  },

  // Связать группу обсуждений
  linkDiscussionGroup: async (groupId, discussionGroupId = null) => {
    const payload = discussionGroupId ? { discussionGroupId } : {}
    const response = await fetchWithAuth(`${API_URL}/api/groups/${groupId}/discussion`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error('Failed to link discussion group');
    }
    return await response.json();
  }
};
