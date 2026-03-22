import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadFileWithProgress } from '../../api/uploads.js'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']

const STORY_THEMES = [
  { key: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #22d3ee, #3b82f6)' },
  { key: 'ember', label: 'Ember', swatch: 'linear-gradient(135deg, #fb7185, #f59e0b)' },
  { key: 'tide', label: 'Tide', swatch: 'linear-gradient(135deg, #34d399, #14b8a6)' },
  { key: 'nova', label: 'Nova', swatch: 'linear-gradient(135deg, #818cf8, #a855f7)' },
  { key: 'dusk', label: 'Dusk', swatch: 'linear-gradient(135deg, #64748b, #0f172a)' }
]

const detectMediaType = (file) => {
  if (!file?.type) return null
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

const accentByKey = (key) => STORY_THEMES.find((theme) => theme.key === key)?.swatch || STORY_THEMES[0].swatch

const StoryComposerModal = ({ user, initialFile, onClose, onPublish }) => {
  const fileInputRef = useRef(null)
  const photoCaptureInputRef = useRef(null)
  const videoCaptureInputRef = useRef(null)

  const [file, setFile] = useState(initialFile || null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [accentKey, setAccentKey] = useState('aurora')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [allowComments, setAllowComments] = useState(true)
  const [allowReactions, setAllowReactions] = useState(true)

  const mediaType = useMemo(() => detectMediaType(file), [file])
  const titleName = user?.firstName || user?.name || user?.username || 'История'

  useEffect(() => {
    setFile(initialFile || null)
  }, [initialFile])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)

    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [file])

  const handleSetFile = (nextFile) => {
    if (!nextFile) return

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError('Поддерживаются JPG, PNG, WebP, GIF, MP4, WebM и MOV.')
      return
    }

    setError('')
    setFile(nextFile)
  }

  const handlePickFile = (event) => {
    handleSetFile(event.target.files?.[0])
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!file || !mediaType) {
      setError('Сначала выбери фото или видео для истории.')
      return
    }

    setBusy(true)
    setError('')
    setProgress(0)

    try {
      const uploadResult = await uploadFileWithProgress(file, user?.id, setProgress)
      const createdStory = await onPublish({
        mediaUrl: uploadResult.url || uploadResult.path,
        mediaType,
        caption: caption.trim(),
        accentKey,
        allowComments,
        allowReactions
      })

      onClose(createdStory)
    } catch (publishError) {
      setError(publishError.message || 'Не удалось опубликовать историю.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(2, 6, 23, 0.86)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px'
      }}
      onClick={() => !busy && onClose(null)}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 460px)',
          height: 'min(94dvh, 840px)',
          borderRadius: '30px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'radial-gradient(circle at top, rgba(74, 222, 128, 0.12), transparent 36%), radial-gradient(circle at right, rgba(251, 191, 36, 0.12), transparent 34%), linear-gradient(180deg, rgba(7, 14, 24, 0.98), rgba(2, 6, 23, 0.99))',
          boxShadow: '0 32px 90px rgba(2, 6, 23, 0.55)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto'
        }}
      >
        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handlePickFile} />
        <input ref={photoCaptureInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePickFile} />
        <input ref={videoCaptureInputRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={handlePickFile} />

        <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            type="button"
            onClick={() => !busy && onClose(null)}
            style={toolbarButtonStyle}
            aria-label="Назад"
          >
            ←
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(125, 211, 252, 0.82)' }}>
              Story Studio
            </div>
            <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
              Новый кадр
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => photoCaptureInputRef.current?.click()} style={toolbarButtonStyle} title="Снять фото">
              ⌾
            </button>
            <button type="button" onClick={() => videoCaptureInputRef.current?.click()} style={toolbarButtonStyle} title="Снять видео">
              ●
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={toolbarButtonStyle} title="Выбрать из галереи">
              ↗
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 14px 14px', minHeight: 0, display: 'grid', gap: '12px', alignContent: 'start' }}>
          <div
            style={{
              position: 'relative',
              minHeight: 0,
              height: '100%',
              borderRadius: '28px',
              overflow: 'hidden',
              background: accentByKey(accentKey),
              boxShadow: '0 24px 60px rgba(2, 6, 23, 0.42)'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.16)' }} />

            {previewUrl ? (
              mediaType === 'video' ? (
                <video
                  src={previewUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '380px' }}
                  muted
                  playsInline
                  controls
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Предпросмотр истории"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '380px' }}
                />
              )
            ) : (
              <div
                style={{
                  minHeight: '380px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(255,255,255,0.82)',
                  textAlign: 'center',
                  padding: '24px'
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>Добавь фото или видео</div>
                  <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.84 }}>
                    Можно снять прямо сейчас или выбрать из галереи.
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={badgeStyle}>
                  {titleName}
                </div>
                <div style={badgeStyle}>
                  24 часа
                </div>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value.slice(0, 280))}
                  placeholder="Добавь подпись к истории"
                  style={{
                    width: '100%',
                    minHeight: '96px',
                    resize: 'none',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '20px',
                    padding: '14px 16px',
                    background: 'rgba(2, 6, 23, 0.38)',
                    color: '#f8fafc',
                    outline: 'none',
                    fontSize: '14px',
                    lineHeight: 1.45,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                  }}
                />

                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {STORY_THEMES.map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => setAccentKey(theme.key)}
                        style={{
                          padding: '0',
                          width: '44px',
                          height: '44px',
                          borderRadius: '16px',
                          border: theme.key === accentKey ? '2px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.12)',
                          background: theme.swatch,
                          cursor: 'pointer',
                          boxShadow: theme.key === accentKey ? '0 0 0 4px rgba(255,255,255,0.14)' : 'none'
                        }}
                        title={theme.label}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={switchRowStyle}>
                      <span>Разрешить комментарии</span>
                      <input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} />
                    </label>
                    <label style={switchRowStyle}>
                      <span>Разрешить лайки</span>
                      <input type="checkbox" checked={allowReactions} onChange={(event) => setAllowReactions(event.target.checked)} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {progress > 0 && busy ? (
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #22d3ee, #3b82f6)'
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(226,232,240,0.78)' }}>
                Загрузка: {Math.round(progress)}%
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                borderRadius: '14px',
                border: '1px solid rgba(248, 113, 113, 0.28)',
                background: 'rgba(127, 29, 29, 0.2)',
                color: '#fecaca',
                padding: '12px 14px',
                fontSize: '13px'
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div style={{ padding: '0 14px 14px', display: 'grid', gap: '10px' }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              border: 'none',
              borderRadius: '18px',
              minHeight: '54px',
              background: busy
                ? 'rgba(59, 130, 246, 0.45)'
                : 'linear-gradient(135deg, #34d399, #22d3ee, #3b82f6)',
              color: 'white',
              fontWeight: 800,
              fontSize: '15px',
              cursor: busy ? 'default' : 'pointer',
              boxShadow: '0 18px 48px rgba(6, 182, 212, 0.24)'
            }}
          >
            {busy ? 'Публикуем...' : 'Опубликовать историю'}
          </button>
        </div>
      </form>
    </div>
  )
}

const toolbarButtonStyle = {
  minWidth: '40px',
  height: '40px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#e2e8f0',
  cursor: 'pointer',
  padding: '0 12px'
}

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(2, 6, 23, 0.4)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f8fafc',
  fontSize: '12px',
  fontWeight: 700,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
}

const switchRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '11px 14px',
  borderRadius: '16px',
  background: 'rgba(2, 6, 23, 0.38)',
  color: '#e2e8f0',
  fontSize: '13px',
  border: '1px solid rgba(255,255,255,0.09)'
}

export default StoryComposerModal
