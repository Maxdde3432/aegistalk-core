import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveAssetUrl } from '../../api/runtimeConfig.js'
import { buildProtectedMediaUrl } from '../../api/messages.js'
import StoryImage from './StoryImage.jsx'

const STORY_THEMES = {
  aurora: 'radial-gradient(circle at top, rgba(45, 212, 191, 0.24), transparent 34%), radial-gradient(circle at right, rgba(125, 211, 252, 0.2), transparent 32%), linear-gradient(140deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.18))',
  ember: 'radial-gradient(circle at top, rgba(251, 146, 60, 0.26), transparent 30%), radial-gradient(circle at left, rgba(244, 63, 94, 0.22), transparent 34%), linear-gradient(140deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.18))',
  tide: 'radial-gradient(circle at top, rgba(74, 222, 128, 0.24), transparent 32%), radial-gradient(circle at right, rgba(20, 184, 166, 0.22), transparent 36%), linear-gradient(140deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.18))',
  nova: 'radial-gradient(circle at top, rgba(192, 132, 252, 0.24), transparent 30%), radial-gradient(circle at left, rgba(129, 140, 248, 0.22), transparent 36%), linear-gradient(140deg, rgba(15, 23, 42, 0.2), rgba(2, 6, 23, 0.18))',
  dusk: 'radial-gradient(circle at top, rgba(148, 163, 184, 0.16), transparent 34%), radial-gradient(circle at right, rgba(71, 85, 105, 0.22), transparent 36%), linear-gradient(140deg, rgba(15, 23, 42, 0.24), rgba(2, 6, 23, 0.22))'
}

const IMAGE_DURATION_MS = 5000
const IMAGE_PROGRESS_STEP_MS = 80

const formatRelativeTime = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'только что'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} мин назад`
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} ч назад`
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const resolveStoryMediaUrl = (url) => {
  if (!url) return url
  if (typeof url === 'string') {
    const trimmed = url.trim()

    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/media/')) {
      return buildProtectedMediaUrl(trimmed)
    }

    if (trimmed.startsWith('messages/')) {
      return buildProtectedMediaUrl(`/uploads/${trimmed}`)
    }

    if (trimmed.startsWith('uploads/')) {
      return buildProtectedMediaUrl(`/${trimmed}`)
    }

    if (trimmed.startsWith('api/media/')) {
      return buildProtectedMediaUrl(`/${trimmed}`)
    }

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed)
        if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/media/')) {
          return buildProtectedMediaUrl(parsed.pathname)
        }
      } catch {
        return trimmed
      }
    }
  }
  return resolveAssetUrl(url)
}

const IconButton = ({ children, size = 42, style, ...props }) => (
  style?.position === 'absolute' && style?.top === '50%' ? null : (
  <button
    type="button"
    {...props}
    style={{
      width: size,
      height: size,
      borderRadius: 14,
      border: 'none',
      background: 'rgba(17, 24, 39, 0.72)',
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      ...style
    }}
  >
    {children}
  </button>
  )
)

const getAdjacentStory = (groups, groupIndex, storyIndex, direction) => {
  const currentGroup = groups[groupIndex]
  const currentStories = currentGroup?.stories || []

  if (direction < 0) {
    if (storyIndex > 0) return currentStories[storyIndex - 1] || null

    for (let index = groupIndex - 1; index >= 0; index -= 1) {
      const stories = groups[index]?.stories || []
      if (stories.length > 0) return stories[stories.length - 1]
    }

    return null
  }

  if (storyIndex < currentStories.length - 1) return currentStories[storyIndex + 1] || null

  for (let index = groupIndex + 1; index < groups.length; index += 1) {
    const stories = groups[index]?.stories || []
    if (stories.length > 0) return stories[0]
  }

  return null
}

