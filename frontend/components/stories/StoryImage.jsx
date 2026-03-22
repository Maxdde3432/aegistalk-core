import { useEffect, useMemo, useState } from 'react'
import heic2any from 'heic2any'
import { authAPI, getAccessToken } from '../../api/auth.js'

const HEIC_PATTERN = /\.(heic|heif)(?:$|\?)/i

const looksLikeHeic = (url = '') => HEIC_PATTERN.test(String(url || '').trim())
const looksLikeProtectedMedia = (url = '') => {
  try {
    const parsed = new URL(String(url || '').trim(), window.location.origin)
    return parsed.pathname.startsWith('/api/media/') || parsed.pathname.startsWith('/uploads/')
  } catch {
    return false
  }
}

const StoryImage = ({
  src,
  alt,
  style,
  className,
  loading,
  onError,
  onLoad
}) => {
  const [resolvedSrc, setResolvedSrc] = useState(src || '')
  const [objectUrl, setObjectUrl] = useState(null)
  const source = useMemo(() => String(src || '').trim(), [src])

  useEffect(() => {
    let disposed = false
    let nextObjectUrl = null

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl(null)
    }

    setResolvedSrc(source)

    if (!source) {
      return undefined
    }

    const load = async () => {
      try {
        const needsProtectedFetch = looksLikeProtectedMedia(source)
        const shouldConvertHeic = looksLikeHeic(source)

        if (!needsProtectedFetch && !shouldConvertHeic) {
          return
        }

        const loadBlob = async () => {
          const headers = {}
          const token = getAccessToken()
          if (needsProtectedFetch && token) {
            headers.Authorization = `Bearer ${token}`
          }

          let response = await fetch(source, { headers })
          if (response.status === 401 && needsProtectedFetch) {
            await authAPI.refreshToken()
            const nextToken = getAccessToken()
            response = await fetch(source, {
              headers: nextToken ? { Authorization: `Bearer ${nextToken}` } : {}
            })
          }

          return response
        }

        const response = await loadBlob()
        if (!response.ok) {
          throw new Error(`Failed to load story image: ${response.status}`)
        }

        const blob = await response.blob()
        let outputBlob = blob

        if (shouldConvertHeic) {
          const converted = await heic2any({
            blob,
            toType: 'image/jpeg',
            quality: 0.9
          })

          const jpegBlob = Array.isArray(converted) ? converted[0] : converted
          if (!(jpegBlob instanceof Blob) || disposed) {
            return
          }
          outputBlob = jpegBlob
        }

        nextObjectUrl = URL.createObjectURL(outputBlob)
        setObjectUrl(nextObjectUrl)
        setResolvedSrc(nextObjectUrl)
      } catch (error) {
        console.error('[Stories] image load failed:', error)
      }
    }

    void load()

    return () => {
      disposed = true
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl)
      }
    }
  }, [source])

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={style}
      className={className}
      loading={loading}
      onError={onError}
      onLoad={onLoad}
    />
  )
}

export default StoryImage
