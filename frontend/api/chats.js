import { getApiBaseUrl, getWsBaseUrl } from './runtimeConfig.js';
const API_URL = getApiBaseUrl();
const WS_URL = getWsBaseUrl();
import { secureStorage } from '../utils/secureStorage.js';
import { authAPI, clearTokens } from './auth.js';

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
      clearTokens();
      secureStorage.clear();
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }));
      throw new Error('Session expired');
    }
  }

  return response;
};

// ============================================================================
// USERS API - Поиск пользователей
// ============================================================================
export const usersAPI = {
  // Найти пользователей по имени/телефону
  searchUsers: async (query) => {
    // Проверяем что query это строка, а не объект
    const queryString = typeof query === 'string' ? query : '';
    const response = await fetchWithAuth(`${API_URL}/api/users/search?q=${encodeURIComponent(queryString)}`);

    if (!response.ok) {
      throw new Error('Failed to search users');
    }

    return await response.json();
  },

  // Получить список всех пользователей (для админки или создания чата)
  getAllUsers: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/users`);

    if (!response.ok) {
      throw new Error('Failed to get users');
    }

    return await response.json();
  }
};

// ============================================================================
// CHATS API
// ============================================================================
export const chatsAPI = {
  getMyChats: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/chats`);

    if (!response.ok) {
      let details = '';
      try {
        const data = await response.json();
        details = data?.error ? `: ${data.error}` : '';
      } catch {
        try {
          const text = await response.text();
          details = text ? `: ${text}` : '';
        } catch {}
      }
      throw new Error(`Failed to get chats (${response.status})${details}`);
    }
    return await response.json();
  },

  createChat: async (targetUserId) => {
    const response = await fetchWithAuth(`${API_URL}/api/chats`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (!response.ok) {
      const msg = result?.error || `Failed to create chat (${response.status})`;
      throw new Error(msg);
    }
    return result || {};
  },

  getChatInfo: async (chatId) => {
    const response = await fetchWithAuth(`${API_URL}/api/chats/${chatId}`);

    if (!response.ok) throw new Error('Failed to get chat info');
    return await response.json();
  },
  
  deleteChat: async (chatId, scope = 'me') => {
    const response = await fetchWithAuth(`${API_URL}/api/chats/${chatId}`, {
      method: 'DELETE',
      body: JSON.stringify({ scope })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete chat');
    }
    return await response.json();
  }
};

// ============================================================================
// MESSAGES API
// ============================================================================
export const messagesAPI = {
  getMessages: async (chatId, limit = 50, offset = 0) => {
    console.log('[MessagesAPI] Start');
    console.log('[MessagesAPI] chatId type:', typeof chatId);
    console.log('[MessagesAPI] chatId value:', chatId);
    
    if (!chatId) {
      console.error('[MessagesAPI] chatId is undefined!');
      throw new Error('chatId is undefined');
    }
    
    if (chatId.length !== 36) {
      console.error('[MessagesAPI] Invalid length:', chatId.length);
      throw new Error('Invalid chatId');
    }
    
    const url = API_URL + '/api/messages/chat/' + chatId + '?limit=' + limit + '&offset=' + offset;
    console.log('[MessagesAPI] URL:', url);
    
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error('[MessagesAPI] Status:', response.status);
      throw new Error('Failed to get messages');
    }
    
    const data = await response.json();
    console.log('[MessagesAPI] Response:', data);
    console.log('[MessagesAPI] Count:', Array.isArray(data) ? data.length : 'NOT ARRAY');
    
    return data;
  },

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

  updateStatus: async (messageId, status) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/status`, {
      method: 'PATCH',
      body: JSON.stringify({ messageId, status })
    });

    if (!response.ok) throw new Error('Failed to update status');
    return await response.json();
  },

  deleteMessage: async (messageId) => {
    const response = await fetchWithAuth(`${API_URL}/api/messages/${messageId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete message');
    return await response.json();
  }
};

