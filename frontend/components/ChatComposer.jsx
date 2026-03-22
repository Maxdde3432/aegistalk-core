import { useRef, useState, useEffect } from 'react'
import { messagesAPI, wsService } from '../api/chats'
import { uploadFile } from '../api/uploads.js'
import { encryptFile } from '../utils/fileCrypto'

const ChatComposer = ({
  selectedChat,
  groupSettings,
  isRecording,
  recordingTime,
  recordingMode = 'audio',
  setRecordingMode,
  formatAudioTime,
  loadChats,
  loadMessages,
  user,
  setComposerPanelTab,
  composerPanelTab,
  setShowStickerPicker,
  showStickerPicker,
  appendEmojiToInput,
  sendStickerMessage,
  AEGIS_GIFS,
  AEGIS_STICKERS,
  AegisSticker,
  shieldIcon,
  messageInput,
  setMessageInput,
  typingTimeoutRef,
  handleKeyPress,
  handleStartRecording,
  handleStopRecording,
  handleCancelRecording,
  sendMessage,
  onJoinPublicChat,
  encryptContentForChat
}) => {
  // Показываем поле ввода, даже если это бот (Aegis AI и др.)
  if (
    !selectedChat ||
    (selectedChat?.isBot && selectedChat?.username === 'AegisTalkBot') ||
    (selectedChat.type === 'channel' &&
      groupSettings?.myRole !== 'owner' &&
      groupSettings?.myRole !== 'admin')
  ) {
    return null
  }

  const recordPressTimerRef = useRef(null)
  const recordLongPressTriggeredRef = useRef(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const [pendingCaption, setPendingCaption] = useState('')
  const [pendingType, setPendingType] = useState('media')
  const [emojiCategory, setEmojiCategory] = useState('smileys')
  const [gifSearch, setGifSearch] = useState('trending')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const hasCustomChatBackground = Boolean(groupSettings?.backgroundImageUrl || groupSettings?.gradientTheme)
  const composerShellBackground = hasCustomChatBackground
    ? 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(2,6,23,0.14) 52%, rgba(2,6,23,0.26) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.58) 100%)'
  const composerCardBackground = hasCustomChatBackground ? 'rgba(4, 10, 20, 0.72)' : 'rgba(10, 10, 12, 0.92)'
  const composerCardBorder = hasCustomChatBackground ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)'
  const composerCardShadow = hasCustomChatBackground
    ? '0 20px 38px rgba(0, 0, 0, 0.32)'
    : '0 18px 34px rgba(0, 0, 0, 0.46)'

  const resetPending = () => {
    setPendingFile(null)
    setPendingPreview(null)
    setPendingCaption('')
    setPendingType('media')
  }

  const handlePickFile = (type) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'media' ? 'image/*,video/*,audio/*' : '.pdf,.doc,.docx,.txt,.zip,.rar,.7z'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 50 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 50MB')
        return
      }

      setPendingFile(file)
      setPendingType(type)

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setPendingPreview(reader.result)
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file)
        setPendingPreview(url)
      } else {
        setPendingPreview(null)
      }
    }
    input.click()
  }

  const handleSendPending = async () => {
    if (!pendingFile || !selectedChat) return
    const chatId = selectedChat.chatId || selectedChat.id
    try {
      // Шифруем файл на клиенте
      const { cipherBlob, keyB64, ivB64, hashName } = await encryptFile(pendingFile)
      const encryptedFile = new File([cipherBlob], hashName, { type: 'application/octet-stream' })

      const result = await uploadFile(encryptedFile, user.id)
      if (!result.success) {
        alert('Ошибка загрузки: ' + result.error)
        return
      }

      const fileType = pendingFile.type.startsWith('image/')
        ? 'image'
        : pendingFile.type.startsWith('video/')
          ? 'video'
          : pendingFile.type.startsWith('audio/')
            ? 'audio'
            : 'file'

      const content = JSON.stringify({
        type: fileType,
        url: result.url,
        size: pendingFile.size,
        caption: pendingCaption || '',
        key: keyB64,
        iv: ivB64,
        mime: pendingFile.type,
        enc: true
      })
      const encryptedContent = typeof encryptContentForChat === 'function'
        ? encryptContentForChat(selectedChat, content)
        : content

      await messagesAPI.sendMessage(chatId, encryptedContent, {
        type: fileType,
        content: encryptedContent,
        senderPublicKey: user?.publicKey || ''
      })
      await loadChats()
      await loadMessages(chatId)
      resetPending()
      setAttachMenuOpen(false)
    } catch (err) {
      console.error('File upload error:', err)
      alert('Ошибка при загрузке файла: ' + err.message)
    }
  }

  // =========================
  // Emoji & GIF data
  // =========================
  const EMOJI_CATEGORIES = {
    смайлы: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😍','😘','😗','😙','😚','🙂','😉','😌','🤗','🤭','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤓','😎','🥳','🤩','🥺','😭','😤','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤝'],
    животные: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'],
    еда: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🥕','🫒','🥔','🌽','🍠','🥐','🍞','🥖','🥨','🥯','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥙','🌮','🌯','🫔','🥗','🥘','🥫'],
    путешествия: ['✈️','🛫','🛬','🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍','🚲','🛴','🚏','🗺','🗽','🗼','🏰','🏯','🏟','🎡','🎢','🎠','🌁','🌉','🏞','🏜','🏝','🏖','🌋','🗻','🏔','⛰','🏕','🛶','⛵️','🚤','🛥','🛳','⛴','🚀','🛸'],
    предметы: ['⌚️','📱','💻','⌨️','🖥','🖱','🖲','🕹','🗜','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📞','☎️','📟','📠','📺','📻','🎙','🎚','🎛','🧭','⏱','⏲','⏰','🕰','⌛️','⏳','📡','🔋','🔌','💡','🔦','🕯','🧯','🛢','🧨','🧧','✉️','📩','📨','📧','💌','📮','📪','📫','📬','📭','📦','📯','📜','📃','📄','📑','📊','📈','📉','🗒','🗓','📆','📅','🗑']
  }

  const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY || 'LIVDSRZULELA'
  useEffect(() => {
    let cancelled = false
    const fetchGifs = async () => {
      setGifLoading(true)
      setGifError('')
      try {
        const q = gifSearch?.trim() || 'trending'
        const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&media_filter=gif,tinygif`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`GIF API ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setGifResults(data.results || [])
      } catch (err) {
        if (!cancelled) setGifError('Не удалось загрузить GIF')
        console.error('[GIF] fetch error', err)
      } finally {
        if (!cancelled) setGifLoading(false)
      }
    }
    if (composerPanelTab === 'gif') fetchGifs()
    return () => { cancelled = true }
  }, [gifSearch, composerPanelTab])

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '8px 20px calc(10px + env(safe-area-inset-bottom)) 20px',
        flexShrink: 0,
        background: composerShellBackground
      }}
    >
      {selectedChat?.isPublic ? (
        <button
          className="btn-primary"
          onClick={onJoinPublicChat}
          style={{
            width: '100%',
            maxWidth: '750px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 'bold',
            borderRadius: '24px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(148, 163, 184, 0.45)',
            boxShadow: '0 18px 45px rgba(0, 0, 0, 0.65)'
          }}
        >
          {selectedChat.type === 'channel' ? '📬 Подписаться на канал' : '👥 Вступить в группу'}
        </button>
      ) : isRecording ? (
        <div
          className="voice-recording-bar"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '9999px',
            maxWidth: '768px',
            width: '100%',
            background: composerCardBackground,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: composerCardBorder,
            boxShadow: composerCardShadow
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()
              handleCancelRecording?.()
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Удалить запись"
            aria-label="Удалить запись"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path
                d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M10 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                fontSize: '16px',
                opacity: 0.9,
                flexShrink: 0
              }}
              title={recordingMode === 'video' ? 'Видео-кружок' : 'Голосовое сообщение'}
            >
              {recordingMode === 'video' ? '📹' : '🎤'}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ff4757',
                animation: 'pulse 1s infinite',
                flexShrink: 0
              }}
            />
            <span
              style={{
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}
            >
              {formatAudioTime(recordingTime)}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()
              handleStopRecording?.()
            }}
            style={{
              height: '40px',
              borderRadius: '9999px',
              border: 'none',
              padding: '0 14px 0 12px',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              flexShrink: 0,
              boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35)'
            }}
            title="Отправить"
            aria-label="Отправить"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 11.5l18-8-8 18-2.5-7L3 11.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Отправить</span>
          </button>
        </div>
      ) : (
        <div
          className="message-input-bar"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            maxWidth: '768px',
            width: '100%',
            background: composerCardBackground,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: composerCardBorder,
            boxShadow: composerCardShadow,
            transition: 'all 0.2s'
          }}
        >
            {showStickerPicker && (
            <div className="composer-media-panel">
              <div className="composer-media-panel-top">
                <div className="composer-media-tabs">
                  <button
                    type="button"
                    className={`composer-media-tab ${composerPanelTab === 'emoji' ? 'active' : ''}`}
                    onClick={() => setComposerPanelTab('emoji')}
                  >
                    Эмодзи
                  </button>
                  <button
                    type="button"
                    className={`composer-media-tab ${composerPanelTab === 'gif' ? 'active' : ''}`}
                    onClick={() => setComposerPanelTab('gif')}
                  >
                    ГИФ
                  </button>
                  <button
                    type="button"
                    className={`composer-media-tab ${composerPanelTab === 'stickers' ? 'active' : ''}`}
                    onClick={() => setComposerPanelTab('stickers')}
                  >
                    Стикеры
                  </button>
                </div>
                <button type="button" onClick={() => setShowStickerPicker(false)} className="composer-media-close">
                  ✕
                </button>
              </div>

              {composerPanelTab === 'emoji' ? (
                <div className="emoji-pane">
                  <div className="emoji-categories">
                    {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                      <button
                        key={cat}
                        className={`emoji-cat ${emojiCategory === cat ? 'active' : ''}`}
                        onClick={() => setEmojiCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="composer-emoji-grid dense">
                    {(EMOJI_CATEGORIES[emojiCategory] || []).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="composer-emoji-btn"
                        onClick={() => appendEmojiToInput(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : composerPanelTab === 'gif' ? (
                <div className="gif-pane">
                  <input
                    type="text"
                    className="gif-search"
                    placeholder="Поиск GIF..."
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                  />
                  {gifLoading && <div className="gif-status">Загрузка...</div>}
                  {gifError && <div className="gif-status error">{gifError}</div>}
                  <div className="composer-sticker-grid gif-grid dense">
                    {gifResults.map((gif) => {
                      const media = gif.media_formats?.tinygif || gif.media_formats?.gif || gif.media_formats?.mediumgif
                      const url = media?.url
                      if (!url) return null
                      return (
                        <button
                          key={gif.id}
                          type="button"
                          className="composer-sticker-item gif-item"
                          onClick={() =>
                            sendStickerMessage({
                              id: gif.id,
                              kind: 'gif',
                              url,
                              preview: url
                            })
                          }
                        >
                          <img src={url} alt="gif" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="composer-sticker-grid">
                  {AEGIS_STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      className="composer-sticker-item"
                      onClick={() => sendStickerMessage(sticker)}
                    >
                      <AegisSticker sticker={sticker} compact />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <button
              className="attach-btn neon-attach"
              onClick={() => setAttachMenuOpen((v) => !v)}
              title="Прикрепить файл"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </button>

            {attachMenuOpen && (
              <div className="attach-menu-glass">
                <button onClick={() => handlePickFile('media')} className="attach-menu-item">Медиа</button>
                <button onClick={() => handlePickFile('doc')} className="attach-menu-item">Документы</button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="chat-sticker-btn"
            onClick={() => {
              setComposerPanelTab('stickers')
              setShowStickerPicker((prev) => !prev)
            }}
            title="Стикеры AegisTalk"
          >
            <img src={shieldIcon} alt="" />
          </button>

          <input
            type="text"
            placeholder="Сообщение..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#E5E7EB',
              fontSize: '15px',
              padding: '8px 4px'
            }}
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value)
              if (showStickerPicker) setShowStickerPicker(false)

              const chatId = selectedChat?.chatId || selectedChat?.id
              if (chatId && e.target.value.trim().length > 0) {
                if (!wsService.isConnected()) return
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                wsService.sendTypingStart(chatId)
                typingTimeoutRef.current = setTimeout(() => {
                  wsService.sendTypingStop(chatId)
                }, 3000)
              } else if (e.target.value.trim().length === 0) {
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                if (chatId && wsService.isConnected()) wsService.sendTypingStop(chatId)
              }
            }}
            onKeyPress={handleKeyPress}
          />

          <button
            type="button"
            onPointerDown={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()

              if (showStickerPicker) setShowStickerPicker(false)

              // Если есть текст — это кнопка "Отправить", не вмешиваемся.
              if (messageInput.trim()) return
              if (isRecording) return

              recordLongPressTriggeredRef.current = false
              if (recordPressTimerRef.current) {
                clearTimeout(recordPressTimerRef.current)
                recordPressTimerRef.current = null
              }

              // Telegram-style: быстрое нажатие переключает режим, удержание запускает запись.
              recordPressTimerRef.current = setTimeout(() => {
                recordLongPressTriggeredRef.current = true
                handleStartRecording?.(recordingMode === 'video' ? 'video' : 'audio')
              }, 260)
            }}
            onPointerUp={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()

              if (recordPressTimerRef.current) {
                clearTimeout(recordPressTimerRef.current)
                recordPressTimerRef.current = null
              }

              // Если не было удержания — переключаем режим (как в Telegram).
              if (!messageInput.trim() && !isRecording && !recordLongPressTriggeredRef.current) {
                setRecordingMode?.((prev) => (prev === 'video' ? 'audio' : 'video'))
              }
            }}
            onPointerCancel={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()
              if (recordPressTimerRef.current) {
                clearTimeout(recordPressTimerRef.current)
                recordPressTimerRef.current = null
              }
              recordLongPressTriggeredRef.current = false
            }}
            onClick={(e) => {
              if (e.cancelable) e.preventDefault()
              e.stopPropagation()

              if (messageInput.trim()) {
                sendMessage()
                return
              }

              // Когда поле пустое: поведение сделано через pointer events,
              // чтобы быстрое нажатие не стартовало запись.
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              border: 'none',
              background: messageInput.trim() ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
              color: messageInput.trim() ? 'white' : 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: messageInput.trim() ? '0 4px 12px rgba(37, 99, 235, 0.4)' : 'none',
              zIndex: 100,
              position: 'relative'
            }}
            title={
              messageInput.trim()
                ? 'Отправить'
                : recordingMode === 'video'
                  ? 'Видео-кружок'
                  : 'Голосовое сообщение'
            }
            aria-label={
              messageInput.trim()
                ? 'Отправить'
                : recordingMode === 'video'
                  ? 'Видео-кружок'
                  : 'Голосовое сообщение'
            }
          >
            {messageInput.trim() ? (
              <span style={{ fontSize: '18px' }}>➤</span>
            ) : (
              <span style={{ fontSize: '18px' }}>{recordingMode === 'video' ? '📹' : '🎤'}</span>
            )}
          </button>
        </div>
      )}

      {pendingFile && (
        <div className="attachment-preview-modal">
          <div className="apm-backdrop" onClick={resetPending} />
          <div className="apm-body">
            <div className="apm-preview">
              {pendingPreview ? (
                pendingFile.type.startsWith('video/') ? (
                  <video src={pendingPreview} controls className="apm-media" />
                ) : pendingFile.type.startsWith('audio/') ? (
                  <audio src={pendingPreview} controls className="apm-audio" />
                ) : (
                  <img src={pendingPreview} alt="Изображение" className="apm-media" />
                )
              ) : (
                <div className="apm-placeholder">Предпросмотр недоступен</div>
              )}
            </div>
            <div className="apm-side">
              <div className="apm-title">Подготовка к отправке</div>
              <label className="apm-label">Подпись</label>
              <textarea
                className="apm-input"
                placeholder="Добавьте сообщение..."
                value={pendingCaption}
                onChange={(e) => setPendingCaption(e.target.value)}
                rows={4}
              />
              <div className="apm-actions">
                <button className="apm-cancel" onClick={resetPending}>Отмена</button>
                <button className="apm-send" onClick={handleSendPending}>
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatComposer
