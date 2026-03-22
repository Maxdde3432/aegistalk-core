// Глобальное хранилище онлайн пользователей
// Используем Map для реактивности
export const onlineUsersStore = {
  listeners: new Set(),
  users: new Map(), // userId -> {isOnline, lastSeen, lastActivity}

  // Подписка на изменения
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },

  // Уведомление всех подписчиков
  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(cb => cb(snapshot));
  },

  // Получить снимок состояния
  getSnapshot() {
    return Object.fromEntries(this.users);
  },

  // Установить статус пользователя
  setOnline(userId, isOnline = true, lastSeen = null) {
    if (isOnline) {
      this.users.set(userId, { 
        isOnline: true, 
        lastSeen: null,
        lastActivity: Date.now()
      });
    } else {
      this.users.set(userId, { 
        isOnline: false, 
        lastSeen: lastSeen || new Date().toISOString(),
        lastActivity: null
      });
    }
    console.log('🌍 [OnlineStore] User', userId, 'is', isOnline ? 'ONLINE' : 'OFFLINE');
    this.notify();
  },

  // Обновить время последней активности
  updateActivity(userId) {
    const user = this.users.get(userId);
    if (user && user.isOnline) {
      user.lastActivity = Date.now();
      this.users.set(userId, user);
      this.notify();
    }
  },

  // Получить всех онлайн
  getOnlineUsers() {
    const online = [];
    this.users.forEach((data, userId) => {
      if (data.isOnline) online.push(userId);
    });
    return online;
  },

  // Проверка: онлайн ли пользователь
  isOnline(userId) {
    const user = this.users.get(userId);
    return user ? user.isOnline : false;
  },

  // Получить последнюю активность
  getLastSeen(userId) {
    const user = this.users.get(userId);
    if (!user) return null;
    if (user.isOnline) return null; // Онлайн - lastSeen не нужен
    return user.lastSeen;
  },

  // Форматирование времени
  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'В сети';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    
    if (diffMinutes < 1) return 'Был в сети только что';
    if (diffMinutes < 60) return `Был в сети ${diffMinutes} мин. назад`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Был в сети ${diffHours} ч. назад`;
    return `Был в сети ${date.toLocaleDateString()}`;
  }
};

// Хук для использования в React компонентах
import { useState, useEffect } from 'react';

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState(() => onlineUsersStore.getSnapshot());

  useEffect(() => {
    const unsubscribe = onlineUsersStore.subscribe((snapshot) => {
      console.log('🌍 [useOnlineUsers] Updated snapshot:', snapshot);
      setOnlineUsers(snapshot);
    });

    // Начальная синхронизация
    setOnlineUsers(onlineUsersStore.getSnapshot());

    return unsubscribe;
  }, []);

  return {
    onlineUsers,
    isOnline: (userId) => onlineUsersStore.isOnline(userId),
    getOnlineList: () => onlineUsersStore.getOnlineUsers()
  };
}
