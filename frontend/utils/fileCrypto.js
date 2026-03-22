// Utility for client-side file encryption/decryption using Web Crypto API (AES-GCM)

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

const fromBase64 = (b64) => {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export const generateRandomName = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const encryptFile = async (file) => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await file.arrayBuffer()
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const rawKey = await crypto.subtle.exportKey('raw', key)

  return {
    cipherBlob: new Blob([cipherBuffer], { type: 'application/octet-stream' }),
    keyB64: toBase64(rawKey),
    ivB64: toBase64(iv),
    hashName: generateRandomName()
  }
}

export const decryptArrayBuffer = async (arrayBuffer, keyB64, ivB64) => {
  const key = await crypto.subtle.importKey('raw', fromBase64(keyB64), { name: 'AES-GCM' }, false, ['decrypt'])
  const iv = new Uint8Array(fromBase64(ivB64))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, arrayBuffer)
  return decrypted
}

