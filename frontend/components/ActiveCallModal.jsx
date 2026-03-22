import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const iconStyle = {
  width: '22px',
  height: '22px',
  display: 'block'
}

const CallIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M5 4.5h3.1l1.6 4.3-2.2 1.4a14 14 0 0 0 6.3 6.3l1.4-2.2 4.3 1.6V19a2 2 0 0 1-2 2h-1C9.7 21 3 14.3 3 6.5a2 2 0 0 1 2-2Z" />
  </svg>
)

const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" />
  </svg>
)

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M4 4l16 16" />
    <path d="M9 9v2a3 3 0 0 0 5.2 2" />
    <path d="M15 10V6a3 3 0 1 0-6 0v.5" />
    <path d="M6 11a6 6 0 0 0 10.4 4.1" />
    <path d="M12 17v4M8 21h8" />
  </svg>
)

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <rect x="3" y="6" width="13" height="12" rx="3" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
)

const ScreenShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <rect x="3" y="4" width="18" height="12" rx="2.5" />
    <path d="M8 20h8M12 16v4M8.5 8.5 12 12l3.5-3.5M12 12V7" />
  </svg>
)

const StopScreenShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <rect x="3" y="4" width="18" height="12" rx="2.5" />
    <path d="M8 20h8M12 16v4M7 7l10 10M17 7 7 17" />
  </svg>
)

const HangupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M4 15.5c2-2 4.7-3 8-3s6 1 8 3l-1.8 4.1-4.7-1.1v-3a14.7 14.7 0 0 1-3 0v3l-4.7 1.1L4 15.5Z" />
  </svg>
)

const CameraOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <rect x="3" y="6" width="13" height="12" rx="3" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
)

const FlipCameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M3 10V7a2 2 0 0 1 2-2h4" />
    <path d="m3 7 3-3" />
    <path d="m3 7 3 3" />
    <path d="M21 14v3a2 2 0 0 1-2 2h-4" />
    <path d="m21 17-3 3" />
    <path d="m21 17-3-3" />
    <rect x="7" y="7" width="10" height="10" rx="3" />
  </svg>
)

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5" />
  </svg>
)

const CollapseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={iconStyle}>
    <path d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6" />
  </svg>
)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const controlButtonStyle = (tone = 'neutral', active = false, danger = false, compact = false) => ({
  width: danger ? (compact ? '74px' : '82px') : (compact ? '58px' : '64px'),
  height: danger ? (compact ? '74px' : '82px') : (compact ? '58px' : '64px'),
  borderRadius: danger ? '24px' : '999px',
  border: danger
    ? '1px solid rgba(248, 113, 113, 0.35)'
    : active
      ? '1px solid rgba(45, 212, 191, 0.38)'
      : '1px solid rgba(255, 255, 255, 0.08)',
  background: danger
    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.98), rgba(185, 28, 28, 0.96))'
    : active
      ? 'linear-gradient(135deg, rgba(45, 212, 191, 0.22), rgba(59, 130, 246, 0.18))'
      : tone === 'success'
        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(22, 163, 74, 0.14))'
        : 'rgba(255, 255, 255, 0.06)',
  color: '#f8fafc',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: danger
    ? '0 20px 45px rgba(127, 29, 29, 0.32)'
    : '0 20px 45px rgba(0, 0, 0, 0.22)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
})

const renderAvatar = (selectedChat) => {
  if (selectedChat?.avatar) {
    return (
      <img
        src={selectedChat.avatar}
        alt={selectedChat?.name || 'Contact'}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'inherit',
          objectFit: 'cover'
        }}
      />
    )
  }

  return (selectedChat?.name || 'C').charAt(0).toUpperCase()
}

const ControlButton = ({ icon, title, onClick, active = false, tone = 'neutral', danger = false, compact = false, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      ...controlButtonStyle(tone, active, danger, compact),
      opacity: disabled ? 0.42 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
  </button>
)

const StreamBadge = ({ children, compact = false }) => (
  <div
    style={{
      position: 'absolute',
      top: compact ? '10px' : '12px',
      left: compact ? '10px' : '12px',
      padding: compact ? '6px 9px' : '7px 11px',
      borderRadius: '999px',
      background: 'rgba(2, 6, 23, 0.58)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      color: '#e2e8f0',
      fontSize: compact ? '11px' : '12px',
      fontWeight: 600,
      letterSpacing: '0.01em',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)'
    }}
  >
    {children}
  </div>
)

