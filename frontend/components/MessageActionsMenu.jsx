const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

const MessageActionsMenu = ({
  msg,
  decryptedText,
  selectedChat,
  groupSettings,
  user,
  toggleReaction,
  openForwardModal,
  saveMessageToFavorites,
  showReactionPicker,
  setShowReactionPicker,
  setShowEditModal,
  setEditContent,
  deleteMessage
}) => {
  return (
    <div
      className="message-actions"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%) translateY(10px)',
        display: 'none',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--bg-tertiary)',
        borderRadius: '20px',
        padding: '6px 8px',
        gap: '4px',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 100,
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        marginBottom: '8px'
      }}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const isAllowed = !(selectedChat?.type === 'channel')
          || (groupSettings?.allowedReactions || []).includes(emoji)
          || (groupSettings?.allowedReactions || []).length === 0

        if (!isAllowed) return null

        return (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation()
              toggleReaction(msg.id, emoji)
            }}
            style={{
              padding: '4px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => { e.target.style.transform = 'scale(1.2)' }}
            onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
          >
            {emoji}
          </button>
        )
      })}

      <button
        onClick={(e) => {
          e.stopPropagation()
          openForwardModal(msg.id, decryptedText, msg)
        }}
        style={{
          padding: '4px 10px',
          background: 'var(--bg-tertiary)',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '13px',
          cursor: 'pointer',
          marginLeft: '4px',
          pointerEvents: 'auto',
          color: 'var(--text-primary)'
        }}
      >
        ↪ Переслать
      </button>

      {saveMessageToFavorites && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            saveMessageToFavorites(msg.id, decryptedText, msg)
          }}
          style={{
            padding: '4px 10px',
            background: 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '13px',
            cursor: 'pointer',
            marginLeft: '4px',
            pointerEvents: 'auto',
            color: 'var(--text-primary)'
          }}
        >
          💾 Сохранить
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)
        }}
        style={{
          padding: '4px 8px',
          background: 'var(--bg-tertiary)',
          border: 'none',
          borderRadius: '12px',
          fontSize: '14px',
          cursor: 'pointer',
          marginLeft: '4px',
          pointerEvents: 'auto'
        }}
      >
        ＋
      </button>

      {(msg.senderId === user.id || ((selectedChat?.type === 'channel' || selectedChat?.type === 'group') && (groupSettings?.myRole === 'owner' || groupSettings?.myRole === 'admin'))) && (
        <>
          {!decryptedText.trim().startsWith('{') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowEditModal(msg.id)
                setEditContent(decryptedText)
              }}
              style={{
                padding: '4px',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
            >
              ✏️
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Удалить?')) deleteMessage(msg.id)
            }}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--danger)',
              pointerEvents: 'auto',
              marginLeft: '4px'
            }}
          >
            Удалить для всех
          </button>
        </>
      )}
    </div>
  )
}

export default MessageActionsMenu