const StoryStagePreview = ({ story, side, onClick }) => {
  if (!story) {
    return <div style={{ width: '156px', height: '320px', opacity: 0 }} />
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '156px',
        height: '320px',
        borderRadius: '30px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        position: 'relative',
        cursor: 'pointer',
        transform: side === 'left'
          ? 'translateX(6px) rotate(-6deg) scale(0.96)'
          : 'translateX(-6px) rotate(6deg) scale(0.96)',
        boxShadow: '0 28px 60px rgba(2, 6, 23, 0.34)',
        opacity: 0.72,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)'
      }}
    >
      {story.mediaType === 'video' ? (
        <video
          src={resolveStoryMediaUrl(story.mediaUrl)}
          muted
          playsInline
          preload="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'saturate(0.8) brightness(0.84)'
          }}
        />
      ) : (
        <StoryImage
          src={resolveStoryMediaUrl(story.mediaUrl)}
          alt={story.caption || 'Story preview'}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'saturate(0.82) brightness(0.84)'
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.12) 55%, rgba(2, 6, 23, 0.62))'
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '14px',
          right: '14px',
          bottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          color: '#f8fafc'
        }}
      >
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {story.author?.firstName || story.author?.username || 'Story'}
          </div>
          <div style={{ marginTop: '3px', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
            {story.mediaType === 'video' ? 'Video pulse' : 'Still frame'}
          </div>
        </div>
        <div
          style={{
            minWidth: '30px',
            height: '30px',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.16)',
            fontSize: '12px',
            fontWeight: 800
          }}
        >
          {side === 'left' ? '↶' : '↷'}
        </div>
      </div>
    </button>
  )
}

