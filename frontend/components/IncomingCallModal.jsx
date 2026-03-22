const iconWrapStyle = {
  width: '22px',
  height: '22px',
  display: 'block'
}

const AcceptIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconWrapStyle}>
    <path d="M5 4.5h3.1l1.6 4.3-2.2 1.4a14 14 0 0 0 6.3 6.3l1.4-2.2 4.3 1.6V19a2 2 0 0 1-2 2h-1C9.7 21 3 14.3 3 6.5a2 2 0 0 1 2-2Z" />
  </svg>
)

const RejectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconWrapStyle}>
    <path d="M4 15.5c2-2 4.7-3 8-3s6 1 8 3l-1.8 4.1-4.7-1.1v-3a14.7 14.7 0 0 1-3 0v3l-4.7 1.1L4 15.5Z" />
  </svg>
)

const actionButtonStyle = (accept = false) => ({
  width: '82px',
  height: '82px',
  border: 'none',
  borderRadius: '999px',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  boxShadow: '0 22px 60px rgba(0, 0, 0, 0.35)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
  background: accept
    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.98), rgba(22, 163, 74, 0.94))'
    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.98), rgba(185, 28, 28, 0.94))'
})

const IncomingCallModal = ({ incomingCall, onAccept, onReject }) => {
  if (!incomingCall) return null

  const callerName = incomingCall.callerNameResolved || incomingCall.callerName || 'Контакт'
  const isVideo = incomingCall.type === 'video'

  return (
    <div
      className="modal-overlay"
      style={{
        background: 'rgba(2, 6, 23, 0.84)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        style={{
          width: 'min(100%, 460px)',
          borderRadius: '32px',
          overflow: 'hidden',
          padding: '0',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.20), transparent 30%), linear-gradient(180deg, rgba(10, 14, 23, 0.98), rgba(3, 7, 18, 0.98))',
          boxShadow: '0 40px 120px rgba(0, 0, 0, 0.56)',
          color: '#f8fafc',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), transparent 45%, rgba(14, 165, 233, 0.08))',
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '28px 24px 26px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              opacity: 0.8
            }}
          >
            <span>{isVideo ? 'Видеозвонок' : 'Аудиозвонок'}</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#22c55e', boxShadow: '0 0 16px rgba(34, 197, 94, 0.65)' }} />
          </div>

          <div
            style={{
              width: '164px',
              height: '164px',
              margin: '24px auto 18px',
              borderRadius: '46px',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.95), rgba(16, 185, 129, 0.88))',
              fontSize: '58px',
              fontWeight: 700,
              boxShadow: '0 0 0 16px rgba(34, 197, 94, 0.06), 0 30px 80px rgba(14, 165, 233, 0.20)'
            }}
          >
            {incomingCall.callerAvatar ? (
              <img
                src={incomingCall.callerAvatar}
                alt={callerName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              callerName.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.03em' }}>{callerName}</div>
          <div style={{ marginTop: '10px', fontSize: '16px', color: '#cbd5e1' }}>
            {isVideo ? 'Входящий видеозвонок' : 'Входящий аудиозвонок'}
          </div>
          <div style={{ marginTop: '6px', fontSize: '14px', color: '#94a3b8' }}>
            Ответьте, чтобы подключить {isVideo ? 'камеру и микрофон' : 'микрофон'}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '18px',
              marginTop: '28px',
              flexWrap: 'wrap'
            }}
          >
            <button type="button" onClick={onReject} style={actionButtonStyle(false)} title="Отклонить звонок">
              <RejectIcon />
            </button>

            <button type="button" onClick={onAccept} style={actionButtonStyle(true)} title="Ответить">
              <AcceptIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomingCallModal
