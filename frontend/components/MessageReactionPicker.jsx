const REACTION_PICKER_EMOJIS = ['👍', '👎', '❤️', '🔥', '🎉', '😀', '😮', '😢', '😡', '✅', '🤔', '🚀']

const MessageReactionPicker = ({
  visible,
  messageId,
  selectedChat,
  groupSettings,
  addReaction,
  onClose
}) => {
  if (!visible) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99,
          cursor: 'pointer'
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: '8px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '4px',
          zIndex: 101,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {REACTION_PICKER_EMOJIS.map((emoji) => {
          const isAllowed = !(selectedChat?.type === 'channel')
            || (groupSettings?.allowedReactions || []).includes(emoji)
            || (groupSettings?.allowedReactions || []).length === 0

          if (!isAllowed) return null

          return (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation()
                addReaction(messageId, emoji)
                onClose()
              }}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'transform 0.1s, background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.2)'
                e.target.style.background = 'var(--bg-tertiary)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)'
                e.target.style.background = 'transparent'
              }}
            >
              {emoji}
            </button>
          )
        })}
      </div>
    </>
  )
}

export default MessageReactionPicker
