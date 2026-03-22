import MessageMeta from './MessageMeta'
import { buildProtectedMediaUrl } from '../api/messages'
import { getMediaPlaceholderLabel, parseMessageMedia } from '../utils/messageMedia'

const TextMessageContent = ({
  msg,
  decryptedText,
  isOwn
}) => {
  const parsed = parseMessageMedia(decryptedText)

  if (parsed?.url) {
    msg.mediaUrl = buildProtectedMediaUrl(parsed.url, 'view', { messageId: msg?.id })
    return null
  }

  if (parsed?.type) {
    return (
      <>
        <div
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.35',
            padding: 0,
            margin: 0,
            marginTop: '4px',
            maxWidth: '100%',
            fontWeight: 500
          }}
        >
          {getMediaPlaceholderLabel(parsed)}
        </div>
        <MessageMeta
          createdAt={msg.createdAt}
          isOwn={isOwn}
          status={msg.status}
          isEdited={msg.isEdited}
          fontSize="11px"
          opacity={0.7}
          marginTop="4px"
        />
      </>
    )
  }

  const isForwarded = decryptedText.startsWith('Переслано от ') || decryptedText.startsWith('Переслано из «')
  const attributionLine = isForwarded ? decryptedText.split('\n')[0] : null
  const bodyText = isForwarded && decryptedText.includes('\n')
    ? decryptedText.slice(decryptedText.indexOf('\n') + 1)
    : isForwarded ? '' : decryptedText

  return (
    <>
      {attributionLine && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            opacity: 0.85,
            marginBottom: '4px',
            borderLeft: '2px solid rgba(79, 172, 254, 0.5)',
            paddingLeft: '8px'
          }}
        >
          {attributionLine}
        </div>
      )}
      {bodyText && (
        <div
          style={{
            wordBreak: 'break-all',
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.35',
            padding: 0,
            margin: 0,
            marginTop: '4px',
            maxWidth: '100%'
          }}
        >
          {bodyText}
        </div>
      )}
      <MessageMeta
        createdAt={msg.createdAt}
        isOwn={isOwn}
        status={msg.status}
        isEdited={msg.isEdited}
        fontSize="11px"
        opacity={0.7}
        marginTop="4px"
      />
    </>
  )
}

export default TextMessageContent
