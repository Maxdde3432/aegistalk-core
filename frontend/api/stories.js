import { getApiBaseUrl } from './runtimeConfig.js'
import { secureStorage } from '../utils/secureStorage.js'

const API_URL = getApiBaseUrl()

const authHeaders = () => {
  const token = secureStorage.getItem('accessToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const parseJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const storiesAPI = {
  async list() {
    const response = await fetch(`${API_URL}/api/stories`, {
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось загрузить истории')
    }

    return Array.isArray(payload) ? payload : []
  },

  async create({
    mediaUrl,
    mediaType,
    caption,
    accentKey,
    allowComments = true,
    allowReactions = true,
    groupId = null
  }) {
    const body = {
      mediaUrl,
      mediaType,
      caption,
      accentKey,
      allowComments,
      allowReactions
    }

    if (groupId != null && String(groupId).trim()) {
      body.groupId = groupId
    }

    const response = await fetch(`${API_URL}/api/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(body)
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось опубликовать историю')
    }

    return payload
  },

  async getChannelStats(groupId) {
    const response = await fetch(`${API_URL}/api/stories/channel/${groupId}/stats`, {
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось загрузить статистику историй канала')
    }

    return {
      activeStories: Number(payload?.activeStories || 0),
      totalViews: Number(payload?.totalViews || 0),
      totalLikes: Number(payload?.totalLikes || 0),
      totalComments: Number(payload?.totalComments || 0),
      lastStoryAt: payload?.lastStoryAt ? Number(payload.lastStoryAt) : null
    }
  },

  async markViewed(storyId) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/view`, {
      method: 'POST',
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось отметить просмотр')
    }

    return payload
  },

  async remove(storyId) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось удалить историю')
    }

    return payload
  },

  async toggleLike(storyId) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/like`, {
      method: 'POST',
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось обновить лайк')
    }

    return payload
  },

  async listComments(storyId) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/comments`, {
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось загрузить комментарии')
    }

    return Array.isArray(payload) ? payload : []
  },

  async listViews(storyId) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/views`, {
      headers: {
        ...authHeaders()
      }
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось загрузить просмотры')
    }

    return {
      total: Number(payload?.total || 0),
      viewers: Array.isArray(payload?.viewers) ? payload.viewers : []
    }
  },

  async addComment(storyId, content) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ content })
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось отправить комментарий')
    }

    return payload
  },

  async updateSettings(storyId, settings) {
    const response = await fetch(`${API_URL}/api/stories/${storyId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(settings)
    })

    const payload = await parseJson(response)
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось обновить настройки истории')
    }

    return payload
  }
}
