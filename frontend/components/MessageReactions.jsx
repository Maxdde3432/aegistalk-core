const MessageReactions = ({
  reactions,
  messageId,
  selectedChat,
  groupSettings,
  user,
  toggleReaction
}) => {
  if (!reactions?.length) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-6px',
        transform: 'translateY(100%)',
        right: 'auto',
        left: '8px',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        zIndex: 10,
        maxWidth: '92%',
        overflow: 'hidden'
      }}
    >
      {reactions.map((reaction) => {
        const isAllowed = !(selectedChat?.type === 'channel')
          || (groupSettings?.allowedReactions || []).includes(reaction.emoji)
          || (groupSettings?.allowedReactions || []).length === 0

        if (!isAllowed) return null

        const isOwnReaction = reaction.users.some((u) => u.userId === user.id)

        return (
          <button
            key={reaction.emoji}
            onClick={(e) => {
              e.stopPropagation()
              toggleReaction(messageId, reaction.emoji)
            }}
            style={{
              padding: '2px 6px',
              background: isOwnReaction ? '#4A9EFF30' : 'var(--bg-tertiary)',
              border: `1px solid ${isOwnReaction ? '#4A9EFF' : 'transparent'}`,
              borderRadius: '12px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}
            title={reaction.users.map((u) => u.name).join(', ')}
          >
            {reaction.emoji}
            {reaction.count > 1 ? <span style={{ fontSize: '10px', marginLeft: '2px' }}>{reaction.count}</span> : ''}
          </button>
        )
      })}
    </div>
  )
}

export default MessageReactions
