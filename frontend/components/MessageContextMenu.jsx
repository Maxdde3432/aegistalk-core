const MessageContextMenu = ({
  messageContextMenu,
  closeMessageContextMenu,
  toggleReaction,
  setShowEditModal,
  setEditContent,
  copyMessageFromMenu,
  openForwardModal,
  saveMessageToFavorites,
  setSelectedMessageId,
  deleteMessageFromMenu
}) => {
  if (!messageContextMenu.visible) return null

  return (
    <>
      <div
        className="message-context-overlay"
        onClick={closeMessageContextMenu}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998
        }}
      />
      <div
        className="message-context-menu modern"
        style={{
          position: 'fixed',
          top: messageContextMenu.y,
          left: messageContextMenu.x,
          zIndex: 9999
        }}
      >
        <div className="message-context-reactions">
          {['❤️', '👍', '👎', '🔥', '🥳', '👏'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="message-context-reaction-btn"
              onClick={() => {
                toggleReaction(messageContextMenu.messageId, emoji)
                closeMessageContextMenu()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="message-context-card">
          {messageContextMenu.isOwn && !messageContextMenu.messageContent?.trim().startsWith('{') && (
            <button
              className="message-context-item"
              onClick={() => {
                setShowEditModal(messageContextMenu.messageId)
                setEditContent(messageContextMenu.messageContent)
                closeMessageContextMenu()
              }}
            >
              <span className="message-context-icon">✎</span>
              <span>Изменить</span>
            </button>
          )}
          <button className="message-context-item" onClick={copyMessageFromMenu}>
            <span className="message-context-icon">⧉</span>
            <span>Копировать</span>
          </button>
          <button
            className="message-context-item"
            onClick={() => {
              openForwardModal(messageContextMenu.messageId, messageContextMenu.messageContent)
              closeMessageContextMenu()
            }}
          >
            <span className="message-context-icon">↗</span>
            <span>Переслать</span>
          </button>
          {saveMessageToFavorites && (
            <button
              className="message-context-item"
              onClick={() => {
                saveMessageToFavorites(messageContextMenu.messageId, messageContextMenu.messageContent)
                closeMessageContextMenu()
              }}
            >
              <span className="message-context-icon">💾</span>
              <span>Сохранить</span>
            </button>
          )}
          <button
            className="message-context-item"
            onClick={() => {
              setSelectedMessageId(messageContextMenu.messageId)
              closeMessageContextMenu()
            }}
          >
            <span className="message-context-icon">◉</span>
            <span>Выбрать</span>
          </button>
          {messageContextMenu.isOwn && (
            <button className="message-context-item danger" onClick={deleteMessageFromMenu}>
              <span className="message-context-icon">⌫</span>
              <span>Удалить</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default MessageContextMenu