const ActiveCallModal = ({
  show,
  callType,
  remoteStream,
  localStream,
  selectedChat,
  callStatus,
  isMuted,
  callDuration,
  formatCallDuration,
  toggleMute,
  toggleCamera,
  switchCameraFacing,
  cameraFacingMode,
  toggleScreenShare,
  switchToVideoCall,
  endCall,
  isScreenSharing
}) => {
  const stageRef = useRef(null)
  const previewRef = useRef(null)
  const dragStateRef = useRef(null)
  const preventPreviewClickRef = useRef(false)
  const [previewPosition, setPreviewPosition] = useState(null)
  const [isSwapped, setIsSwapped] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false))

  const previewSize = useMemo(() => ({
    width: isCompact ? 124 : 184,
    height: isCompact ? 176 : 248
  }), [isCompact])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => {
      setIsCompact(window.innerWidth <= 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const clampPreviewPosition = useCallback((position) => {
    if (!stageRef.current || !position) return position

    const stageRect = stageRef.current.getBoundingClientRect()
    return {
      x: clamp(position.x, 12, Math.max(12, stageRect.width - previewSize.width - 12)),
      y: clamp(position.y, 12, Math.max(12, stageRect.height - previewSize.height - 12))
    }
  }, [previewSize.height, previewSize.width])

  useEffect(() => {
    if (!show) {
      setPreviewPosition(null)
      setIsSwapped(false)
      setIsPseudoFullscreen(false)
      dragStateRef.current = null
      return
    }

    if (!previewPosition && stageRef.current) {
      const stageRect = stageRef.current.getBoundingClientRect()
      setPreviewPosition({
        x: Math.max(12, stageRect.width - previewSize.width - 18),
        y: Math.max(12, stageRect.height - previewSize.height - 18)
      })
    }
  }, [previewPosition, previewSize.height, previewSize.width, show])

  useEffect(() => {
    if (!previewPosition) return
    setPreviewPosition((prev) => clampPreviewPosition(prev))
  }, [clampPreviewPosition, previewSize.height, previewSize.width])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragStateRef.current || !stageRef.current) return

      const nextX = dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX)
      const nextY = dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY)
      const clamped = clampPreviewPosition({ x: nextX, y: nextY })

      if (
        Math.abs(event.clientX - dragStateRef.current.startX) > 6 ||
        Math.abs(event.clientY - dragStateRef.current.startY) > 6
      ) {
        preventPreviewClickRef.current = true
      }

      setPreviewPosition(clamped)
    }

    const stopDragging = () => {
      if (!dragStateRef.current) return
      dragStateRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [clampPreviewPosition])

  const toggleStageFullscreen = useCallback(async () => {
    if (typeof document === 'undefined' || !stageRef.current) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      if (stageRef.current.requestFullscreen) {
        await stageRef.current.requestFullscreen()
        return
      }

      setIsPseudoFullscreen((prev) => !prev)
    } catch (error) {
      console.error('[CallFullscreen] Error:', error)
      setIsPseudoFullscreen((prev) => !prev)
    }
  }, [])

  const handlePreviewPointerDown = useCallback((event) => {
    if (!stageRef.current || !previewPosition) return

    event.stopPropagation()
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: previewPosition.x,
      originY: previewPosition.y
    }
    preventPreviewClickRef.current = false
  }, [previewPosition])

  const handlePreviewClick = useCallback((event) => {
    event.stopPropagation()

    if (preventPreviewClickRef.current) {
      preventPreviewClickRef.current = false
      return
    }

    if (remoteStream && localStream) {
      setIsSwapped((prev) => !prev)
    }
  }, [localStream, remoteStream])

  if (!show) return null

  const isVideoCall = callType === 'video'
  const title = selectedChat?.name || 'Контакт'
  const statusText =
    callStatus === 'connected'
      ? 'Соединение установлено'
      : callStatus === 'ended'
        ? 'Звонок завершен'
        : isVideoCall
          ? 'Исходящий видеозвонок'
          : 'Исходящий аудиозвонок'

  const hasBothVideoStreams = Boolean(remoteStream && localStream)
  const showRemoteAsMain = Boolean(remoteStream) && !(isSwapped && localStream)
  const showLocalAsMain = Boolean(localStream) && hasBothVideoStreams && isSwapped
  const mainStream = showRemoteAsMain ? remoteStream : (showLocalAsMain ? localStream : null)
  const mainIsLocal = showLocalAsMain && mainStream === localStream
  const previewStream = hasBothVideoStreams
    ? (showRemoteAsMain ? localStream : remoteStream)
    : (isVideoCall && localStream ? localStream : null)
  const previewIsLocal = Boolean(previewStream && previewStream === localStream)
  const showLiveVideoStage = isVideoCall && callStatus === 'connected'

  const localVideoTransform = cameraFacingMode === 'environment' || isScreenSharing ? 'none' : 'scaleX(-1)'
  const mainTransform = mainIsLocal ? localVideoTransform : 'none'
  const previewTransform = previewIsLocal ? localVideoTransform : 'none'
  const previewLabel = previewIsLocal ? (isScreenSharing ? 'Ваш экран' : 'Вы') : title
  const mainLabel = mainIsLocal ? (isScreenSharing ? 'Демонстрация экрана' : 'Вы') : title
  const isExpandedVideo = isVideoCall && (isFullscreen || isPseudoFullscreen)

  return (
    <div
      className="modal-overlay"
      onClick={endCall}
      style={{
        background: 'rgba(2, 6, 23, 0.9)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        padding: isCompact ? '0' : '14px'
      }}
    >
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isCompact ? '100%' : '1180px',
          height: isCompact ? '100dvh' : 'min(96vh, 920px)',
          borderRadius: isCompact ? '0' : '34px',
          overflow: 'hidden',
          padding: 0,
          background: 'radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 24%), linear-gradient(180deg, rgba(8, 12, 21, 0.99), rgba(2, 6, 23, 0.99))',
          border: isCompact ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isCompact ? 'none' : '0 40px 120px rgba(0, 0, 0, 0.58)',
          position: 'relative',
          color: '#f8fafc'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent 28%, rgba(16, 185, 129, 0.08) 72%, transparent)',
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: isExpandedVideo ? '0' : (isCompact ? '12px' : '18px')
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: isCompact ? '10px' : '16px',
              marginBottom: isExpandedVideo ? '0' : (isCompact ? '10px' : '14px'),
              position: isExpandedVideo ? 'fixed' : 'relative',
              top: isExpandedVideo ? 'max(12px, env(safe-area-inset-top, 0px))' : 'auto',
              left: isExpandedVideo ? '12px' : 'auto',
              right: isExpandedVideo ? '12px' : 'auto',
              zIndex: isExpandedVideo ? 6 : 'auto'
            }}
          >
            <div
              style={{
                padding: isCompact ? '10px 12px' : '12px 16px',
                borderRadius: isCompact ? '18px' : '20px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                maxWidth: isCompact ? '66%' : 'min(44%, 360px)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)'
              }}
            >
              <div style={{ fontSize: isCompact ? '11px' : '12px', letterSpacing: '0.13em', textTransform: 'uppercase', opacity: 0.62 }}>
                {isVideoCall ? 'Видеозвонок' : 'Аудиозвонок'}
              </div>
              <div style={{ marginTop: '6px', fontSize: isCompact ? '14px' : '16px', fontWeight: 700 }}>{statusText}</div>
            </div>

            <div style={{ display: 'flex', gap: isCompact ? '8px' : '10px', alignItems: 'center' }}>
              <div
                style={{
                  padding: isCompact ? '10px 12px' : '12px 16px',
                  borderRadius: isCompact ? '18px' : '20px',
                  background: callStatus === 'connected' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: isCompact ? '14px' : '16px',
                  fontWeight: 700,
                  minWidth: isCompact ? '88px' : '104px',
                  textAlign: 'center',
                  color: callStatus === 'connected' ? '#86efac' : '#e2e8f0'
                }}
              >
                {callStatus === 'connected' ? formatCallDuration(callDuration) : '00:00'}
              </div>

              {isVideoCall && (
                <ControlButton
                  icon={isExpandedVideo ? <CollapseIcon /> : <ExpandIcon />}
                  title={isExpandedVideo ? 'Свернуть видео' : 'Развернуть видео'}
                  compact={isCompact}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleStageFullscreen()
                  }}
                />
              )}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'grid',
              placeItems: 'stretch',
              minHeight: 0,
              marginBottom: isExpandedVideo ? '0' : (isCompact ? '10px' : '14px')
            }}
          >
            {showLiveVideoStage ? (
              <div
                ref={stageRef}
                onDoubleClick={toggleStageFullscreen}
                style={{
                  width: isExpandedVideo ? '100vw' : '100%',
                  height: isExpandedVideo ? '100dvh' : '100%',
                  minHeight: isExpandedVideo ? '100dvh' : (isCompact ? 'calc(100dvh - 178px)' : '540px'),
                  borderRadius: isExpandedVideo ? '0' : (isCompact ? '26px' : '30px'),
                  overflow: 'hidden',
                  border: isExpandedVideo ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98))',
                  position: isExpandedVideo ? 'fixed' : 'relative',
                  inset: isExpandedVideo ? '0' : 'auto',
                  zIndex: isExpandedVideo ? 4 : 'auto'
                }}
              >
                {mainStream ? (
                  <video
                    autoPlay
                    playsInline
                    muted={mainIsLocal}
                    ref={(element) => {
                      if (element && element.srcObject !== mainStream) {
                        element.srcObject = mainStream
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      background: '#020617',
                      transform: mainTransform
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#cbd5e1',
                      textAlign: 'center',
                      padding: '24px'
                    }}
                  >
                    <div>
                      <div
                        style={{
                          width: isCompact ? '92px' : '112px',
                          height: isCompact ? '92px' : '112px',
                          borderRadius: isCompact ? '28px' : '36px',
                          margin: '0 auto 18px',
                          display: 'grid',
                          placeItems: 'center',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(16, 185, 129, 0.82))',
                          fontSize: isCompact ? '34px' : '42px',
                          fontWeight: 700,
                          boxShadow: '0 25px 60px rgba(14, 165, 233, 0.18)'
                        }}
                      >
                        {renderAvatar(selectedChat)}
                      </div>
                      <div style={{ fontSize: isCompact ? '22px' : '26px', fontWeight: 700 }}>{title}</div>
                      <div style={{ marginTop: '8px', fontSize: isCompact ? '13px' : '15px', opacity: 0.76 }}>
                        Подключаем видео и ждем ответ
                      </div>
                    </div>
                  </div>
                )}

                {mainStream && <StreamBadge compact={isCompact}>{mainLabel}</StreamBadge>}

                {previewStream && previewPosition && (
                  <div
                    ref={previewRef}
                    onPointerDown={handlePreviewPointerDown}
                    onClick={handlePreviewClick}
                    style={{
                      position: 'absolute',
                      left: `${previewPosition.x}px`,
                      top: `${previewPosition.y}px`,
                      width: `${previewSize.width}px`,
                      height: `${previewSize.height}px`,
                      borderRadius: isCompact ? '20px' : '24px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      background: '#0f172a',
                      boxShadow: '0 18px 45px rgba(0, 0, 0, 0.42)',
                      cursor: 'grab',
                      touchAction: 'none',
                      userSelect: 'none'
                    }}
                  >
                    <video
                      autoPlay
                      playsInline
                      muted={previewIsLocal}
                      ref={(element) => {
                        if (element && element.srcObject !== previewStream) {
                          element.srcObject = previewStream
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: previewTransform,
                        background: '#020617'
                      }}
                    />
                    <StreamBadge compact={isCompact}>{previewLabel}</StreamBadge>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 'auto 10px 10px auto',
                        padding: '6px 8px',
                        borderRadius: '999px',
                        background: 'rgba(2, 6, 23, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#cbd5e1',
                        fontSize: '11px',
                        fontWeight: 600,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)'
                      }}
                    >
                      Тап для разворота
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', alignSelf: 'center', width: '100%' }}>
                {!isVideoCall && remoteStream ? (
                  <audio
                    autoPlay
                    playsInline
                    ref={(element) => {
                      if (element && element.srcObject !== remoteStream) {
                        element.srcObject = remoteStream
                        element.volume = 1
                        element.muted = false
                        element.play?.().catch(() => {})
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                ) : null}
                <div
                  style={{
                    width: isCompact ? '148px' : '172px',
                    height: isCompact ? '148px' : '172px',
                    margin: '0 auto 22px',
                    borderRadius: isCompact ? '38px' : '48px',
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.95), rgba(16, 185, 129, 0.88))',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: isCompact ? '52px' : '64px',
                    fontWeight: 700,
                    boxShadow: callStatus === 'connected'
                      ? '0 0 0 18px rgba(34, 197, 94, 0.08), 0 30px 80px rgba(16, 185, 129, 0.20)'
                      : '0 30px 80px rgba(14, 165, 233, 0.22)'
                  }}
                >
                  {renderAvatar(selectedChat)}
                </div>
                <div style={{ fontSize: isCompact ? '28px' : '34px', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
                <div style={{ marginTop: '10px', fontSize: isCompact ? '14px' : '16px', color: callStatus === 'connected' ? '#86efac' : '#cbd5e1' }}>
                  {statusText}
                </div>
                {isVideoCall && callStatus !== 'connected' && (
                  <>
                    <div
                      style={{
                        marginTop: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#e2e8f0',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: '#38bdf8',
                          boxShadow: '0 0 0 8px rgba(56, 189, 248, 0.12)'
                        }}
                      />
                      Подключаем видео и ждём ответ
                    </div>

                    {localStream && (
                      <div
                        style={{
                          margin: '18px auto 0',
                          width: isCompact ? '128px' : '156px',
                          height: isCompact ? '184px' : '220px',
                          borderRadius: isCompact ? '24px' : '28px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          background: '#0f172a',
                          boxShadow: '0 24px 56px rgba(2, 6, 23, 0.36)',
                          position: 'relative'
                        }}
                      >
                        <video
                          autoPlay
                          playsInline
                          muted
                          ref={(element) => {
                            if (element && element.srcObject !== localStream) {
                              element.srcObject = localStream
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            background: '#020617',
                            transform: localVideoTransform
                          }}
                        />
                        <StreamBadge compact={isCompact}>
                          {isScreenSharing ? 'Ваш экран' : 'Вы'}
                        </StreamBadge>
                      </div>
                    )}
                  </>
                )}
                {isMuted && (
                  <div
                    style={{
                      marginTop: '14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '999px',
                      background: 'rgba(248, 113, 113, 0.12)',
                      border: '1px solid rgba(248, 113, 113, 0.16)',
                      color: '#fecaca',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    Микрофон выключен
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: isCompact ? '10px' : '14px',
              paddingBottom: isExpandedVideo ? '0' : (isCompact ? '6px' : '2px'),
              position: isExpandedVideo ? 'fixed' : 'relative',
              left: isExpandedVideo ? '50%' : 'auto',
              bottom: isExpandedVideo ? 'max(12px, env(safe-area-inset-bottom, 0px))' : 'auto',
              transform: isExpandedVideo ? 'translateX(-50%)' : 'none',
              zIndex: isExpandedVideo ? 6 : 'auto',
              width: isExpandedVideo ? 'min(calc(100vw - 24px), 520px)' : 'auto'
            }}
          >
            {callStatus === 'connected' && (
              <ControlButton
                icon={isMuted ? <MicOffIcon /> : <MicOnIcon />}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                active={isMuted}
                compact={isCompact}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleMute()
                }}
              />
            )}

            {callStatus === 'connected' && isVideoCall && typeof toggleCamera === 'function' && (
              <ControlButton
                icon={<CameraOnIcon />}
                title="Камера"
                compact={isCompact}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCamera()
                }}
              />
            )}

            {callStatus === 'connected' && isVideoCall && typeof switchCameraFacing === 'function' && (
              <ControlButton
                icon={<FlipCameraIcon />}
                title="Переключить камеру"
                compact={isCompact}
                disabled={isScreenSharing}
                onClick={async (event) => {
                  event.stopPropagation()
                  try {
                    await switchCameraFacing()
                  } catch (error) {
                    console.error('[SwitchCameraFacing] Error:', error)
                  }
                }}
              />
            )}

            {callStatus === 'connected' && typeof toggleScreenShare === 'function' && (
              <ControlButton
                icon={isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                title={isScreenSharing ? 'Выключить демонстрацию' : 'Демонстрация экрана'}
                active={isScreenSharing}
                tone="success"
                compact={isCompact}
                onClick={async (event) => {
                  event.stopPropagation()
                  try {
                    await toggleScreenShare()
                  } catch (error) {
                    console.error('[ScreenShare] Error:', error)
                  }
                }}
              />
            )}

            {callStatus === 'connected' && !isVideoCall && (
              <ControlButton
                icon={<VideoIcon />}
                title="Переключить на видео"
                tone="success"
                compact={isCompact}
                onClick={(event) => {
                  event.stopPropagation()
                  switchToVideoCall()
                }}
              />
            )}

            <ControlButton
              icon={callStatus === 'connected' ? <HangupIcon /> : <CallIcon />}
              title="Завершить звонок"
              danger
              compact={isCompact}
              onClick={(event) => {
                event.stopPropagation()
                endCall()
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActiveCallModal
