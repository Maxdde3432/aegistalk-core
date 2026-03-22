const PinnedMessageBar = ({ pinnedMessage, onClose }) => {
  if (!pinnedMessage) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'rgba(79, 172, 254, 0.1)',
        borderLeft: '3px solid #4facfe',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.15)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.1)' }}
    >
      <span style={{ fontSize: '16px' }}>📌</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pinnedMessage.content}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '4px'
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default PinnedMessageBar