const StoryViewerModal = ({
  groups,
  initialGroupIndex = 0,
  onClose,
  onMarkViewed,
  onDeleteOwn,
  onToggleLike,
  onLoadComments,
  onLoadViews,
  onAddComment,
  onUpdateSettings
}) => {
  const videoRef = useRef(null)
  const onMarkViewedRef = useRef(onMarkViewed)
  const onLoadCommentsRef = useRef(onLoadComments)
  const onLoadViewsRef = useRef(onLoadViews)
  const touchStartRef = useRef(null)
  const gestureAxisRef = useRef(null)
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showViews, setShowViews] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [incognitoMode, setIncognitoMode] = useState(false)
  const [notice, setNotice] = useState('')
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [viewsLoading, setViewsLoading] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyFocused, setReplyFocused] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [likeState, setLikeState] = useState({ storyId: null, isLiked: false, likesCount: 0, busy: false })
  const [mediaProgress, setMediaProgress] = useState(0)
  const [storyViews, setStoryViews] = useState({ total: 0, viewers: [] })
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight))
  const [gestureOffset, setGestureOffset] = useState({ x: 0, y: 0 })

  const currentGroup = groups[groupIndex] || null
  const storiesInGroup = currentGroup?.stories || []
  const currentStory = storiesInGroup[storyIndex] || null
  const interactionOpen = menuOpen || showSettings || showComments || showViews || replyFocused || commentBusy
  const isMobile = viewportWidth <= 768
  const isCompactMobile = viewportWidth <= 430
  const isShortMobile = viewportHeight <= 760
  const showStagePreviews = viewportWidth >= 1080
  const outerPadding = isCompactMobile ? 6 : isMobile ? 10 : 10
  const storyShellWidth = isCompactMobile ? `min(calc(100vw - ${outerPadding * 2}px), 430px)` : 'min(calc(100vw - 20px), 430px)'
  const storyShellHeight = isCompactMobile
    ? `min(calc(100dvh - ${outerPadding * 2}px), 820px)`
    : 'min(calc(100dvh - 20px), 820px)'
  const storyShellRadius = isCompactMobile ? 24 : 32
  const overlayPadding = isCompactMobile ? '8px 8px 0' : '10px 10px 0'
  const captionBottom = showComments || showViews
    ? (isCompactMobile ? '254px' : '230px')
    : (isCompactMobile ? '96px' : '84px')
  const composerBottom = showComments || showViews
    ? (isCompactMobile ? '228px' : '214px')
    : (isCompactMobile ? '12px' : '10px')
  const commentsBottom = showComments ? (isCompactMobile ? '82px' : '72px') : (isCompactMobile ? '-280px' : '-240px')
  const commentsMaxHeight = isCompactMobile || isShortMobile ? '188px' : '136px'

  const previousStory = useMemo(
    () => getAdjacentStory(groups, groupIndex, storyIndex, -1),
    [groups, groupIndex, storyIndex]
  )

  const nextStory = useMemo(
    () => getAdjacentStory(groups, groupIndex, storyIndex, 1),
    [groups, groupIndex, storyIndex]
  )

  const authorName = useMemo(() => {
    if (!currentStory?.author) return 'Участник'
    return currentStory.author.firstName || currentStory.author.username || 'Участник'
  }, [currentStory?.author])

  useEffect(() => {
    setGroupIndex(initialGroupIndex)
    setStoryIndex(0)
  }, [initialGroupIndex])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    onMarkViewedRef.current = onMarkViewed
  }, [onMarkViewed])

  useEffect(() => {
    onLoadCommentsRef.current = onLoadComments
  }, [onLoadComments])

  useEffect(() => {
    onLoadViewsRef.current = onLoadViews
  }, [onLoadViews])

  useEffect(() => {
    setMenuOpen(false)
    setShowSettings(false)
    setShowComments(false)
    setShowViews(false)
    setCommentText('')
    setComments([])
    setStoryViews({ total: Number(currentStory?.viewsCount || 0), viewers: [] })
    setReplyFocused(false)
    setMediaProgress(0)
    setGestureOffset({ x: 0, y: 0 })
    touchStartRef.current = null
    gestureAxisRef.current = null

    if (currentStory?.id && !incognitoMode) {
      onMarkViewedRef.current?.(currentStory.id)
    }
  }, [currentStory?.id, incognitoMode])

  useEffect(() => {
    if (!currentStory?.id) return
    setLikeState({
      storyId: currentStory.id,
      isLiked: Boolean(currentStory.isLiked),
      likesCount: Number(currentStory.likesCount || 0),
      busy: false
    })
  }, [currentStory?.id, currentStory?.isLiked, currentStory?.likesCount])

  useEffect(() => {
    if (!showComments || !currentStory?.id) return undefined

    let cancelled = false
    setCommentsLoading(true)

    onLoadCommentsRef.current?.(currentStory.id)
      ?.then((items) => {
        if (!cancelled) {
          setComments(Array.isArray(items) ? items : [])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [showComments, currentStory?.id])

  useEffect(() => {
    if (!showViews || !currentStory?.id || !currentStory?.isOwn) return undefined

    let cancelled = false
    setViewsLoading(true)

    onLoadViewsRef.current?.(currentStory.id)
      ?.then((payload) => {
        if (!cancelled) {
          setStoryViews({
            total: Number(payload?.total || 0),
            viewers: Array.isArray(payload?.viewers) ? payload.viewers : []
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setViewsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [showViews, currentStory?.id, currentStory?.isOwn])

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(''), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const closeViewer = () => {
    setMenuOpen(false)
    setShowSettings(false)
    setShowComments(false)
    onClose?.()
  }

  const openNextStory = () => {
    if (storyIndex < storiesInGroup.length - 1) {
      setStoryIndex((prev) => prev + 1)
      return
    }

    if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1)
      setStoryIndex(0)
      return
    }

    closeViewer()
  }

  const openPrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1)
      return
    }

    if (groupIndex > 0) {
      const prevGroupIndex = groupIndex - 1
      const prevStories = groups[prevGroupIndex]?.stories || []
      setGroupIndex(prevGroupIndex)
      setStoryIndex(Math.max(0, prevStories.length - 1))
    }
  }

  useEffect(() => {
    if (!currentStory || currentStory.mediaType === 'video' || interactionOpen) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setMediaProgress((prev) => {
        const next = clamp(prev + IMAGE_PROGRESS_STEP_MS / IMAGE_DURATION_MS, 0, 1)
        if (next >= 1) {
          window.setTimeout(openNextStory, 0)
        }
        return next
      })
    }, IMAGE_PROGRESS_STEP_MS)

    return () => window.clearInterval(intervalId)
  }, [currentStory?.id, currentStory?.mediaType, interactionOpen])

  useEffect(() => {
    if (currentStory?.mediaType !== 'video') return undefined

    const video = videoRef.current
    if (!video) return undefined

    const syncProgress = () => {
      const duration = Number(video.duration || 0)
      if (!duration || Number.isNaN(duration)) return
      setMediaProgress(clamp(video.currentTime / duration, 0, 1))
    }

    const handleEnded = () => {
      setMediaProgress(1)
      openNextStory()
    }

    video.addEventListener('timeupdate', syncProgress)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadedmetadata', syncProgress)

    return () => {
      video.removeEventListener('timeupdate', syncProgress)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('loadedmetadata', syncProgress)
    }
  }, [currentStory?.id, currentStory?.mediaType])

  useEffect(() => {
    if (currentStory?.mediaType !== 'video') return

    const video = videoRef.current
    if (!video) return

    if (interactionOpen) {
      video.pause()
      return
    }

    const playPromise = video.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {})
    }
  }, [currentStory?.id, currentStory?.mediaType, interactionOpen, videoMuted])

  const stopEvent = (event) => {
    event.stopPropagation()
  }

  const handleTouchStart = (event) => {
    if (interactionOpen) return
    if (event.target.closest('button, input, textarea, label')) return

    const touch = event.touches?.[0]
    if (!touch) return

    gestureAxisRef.current = null
    setGestureOffset({ x: 0, y: 0 })
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now()
    }
  }

  const handleTouchMove = (event) => {
    const start = touchStartRef.current
    if (!start || interactionOpen) return
    if (event.target.closest('button, input, textarea, label')) return

    const touch = event.touches?.[0]
    if (!touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (!gestureAxisRef.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      gestureAxisRef.current = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical' : 'horizontal'
    }

    if (gestureAxisRef.current === 'vertical') {
      if (deltaY <= 0) {
        setGestureOffset({ x: 0, y: 0 })
        return
      }
      setGestureOffset({ x: 0, y: clamp(deltaY, 0, 180) })
      if (event.cancelable) event.preventDefault()
      return
    }

    setGestureOffset({ x: clamp(deltaX, -120, 120), y: 0 })
    if (event.cancelable) event.preventDefault()
  }

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current
    const axis = gestureAxisRef.current
    touchStartRef.current = null
    gestureAxisRef.current = null

    if (!start || interactionOpen) {
      setGestureOffset({ x: 0, y: 0 })
      return
    }
    if (event.target.closest('button, input, textarea, label')) return

    const touch = event.changedTouches?.[0]
    if (!touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const elapsed = Date.now() - start.at

    if (axis === 'vertical') {
      if (elapsed <= 520 && deltaY > 110 && Math.abs(deltaX) < 90) {
        closeViewer()
        return
      }
      setGestureOffset({ x: 0, y: 0 })
      return
    }

    setGestureOffset({ x: 0, y: 0 })

    if (elapsed > 450) return
    if (Math.abs(deltaX) < 52 || Math.abs(deltaY) > 84) return

    if (deltaX < 0) {
      openNextStory()
    } else {
      openPrevStory()
    }
  }

  const handleCopyLink = async () => {
    if (!currentStory?.id) return

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/stories/${currentStory.id}`)
      setNotice('Ссылка скопирована')
    } catch {
      setNotice('Не удалось скопировать ссылку')
    } finally {
      setMenuOpen(false)
    }
  }

  const handleToggleIncognito = () => {
    setIncognitoMode((prev) => !prev)
    setMenuOpen(false)
    setNotice(!incognitoMode ? 'Инкогнито включено' : 'Инкогнито выключено')
  }

  const handleReport = () => {
    setMenuOpen(false)
    setNotice('Жалобу подключим следующим шагом')
  }

  const handleToggleSetting = async (field, value) => {
    if (!currentStory?.id) return

    setSettingsBusy(true)
    try {
      await onUpdateSettings?.(currentStory.id, { [field]: value })
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleToggleLike = async (event) => {
    stopEvent(event)
    if (!currentStory?.id || !currentStory.allowReactions || likeState.busy) return

    const nextLiked = !likeState.isLiked
    const nextCount = Math.max(0, Number(likeState.likesCount || 0) + (nextLiked ? 1 : -1))

    setLikeState({
      storyId: currentStory.id,
      isLiked: nextLiked,
      likesCount: nextCount,
      busy: true
    })

    try {
      const result = await onToggleLike?.(currentStory.id)
      setLikeState({
        storyId: currentStory.id,
        isLiked: Boolean(result?.isLiked ?? nextLiked),
        likesCount: Number(result?.likesCount ?? nextCount),
        busy: false
      })
    } catch {
      setLikeState({
        storyId: currentStory.id,
        isLiked: Boolean(currentStory.isLiked),
        likesCount: Number(currentStory.likesCount || 0),
        busy: false
      })
      setNotice('Не удалось обновить лайк')
    }
  }

  const handleSendComment = async (event) => {
    stopEvent(event)
    const trimmed = commentText.trim()
    if (!trimmed || !currentStory?.id || !currentStory.allowComments) return

    setCommentBusy(true)
    try {
      const createdComment = await onAddComment?.(currentStory.id, trimmed)
      if (createdComment) {
        setComments((prev) => [...prev, createdComment])
        setCommentText('')
        setShowComments(true)
        setNotice('Комментарий отправлен')
      }
    } catch {
      setNotice('Не удалось отправить комментарий')
    } finally {
      setCommentBusy(false)
      setReplyFocused(false)
    }
  }

  if (!currentStory) return null

  const progressItems = storiesInGroup.map((story, index) => {
    if (index < storyIndex) return 1
    if (index > storyIndex) return 0
    return mediaProgress
  })

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal((
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250,
        background: 'radial-gradient(circle at top, rgba(120, 113, 108, 0.2), transparent 26%), radial-gradient(circle at bottom, rgba(56, 189, 248, 0.08), transparent 28%), rgba(2, 6, 23, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${outerPadding}px`
      }}
    >
      <div onClick={closeViewer} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, 980px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showStagePreviews ? '22px' : 0
        }}
      >
        {showStagePreviews ? (
          <StoryStagePreview
            side="left"
            story={previousStory}
            onClick={(event) => {
              stopEvent(event)
              openPrevStory()
            }}
          />
        ) : null}

        <div
          onClick={stopEvent}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStartRef.current = null
            gestureAxisRef.current = null
            setGestureOffset({ x: 0, y: 0 })
          }}
          style={{
            width: storyShellWidth,
            height: storyShellHeight,
            borderRadius: `${storyShellRadius}px`,
            overflow: 'hidden',
            position: 'relative',
            background: `${STORY_THEMES[currentStory.accentKey] || STORY_THEMES.aurora}, linear-gradient(180deg, rgba(12, 16, 24, 0.94), rgba(2, 6, 23, 0.98))`,
            boxShadow: '0 42px 110px rgba(2, 6, 23, 0.66)',
            border: '1px solid rgba(255,255,255,0.08)',
            transform: `translate3d(${gestureOffset.x}px, ${gestureOffset.y}px, 0) scale(${1 - Math.min(gestureOffset.y / 1200, 0.04)})`,
            opacity: 1 - Math.min(gestureOffset.y / 280, 0.22),
            transition: touchStartRef.current ? 'none' : 'transform 180ms ease, opacity 180ms ease',
            touchAction: interactionOpen ? 'auto' : 'none'
          }}
        >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.06), rgba(2, 6, 23, 0.18) 46%, rgba(2, 6, 23, 0.72))',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />

        {currentStory.mediaType === 'video' ? (
          <video
            ref={videoRef}
            key={currentStory.id}
            src={resolveStoryMediaUrl(currentStory.mediaUrl)}
            autoPlay
            playsInline
            muted={videoMuted}
            preload="metadata"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#020617'
            }}
          />
        ) : (
          <StoryImage
            key={currentStory.id}
            src={resolveStoryMediaUrl(currentStory.mediaUrl)}
            alt={currentStory.caption || authorName}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#020617'
            }}
          />
        )}

        <div style={{ position: 'absolute', inset: '0 0 auto 0', padding: overlayPadding, zIndex: 5 }}>
          {isMobile ? (
            <button
              type="button"
              onClick={(event) => {
                stopEvent(event)
                closeViewer()
              }}
              aria-label="Закрыть историю"
              style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '58px',
                height: '6px',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(255,255,255,0.52)',
                boxShadow: '0 8px 20px rgba(2, 6, 23, 0.24)',
                cursor: 'pointer',
                padding: 0
              }}
            />
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(progressItems.length, 1)}, minmax(0, 1fr))`, gap: '6px' }}>
            {progressItems.map((value, index) => (
              <div key={`${currentStory.id}-${index}`} style={{ height: '3px', borderRadius: '999px', background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${clamp(value, 0, 1) * 100}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.98)',
                    transition: value === 0 || value === 1 ? 'none' : 'width 80ms linear'
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }}>
                {currentStory.author.avatarUrl ? (
                  <img
                    src={resolveAssetUrl(currentStory.author.avatarUrl)}
                    alt={authorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>
                    {authorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isCompactMobile ? '17px' : '18px', lineHeight: 1.05, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {authorName}
                </div>
                <div style={{ marginTop: '2px', fontSize: '12px', color: 'rgba(255,255,255,0.86)' }}>
                  {formatRelativeTime(currentStory.createdAt)}
                </div>
                {currentStory.isOwn ? (
                  <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(2, 6, 23, 0.38)', color: '#e2e8f0', fontSize: '11px', fontWeight: 700 }}>
                    <span>Views</span>
                    <span>{Number(currentStory.viewsCount || storyViews.total || 0)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <IconButton
                onClick={(event) => {
                  stopEvent(event)
                  closeViewer()
                }}
                aria-label="Закрыть историю"
                size={isCompactMobile ? 40 : 42}
                style={{
                  background: isMobile ? 'rgba(15, 23, 42, 0.82)' : 'rgba(17, 24, 39, 0.72)'
                }}
              >
                ×
              </IconButton>
              <IconButton
                onClick={(event) => {
                  stopEvent(event)
                  setVideoMuted((prev) => !prev)
                }}
                aria-label={videoMuted ? 'Включить звук истории' : 'Выключить звук истории'}
              >
                {videoMuted ? '🔇' : '🔊'}
              </IconButton>
              <IconButton
                onClick={(event) => {
                  stopEvent(event)
                  setMenuOpen((prev) => !prev)
                  setShowSettings(false)
                }}
                aria-label="Открыть меню истории"
              >
                ⋯
              </IconButton>

              {menuOpen ? (
                <div
                  onClick={stopEvent}
                  style={{
                    position: 'absolute',
                    top: '48px',
                    right: 0,
                    width: '228px',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    background: 'rgba(33, 33, 33, 0.98)',
                    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  {[
                    { key: 'copy', label: 'Копировать ссылку', icon: '⧉', onClick: handleCopyLink },
                    { key: 'incognito', label: incognitoMode ? 'Выключить инкогнито' : 'Режим инкогнито', icon: '◌', onClick: handleToggleIncognito },
                    { key: 'report', label: 'Пожаловаться', icon: '⚑', onClick: handleReport },
                    currentStory.isOwn
                      ? {
                          key: 'settings',
                          label: 'Настройки истории',
                          icon: '⚙',
                          onClick: () => {
                            setMenuOpen(false)
                            setShowSettings((prev) => !prev)
                          }
                        }
                      : null
                  ].filter(Boolean).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={(event) => {
                        stopEvent(event)
                        item.onClick()
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      <span style={{ width: 18, textAlign: 'center', color: '#cbd5e1' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {notice ? (
          <div
            style={{
              position: 'absolute',
              top: '76px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 6,
              padding: '10px 14px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.76)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            {notice}
          </div>
        ) : null}

        {showSettings && currentStory.isOwn ? (
          <div
            onClick={stopEvent}
            style={{
              position: 'absolute',
              top: '96px',
              right: '12px',
              zIndex: 6,
              width: '230px',
              padding: '14px',
              borderRadius: '18px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'grid',
              gap: '12px'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#e2e8f0', fontSize: '13px' }}>
              Комментарии
              <input
                type="checkbox"
                checked={currentStory.allowComments}
                disabled={settingsBusy}
                onChange={(event) => handleToggleSetting('allowComments', event.target.checked)}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#e2e8f0', fontSize: '13px' }}>
              Лайки
              <input
                type="checkbox"
                checked={currentStory.allowReactions}
                disabled={settingsBusy}
                onChange={(event) => handleToggleSetting('allowReactions', event.target.checked)}
              />
            </label>
            <button
              type="button"
              onClick={() => onDeleteOwn?.(currentStory.id)}
              style={{
                minHeight: '42px',
                borderRadius: '14px',
                border: 'none',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#fecaca',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Удалить историю
            </button>
          </div>
        ) : null}

        {currentStory.caption ? (
          <div
            style={{
              position: 'absolute',
              left: '16px',
              right: '16px',
              bottom: captionBottom,
              zIndex: 5,
              color: '#ffffff',
              fontSize: isCompactMobile ? '14px' : '15px',
              lineHeight: 1.45,
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.42)'
            }}
          >
            {currentStory.caption}
          </div>
        ) : null}

        <IconButton
          onClick={(event) => {
            stopEvent(event)
            openPrevStory()
          }}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 6 }}
          aria-label="Предыдущая история"
        >
          ←
        </IconButton>

        <IconButton
          onClick={(event) => {
            stopEvent(event)
            openNextStory()
          }}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 6 }}
          aria-label="Следующая история"
        >
          →
        </IconButton>

        <div
          onClick={stopEvent}
          style={{
            position: 'absolute',
            left: '10px',
            right: '10px',
            bottom: composerBottom,
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'bottom 180ms ease'
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: '54px',
              borderRadius: isCompactMobile ? '18px' : '16px',
              background: 'rgba(23, 23, 23, 0.9)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 12px'
            }}
          >
            <button
              type="button"
              onClick={stopEvent}
              style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.78)', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              😊
            </button>
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value.slice(0, 280))}
              onFocus={() => {
                setReplyFocused(true)
                setShowComments(true)
              }}
              onBlur={() => setReplyFocused(false)}
              placeholder={currentStory.allowComments ? 'Ответить сообщением' : 'Ответы отключены'}
              disabled={!currentStory.allowComments || commentBusy}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#f8fafc',
                fontSize: isCompactMobile ? '16px' : '14px'
              }}
            />
            <button
              type="button"
              onClick={stopEvent}
              style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.78)', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              📎
            </button>
          </div>

          {commentText.trim() ? (
            <IconButton
              onClick={handleSendComment}
              disabled={commentBusy || !currentStory.allowComments}
              style={{
                background: 'linear-gradient(135deg, #34d399, #fbbf24)',
                color: '#07111f',
                opacity: commentBusy || !currentStory.allowComments ? 0.6 : 1
              }}
              aria-label="Отправить комментарий"
            >
              ↑
            </IconButton>
          ) : (
            <>
              <div
                style={{
                  minWidth: '52px',
                  minHeight: '54px',
                  padding: '0 8px',
                  borderRadius: '16px',
                  background: likeState.isLiked ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.92), rgba(244, 63, 94, 0.88))' : 'rgba(23, 23, 23, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: currentStory.allowReactions ? 1 : 0.45
                }}
              >
                <button
                  type="button"
                  onClick={handleToggleLike}
                  disabled={!currentStory.allowReactions || likeState.busy}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#fff',
                    cursor: currentStory.allowReactions ? 'pointer' : 'default',
                    fontSize: '20px',
                    padding: 0
                  }}
                  aria-label="Поставить или убрать лайк"
                >
                  {likeState.isLiked ? '♥' : '♡'}
                </button>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{likeState.likesCount}</span>
              </div>

              <IconButton
                onClick={(event) => {
                  stopEvent(event)
                  if (!currentStory.allowComments) return
                  setShowComments((prev) => !prev)
                }}
                disabled={!currentStory.allowComments}
                style={{
                  background: showComments ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.36), rgba(251, 191, 36, 0.28))' : 'rgba(23, 23, 23, 0.9)',
                  opacity: currentStory.allowComments ? 1 : 0.45
                }}
                aria-label="Открыть комментарии"
              >
                💬
              </IconButton>
            </>
          )}
        </div>

        <div
          onClick={stopEvent}
          style={{
            position: 'absolute',
            left: '10px',
            right: '10px',
            bottom: commentsBottom,
            maxHeight: commentsMaxHeight,
            zIndex: 6,
            borderRadius: '18px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '12px',
            display: 'grid',
            gap: '10px',
            transition: 'bottom 180ms ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 700 }}>Комментарии</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{comments.length || currentStory.commentsCount || 0}</div>
          </div>

          <div style={{ overflowY: 'auto', display: 'grid', gap: '8px', maxHeight: isCompactMobile || isShortMobile ? '122px' : '72px', paddingRight: '4px' }}>
            {commentsLoading ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Загружаем комментарии...</div>
            ) : comments.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Пока тихо. Можно написать первым.</div>
            ) : comments.map((comment) => (
              <div key={comment.id} style={{ padding: '9px 10px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>
                  {comment.author.firstName || comment.author.username || 'Участник'}
                </div>
                <div style={{ marginTop: '3px', fontSize: '13px', lineHeight: 1.4, color: '#f8fafc' }}>
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>

        {showStagePreviews ? (
          <StoryStagePreview
            side="right"
            story={nextStory}
            onClick={(event) => {
              stopEvent(event)
              openNextStory()
            }}
          />
        ) : null}
      </div>
    </div>
  ), document.body)
}

export default StoryViewerModal
