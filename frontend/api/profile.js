import { getApiBaseUrl } from './runtimeConfig.js'
import { secureStorage } from '../utils/secureStorage.js'
import { authAPI } from './auth.js'

const API_URL = getApiBaseUrl()

const getAccessToken = () => secureStorage.getItem('accessToken')

const fetchWithAuth = async (url, options = {}) => {
  let token = getAccessToken()

  const defaultHeaders = {
    Authorization: `Bearer ${token}`,
    ...options.headers
  }

  let response = await fetch(url, { ...options, headers: defaultHeaders })

  if (response.status === 401) {
    try {
      await authAPI.refreshToken()
      token = getAccessToken()

      const newHeaders = {
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
      response = await fetch(url, { ...options, headers: newHeaders })
    } catch (e) {
      localStorage.clear()
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { type: 'unauthorized' } }))
      throw new Error('Session expired')
    }
  }

  return response
}

export const profileAPI = {
  getProfile: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/me`)
    if (!response.ok) {
      throw new Error('Failed to get profile')
    }
    return await response.json()
  },

  updateProfile: async (data) => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update profile')
    }
    return await response.json()
  },

  uploadAvatar: async (avatarFile) => {
    const formData = new FormData()
    formData.append('avatar', avatarFile)

    const response = await fetchWithAuth(`${API_URL}/api/profile/avatar`, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload avatar')
    }
    return await response.json()
  },

  removeAvatar: async () => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/avatar`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error('Failed to remove avatar')
    }
    return await response.json()
  },

  requestEmailChange: async (email) => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/email/change-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Не удалось отправить код подтверждения')
    }
    return result
  },

  confirmEmailChange: async ({ email, code }) => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/email/change-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Не удалось подтвердить смену email')
    }
    return result
  },

  deleteAccount: async ({ password }) => {
    const response = await fetchWithAuth(`${API_URL}/api/profile/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(result.error || 'Не удалось удалить аккаунт')
    }

    return result
  }
}
