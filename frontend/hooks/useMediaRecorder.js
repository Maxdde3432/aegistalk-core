import { useState, useRef, useCallback } from 'react'

/**
 * Минимальный, локальный useMediaRecorder с подробным логированием.
 * Никаких внешних вызовов (сокеты/БД) здесь нет.
 */
export const useMediaRecorder = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState(null)
  const [mediaType, setMediaType] = useState(null) // 'audio' | 'video'

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const startTimeRef = useRef(null)

  const startTimer = useCallback(() => {
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const cleanup = useCallback(() => {
    stopTimer()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [stopTimer])

  const startRecording = useCallback(async (type = 'audio', constraints = {}) => {
    console.log('[useMediaRecorder] startRecording', { type, constraints })
    try {
      setError(null)
      setMediaType(type)

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Ваш браузер не поддерживает запись с микрофона (MediaDevices API недоступен)')
      }

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Ваш браузер не поддерживает запись (MediaRecorder API недоступен)')
      }

      const defaultConstraints =
        type === 'audio'
          ? { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1 } }
          : {
              video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
              audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
            }

      const finalConstraints = { ...defaultConstraints, ...constraints }
      console.log('[useMediaRecorder] getUserMedia request', finalConstraints)

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
        console.log('[useMediaRecorder] getUserMedia success')
      } catch (err) {
        console.error('[useMediaRecorder] getUserMedia error', err)
        if (err.name === 'NotAllowedError') {
          throw new Error(type === 'video' ? 'Доступ к камере и микрофону запрещён' : 'Доступ к микрофону запрещён')
        }
        if (err.name === 'NotFoundError') {
          throw new Error(type === 'video' ? 'Камера не найдена' : 'Микрофон не найден')
        }
        throw err
      }

      streamRef.current = stream

      let mimeType
      let options = {}
      const supports =
        typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
          : () => false

      if (type === 'audio') {
        if (supports('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (supports('audio/webm')) {
          mimeType = 'audio/webm'
        } else {
          mimeType = 'audio/ogg'
        }
        options = { mimeType, audioBitsPerSecond: 32000 }
      } else {
        if (supports('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus'
        } else if (supports('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus'
        } else {
          mimeType = 'video/webm'
        }
        options = { mimeType, videoBitsPerSecond: 256000, audioBitsPerSecond: 32000 }
      }

      console.log('[useMediaRecorder] MediaRecorder options', options)
      let mediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, options)
      } catch (e) {
        // Ensure we don't leave the mic/camera open if MediaRecorder can't be created.
        try {
          stream?.getTracks?.().forEach((t) => t.stop())
        } catch (_) {}
        throw e
      }
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstart = () => {
        console.log('[useMediaRecorder] onstart')
        setIsRecording(true)
        startTimeRef.current = Date.now()
        startTimer()
      }

      mediaRecorder.onerror = (e) => {
        console.error('[useMediaRecorder] mediaRecorder error', e.error)
      }

      await new Promise((r) => setTimeout(r, 150))
      mediaRecorder.start(100)
      console.log('[useMediaRecorder] mediaRecorder started')

      return stream
    } catch (err) {
      console.error('[MediaRecorder] Error starting recording:', err)
      cleanup()
      setIsRecording(false)
      setMediaType(null)
      setError(err.message || 'Ошибка записи')
      throw err
    }
  }, [cleanup, startTimer])

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('MediaRecorder не инициализирован'))
        return
      }

      const mediaRecorder = mediaRecorderRef.current
      const stream = mediaRecorder.stream || streamRef.current

      setRecordingTime(0)

      if (mediaRecorder.state !== 'recording') {
        if (stream) stream.getTracks().forEach((t) => t.stop())
        cleanup()
        setMediaType(null)
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        if (stream) stream.getTracks().forEach((t) => t.stop())
        setIsRecording(false)
        stopTimer()

        const hadVideo = mediaType === 'video'
        const blobType = hadVideo ? 'video/webm' : 'audio/webm'
        const actualType = hadVideo ? 'video' : 'audio'
        const blob = new Blob(chunksRef.current, { type: blobType })
        const durationMs = Date.now() - (startTimeRef.current || Date.now())

        if (durationMs < 150 || blob.size < 512) {
          cleanup()
          setMediaType(null)
          resolve(null)
          return
        }

        const durationSec = Math.round(durationMs / 1000)
        cleanup()
        setMediaType(null)
        resolve({ blob, duration: durationSec, type: actualType })
      }

      mediaRecorder.onerror = (e) => reject(e.error)
      mediaRecorder.stop()
    })
  }, [cleanup, mediaType, stopTimer])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
    setIsRecording(false)
    setRecordingTime(0)
    setMediaType(null)
  }, [cleanup])

  const toggleRecording = useCallback(
    async (type = 'audio') => {
      if (isRecording) {
        return await stopRecording()
      }
      return await startRecording(type)
    },
    [isRecording, startRecording, stopRecording]
  )

  return {
    isRecording,
    recordingTime,
    formattedTime: formatTime(recordingTime),
    error,
    mediaType,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
    cleanup,
  }
}

export default useMediaRecorder
