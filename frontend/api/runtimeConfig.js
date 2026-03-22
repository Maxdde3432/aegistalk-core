import { secureStorage } from '../utils/secureStorage.js'

const isLocalHostValue = (value = '') =>
  typeof value === 'string' && (
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('0.0.0.0')
  )

const getBrowserOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return 'http://localhost:4000'
  }

  return window.location.origin
}

export const isNativeApp = () => false

export const getApiBaseUrl = () => {
  const envValue = import.meta.env.VITE_API_URL
  const browserOrigin = getBrowserOrigin()

  if (!envValue) {
    return browserOrigin
  }

  if (isLocalHostValue(envValue) && !isLocalHostValue(browserOrigin)) {
    return browserOrigin
  }

  return envValue
}

export const getWsBaseUrl = () => {
  const envValue = import.meta.env.VITE_WS_URL

  if (envValue) {
    const browserOrigin = getBrowserOrigin()
    if (isLocalHostValue(envValue) && !isLocalHostValue(browserOrigin)) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws`
    }
    return envValue
  }

  const origin = getBrowserOrigin()
  const protocol = origin.startsWith('https://') ? 'wss://' : 'ws://'
  return `${origin.replace(/^https?:\/\//, protocol)}/ws`
}

export const resolveAssetUrl = (path) => {
  if (!path) return path
  if (/^(data:|blob:)/i.test(path)) return path

  const token = secureStorage.getItem('accessToken')
  const appendToken = (url) => {
    if (!token) return url
    try {
      const parsed = new URL(url, getApiBaseUrl())
      if (parsed.pathname.startsWith('/api/media/') || parsed.pathname.startsWith('/uploads/')) {
        parsed.searchParams.set('token', token)
      }
      return parsed.toString()
    } catch {
      return url
    }
  }

  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path)
      if (parsed.pathname.startsWith('/api/media/') || parsed.pathname.startsWith('/uploads/')) {
        return appendToken(`${getApiBaseUrl()}${parsed.pathname}`)
      }
      return path
    } catch {
      return path
    }
  }

  return appendToken(`${getApiBaseUrl()}${path}`)
}
