const RENDER_TYPE_MAP = {
  circle: 'video-circle',
  voice: 'voice',
}

export const MEDIA_TYPES = new Set([
  'voice',
  'video-circle',
  'image',
  'video',
  'audio',
  'file',
  'sticker',
])

export const getRawMessageContent = (value) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.content || ''
  return ''
}

export const normalizeMessageMedia = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const normalizedType = typeof value.type === 'string' && value.type
    ? value.type
    : typeof value.render === 'string' && value.render
      ? (RENDER_TYPE_MAP[value.render] || value.render)
      : null

  if (!normalizedType && typeof value.url !== 'string' && typeof value.text !== 'string') {
    return null
  }

  return {
    ...value,
    type: normalizedType,
  }
}

export const parseMessageMedia = (value) => {
  const raw = getRawMessageContent(value)
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) {
    return null
  }

  try {
    return normalizeMessageMedia(JSON.parse(trimmed))
  } catch {
    return null
  }
}

export const isMediaMessagePayload = (value) => {
  const media = typeof value === 'string' ? parseMessageMedia(value) : normalizeMessageMedia(value)
  return Boolean(media?.type && MEDIA_TYPES.has(media.type))
}

export const getMessagePreviewLabel = (value) => {
  const raw = getRawMessageContent(value)
  const media = typeof value === 'string' || (value && typeof value === 'object' && !value.type && !value.render)
    ? parseMessageMedia(value)
    : normalizeMessageMedia(value)

  if (!media?.type) {
    return raw
  }

  switch (media.type) {
    case 'image':
      return '🖼 Фотография'
    case 'video-circle':
      return '📹 Видеосообщение'
    case 'video':
      return '📹 Видео'
    case 'voice':
      return '🎤 Голосовое сообщение'
    case 'audio':
      return '🎧 Аудио'
    case 'file':
      return '📎 Файл'
    case 'sticker':
      return media.kind === 'gif'
        ? (media.title ? `GIF ${media.title}` : 'GIF')
        : (media.title ? `🛡️ ${media.title}` : 'Стикер')
    default:
      return media.text?.trim() || raw
  }
}

export const getMediaPlaceholderLabel = (value) => {
  const media = typeof value === 'string' ? parseMessageMedia(value) : normalizeMessageMedia(value)
  if (!media?.type) {
    return ''
  }

  switch (media.type) {
    case 'video-circle':
      return '📹 Видеосообщение'
    case 'voice':
      return '🎤 Голосовое сообщение'
    case 'image':
      return '🖼 Фотография'
    case 'video':
      return '📹 Видео'
    case 'audio':
      return '🎧 Аудио'
    case 'file':
      return '📎 Файл'
    case 'sticker':
      return 'Стикер'
    default:
      return media.text?.trim() || ''
  }
}
