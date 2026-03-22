const STORAGE_KEY = 'aegistalk_privacy_show_forwarding_attribution'

/**
 * Показывать ли «Переслано от [имя]» при пересылке сообщений.
 * По умолчанию true (показывать).
 */
export const getShowForwardingAttribution = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return true
    return v === 'true'
  } catch {
    return true
  }
}

export const setShowForwardingAttribution = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(!!value))
  } catch (e) {
    console.error('[Privacy] Failed to save:', e)
  }
}
