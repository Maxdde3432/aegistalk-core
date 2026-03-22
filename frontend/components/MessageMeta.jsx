const MessageMeta = ({
  createdAt,
  isOwn = false,
  status,
  isEdited = false,
  fontSize = '11px',
  opacity = 0.7,
  gap = '4px',
  marginTop = '4px',
  justifyContent = 'flex-end',
  alignSelf = 'flex-end',
  position,
  bottom,
  right
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        marginTop,
        justifyContent,
        alignSelf,
        ...(position ? { position } : {}),
        ...(bottom !== undefined ? { bottom } : {}),
        ...(right !== undefined ? { right } : {})
      }}
    >
      <span style={{ fontSize, opacity, whiteSpace: 'nowrap' }}>
        {new Date(createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </span>
      {isOwn && (
        <span style={{ fontSize, opacity }}>
          {status === 'read' ? '✓✓' : '✓'}
        </span>
      )}
      {isEdited && (
        <span style={{ fontSize: '10px', opacity: Math.max(0.4, opacity - 0.2) }}>(ред.)</span>
      )}
    </div>
  )
}

export default MessageMeta
