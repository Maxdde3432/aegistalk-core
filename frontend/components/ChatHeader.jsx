import React, { useEffect } from 'react'

const ChatHeader = ({
  selectedChat,
  groupSettings,
  showSearch,
  chatHistorySearch,
  setChatHistorySearch,
  setShowSearch,
  pinnedMessage,
  setShowMobileChat,
  setSelectedChat,
  handleOpenProfile,
  openChannelSettings,
  loadGroupSettings,
  getTypingUser,
  isUserOnline,
  onlineUsersStore,
  showActionsMenu,
  setShowActionsMenu,
  onProfile,
  onClearHistory,
  onBlock,
  onSettings,
  onDeleteGroup,
  onStatistics
}) => {
  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showActionsMenu && !e.target.closest('.actions-menu-container')) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showActionsMenu, setShowActionsMenu])
  return (
    <div className="chat-header" style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border-color)',
      minHeight: '60px',
      ...(selectedChat?.type === 'channel' && groupSettings?.titleColor ? {
        color: groupSettings.titleColor,
        borderBottom: `1px solid ${groupSettings.titleColor}33`
      } : {})
    }}>
      {/* Кнопка "Назад" для мобильных */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMobileChat(false)
          setSelectedChat(null)
          console.log('[ChatHeader] Back button clicked - returning to chat list')
        }}
        style={{
          display: 'block',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '4px 8px',
          marginRight: '8px',
          flexShrink: 0
        }}
        className="mobile-back-btn"
      >
        ←
      </button>

      {/* Название чата и статус */}
      <div
        className="chat-header-info"
        onClick={(e) => {
          e.stopPropagation();
          console.log('[ChatHeader] Clicked on:', {
            type: selectedChat?.type,
            name: selectedChat?.name,
            chatId: selectedChat?.id,
            groupId: selectedChat?.groupId,
            groupSettings,
          });
          if (selectedChat?.type === 'private') {
            handleOpenProfile(false);
          } else if (selectedChat?.type === 'group' || selectedChat?.type === 'channel') {
            // Используем groupId (из таблицы groups), а не chat.id (из таблицы chats)
            const groupId = selectedChat.groupId || selectedChat.id;
            console.log('[ChatHeader] Calling loadGroupSettings with groupId:', groupId);
            loadGroupSettings(groupId);
            if (typeof openChannelSettings === 'function') openChannelSettings();
          }
        }}
        style={{
          cursor: 'pointer',
          flex: 1,
          opacity: showSearch ? 0 : 1,
          transition: 'opacity 0.2s'
        }}
      >
        <span className="chat-title" style={{
          ...(selectedChat?.type === 'channel' && groupSettings?.titleColor ? {
            color: groupSettings.titleColor
          } : {}),
          transition: 'opacity 0.2s',
          fontWeight: '600'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          {selectedChat.name}
          {groupSettings?.externalLink && (
            <a href={groupSettings.externalLink} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--primary)', textDecoration: 'none', fontSize: '16px' }} title={groupSettings.externalLink}>🌐</a>
          )}
        </span>

        {/* Статус "печатает..." или "В сети" или "Был в сети" */}
        {(() => {
          const chatId = selectedChat?.chatId || selectedChat?.id;
          const typingInfo = getTypingUser(chatId);

          if (selectedChat?.isSelf) {
            return null;
          }

          if (typingInfo) {
            return (
              <span className="typing-indicator" style={{
                marginLeft: '8px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                fontStyle: 'italic'
              }}>
                {selectedChat.name} печатает
                <span className="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </span>
            );
          } else if (selectedChat.type === 'private') {
            const isOnline = isUserOnline(selectedChat.userId);

            if (isOnline) {
              return <span className="online-indicator">● В сети</span>;
            } else {
              const onlineUsers = onlineUsersStore.users;
              const userData = onlineUsers.get(selectedChat.userId);
              const lastSeen = userData?.lastSeen;

              let lastSeenText = 'Был в сети недавно';
              if (lastSeen) {
                const date = new Date(lastSeen);
                const now = new Date();
                const diffMinutes = Math.floor((now - date) / 60000);

                if (diffMinutes < 1) lastSeenText = 'Был в сети только что';
                else if (diffMinutes < 60) lastSeenText = `Был в сети ${diffMinutes} мин. назад`;
                else if (diffMinutes < 180) lastSeenText = `Был в сети ${Math.floor(diffMinutes/60)} ч. назад`;
                else lastSeenText = `Был в сети ${date.toLocaleDateString()}`;
              }

              return <span className="online-indicator" style={{ color: '#9E9E9E' }}>● {lastSeenText}</span>;
            }
          }
          return null;
        })()}
      </div>

      {/* Иконки справа: поиск, закрепленные, меню */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 10
      }}>
        {/* Поиск */}
        <button
          onClick={() => {
            setShowSearch(!showSearch)
            setChatHistorySearch('')
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: showSearch ? '#4facfe' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            transition: 'color 0.2s'
          }}
          title="Поиск в чате"
        >
          🔍
        </button>

        {/* Закрепленные */}
        <button
          onClick={() => {}}
          style={{
            background: 'transparent',
            border: 'none',
            color: pinnedMessage ? '#4facfe' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            transition: 'color 0.2s'
          }}
          title="Закрепленные сообщения"
        >
          📌
        </button>

        {/* Меню (три точки) - для личных чатов ИЛИ для групп/каналов (проверка роли внутри) */}
        {(selectedChat?.type === 'private' || selectedChat?.type === 'group' || selectedChat?.type === 'channel') ? (
          <div className="actions-menu-container" style={{ position: 'relative' }}>
            <button
              className="menu-dot-button"
              style={{ width: '32px', height: '32px', fontSize: '18px' }}
              onClick={(e) => {
                e.stopPropagation()
                setShowActionsMenu(!showActionsMenu)
              }}
            >
              ⋮
            </button>

            {/* Выпадающее меню */}
            {showActionsMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '40px',
                zIndex: 100,
                minWidth: '180px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                padding: '8px 0',
                overflow: 'hidden'
              }}>
                {selectedChat?.type === 'private' ? (
                  <>
                    <button
                      onClick={() => {
                        onProfile?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      👤 Профиль
                    </button>
                    <button
                      onClick={() => {
                        onClearHistory?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      🗑️ Очистить историю
                    </button>
                    <button
                      onClick={() => {
                        onBlock?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      🚫 Заблокировать
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onSettings?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      ⚙️ Настройки
                    </button>
                    <button
                      onClick={() => {
                        onDeleteGroup?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      🗑️ Удалить группу
                    </button>
                    <button
                      onClick={() => {
                        onStatistics?.()
                        setShowActionsMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      📊 Статистика
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Поле поиска (поверх всей шапки) */}
      {showSearch && (
        <div style={{
          position: 'absolute',
          left: '0',
          right: '0',
          top: '0',
          bottom: '0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '8px',
          zIndex: 100,
          background: 'var(--bg-primary)'
        }}>
          <input
            type="text"
            placeholder="Поиск сообщений..."
            value={chatHistorySearch}
            onChange={(e) => setChatHistorySearch(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none'
            }}
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearch(false)
              setChatHistorySearch('')
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default ChatHeader
