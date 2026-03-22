const baseHeaderStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '4px'
}

const avatarStyle = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer',
  flexShrink: 0
}

const labelStyle = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  fontWeight: '500',
  cursor: 'pointer',
  textDecoration: 'none'
}

const getThemeAvatarStyle = (gradientTheme, gradientThemes) => {
  const theme = gradientThemes?.[gradientTheme]
  if (!theme) {
    return { background: 'var(--primary)' }
  }

  if (theme.type === 'pattern') {
    return {
      backgroundColor: theme.backgroundColor || '#0E1621',
      backgroundImage: theme.css,
      backgroundSize: '28px 28px',
      animation: theme.animated ? 'dmGradientShift 24s ease infinite' : 'none'
    }
  }

  return {
    backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
    backgroundSize: theme.animated ? '400% 400%' : 'cover',
    animation: theme.animated ? 'dmGradientShift 24s ease infinite' : 'none'
  }
}

const MessageAuthorHeader = ({
  msg,
  isOwn,
  isBot,
  selectedChat,
  groupSettings,
  gradientThemes,
  onOpenUserProfile,
  onOpenChannelSettings
}) => {
  if (isOwn || isBot) return null

  if (selectedChat?.type === 'group') {
    return (
      <div style={{ ...baseHeaderStyle, alignItems: 'flex-start' }}>
        <div
          onClick={(e) => {
            e.stopPropagation()
            onOpenUserProfile(msg.senderId, msg.senderName, msg.senderAvatar)
          }}
          style={{ ...avatarStyle, background: 'var(--primary)' }}
        >
          {msg.senderAvatar ? (
            <img
              src={msg.senderAvatar}
              alt={msg.senderName || 'User'}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            (msg.senderName || 'U').charAt(0).toUpperCase()
          )}
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation()
            onOpenUserProfile(msg.senderId, msg.senderName, msg.senderAvatar)
          }}
          style={labelStyle}
        >
          {msg.senderName || 'Пользователь'}
        </span>
      </div>
    )
  }

  if (selectedChat?.type === 'channel') {
    return (
      <div style={{ ...baseHeaderStyle, alignItems: 'center' }}>
        <div
          onClick={(e) => {
            e.stopPropagation()
            if (groupSettings) onOpenChannelSettings()
          }}
          style={{
            ...avatarStyle,
            ...getThemeAvatarStyle(groupSettings?.gradientTheme, gradientThemes)
          }}
        >
          {groupSettings?.avatarUrl ? (
            <img
              src={groupSettings.avatarUrl}
              alt={selectedChat.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            (selectedChat.name || 'C').charAt(0).toUpperCase()
          )}
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation()
            if (groupSettings) onOpenChannelSettings()
          }}
          style={labelStyle}
        >
          {selectedChat.name}
        </span>
      </div>
    )
  }

  return null
}

export default MessageAuthorHeader
