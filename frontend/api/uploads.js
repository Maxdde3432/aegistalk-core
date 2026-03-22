import { getApiBaseUrl } from './runtimeConfig.js'
import { secureStorage } from '../utils/secureStorage.js'

const API_URL = getApiBaseUrl()

const authHeaders = () => {
  const token = secureStorage.getItem('accessToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const uploadFile = async (file, userId) => {
  if (!file) return { success: false, error: 'Файл не передан' }

  const formData = new FormData()
  formData.append('file', file)
  if (userId) formData.append('userId', userId)

  const response = await fetch(`${API_URL}/api/messages/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders()
    },
    body: formData
  })

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    // ignore
  }

  if (!response.ok || !payload.url) {
    return { success: false, error: payload.error || 'Не удалось загрузить файл' }
  }

  return { success: true, url: payload.url, path: payload.path, name: payload.name, size: payload.size }
}

export const uploadFileWithProgress = (file, userId, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Файл не передан'))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/messages/upload`)
    const token = secureStorage.getItem('accessToken')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && payload.url) {
          resolve({ success: true, url: payload.url, path: payload.path, name: payload.name, size: payload.size })
        } else {
          reject(new Error(payload.error || 'Не удалось загрузить файл'))
        }
      } catch (err) {
        reject(err)
      }
    }

    xhr.onerror = () => reject(new Error('Ошибка сети при загрузке файла'))

    const formData = new FormData()
    formData.append('file', file)
    if (userId) formData.append('userId', userId)
    xhr.send(formData)
  })
}
