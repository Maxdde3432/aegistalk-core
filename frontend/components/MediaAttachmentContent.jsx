import { useMemo, useEffect, useState } from 'react'
import { buildProtectedMediaUrl, downloadProtectedMedia, fetchProtectedMediaBlobUrl } from '../api/messages'
import { secureStorage } from '../utils/secureStorage'

const MediaAttachmentContent = ({
  msg,
  mediaData,
  isOwn,
  onOpenImagePreview
}) => {
  const token = secureStorage.getItem('accessToken')

  // Если пользователь не авторизован, не пытаемся грузить приватное медиа
  if (!token) {
    return (
      <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
        Авторизуйтесь, чтобы просмотреть вложение
      </div>
    )
  }

  const mediaReference = mediaData?.url || mediaData?.path || msg?.content || msg?.id
  const protectedUrl = buildProtectedMediaUrl(mediaReference, 'view', { messageId: msg?.id })
  const decryptInfo = useMemo(() => ({
    key: mediaData?.key,
    iv: mediaData?.iv,
    mime: mediaData?.mime
  }), [mediaData?.key, mediaData?.iv, mediaData?.mime])
  const [decryptedUrl, setDecryptedUrl] = useState(null)

  useEffect(() => {
    let revoke = null
    if (mediaData?.type && msg?.id) {
      fetchProtectedMediaBlobUrl(
        msg.id,
        'view',
        decryptInfo?.key && decryptInfo?.iv ? decryptInfo : null
      )
        .then((url) => {
          setDecryptedUrl(url)
          revoke = url
        })
        .catch((err) => {
          console.error('[MediaAttachmentContent] fetch/decrypt error', err)
          setDecryptedUrl(null)
        })
    } else {
      setDecryptedUrl(null)
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [msg?.id, mediaData?.type, decryptInfo?.key, decryptInfo?.iv, decryptInfo?.mime])

  const imageUrl = useMemo(() => {
    if (mediaData?.type !== 'image') return null
    return decryptedUrl || protectedUrl
  }, [mediaData?.type, decryptedUrl, protectedUrl])

  const openInBrowser = (e) => {
    e.stopPropagation()
    // Открываем защищённую ссылку (с токеном), чтобы сработала серверная авторизация/редирект
    window.open(protectedUrl, '_blank', 'noopener')
  }

  if (mediaData?.type === 'image' && imageUrl) {

    return (
      <>
        <div
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            maxWidth: '320px',
            border: '1px solid rgba(148, 163, 184, 0.4)',
            cursor: 'pointer',
            marginTop: '4px'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onOpenImagePreview({
              url: imageUrl,
              name: 'Изображение',
              messageId: msg?.id || null,
              messageContent: msg?.content || '',
              isMedia: true,
              senderName: msg?.senderName || ''
            })
          }}
        >
          <img
            src={imageUrl}
            alt="Изображение"
            style={{
              width: '100%',
              display: 'block',
              objectFit: 'cover',
              maxHeight: '420px'
            }}
          />
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.8 }}>Фото</div>
      </>
    )
  }

  if (mediaData && (mediaData.type === 'video' || mediaData.type === 'file' || mediaData.type === 'audio' || mediaData.type === 'voice')) {
    const fileLabel =
      mediaData.type === 'video'
        ? 'Видео'
        : mediaData.type === 'audio' || mediaData.type === 'voice'
          ? 'Аудио'
          : 'Файл'
    const sizeKb = mediaData.size ? Math.round(mediaData.size / 1024) : null

    if (mediaData.type === 'video') {
      return (
        <div className={`telegram-video-bubble ${isOwn ? 'own' : ''}`}>
          <video
            controls
            src={decryptedUrl || protectedUrl}
            style={{
              width: '100%',
              maxWidth: '280px',
              maxHeight: '360px',
              borderRadius: '22px',
              display: 'block',
              background: '#000',
              objectFit: 'cover'
            }}
          />
          <div className="telegram-video-meta">
            <span>{fileLabel}</span>
            <span>{new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )
    }

    if (mediaData.type === 'audio' || mediaData.type === 'voice') {
      return (
        <>
          <audio
            controls
            src={decryptedUrl || protectedUrl}
            style={{ width: '100%', maxWidth: '320px', marginTop: '4px' }}
          />
          <div style={{ marginTop: '6px', fontSize: '11px', opacity: 0.8 }}>
            {fileLabel}
          </div>
        </>
      )
    }

    return (
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation()
          if (!msg?.id) return
          try {
            await downloadProtectedMedia(msg.id, fileLabel, decryptInfo?.key ? decryptInfo : null)
          } catch (error) {
            console.error('[MediaAttachmentContent] Failed to download file:', error)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '12px',
          background: 'rgba(17, 24, 39, 0.9)',
          marginTop: '4px',
          color: '#E5E7EB',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '18px' }}>📎</span>
        <span style={{ fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileLabel}
        </span>
        {sizeKb != null && (
          <span style={{ fontSize: '11px', opacity: 0.7 }}>
            {sizeKb} KB
          </span>
        )}
      </button>
    )
  }

  // Файл или медиа по умолчанию: кнопка открытия
  if (mediaData?.url) {
    return null
  }

  return null
}

export default MediaAttachmentContent