// ============================================================================
// WEBSOCKET
// ============================================================================
export class WebSocketService {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.heartbeat = null;
    this.shouldReconnect = true;
    this.messageHandlers = [];
    this.statusHandlers = [];
    this.typingHandlers = [];
    this.reactionHandlers = []; // Обработчики реакций
    this.editMessageHandlers = []; // Обработчики редактирования
    this.deleteMessageHandlers = []; // Обработчики удаления
    this.memberRoleChangedHandlers = []; // Обработчики изменения роли
    this.userUpdatedHandlers = []; // Обработчики обновления профиля
    this.participantKickedHandlers = []; // Обработчики исключения участника
    this.addedToChannelHandlers = []; // Обработчики добавления в канал
    this.memberAddedHandlers = []; // Обработчики добавления участника в канал
    this.userTypingHandlers = []; // Обработчики статуса "печатает"
    this.userStatusChangedHandlers = []; // Обработчики изменения статуса пользователя
    this.chatDeletedHandlers = [];
    this.callHandlers = []; // call_offer/call_accepted/call_rejected/call_end/call_type_change/call_error
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.connectionStateHandlers = [];
    this.pendingSubscriptions = new Set(); // Чаты для подписки после auth
    this.activeSubscriptions = new Set(); // Уже подписанные чаты
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeat = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      } catch (e) {}
    }, 30000);
  }

  _stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  _emitConnectionState() {
    const readyState = this.ws?.readyState ?? WebSocket.CLOSED;
    this.connectionStateHandlers.forEach((handler) => {
      try { handler({ readyState, isConnecting: this.isConnecting }); } catch (e) {}
    });
  }

  getConnectionState() {
    return { readyState: this.ws?.readyState ?? WebSocket.CLOSED, isConnecting: this.isConnecting };
  }

  onConnectionState(handler) { this.connectionStateHandlers.push(handler); }

  offConnectionState(handler) {
    const index = this.connectionStateHandlers.indexOf(handler)
    if (index > -1) this.connectionStateHandlers.splice(index, 1)
  }

  connect(userId) {
    if (!userId) return;
    // Защита от множественных подключений
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.userId = userId;
    this.isConnecting = true;
    this.shouldReconnect = true;
    this.isAuthenticated = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._emitConnectionState();

    try {
      // Keep tokens out of the WebSocket URL so they do not leak into browser logs.
      const token = secureStorage.getItem('accessToken');
      const wsUrl = WS_URL;

      this.ws = new WebSocket(wsUrl);
      this._emitConnectionState();

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this._startHeartbeat();
        this._emitConnectionState();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Include token for forward-compatibility; server may ignore it today.
          this.ws.send(JSON.stringify({ type: 'auth', userId, token }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Обработка ping от сервера
          if (data.type === 'ping') {
            this.ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (data.type === 'auth_success') {
            this.isAuthenticated = true;
            // Переподписываемся на все чаты после авторизации
            this.pendingSubscriptions.forEach(chatId => {
              this._sendSubscribe(chatId);
            });
            this.pendingSubscriptions.clear();
          }
          if (data.type === 'new_message') {
            this.messageHandlers.forEach(handler => handler(data));
          }
          // Forward these to status/typing handlers so higher-level state (SocketContext) can stay clean
          // without overriding the low-level ws.onmessage.
          if (data.type === 'online_users_list') {
            this.userStatusChangedHandlers?.forEach(handler => handler(data));
          }
          if (data.type === 'display_typing') {
            this.userTypingHandlers.forEach(handler => handler(data));
          }
          if (data.type === 'status_update') {
            this.statusHandlers.forEach(handler => handler(data));
          }
          if (data.type === 'typing') {
            this.typingHandlers.forEach(handler => handler(data));
          }
          // Обработка событий о реакциях
          if (data.type === 'new_reaction' || data.type === 'remove_reaction') {
            this.reactionHandlers.forEach(handler => handler(data));
          }
          // Обработка редактирования сообщений
          if (data.type === 'edit_message') {
            this.editMessageHandlers.forEach(handler => handler(data));
          }
          // Обработка удаления сообщений
          if (data.type === 'delete_message') {
            this.deleteMessageHandlers.forEach(handler => handler(data));
          }
          if (data.type === 'chat_deleted') {
            this.chatDeletedHandlers.forEach(handler => handler(data));
          }
          // Обработка изменения роли участника
          if (data.type === 'member_role_changed') {
            this.memberRoleChangedHandlers.forEach(handler => handler(data));
          }
          // Обработка исключения участника
          if (data.type === 'participant_kicked') {
            this.participantKickedHandlers.forEach(handler => handler(data));
          }
          // Обработка обновления профиля пользователя
          if (data.type === 'user_updated') {
            this.userUpdatedHandlers.forEach(handler => handler(data));
          }
          // Обработка добавления в канал
          if (data.type === 'added_to_channel') {
            this.addedToChannelHandlers.forEach(handler => handler(data));
          }
          // Обработка добавления участника в канал
          if (data.type === 'member_added') {
            this.memberAddedHandlers.forEach(handler => handler(data));
          }
          // Обработка статуса "печатает"
          if (data.type === 'call_offer' || data.type === 'call_accepted' || data.type === 'call_rejected' || data.type === 'call_end' || data.type === 'call_type_change' || data.type === 'call_error') {
            this.callHandlers.forEach(handler => handler(data));
          }
          if (data.type === 'user_typing') {
            this.userTypingHandlers.forEach(handler => handler(data));
          }
          // Обработка изменения статуса пользователя
          if (data.type === 'user_status_changed') {
            this.userStatusChangedHandlers?.forEach(handler => handler(data));
          }
          if (data.type === 'subscribed') {
            this.activeSubscriptions.add(data.chatId);
          }
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };

      this.ws.onclose = (event) => {
        this._stopHeartbeat();
        this.ws = null;
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.activeSubscriptions.clear();
        this._emitConnectionState();

        // Auto-reconnect (unless disconnected explicitly).
        if (!this.shouldReconnect || !this.userId) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect(this.userId);
        }, 3000);
      };

      this.ws.onerror = (error) => {
        // Тихо игнорируем ошибки чтобы не спамить консоль
        this.isConnecting = false;
        this._emitConnectionState();
      };

    } catch (error) {
      this.isConnecting = false;
      this._emitConnectionState();
    }
  }

  checkConnection(userId = this.userId) {
    const targetUserId = userId ?? this.userId;
    if (!targetUserId) return;
    if (this.isConnected()) return;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;
    this.connect(targetUserId);
  }

  disconnect() {
    this.userId = null;
    this.isConnecting = false;
    this.shouldReconnect = false;
    this.isAuthenticated = false;
    this.activeSubscriptions.clear();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._emitConnectionState();
  }

  subscribe(chatId) {
    // Добавляем в список подписок
    this.pendingSubscriptions.add(chatId);

    // Если уже аутентифицированы - подписываемся сразу
    if (this.isAuthenticated && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._sendSubscribe(chatId);
    }
    // Иначе подпишемся после auth_success в onmessage
  }

  _sendSubscribe(chatId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe_chat', chatId }));
    }
  }

  unsubscribe(chatId) {
    this.pendingSubscriptions.delete(chatId);
    this.activeSubscriptions.delete(chatId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe_chat', chatId }));
    }
  }

  sendMessage(chatId, message, chatType) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_message', chatId, chatType, message }));
    }
  }

  sendTyping(chatId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing', chatId }));
    }
  }

  sendTypingStart(chatId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing_start', chatId }));
    }
  }

  sendTypingStop(chatId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing_stop', chatId }));
    }
  }

  onUserTyping(handler) { this.userTypingHandlers.push(handler); }
  onUserStatusChanged(handler) { this.userStatusChangedHandlers.push(handler); }

  markAsRead(messageIds) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mark_read', messageIds }));
    }
  }

  onMessage(handler) { this.messageHandlers.push(handler); }
  onStatusUpdate(handler) { this.statusHandlers.push(handler); }
  onTyping(handler) { this.typingHandlers.push(handler); }
  onReaction(handler) { this.reactionHandlers.push(handler); }
  onEditMessage(handler) { this.editMessageHandlers.push(handler); }
  onDeleteMessage(handler) { this.deleteMessageHandlers.push(handler); }
  onChatDeleted(handler) { this.chatDeletedHandlers.push(handler); }
  onMemberRoleChanged(handler) { this.memberRoleChangedHandlers.push(handler); }
  onUserUpdated(handler) { this.userUpdatedHandlers.push(handler); }
  onParticipantKicked(handler) { this.participantKickedHandlers.push(handler); }
  onAddedToChannel(handler) { this.addedToChannelHandlers.push(handler); }
  onMemberAdded(handler) { this.memberAddedHandlers.push(handler); }
  onCall(handler) { this.callHandlers.push(handler); }

  // Метод для удаления обработчика (cleanup)
  offMessage(handler) {
    const index = this.messageHandlers.indexOf(handler)
    if (index > -1) this.messageHandlers.splice(index, 1)
  }

  offCall(handler) {
    const index = this.callHandlers.indexOf(handler)
    if (index > -1) this.callHandlers.splice(index, 1)
  }

  isConnected() { return this.ws && this.ws.readyState === WebSocket.OPEN; }
}

export const wsService = new WebSocketService();
