import MessageMeta from './MessageMeta'
import MediaAttachmentContent from './MediaAttachmentContent'
import { buildProtectedMediaUrl } from '../api/messages'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const BotMediaContent = ({
  msg,
  isOwn,
  mediaData,
  decryptedText,
  AegisSticker,
  currentlyPlayingId,
  currentAudioRef,
  setCurrentlyPlayingId,
  audioProgress,
  setAudioProgress,
  audioCurrentTime,
  setAudioCurrentTime,
  audioDuration,
  setAudioDuration,
  formatAudioTime,
  setImagePreview
}) => {
  const inlineBase64Image =
    (msg?.mediaUrl && msg.mediaUrl.startsWith('data:image')) ||
    (msg?.imageUrl && msg.imageUrl.startsWith('data:image'))
      ? msg.mediaUrl || msg.imageUrl
      : null

  if (inlineBase64Image) {
    return (
      <div
        style={{
          maxWidth: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.4)',
          marginTop: '4px'
        }}
      >
        <img
          src={inlineBase64Image}
          alt="Изображение"
          style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '460px' }}
        />
      </div>
    )
  }

  if (mediaData && mediaData.type === 'sticker') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
        <AegisSticker sticker={mediaData} />
      </div>
    )
  }

  if (mediaData && mediaData.type === 'voice' && mediaData.url) {
    const voiceUrl = buildProtectedMediaUrl(mediaData.url || msg?.content || msg.id, 'view', { messageId: msg?.id })
    const voiceDuration = Number(mediaData.duration) || 0
    const isPlaying = currentlyPlayingId === msg.id
    const waveHeights = [6, 10, 14, 8, 12, 16, 10, 6, 12, 14, 8, 10, 16, 12, 6, 14, 10, 8, 12, 16, 10, 6, 14, 12, 8]

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.08)', padding: '10px 16px', borderRadius: '12px', width: 'fit-content', maxWidth: '100%', minWidth: '300px', position: 'relative', margin: '8px auto 0 auto' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (currentlyPlayingId === msg.id && currentAudioRef.current) {
              currentAudioRef.current.pause()
              currentAudioRef.current = null
              setCurrentlyPlayingId(null)
              setAudioProgress(0)
              setAudioCurrentTime(0)
              setAudioDuration(0)
            } else {
              setAudioDuration(0)
              if (currentAudioRef.current) {
                currentAudioRef.current.pause()
                currentAudioRef.current = null
              }
              const audio = new Audio(voiceUrl)
              audio.onloadedmetadata = () => setAudioDuration(audio.duration || 0)
              audio.ontimeupdate = () => {
                const progress = (audio.currentTime / audio.duration) * 100
                setAudioProgress(progress || 0)
                setAudioCurrentTime(audio.currentTime || 0)
              }
              audio.onended = () => {
                setCurrentlyPlayingId(null)
                setAudioProgress(0)
                setAudioCurrentTime(0)
                currentAudioRef.current = null
              }
              currentAudioRef.current = audio
              setCurrentlyPlayingId(msg.id)
              setAudioProgress(0)
              setAudioCurrentTime(0)
              audio.play().catch(() => {
                setCurrentlyPlayingId(null)
                setAudioProgress(0)
                setAudioCurrentTime(0)
                currentAudioRef.current = null
              })
            }
          }}
          style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'white', opacity: 0.95, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '32px', flex: '1', flexShrink: 0 }}>
            {waveHeights.map((h, i) => {
              const barPosition = ((i + 1) / waveHeights.length) * 100
              const isPassed = isPlaying && audioProgress >= barPosition
              return <span key={i} style={{ width: '3px', height: `${Math.max(4, h)}px`, background: isPassed ? 'rgba(255,255,255,0.95)' : 'rgba(255, 255, 255, 0.35)', borderRadius: '2px', display: 'inline-block', transition: 'background 0.1s ease' }} />
            })}
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.95)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isPlaying ? formatAudioTime(audioCurrentTime) : formatAudioTime(voiceDuration || audioDuration)}
          </span>
        </div>
        <MessageMeta createdAt={msg.createdAt} isOwn={isOwn} status={msg.status} isEdited={msg.isEdited} fontSize="9px" opacity={0.6} gap="3px" marginTop="0" justifyContent="flex-end" alignSelf="auto" position="absolute" bottom="2px" right="8px" />
      </div>
    )
  }

  if (mediaData && mediaData.type === 'video-circle') {
    const videoUrl = buildProtectedMediaUrl(mediaData?.url || msg?.content || msg.id, 'view', { messageId: msg?.id })
    const videoDuration = mediaData?.duration != null ? Number(mediaData.duration) : 0
    const isPlaying = currentlyPlayingId === msg.id

    return (
      <>
        <div style={{ width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '3px solid rgba(79, 172, 254, 0.6)', boxShadow: '0 0 20px rgba(79, 172, 254, 0.4), 0 4px 20px rgba(0, 0, 0, 0.3)', position: 'relative' }}>
          {videoUrl ? (
            <>
              <video
                src={videoUrl}
                onClick={(e) => {
                  e.stopPropagation()
                  const video = e.currentTarget
                  if (isPlaying) {
                    video.pause()
                    setCurrentlyPlayingId(null)
                  } else {
                    video.play()
                    setCurrentlyPlayingId(msg.id)
                  }
                }}
                onEnded={() => setCurrentlyPlayingId(null)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
              {!isPlaying && (
                <div style={{ position: 'absolute', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(79, 172, 254, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(79, 172, 254, 0.6)', pointerEvents: 'none' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: '48px', color: '#4facfe' }}>📹</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: '11px', opacity: 0.7, whiteSpace: 'nowrap' }}>{formatAudioTime(videoDuration || 0)}</span>
          {isOwn && <span style={{ fontSize: '11px', opacity: 0.7 }}>{msg.status === 'read' ? '✓✓' : '✓'}</span>}
        </div>
      </>
    )
  }

  if (mediaData && ['image', 'video', 'file', 'audio'].includes(mediaData.type)) {
    return <MediaAttachmentContent msg={msg} mediaData={mediaData} isOwn={isOwn} onOpenImagePreview={setImagePreview} />
  }

  if (!mediaData) {
    return (
      <>
        <div className="aegis-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(decryptedText || '')}</ReactMarkdown>
        </div>
        <MessageMeta createdAt={msg.createdAt} isOwn={isOwn} status={msg.status} isEdited={msg.isEdited} fontSize="10px" opacity={0.6} marginTop="8px" />
      </>
    )
  }

  return (
    <>
      <div style={{ overflowWrap: 'break-word', wordBreak: 'keep-all', whiteSpace: 'pre-wrap', lineHeight: '1.6', padding: 0, margin: 0, maxWidth: '100%' }}>
        {decryptedText.split('\n').map((line, idx) => {
          const trimmed = line.trim()
          if (trimmed.startsWith('—') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
            return (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', marginBottom: '8px' }}>
                <span style={{ color: '#64B5F6', fontWeight: 'bold' }}>•</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{trimmed.substring(1).trim()}</span>
              </div>
            )
          }
          if (trimmed === '') {
            return <div key={idx} style={{ height: '8px' }} />
          }
          return <div key={idx}>{line}</div>
        })}
      </div>
      <MessageMeta createdAt={msg.createdAt} isOwn={isOwn} status={msg.status} isEdited={msg.isEdited} fontSize="10px" opacity={0.6} marginTop="8px" />
    </>
  )
}

export default BotMediaContent
