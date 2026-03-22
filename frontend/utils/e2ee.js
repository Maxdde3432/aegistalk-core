import nacl from 'tweetnacl'
import * as naclUtil from 'tweetnacl-util'

const ENVELOPE_ALG = 'nacl-box+secretbox'

const toBase64 = (value) => naclUtil.encodeBase64(value)
const fromBase64 = (value) => naclUtil.decodeBase64(String(value || ''))
const toUtf8 = (value) => naclUtil.decodeUTF8(String(value || ''))
const fromUtf8 = (value) => naclUtil.encodeUTF8(value)

const uniqueRecipients = (recipients = []) => {
  const seen = new Set()
  return recipients.filter((recipient) => {
    const userId = String(recipient?.userId || '').trim()
    const publicKey = String(recipient?.publicKey || '').trim()
    if (!userId || !publicKey || seen.has(userId)) return false
    seen.add(userId)
    return true
  })
}

export const generateUserKeyPair = () => {
  const pair = nacl.box.keyPair()
  const publicKey = toBase64(pair.publicKey)
  return {
    publicKey,
    secretKey: toBase64(pair.secretKey),
    publicKeySignature: `unsigned:${publicKey.slice(0, 16)}`
  }
}

export const isEncryptedEnvelope = (value) => {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('{"alg":"') && trimmed.includes(`"${ENVELOPE_ALG}"`)
}

export const encryptMessageEnvelope = ({
  plaintext,
  recipients,
  senderUserId,
  senderPublicKey,
  senderSecretKey
}) => {
  const resolvedRecipients = uniqueRecipients(recipients)
  if (!resolvedRecipients.length) return String(plaintext || '')

  const bodyKey = nacl.randomBytes(nacl.secretbox.keyLength)
  const bodyNonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const bodyCipher = nacl.secretbox(toUtf8(plaintext), bodyNonce, bodyKey)
  const senderSecret = fromBase64(senderSecretKey)

  const keys = {}
  resolvedRecipients.forEach((recipient) => {
    const keyNonce = nacl.randomBytes(nacl.box.nonceLength)
    const wrappedKey = nacl.box(bodyKey, keyNonce, fromBase64(recipient.publicKey), senderSecret)
    keys[String(recipient.userId)] = {
      nonce: toBase64(keyNonce),
      key: toBase64(wrappedKey)
    }
  })

  return JSON.stringify({
    alg: ENVELOPE_ALG,
    senderUserId: String(senderUserId || ''),
    senderPublicKey: String(senderPublicKey || ''),
    bodyNonce: toBase64(bodyNonce),
    body: toBase64(bodyCipher),
    keys
  })
}

export const decryptMessageEnvelope = ({ ciphertext, selfUserId, selfSecretKey }) => {
  const raw = String(ciphertext || '').trim()
  if (!raw || !isEncryptedEnvelope(raw)) return raw

  const envelope = JSON.parse(raw)
  const entry = envelope?.keys?.[String(selfUserId || '')]
  if (!entry?.nonce || !entry?.key || !envelope?.senderPublicKey) {
    return '[Encrypted message]'
  }

  const bodyKey = nacl.box.open(
    fromBase64(entry.key),
    fromBase64(entry.nonce),
    fromBase64(envelope.senderPublicKey),
    fromBase64(selfSecretKey)
  )

  if (!bodyKey) return '[Encrypted message]'

  const plaintext = nacl.secretbox.open(
    fromBase64(envelope.body),
    fromBase64(envelope.bodyNonce),
    bodyKey
  )

  if (!plaintext) return '[Encrypted message]'
  return fromUtf8(plaintext)
}
