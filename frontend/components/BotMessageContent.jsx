const BotMessageContent = ({
  msg,
  children
}) => {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      padding: '10px 14px',
      borderRadius: '10px',
      maxWidth: '520px',
      width: '100%',
      margin: '12px auto',
      border: '1px solid rgba(79, 172, 254, 0.35)',
      borderLeft: '3px solid #4facfe',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.7)'
    }}>
      <div style={{
        fontSize: '1rem',
        color: '#4facfe',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px'
      }}>
        <span style={{ fontSize: '18px' }}>🤖</span>
        <span>{msg.senderName || 'AegisTalk Bot'}</span>
        <span title="Официальный бот AegisTalk" style={{ color: '#4facfe', fontSize: '14px', fontWeight: 'bold', cursor: 'help' }}>✓</span>
      </div>
      <div style={{
        color: '#E3F2FD',
        fontSize: '14px',
        lineHeight: '1.6',
        overflowWrap: 'break-word',
        wordBreak: 'keep-all'
      }}>
        {children}
      </div>
    </div>
  )
}

export default BotMessageContent
