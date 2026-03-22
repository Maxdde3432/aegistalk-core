import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { wsService } from '../api/chats';
import { onlineUsersStore } from '../store/onlineUsersStore';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, userId }) => {
  // Используем глобальное хранилище для онлайн пользователей
  const [onlineUsersSnapshot, setOnlineUsersSnapshot] = useState(() => onlineUsersStore.getSnapshot());

  // Статус подключения WebSocket
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'

  // Глобальное состояние: кто печатает { chatId: { userId, timestamp } }
  const [typingStates, setTypingStates] = useState({});

  // Ссылка на последний processed message ID чтобы не дублировать
  const lastProcessedMessageId = useRef(null);

  // Подписка на статус WebSocket
  useEffect(() => {
    const checkWsStatus = () => {
      if (!wsService.ws) {
        setWsStatus('connecting');
      } else if (wsService.ws.readyState === WebSocket.OPEN) {
        setWsStatus('connected');
      } else if (wsService.ws.readyState === WebSocket.CLOSED) {
        setWsStatus('disconnected');
      } else {
        setWsStatus('connecting');
      }
    };

    checkWsStatus();
    const interval = setInterval(checkWsStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== ЦЕНТРАЛЬНЫЙ ОБРАБОТЧИК СОКЕТ СОБЫТИЙ =====
  const handleSocketMessage = useCallback((data) => {
    switch (data.type) {
      // === ПОЛЬЗОВАТЕЛЬ ПЕЧАТАЕТ ===
      case 'display_typing':
      case 'user_typing': {
        if (data.isTyping === true || data.isTyping === undefined) {
          setTypingStates(prev => ({
            ...prev,
            [data.chatId]: {
              userId: data.userId,
              timestamp: Date.now()
            }
          }));
        } else {
          setTypingStates(prev => {
            const newState = { ...prev };
            delete newState[data.chatId];
            return newState;
          });
        }
        break;
      }

      // === СТАТУС ПОЛЬЗОВАТЕЛЯ (онлайн/оффлайн) ===
      case 'user_status_changed':
      case 'user_status_update':
      case 'user_connected': {
        // Игнорируем события о самом себе
        if (data.userId === userId) {
          return;
        }

        // Обновляем глобальное хранилище
        onlineUsersStore.setOnline(data.userId, data.isOnline || data.online, data.lastSeen);
        break;
      }

      // === СПИСОК ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ (при подключении) ===
      case 'online_users_list': {
        if (data.users && Array.isArray(data.users)) {
          data.users.forEach(user => {
            if (user.userId !== userId && user.isOnline) {
              onlineUsersStore.setOnline(user.userId, true);
            }
          });
        }
        break;
      }

      // === ИЗМЕНЕНИЕ СТАТУСА СООБЩЕНИЯ (прочитано/доставлено) ===
      case 'status_update': {
        break;
      }

      // === РЕАКЦИИ ===
      case 'new_reaction':
      case 'remove_reaction': {
        break;
      }

      // === РЕДАКТИРОВАНИЕ СООБЩЕНИЯ ===
      case 'edit_message': {
        break;
      }

      // === УДАЛЕНИЕ СООБЩЕНИЯ ===
      case 'delete_message': {
        break;
      }

      default:
        break;
    }
  }, [userId]);

  // Подписка на события при монтировании
  useEffect(() => {
    // Подписываемся только на typing/online события через wsService,
    // без переопределения ws.onmessage (это ломало доставку сообщений и давало дубли).
    wsService.onUserTyping(handleSocketMessage);
    wsService.onUserStatusChanged?.(handleSocketMessage);

    return () => {
      const typingIndex = wsService.userTypingHandlers?.indexOf(handleSocketMessage);
      if (typingIndex > -1) wsService.userTypingHandlers.splice(typingIndex, 1);

      const statusIndex = wsService.userStatusChangedHandlers?.indexOf(handleSocketMessage);
      if (statusIndex > -1) wsService.userStatusChangedHandlers.splice(statusIndex, 1);
      
      console.log('[SocketContext] Cleanup completed');
    };
  }, [handleSocketMessage, userId]);

  // Поддержание активности пользователя - heartbeat каждые 30 сек
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      if (wsService.isConnected() && userId) {
        // Отправляем ping для поддержания соединения
      }
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [userId]);

  // Проверка устаревших typing статусов (авто-очистка через 5 сек)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingStates(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(chatId => {
          if (now - newState[chatId].timestamp > 5000) {
            delete newState[chatId];
          }
        });
        return newState;
      });
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Публичные методы
  const isUserOnline = useCallback((checkUserId) => {
    return onlineUsersStore.isOnline(checkUserId);
  }, [onlineUsersSnapshot]);

  const isTypingInChat = useCallback((chatId) => {
    return !!typingStates[chatId];
  }, [typingStates]);

  const getTypingUser = useCallback((chatId) => {
    return typingStates[chatId] || null;
  }, [typingStates]);

  const value = {
    typingStates,
    onlineUsers: onlineUsersSnapshot,
    wsStatus, // 'connecting' | 'connected' | 'disconnected'
    isUserOnline,
    isTypingInChat,
    getTypingUser,
    handleSocketMessage
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
