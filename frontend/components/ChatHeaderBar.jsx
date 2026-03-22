const ChatHeaderBar = ({
  selectedChat,
  groupSettings,
  showSearch,
  chatHistorySearch,
  setChatHistorySearch,
  setShowSearch,
  pinnedMessage,
  handleBackToChatList,
  setIsMobileSidebarOpen,
  handleOpenProfile,
  openChannelSettings,
  loadGroupSettings,
  getTypingUser,
  isUserOnline,
  onlineUsersStore,
  startCall,
  showChatActionsMenu,
  setShowChatActionsMenu,
  showDeleteChatOptions,
  setShowDeleteChatOptions,
  setShowDmThemeModal,
  activeDmTheme,
  updateDmThemes,
  handleDeleteSelectedChat
}) => {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  const typingInfo = typeof getTypingUser === 'function'
    ? getTypingUser(selectedChat?.chatId || selectedChat?.id)
    : null

  if (!selectedChat) return null

  const renderPresence = () => {
    if (selectedChat.isSelf) return null

    if (selectedChat.isAi) {
      return <span className="online-indicator" style={{ color: 'var(--primary)', marginLeft: '8px' }}>● В сети</span>
    }

    if (typingInfo) {
      return (
        <span className="typing-indicator" style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {selectedChat.name} печатает
          <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
        </span>
      )
    }

    if (selectedChat.type !== 'private') return null

    if (typeof isUserOnline === 'function' && isUserOnline(selectedChat.userId)) {
      return <span className="online-indicator">● В сети</span>
    }

    const userData = onlineUsersStore?.users?.get ? onlineUsersStore.users.get(selectedChat.userId) : null
    const lastSeen = userData?.lastSeen
    let lastSeenText = 'Был в сети недавно'

    if (lastSeen) {
      const date = new Date(lastSeen)
      const now = new Date()
      const diffMinutes = Math.floor((now - date) / 60000)

      if (diffMinutes < 1) lastSeenText = 'Был в сети только что'
      else if (diffMinutes < 60) lastSeenText = `Был в сети ${diffMinutes} мин. назад`
      else if (diffMinutes < 180) lastSeenText = `Был в сети ${Math.floor(diffMinutes / 60)} ч. назад`
      else lastSeenText = `Был в сети ${date.toLocaleDateString()}`
    }

    return <span className="online-indicator" style={{ color: '#9E9E9E' }}>● {lastSeenText}</span>
  }

  const resetDmTheme = () => {
    const key = selectedChat.chatId || selectedChat.id
    if (selectedChat.type === 'private') {
      updateDmThemes((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setShowDeleteChatOptions(false)
    setShowChatActionsMenu(false)
  }

  return (
    <div className="chat-header" style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `calc(env(safe-area-inset-top, 0px) + ${isMobile ? '8px' : '0px'}) 16px ${isMobile ? '8px' : '0px'}`,
      height: isMobile ? 'auto' : '56px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
      background: 'rgba(10, 11, 15, 0.5)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      minHeight: `calc(56px + ${isMobile ? 'env(safe-area-inset-top, 0px)' : '0px'})`,
      ...(selectedChat?.type === 'channel' && groupSettings?.titleColor ? {
        color: groupSettings.titleColor,
        borderBottom: `1px solid ${groupSettings.titleColor}33`
      } : {})
    }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleBackToChatList()
        }}
        title="Выйти из чата"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '24px', cursor: 'pointer', padding: '6px', marginRight: '4px', flexShrink: 0, zIndex: 1002, order: -1, width: '36px', height: '36px', minWidth: '36px' }}
        className="mobile-back-btn"
      >
        ←
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsMobileSidebarOpen(true)
        }}
        style={{ display: 'none', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '24px', cursor: 'pointer', padding: '4px 8px', marginRight: '12px' }}
        className="mobile-menu-btn"
      >
        ☰
      </button>

      <div
        className="chat-header-info"
        onClick={(e) => {
          e.stopPropagation()
          if (selectedChat.type === 'private') handleOpenProfile(false)
          else if (selectedChat.type === 'group' || selectedChat.type === 'channel') {
            loadGroupSettings(selectedChat.groupId || selectedChat.id)
            if (typeof openChannelSettings === 'function') openChannelSettings()
          }
        }}
        style={{ cursor: 'pointer', flex: 1, minWidth: 0, opacity: showSearch ? 0 : 1, transition: 'opacity 0.2s' }}
      >
        <span
          className="chat-title"
          style={{ ...(selectedChat.type === 'channel' && groupSettings?.titleColor ? { color: groupSettings.titleColor } : {}), transition: 'opacity 0.2s', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>{selectedChat.name}</span>
          {(selectedChat.isBot || selectedChat.isAi) && (
            <span title="Официальный бот AegisTalk" style={{ color: '#5cc8ff', fontSize: '16px', lineHeight: 1 }}>✓</span>
          )}
          {groupSettings?.externalLink && groupSettings?.siteVerificationStatus === 'verified' && (
            <a href={groupSettings.externalLink} target="_blank" rel="noreferrer" style={{ marginLeft: 4, color: 'var(--primary)', textDecoration: 'none', fontSize: '16px' }} title={groupSettings.externalLink}>🌐</a>
          )}
        </span>
        {renderPresence()}
      </div>

      <div className="chat-header-buttons" style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10, flexShrink: 0 }}>
        {selectedChat.type === 'private' && !selectedChat.isSelf && (
          <>
            <button onClick={() => startCall('audio')} className="header-btn" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Аудиозвонок">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </button>
            <button onClick={() => startCall('video')} className="header-btn" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Видеозвонок">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
          </>
        )}

        <button onClick={() => { setShowSearch(!showSearch); setChatHistorySearch('') }} className="header-btn" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: showSearch ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Поиск в чате">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>

        <button onClick={() => {}} className="header-btn" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: pinnedMessage ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Закрепленные сообщения">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="header-btn"
            style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => {
              e.stopPropagation()
              setShowChatActionsMenu((prev) => {
                const next = !prev
                if (!next) setShowDeleteChatOptions(false)
                return next
              })
            }}
            title="Еще"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
          </button>

          {showChatActionsMenu && (
            <div className="profile-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setShowDmThemeModal(true); setShowDeleteChatOptions(false); setShowChatActionsMenu(false) }}>Оформление фона</button>
              {(activeDmTheme || (selectedChat.type === 'channel' && groupSettings?.gradientTheme) || (selectedChat.type === 'group' && groupSettings?.gradientTheme)) && (
                <button onClick={resetDmTheme}>Сбросить фон</button>
              )}
              {selectedChat.type === 'private' && (
                <>
                  <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                  {!showDeleteChatOptions ? (
                    <button onClick={() => setShowDeleteChatOptions(true)} style={{ color: 'var(--danger)' }}>Удалить переписку</button>
                  ) : (
                    <>
                      <div style={{ padding: '8px 14px 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Выберите вариант удаления</div>
                      <button onClick={() => handleDeleteSelectedChat('me')} style={{ color: 'var(--text-primary)' }}>Только у себя</button>
                      <button onClick={() => handleDeleteSelectedChat('everyone')} style={{ color: 'var(--danger)' }}>Для всех</button>
                      <button onClick={() => setShowDeleteChatOptions(false)}>Назад</button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showSearch && (
        <div style={{ position: 'absolute', left: '16px', right: '160px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 20 }}>
          <input
            type="text"
            placeholder="Поиск сообщений..."
            value={chatHistorySearch}
            onChange={(e) => setChatHistorySearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
            autoFocus
          />
          <button onClick={() => { setShowSearch(false); setChatHistorySearch('') }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>
      )}
    </div>
  )
}

export default ChatHeaderBar
