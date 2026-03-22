import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { storiesAPI } from '../../api/stories.js'
import { resolveAssetUrl } from '../../api/runtimeConfig.js'
import { buildProtectedMediaUrl } from '../../api/messages.js'
import StoryComposerModal from './StoryComposerModal.jsx'
import StoryImage from './StoryImage.jsx'
import StoryViewerModal from './StoryViewerModal.jsx'

const ACCENTS = {
  aurora: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
  ember: 'linear-gradient(135deg, #fb7185, #f59e0b)',
  tide: 'linear-gradient(135deg, #34d399, #14b8a6)',
  nova: 'linear-gradient(135deg, #818cf8, #a855f7)',
  dusk: 'linear-gradient(135deg, #64748b, #0f172a)'
}

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

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']

const getAuthorName = (author) => author?.firstName || author?.username || 'Участник'

const StoriesRail = ({ user }) => {
  const fileInputRef = useRef(null)
  const viewedRequestIdsRef = useRef(new Set())
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftFile, setDraftFile] = useState(null)
  const [showComposer, setShowComposer] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)

  const loadStories = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true)
      }

      const nextGroups = await storiesAPI.list()
      setGroups(nextGroups)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить истории')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadStories()

    if (viewerIndex != null) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void loadStories({ silent: true })
    }, 15_000)

    return () => window.clearInterval(intervalId)
  }, [loadStories, viewerIndex])

  useEffect(() => {
    const handleStoriesRefresh = () => {
      void loadStories({ silent: true })
    }

    window.addEventListener('stories:refresh', handleStoriesRefresh)
    return () => window.removeEventListener('stories:refresh', handleStoriesRefresh)
  }, [loadStories])

  const personalGroup = useMemo(
    () => groups.find((group) => group.sourceType !== 'channel' && group.isOwn) || null,
    [groups]
  )

  const orderedGroups = useMemo(() => {
    const personalId = personalGroup?.author?.id || null
    const rest = groups.filter((group) => group.author?.id !== personalId)
    rest.sort((left, right) => Number(right.latestAt || 0) - Number(left.latestAt || 0))
    return personalGroup ? [personalGroup, ...rest] : rest
  }, [groups, personalGroup])

  const visibleGroups = useMemo(
    () => orderedGroups.filter((group) => group.author?.id !== personalGroup?.author?.id),
    [orderedGroups, personalGroup]
  )

  const openPicker = () => {
    fileInputRef.current?.click()
  }

  const handlePickedFile = (event) => {
    const nextFile = event.target.files?.[0]
    if (event.target) {
      event.target.value = ''
    }

    if (!nextFile) return

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError('Для историй пока подходят JPG, PNG, WebP, GIF, MP4, WebM и MOV.')
      return
    }

    setError('')
    setDraftFile(nextFile)
    setShowComposer(true)
  }

  const handlePublish = async (storyPayload) => {
    const createdStory = await storiesAPI.create(storyPayload)

    setGroups((prev) => {
      const ownIndex = prev.findIndex((group) => group.sourceType !== 'channel' && group.isOwn)

      if (ownIndex === -1) {
        return [
          {
            author: createdStory.author,
            isOwn: true,
            sourceType: createdStory.sourceType || 'user',
            groupId: createdStory.groupId || null,
            hasUnseen: false,
            latestAt: createdStory.createdAt,
            stories: [createdStory]
          },
          ...prev
        ]
      }

      const next = [...prev]
      next[ownIndex] = {
        ...next[ownIndex],
        latestAt: createdStory.createdAt,
        stories: [createdStory, ...next[ownIndex].stories]
      }
      return next
    })

    window.dispatchEvent(new CustomEvent('stories:refresh'))
    return createdStory
  }

  const patchStoryInGroups = useCallback((storyId, updater) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        stories: group.stories.map((story) => (story.id === storyId ? updater(story) : story))
      }))
    )
  }, [])

  const handleMarkViewed = useCallback(async (storyId) => {
    if (!storyId || viewedRequestIdsRef.current.has(storyId)) {
      return
    }

    viewedRequestIdsRef.current.add(storyId)

    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        hasUnseen: group.isOwn ? false : group.stories.some((story) => story.id !== storyId && !story.isViewed),
        stories: group.stories.map((story) => (story.id === storyId ? { ...story, isViewed: true } : story))
      }))
    )

    try {
      await storiesAPI.markViewed(storyId)
    } catch {
      viewedRequestIdsRef.current.delete(storyId)
    }
  }, [])

  const handleDeleteOwn = useCallback(async (storyId) => {
    try {
      await storiesAPI.remove(storyId)
      setGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            stories: group.stories.filter((story) => story.id !== storyId)
          }))
          .filter((group) => group.stories.length > 0)
      )
      setViewerIndex(null)
      window.dispatchEvent(new CustomEvent('stories:refresh'))
    } catch (deleteError) {
      setError(deleteError.message || 'Не удалось удалить историю')
    }
  }, [])

  const handleToggleLike = useCallback(
    async (storyId) => {
      const result = await storiesAPI.toggleLike(storyId)
      patchStoryInGroups(storyId, (story) => ({
        ...story,
        isLiked: Boolean(result?.isLiked),
        likesCount: Number(result?.likesCount || 0)
      }))
      return result
    },
    [patchStoryInGroups]
  )

  const handleLoadComments = useCallback(async (storyId) => storiesAPI.listComments(storyId), [])
  const handleLoadViews = useCallback(async (storyId) => storiesAPI.listViews(storyId), [])

  const handleAddComment = useCallback(
    async (storyId, content) => {
      const createdComment = await storiesAPI.addComment(storyId, content)
      patchStoryInGroups(storyId, (story) => ({
        ...story,
        commentsCount: Number(story.commentsCount || 0) + 1
      }))
      return createdComment
    },
    [patchStoryInGroups]
  )

  const handleUpdateSettings = useCallback(
    async (storyId, settings) => {
      const updated = await storiesAPI.updateSettings(storyId, settings)
      patchStoryInGroups(storyId, (story) => ({
        ...story,
        allowComments: typeof updated?.allowComments === 'boolean' ? updated.allowComments : story.allowComments,
        allowReactions: typeof updated?.allowReactions === 'boolean' ? updated.allowReactions : story.allowReactions
      }))
      return updated
    },
    [patchStoryInGroups]
  )

  const closeComposer = () => {
    setShowComposer(false)
    setDraftFile(null)
  }

  const openPersonalStory = () => {
    if (personalGroup?.stories?.length) {
      setViewerIndex(0)
      return
    }

    openPicker()
  }

  return (
    <>
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handlePickedFile}
        />

        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: '68px',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '4px',
            paddingTop: '2px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            maskImage: 'linear-gradient(90deg, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)'
          }}
        >
          <button
            type="button"
            onClick={openPersonalStory}
            style={{
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0
            }}
            title={personalGroup?.stories?.length ? 'Открыть свою историю' : 'Добавить историю'}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: personalGroup?.stories?.[0]
                  ? ACCENTS[personalGroup.stories[0].accentKey] || ACCENTS.aurora
                  : 'linear-gradient(135deg, rgba(22, 163, 74, 0.8), rgba(8, 145, 178, 0.72), rgba(15, 23, 42, 0.94))',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 14px 30px rgba(2, 6, 23, 0.18), 0 0 0 1px rgba(255,255,255,0.03)',
                position: 'relative'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '3px',
                  borderRadius: '50%',
                  background: personalGroup?.stories?.[0]
                    ? 'rgba(2, 6, 23, 0.16)'
                    : 'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {personalGroup?.stories?.[0]?.mediaType === 'image' ? (
                  <StoryImage
                    src={resolveStoryMediaUrl(personalGroup.stories[0].mediaUrl)}
                    alt={user?.firstName || 'Твоя история'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : user?.avatarUrl ? (
                  <img
                    src={resolveAssetUrl(user.avatarUrl)}
                    alt={user?.firstName || 'Твоя история'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '22px', color: '#fff', fontWeight: 800 }}>
                    {(user?.firstName || user?.username || 'Я').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openPicker()
                }}
                title="Добавить историю"
                aria-label="Добавить историю"
                style={{
                  position: 'absolute',
                  right: '-1px',
                  bottom: '-1px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #34d399, #22d3ee)',
                  border: '3px solid #0b1220',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                +
              </button>
            </div>
          </button>

          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              />
            </div>
          ) : null}

          {visibleGroups.map((group, index) => {
            const story = group.stories[0]
            const resolvedIndex = personalGroup ? index + 1 : index

            return (
              <button
                key={`${group.sourceType || 'user'}:${group.groupId || group.author.id}`}
                type="button"
                onClick={() => setViewerIndex(resolvedIndex)}
                title={getAuthorName(group.author)}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    position: 'relative',
                    background: ACCENTS[story.accentKey] || ACCENTS.aurora,
                    padding: '3px',
                    boxShadow: group.hasUnseen
                      ? '0 0 0 3px rgba(52, 211, 153, 0.18), 0 12px 28px rgba(2, 6, 23, 0.2)'
                      : '0 10px 24px rgba(2, 6, 23, 0.18)'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: '3px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#0f172a'
                    }}
                  >
                    {story.mediaType === 'image' ? (
                      <StoryImage
                        src={resolveStoryMediaUrl(story.mediaUrl)}
                        alt={getAuthorName(group.author)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <video
                        src={resolveStoryMediaUrl(story.mediaUrl)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                        preload="none"
                      />
                    )}

                    {!group.hasUnseen && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.34)' }} />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {error ? (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#fda4af' }}>
            {error}
          </div>
        ) : null}
      </div>

      {showComposer ? (
        <StoryComposerModal
          user={user}
          initialFile={draftFile}
          onClose={closeComposer}
          onPublish={handlePublish}
        />
      ) : null}

      {viewerIndex != null && orderedGroups[viewerIndex] ? (
        <StoryViewerModal
          groups={orderedGroups}
          initialGroupIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onMarkViewed={handleMarkViewed}
          onDeleteOwn={handleDeleteOwn}
          onToggleLike={handleToggleLike}
          onLoadComments={handleLoadComments}
          onLoadViews={handleLoadViews}
          onAddComment={handleAddComment}
          onUpdateSettings={handleUpdateSettings}
        />
      ) : null}
    </>
  )
}

export default StoriesRail
