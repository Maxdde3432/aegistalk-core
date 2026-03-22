const ForwardMessageModal = ({
  forwardState,
  closeForwardModal,
  chats,
  selectedChat,
  isForwarding,
  handleForwardToChat,
  AegisSticker
}) => {
  if (!forwardState.open) return null

  return (
    <div
      className="modal-overlay"
      onClick={closeForwardModal}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 11990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '80vh',
          background: '#050505',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          padding: '18px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Переслать сообщение</h3>
          <button
            type="button"
            onClick={closeForwardModal}
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

        {forwardState.message && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background: '#0b0b0f',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              maxHeight: '160px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {(() => {
              const { text, mediaPreview, isMedia } = forwardState.message
              if (!isMedia) return text || 'Пустое сообщение'
              if (!mediaPreview) return 'Медиа (пересылаем без изменений)'
              if (mediaPreview.type === 'image' && mediaPreview.url) {
                const imageUrl = mediaPreview.url
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        maxWidth: '260px',
                        border: '1px solid rgba(148, 163, 184, 0.4)'
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt="Изображение"
                        style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: '220px' }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>🖼 Фото</span>
                  </div>
                )
              }
              if (mediaPreview.type === 'video') return '📹 Видео'
              if (mediaPreview.type === 'audio' || mediaPreview.type === 'voice') return '🎤 Голосовое сообщение'
              if (mediaPreview.type === 'sticker') {
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px' }}>
                    <AegisSticker sticker={mediaPreview} compact />
                  </div>
                )
              }
              if (mediaPreview.type === 'file') return '📎 Файл'
              return 'Медиа-сообщение'
            })()}
          </div>
        )}

        <div
          style={{
            marginTop: '4px',
            padding: '8px 0',
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {chats.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Нет доступных чатов для пересылки.
            </div>
          )}

          {chats.map((chat) => {
            const chatId = chat.chatId || chat.id
            const isCurrent = (selectedChat?.chatId || selectedChat?.id) === chatId
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => handleForwardToChat(chat)}
                disabled={isForwarding}
                style={{
                  padding: '8px 12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-color)',
                  background: isCurrent ? 'rgba(79, 172, 254, 0.14)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: isForwarding ? 'default' : 'pointer',
                  opacity: isForwarding ? 0.7 : 1
                }}
              >
                {chat.name}
                {isCurrent && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                    (текущий чат)
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div
          style={{
            marginTop: '6px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={closeForwardModal}
            style={{
              padding: '8px 14px',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForwardMessageModal
