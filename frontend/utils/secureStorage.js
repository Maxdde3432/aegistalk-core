const SECRET_KEY = 'aegis_storage_key_v1'
const STORAGE_PREFIX = 'enc_'

const encrypt = (data) => {
  try {
    const str = JSON.stringify(data)
    let result = ''
    for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length))
    }
    return btoa(result)
  } catch (e) {
    console.error('secureStorage encrypt error:', e)
    return null
  }
}

const decrypt = (encrypted) => {
  try {
    const decoded = atob(encrypted)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length))
    }
    return JSON.parse(result)
  } catch (e) {
    console.error('secureStorage decrypt error:', e)
    return null
  }
}

const getStorageKey = (key) => `${STORAGE_PREFIX}${key}`

const writeLocal = (key, value) => {
  localStorage.setItem(getStorageKey(key), value)
}

const removeLocal = (key) => {
  localStorage.removeItem(getStorageKey(key))
}

export const initSecureStorage = async () => {}

export const secureStorage = {
  setItem: (key, value) => {
    try {
      const encrypted = encrypt(value)
      if (!encrypted) return false

      writeLocal(key, encrypted)

      return true
    } catch (e) {
      console.error('secureStorage.setItem error:', e)
      return false
    }
  },

  getItem: (key) => {
    try {
      const encrypted = localStorage.getItem(getStorageKey(key))
      if (encrypted) {
        return decrypt(encrypted)
      }
    } catch (e) {
      console.error('secureStorage.getItem error:', e)
    }
    return null
  },

  removeItem: (key) => {
    removeLocal(key)
  },

  clear: () => {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }
}

export default secureStorage
