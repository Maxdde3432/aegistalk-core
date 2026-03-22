import { useState, useEffect, useRef } from 'react';
import { X, Image, File, Link, Mic, Phone, Users, Clock, Hash } from 'lucide-react';
import { groupsAPI } from '../api/groups';
import { resolveAssetUrl } from '../api/runtimeConfig';
import { useSocket } from '../contexts/SocketContext';

/**
 * Боковая панель профиля пользователя
 */
const ProfileSidebar = ({
  isOpen,
  onClose,
  user,
  chatId,
  messages,
  onSwitchChat,
  onSwitchToPrivateChat,
  showWriteButton = false,
  onViewCallHistory
}) => {
  const { isUserOnline } = useSocket();
  const [activeTab, setActiveTab] = useState('photos');
  const [isAnimating, setIsAnimating] = useState(false);
  const [commonChats, setCommonChats] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [avatarOk, setAvatarOk] = useState(true);
  const tabsScrollRef = useRef(null);
  const indicatorRef = useRef(null);

  useEffect(() => {
    setAvatarOk(true);
  }, [user?.id, user?.avatarUrl]);

  if (!isOpen || !user) return null;

  const avatarSrc = user.avatarUrl && avatarOk ? resolveAssetUrl(user.avatarUrl) : null;

  // Проверяем онлайн статус через контекст
  const isOnline = isUserOnline(user.id);

  const tabs = [
    { id: 'photos', label: 'Фото', icon: <Image size={18} /> },
    { id: 'files', label: 'Файлы', icon: <File size={18} /> },
    { id: 'links', label: 'Ссылки', icon: <Link size={18} /> },
    { id: 'voice', label: 'Голосовые', icon: <Mic size={18} /> },
    { id: 'calls', label: 'Звонки', icon: <Phone size={18} /> },
    { id: 'chats', label: 'Общие чаты', icon: <Users size={18} /> }
  ];

  // Фильтрация контента из сообщений
  const getFilteredContent = () => {
    if (!messages) return [];

    switch (activeTab) {
      case 'photos':
        return messages.filter(m => m.type === 'photo' || m.type === 'image');
      case 'files':
        return messages.filter(m => m.type === 'file' || m.type === 'document');
      case 'links':
        // Исключаем голосовые сообщения и служебные ссылки
        return messages.filter(m => {
          if (m.type === 'voice' || m.type === 'audio') return false;
          if (m.content && m.content.startsWith('voice:')) return false;
          if (m.content && m.content.startsWith('blob:')) return false;
          return m.type === 'link' || (m.content && m.content.match(/https?:\/\//));
        });
      case 'voice':
        return messages.filter(m => m.type === 'voice' || m.type === 'audio');
      case 'calls':
        return messages.filter(m => m.type === 'call');
      case 'chats':
        return commonChats;
      default:
        return [];
    }
  };

  const filteredContent = getFilteredContent();

  // Загрузка общих чатов
  useEffect(() => {
    if (activeTab === 'chats' && user?.id) {
      loadCommonChats();
    }
  }, [activeTab, user?.id]);

  const loadCommonChats = () => {
    if (!user.id) return;
    
    groupsAPI.getCommonChats(user.id)
      .then(chats => {
        console.log('[ProfileSidebar] Common chats:', chats);
        setCommonChats(chats);
      })
      .catch(error => {
        console.error('[ProfileSidebar] Failed to load common chats:', error);
        setCommonChats([]);
      });
  };

  const handleTabChange = (tabId) => {
    // Плавная прокрутка вкладки к центру
    const tabElement = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabElement && tabsScrollRef.current) {
      const container = tabsScrollRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tabElement.getBoundingClientRect();
      
      const scrollAmount = tabElement.offsetLeft - (containerRect.width / 2) + (tabRect.width / 2);
      
      container.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      setActiveTab(tabId);
      setIsAnimating(false);
    }, 150);
  };

  // Проверка видимости стрелок (удалено - теперь только скролл)
  const checkScrollArrows = () => {
    // Пустая функция для совместимости
  };

  const getStatusText = () => {
    if (isOnline) return 'В сети';
    return 'Оффлайн';
  };

  const renderContent = () => {
    if (filteredContent.length === 0) {
      return (
        <div className="empty-content">
          <div className="empty-icon">📭</div>
          <p>Здесь пока пусто</p>
          <span>Контент из этой вкладки появится здесь</span>
        </div>
      );
    }

    return (
      <div className="content-grid">
        {filteredContent.slice(0, 7).map((item, index) => (
          <div
            key={item.id || index}
            className="content-item"
            onClick={() => {
              if (activeTab === 'photos' && item.url) {
                setPreviewPhoto(item.url);
              }
            }}
          >
            {activeTab === 'photos' && item.url && (
              <img src={item.url} alt="Фото" className="photo-thumbnail" />
            )}
            {activeTab === 'files' && (
              <div className="file-item">
                <File size={24} className="file-icon" />
                <div className="file-info">
                  <span className="file-name">{item.fileName || 'Файл'}</span>
                  <span className="file-size">{item.fileSize || '—'}</span>
                </div>
              </div>
            )}
            {activeTab === 'links' && (
              <div className="link-item">
                <Link size={16} className="link-icon" />
                <span className="link-url" title={item.content || item.url || 'Ссылка'}>
                  {(() => {
                    const url = item.content || item.url || '';
                    try {
                      const urlObj = new URL(url);
                      // Показываем только домен для безопасности
                      return `🔗 ${urlObj.hostname}`;
                    } catch {
                      // Если не URL, показываем зашифрованный текст
                      return '🔗 Ссылка (контент скрыт)';
                    }
                  })()}
                </span>
              </div>
            )}
            {activeTab === 'voice' && (
              <div className="voice-item">
                <Mic size={20} className="voice-icon" />
                <div className="voice-wave">
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                  <div className="wave-bar"></div>
                </div>
                <span className="voice-duration">{item.duration || '0:00'}</span>
              </div>
            )}
            {activeTab === 'calls' && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div className="call-item" style={{ marginBottom: '20px' }}>
                  <Phone size={18} className="call-icon" />
                  <div className="call-info">
                    <span className="call-type">История звонков</span>
                  </div>
                </div>
                <button
                  onClick={onViewCallHistory}
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '16px'
                  }}
                >
                  Показать все звонки
                </button>
              </div>
            )}
            {activeTab === 'chats' && (
              <div className="chat-item" onClick={() => onSwitchChat?.(item)}>
                <div className="chat-icon-wrapper">
                  {item.type === 'channel' ? (
                    <span className="channel-icon">📢</span>
                  ) : (
                    <Hash size={20} className="group-icon" />
                  )}
                </div>
                <div className="chat-info">
                  <span className="chat-name">{item.name}</span>
                  <span className="chat-type">{item.type === 'channel' ? 'Канал' : 'Группа'}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="profile-sidebar-overlay" onClick={onClose} />
      <div className={`profile-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Кнопка закрытия */}
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Шапка профиля */}
        <div className="profile-header">
          <div className="avatar-container">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={user.firstName || 'User'}
                className="profile-avatar"
                onError={() => setAvatarOk(false)}
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(user.firstName || user.lastName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`} />
          </div>
          
          <h2 className="profile-name">
            {user.firstName || user.lastName
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
              : 'Аноним'}
          </h2>

          <span className="profile-username">
            {user.username ? `@${user.username}` : 'Без username'}
          </span>

          <div className="status-text">
            <Clock size={12} />
            <span>{getStatusText()}</span>
          </div>

          {/* Кнопка "Написать" */}
          {showWriteButton && (
            <button
              onClick={() => onSwitchToPrivateChat?.(user.id, user.firstName)}
              className="write-message-btn"
            >
              ✉️ Написать
            </button>
          )}
        </div>

        {/* Вкладки */}
        <div className="tabs-container">
          <div 
            className="tabs-scroll" 
            ref={tabsScrollRef}
            onScroll={checkScrollArrows}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
            {/* Плавающий индикатор */}
            <div className="tab-indicator-float" ref={indicatorRef} />
          </div>
        </div>

        {/* Контент */}
        <div className={`profile-content ${isAnimating ? 'animating' : ''}`}>
          {renderContent()}
        </div>

        <style>{`
          .profile-sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .profile-sidebar {
            position: fixed;
            top: 0;
            right: -480px;
            width: 480px;
            max-width: 100%;
            height: 100vh;
            background: var(--bg-secondary);
            z-index: 1001;
            transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
          }

          .profile-sidebar.open {
            right: 0;
          }

          .close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--bg-tertiary);
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            z-index: 10;
          }

          .close-btn:hover {
            background: var(--primary);
            color: white;
            transform: rotate(90deg);
          }

          /* Шапка профиля */
          .profile-header {
            padding: 60px 32px 24px;
            text-align: center;
            background: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
            border-bottom: 1px solid var(--border-color);
          }

          .avatar-container {
            position: relative;
            width: 120px;
            height: 120px;
            margin: 0 auto 16px;
          }

          .profile-avatar {
            width: 100%;
            height: 100%;
            border-radius: 24px;
            object-fit: cover;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            background: var(--primary);
          }

          .profile-avatar-placeholder {
            width: 100%;
            height: 100%;
            border-radius: 24px;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            font-weight: 700;
            color: white;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          }

          .status-indicator {
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 4px solid var(--bg-secondary);
          }

          .status-indicator.online {
            background: #4CAF50;
            box-shadow: 0 0 12px rgba(76, 175, 80, 0.5);
          }

          .status-indicator.offline {
            background: #9E9E9E;
          }

          .profile-name {
            margin: 0 0 8px;
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .profile-username {
            display: block;
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 12px;
          }

          .status-text {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 13px;
            color: var(--text-secondary);
          }

          .write-message-btn {
            margin-top: 16px;
            width: 100%;
            padding: 12px 24px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .write-message-btn:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
          }

          /* Вкладки */
          .tabs-container {
            padding: 16px 0;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
          }

          .tabs-scroll {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            padding: 0 16px;
            scrollbar-width: none;
            -ms-overflow-style: none;
            scroll-behavior: smooth;
          }

          .tabs-scroll::-webkit-scrollbar {
            display: none;
          }

          .tab-btn {
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 16px;
            background: var(--bg-tertiary);
            border: none;
            border-radius: 12px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }

          .tab-btn:hover {
            background: var(--bg-secondary);
            color: var(--text-primary);
            transform: translateY(-2px);
          }

          .tab-btn.active {
            background: var(--primary);
            color: white;
            box-shadow: 0 4px 16px rgba(var(--primary-rgb), 0.4);
          }

          .tab-icon {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .tab-label {
            font-size: 12px;
            font-weight: 500;
          }

          .tab-indicator {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
            background: white;
            border-radius: 2px 2px 0 0;
          }

          .tab-indicator-float {
            position: absolute;
            bottom: 8px;
            height: 3px;
            background: var(--primary);
            border-radius: 2px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
          }

          /* Контент */
          .profile-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          }

          .profile-content.animating {
            animation: fadeIn 0.3s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .empty-content {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-secondary);
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
          }

          .empty-content p {
            font-size: 16px;
            margin: 0 0 8px;
            color: var(--text-primary);
          }

          .empty-content span {
            font-size: 13px;
          }

          .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }

          .content-item {
            background: var(--bg-tertiary);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
          }

          .content-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            border-color: var(--primary);
          }

          .photo-thumbnail {
            width: 100%;
            height: 140px;
            object-fit: cover;
            display: block;
          }

          .file-item {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .file-icon {
            color: var(--primary);
            flex-shrink: 0;
          }

          .file-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            overflow: hidden;
          }

          .file-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .file-size {
            font-size: 11px;
            color: var(--text-secondary);
          }

          .link-item {
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .link-icon {
            color: var(--primary);
            flex-shrink: 0;
          }

          .link-url {
            font-size: 13px;
            color: var(--primary);
            word-break: break-all;
          }

          .voice-item {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .voice-icon {
            color: var(--primary);
            flex-shrink: 0;
          }

          .voice-wave {
            display: flex;
            align-items: center;
            gap: 3px;
            flex: 1;
          }

          .wave-bar {
            width: 3px;
            height: 16px;
            background: var(--primary);
            border-radius: 2px;
            animation: wave 1s ease-in-out infinite;
          }

          .wave-bar:nth-child(2) { animation-delay: 0.1s; height: 20px; }
          .wave-bar:nth-child(3) { animation-delay: 0.2s; height: 14px; }
          .wave-bar:nth-child(4) { animation-delay: 0.3s; height: 18px; }
          .wave-bar:nth-child(5) { animation-delay: 0.4s; height: 12px; }

          @keyframes wave {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.6); }
          }

          .voice-duration {
            font-size: 12px;
            color: var(--text-secondary);
          }

          .call-item {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .call-icon {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-secondary);
          }

          .call-icon.missed {
            color: #f44336;
            background: rgba(244, 67, 54, 0.1);
          }

          .call-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .call-type {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-primary);
          }

          .call-date {
            font-size: 12px;
            color: var(--text-secondary);
          }

          .chat-item {
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 14px;
            background: var(--bg-tertiary);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
          }

          .chat-item:hover {
            transform: translateX(4px);
            background: var(--bg-secondary);
            border-color: var(--primary);
          }

          .chat-icon-wrapper {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: var(--bg-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .channel-icon {
            font-size: 20px;
          }

          .group-icon {
            color: var(--primary);
          }

          .chat-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            overflow: hidden;
          }

          .chat-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .chat-type {
            font-size: 12px;
            color: var(--text-secondary);
          }
          
          /* Просмотр фото профиля/из вкладки "Фото" */
          .profile-photo-preview-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1200;
            cursor: zoom-out;
          }

          .profile-photo-preview-content {
            max-width: 100%;
            max-height: 100%;
            padding: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }

          .profile-photo-preview-image {
            max-width: 100%;
            max-height: 80vh;
            border-radius: 16px;
            object-fit: contain;
            box-shadow: 0 18px 45px rgba(0,0,0,0.75);
          }
        `}</style>
      </div>

      {previewPhoto && (
        <div
          className="profile-photo-preview-overlay"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="profile-photo-preview-content"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={previewPhoto}
              alt="Фото профиля"
              className="profile-photo-preview-image"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileSidebar;
