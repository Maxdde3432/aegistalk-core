import { useState, useEffect } from 'react'
import { resolveAssetUrl } from '../api/runtimeConfig.js'
import { getMessagePreviewLabel, parseMessageMedia } from '../utils/messageMedia'
import StoriesRail from './stories/StoriesRail.jsx'

const parseChatDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const normalized = String(value).trim()
  if (!normalized) return null
  if (/^\d{10,13}$/.test(normalized)) {
    const numericValue = normalized.length === 13 ? Number(normalized) : Number(normalized) * 1000
    const date = new Date(numericValue)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const withoutZone = normalized.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/)
  const date = withoutZone
    ? new Date(normalized.replace(' ', 'T') + 'Z')
    : new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

const ChatSidebar = ({
  showChatList,
  isMobileSidebarOpen,
  showConnectionBanner,
  connectionBannerText,
  user,
  navigateToProfile,
  showSidebarActionsMenu,
  setShowSidebarActionsMenu,
  setShowNewGroupModal,
  sidebarSearchInputRef,
  searchQuery,
  setSearchQuery,
  loadUsers,
  loadGroups,
  setUsers,
  setGroups,
  filteredChats,
  selectedChat,
  selectChat,
  getAvatarColor,
  getInitial,
  users,
  groups,
  createNewChat,
  chats,
  groupsAPI,
  forceUpdate,
  formatTime,
  unreadCounts,
  isTypingInChat,
  decryptMessage
}) => {
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    chat: null
  })

  useEffect(() => {
    const handleClickAway = () => setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev)
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickAway)
      document.addEventListener('contextmenu', handleClickAway)
    }
    return () => {
      document.removeEventListener('click', handleClickAway)
      document.removeEventListener('contextmenu', handleClickAway)
    }
  }, [contextMenu.visible])

  const openContextMenu = (e, chat) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      chat
    })
  }

  const handleMenuAction = (action) => {
    const chat = contextMenu.chat
    if (!chat) return
    console.log('[ChatContextMenu]', action, chat)
    setContextMenu(prev => ({ ...prev, visible: false }))
  }

  const getSidebarPreviewText = (lastMessage) => {
    if (!lastMessage) return 'Нет сообщений'

    const rawValue = typeof lastMessage === 'string' ? lastMessage : lastMessage?.content || ''
    const decryptedValue = decryptMessage(rawValue)
    const candidates = [decryptedValue, rawValue]

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue

      try {
        if (!candidate.trim().startsWith('{')) continue

        const mediaData = JSON.parse(candidate)

        if (mediaData?.type === 'voice') return '🎤 Голосовое сообщение'
        if (mediaData?.type === 'video-circle') return '📹 Видео-кружок'
        if (mediaData?.type === 'video') return '📹 Видео'
        if (mediaData?.type === 'image') return '🖼️ Фото'
        if (mediaData?.type === 'file') return '📎 Файл'
        if (mediaData?.type === 'audio') return '🎧 Аудио'
        if (mediaData?.type === 'sticker') {
          if (mediaData.kind === 'gif') {
            return mediaData.title ? `GIF ${mediaData.title}` : 'GIF'
          }
          return mediaData.title ? `🛡️ ${mediaData.title}` : '🛡️ Стикер'
        }
      } catch (error) {
        continue
      }
    }

    if (typeof decryptedValue === 'string' && !decryptedValue.trim().startsWith('{')) {
      return decryptedValue
    }

    if (typeof rawValue === 'string' && !rawValue.trim().startsWith('{')) {
      return rawValue
    }

    return 'Сообщение'
  }

  const safeSidebarPreviewText = (lastMessage) => {
    if (!lastMessage) return 'Нет сообщений'

    const rawValue = typeof lastMessage === 'string' ? lastMessage : lastMessage?.content || ''
    const decryptedValue = decryptMessage(rawValue)
    const candidates = [decryptedValue, rawValue]

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue
      const mediaData = parseMessageMedia(candidate)
      if (mediaData) {
        return getMessagePreviewLabel(mediaData) || 'Сообщение'
      }
    }

    if (typeof decryptedValue === 'string' && !decryptedValue.trim().startsWith('{')) {
      return decryptedValue
    }

    if (typeof rawValue === 'string' && !rawValue.trim().startsWith('{')) {
      return rawValue
    }

    return 'Сообщение'
  }

  return (
    <aside
      className={`sidebar ${(showChatList || isMobileSidebarOpen) ? 'visible' : 'mobile-hidden'}`}
      style={{
        display: (showChatList || isMobileSidebarOpen) ? 'flex' : 'none',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y'
      }}
    >
      <div className="sidebar-header">
        <div className="profile-button" onClick={navigateToProfile}>
          <div className="avatar-placeholder" style={{ position: 'relative' }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Avatar"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '12px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              user?.firstName?.[0] || '👤'
            )}
          </div>
          <span>{user?.firstName || 'Профиль'}</span>
        </div>
        <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
          <button
            className="send-button"
            style={{ width: '32px', height: '32px', fontSize: '18px' }}
            onClick={() => setShowSidebarActionsMenu(!showSidebarActionsMenu)}
          >
            ⋮
          </button>
          {showSidebarActionsMenu && (
            <div className="profile-menu" style={{ right: 0, left: 'auto', marginTop: '8px' }}>
              <button onClick={() => { setShowNewGroupModal(true); setShowSidebarActionsMenu(false) }}>
                👥 Группа/Канал
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`net-status-banner ${showConnectionBanner ? 'show' : ''}`} aria-live="polite">
        <div className="net-status-banner-inner">{connectionBannerText}</div>
      </div>

      <StoriesRail user={user} />

      <div className="sidebar-search">
        <div className="sidebar-search-box">
          <span className="sidebar-search-icon">🔍</span>
          <input
            ref={sidebarSearchInputRef}
            type="text"
            placeholder="Поиск..."
            className="sidebar-search-field"
            value={searchQuery}
            onChange={(e) => {
              const nextValue = e.target.value
              setSearchQuery(nextValue)
              if (nextValue.length >= 2 && nextValue.length <= 50) {
                // Pass the latest value to avoid "one char behind" state lag (q=A => 400).
                loadUsers(nextValue)
                loadGroups(nextValue)
              } else if (e.target.value.length === 0) {
                setUsers([])
                setGroups([])
              } else if (e.target.value.length === 1) {
                setUsers([])
                loadGroups(nextValue)
              }
            }}
          />
        </div>
      </div>

      {searchQuery.length > 0 ? (
        <div className="chat-list">
          {filteredChats.length > 0 && (
            <>
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    selectChat(chat)
                    setSearchQuery('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0',
                    margin: '0',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onContextMenu={(e) => openContextMenu(e, chat)}
                >
                  <div
                    className="chat-avatar"
                    style={chat.avatar ? undefined : { background: getAvatarColor(chat.id || chat.name), color: '#ffffff' }}
                  >
                    {chat.avatar ? (
                      <img
                        src={resolveAssetUrl(chat.avatar)}
                        alt={chat.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 'inherit',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : getInitial(chat.name)}
                  </div>
                  <div className="chat-info">
                    <span className="chat-name">
                      {chat.name}
                      {(chat.isBot || chat.isAi) && (
                        <span
                          title="Официальный бот AegisTalk"
                          style={{ display: 'inline-block', marginLeft: '4px', color: '#5cc8ff', fontSize: '14px', cursor: 'help', verticalAlign: 'middle' }}
                        >
                          ✓
                        </span>
                      )}
                      {chat.isAi && (
                        <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--primary)' }}>● онлайн</span>
                      )}
                    </span>
                    <span className="chat-preview">{chat.lastMessage || (chat.username ? `@${chat.username}` : 'Открыть чат')}</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {searchQuery.length >= 2 && searchQuery.length <= 50 && users.length === 0 && groups.length === 0 && filteredChats.length === 0 ? (
            <div className="chat-item placeholder">
              <div className="chat-avatar">🔍</div>
              <div className="chat-info">
                <span className="chat-name">Ничего не найдено</span>
                <span className="chat-preview">Попробуйте другой запрос</span>
              </div>
            </div>
          ) : (
            <>
              {searchQuery.length >= 2 && users.length > 0 && users.map(u => (
                <div
                  key={u.id}
                  className="chat-item"
                  onClick={() => { createNewChat(u.id); setSearchQuery(''); setUsers([]) }}
                  onContextMenu={(e) => openContextMenu(e, { ...u, type: 'private' })}
                >
                  <div className="chat-avatar" style={{ background: getAvatarColor(u.id || u.displayName), color: '#ffffff' }}>
                    {getInitial(u.displayName || u.firstName)}
                  </div>
                  <div className="chat-info">
                    <span className="chat-name">{u.displayName}</span>
                    {u.username && <span className="chat-preview">@{u.username}</span>}
                    {u.isOnline && <span className="user-online">онлайн</span>}
                  </div>
                </div>
              ))}
              {searchQuery.length >= 2 && groups.length > 0 && groups.map(g => {
                const isMyChat = chats.some(c => c.id === g.id)
                return (
                  <div
                    key={g.id}
                    className="chat-item"
                    onClick={async () => {
                      setSearchQuery('')
                      setGroups([])
                      const chat = chats.find(c => c.id === g.id)
                      if (chat) {
                        selectChat(chat)
                      } else {
                        const groupInfo = await groupsAPI.getGroupInfo(g.id)
                        const newChat = {
                          id: groupInfo.id,
                          chatId: groupInfo.chatId,
                          type: groupInfo.type,
                          name: groupInfo.name,
                          avatar: groupInfo.avatarUrl
                        }
                        selectChat(newChat)
                      }
                    }}
                    onContextMenu={(e) => openContextMenu(e, { ...g, type: 'group' })}
                  >
                    <div className="chat-avatar" style={{ background: getAvatarColor(g.id || g.name), color: '#ffffff' }}>
                      {getInitial(g.name)}
                    </div>
                    <div className="chat-info">
                      <span className="chat-name">{g.name}</span>
                      {!isMyChat && <span className="chat-preview" style={{ color: 'var(--primary)' }}>🔓 {g.type === 'channel' ? 'Публичный канал' : 'Публичная группа'}</span>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ) : (
        <div className="chat-list" key={`chatlist-${forceUpdate}`}>
          {(() => {
            const sortedChats = [...chats].sort((a, b) => {
              const aTime = parseChatDate(a.lastMessageTime)?.getTime() || 0
              const bTime = parseChatDate(b.lastMessageTime)?.getTime() || 0
              return bTime - aTime
            })

            return sortedChats.length === 0
              ? <div className="chat-item placeholder"><div className="chat-avatar">💬</div><div className="chat-info"><span className="chat-name">Нет чатов</span></div></div>
              : sortedChats.map(chat => (
                  <button
                    key={chat.id}
                    className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      selectChat(chat)
                    }}
                style={{
                      background: 'none',
                      border: 'none',
                      padding: '0',
                      margin: '0',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'pan-y',
                      WebkitTouchCallout: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                }}
                onContextMenu={(e) => openContextMenu(e, chat)}
              >
                    <div
                      className="chat-avatar"
                      style={chat.avatar ? undefined : { background: getAvatarColor(chat.id || chat.name), color: '#ffffff' }}
                    >
                      {chat.avatar ? (
                        <img
                          src={resolveAssetUrl(chat.avatar)}
                          alt={chat.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 'inherit',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            // Hide broken image and fall back to initials background.
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : getInitial(chat.name)}
                    </div>
                    <div className="chat-info">
                      <div className="chat-header-row">
                        <span className="chat-name">
                          {chat.name}
                          {(chat.isBot || chat.isAi) && (
                            <span
                              title="Официальный бот AegisTalk"
                              style={{ display: 'inline-block', marginLeft: '4px', color: '#5cc8ff', fontSize: '14px', cursor: 'help', verticalAlign: 'middle' }}
                            >
                              ✓
                            </span>
                          )}
                          {chat.isAi && (
                            <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--primary)' }}>● онлайн</span>
                          )}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="chat-time">{formatTime(chat.lastMessageTime)}</span>
                          {unreadCounts[chat.chatId || chat.id] > 0 && (
                            <span style={{
                              background: 'var(--primary)',
                              color: 'white',
                              borderRadius: '10px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              minWidth: '20px',
                              textAlign: 'center'
                            }}>
                              {unreadCounts[chat.chatId || chat.id]}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="chat-preview">
                        {(() => {
                          const chatId = chat.chatId || chat.id
                          if (chat.type === 'private' && isTypingInChat(chatId)) {
                            return (
                              <span style={{ color: 'var(--primary)', fontStyle: 'italic' }}>
                                печатает<span className="typing-dots-inline"><span>.</span><span>.</span><span>.</span></span>
                              </span>
                            )
                          }
                          return safeSidebarPreviewText(chat.lastMessage)
                        })()}
                      </span>
                    </div>
                  </button>
                ))
          })()}
        </div>
      )}

      {contextMenu.visible && (
        <div
          className="chat-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'rgba(22, 26, 38, 0.88)',
            borderRadius: '18px',
            padding: '12px 12px 10px',
            minWidth: '220px',
            boxShadow: '0 18px 38px rgba(0,0,0,0.35)',
            border: '1px solid rgba(64,156,255,0.35)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: 2000
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👁</span> <span style={{ cursor: 'pointer' }} onClick={() => handleMenuAction('read')}>Прочитать всё</span>
          </div>

          <div style={{ fontSize: 11, letterSpacing: 0.6, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Управление</div>
          <button className="chat-context-item" onClick={() => handleMenuAction('pin')}><span style={{ marginRight: 8 }}>📌</span>Закрепить в топе</button>
          <button className="chat-context-item" onClick={() => handleMenuAction('mute')}><span style={{ marginRight: 8 }}>🔇</span>Без звука</button>
          <button className="chat-context-item" onClick={() => handleMenuAction('archive')}><span style={{ marginRight: 8 }}>📁</span>В архив</button>

          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '8px 0 10px' }} />

          <div style={{ fontSize: 11, letterSpacing: 0.6, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Безопасность</div>
          <button className="chat-context-item" onClick={() => handleMenuAction('shield')}><span style={{ marginRight: 8 }}>🛡</span>Настройки защиты</button>
          <button className="chat-context-item danger" onClick={() => handleMenuAction('delete')}><span style={{ marginRight: 8 }}>🗑</span>Удалить и очистить</button>
        </div>
      )}
    </aside>
  )
}

export default ChatSidebar
