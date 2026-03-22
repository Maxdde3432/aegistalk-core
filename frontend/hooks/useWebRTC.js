// useWebRTC.js - WebRTC hook for calls via PeerJS
import { useEffect, useRef, useState, useCallback } from 'react'
import Peer from 'peerjs'
import { getApiBaseUrl } from '../api/runtimeConfig.js'

const buildIceServers = () => {
  const configuredTurnUrl = import.meta.env.VITE_TURN_URL
  const configuredTurnUsername = import.meta.env.VITE_TURN_USERNAME
  const configuredTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]

  if (configuredTurnUrl && configuredTurnUsername && configuredTurnCredential) {
    iceServers.push({
      urls: configuredTurnUrl,
      username: configuredTurnUsername,
      credential: configuredTurnCredential
    })
  }

  return iceServers
}

const normalizeAudioTracks = (stream) => {
  if (!stream) return false

  const audioTracks = stream.getAudioTracks()
  if (!audioTracks.length) return false

  audioTracks.forEach((track) => {
    track.enabled = true
    track.contentHint = 'speech'
  })

  return audioTracks.some((track) => track.readyState === 'live')
}

const optimizeAudioSender = async (call) => {
  try {
    const sender = call?.peerConnection?.getSenders?.().find((item) => item.track?.kind === 'audio')
    if (!sender?.getParameters || !sender?.setParameters) return

    const params = sender.getParameters()
    params.encodings = params.encodings?.length ? params.encodings : [{}]
    params.encodings[0].maxBitrate = 128000
    params.encodings[0].dtx = false
    await sender.setParameters(params)
  } catch (error) {
    console.error('[WebRTC] Failed to optimize audio sender:', error)
  }
}

const createPlaceholderVideoStream = () => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#050816'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)'
    ctx.font = '600 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AegisTalk', canvas.width / 2, canvas.height / 2)
  }

  const stream = canvas.captureStream(12)
  return stream || null
}

const getPeerClientConfig = () => {
  const apiBaseUrl = getApiBaseUrl()
  const url = new URL(apiBaseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')
  const isSecure = url.protocol === 'https:'
  const port = url.port ? Number(url.port) : (isSecure ? 443 : 80)

  return {
    host: url.hostname,
    port,
    path: '/peerjs/rtc',
    secure: isSecure,
    key: 'aegis-peer',
    debug: 1,
    config: {
      iceServers: buildIceServers(),
      sdpSemantics: 'unified-plan',
      iceCandidatePoolSize: 10
    }
  }
}

export const useWebRTC = (userId, options = {}) => {
  const peerRef = useRef(null)
  const optionsRef = useRef(options)
  const callRef = useRef(null)
  const pendingIncomingCallRef = useRef(null)
  const autoAnswerRequestRef = useRef(null)
  const closeGraceTimeoutRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const preferredVideoRef = useRef(false)
  const facingModeRef = useRef('user')
  const isScreenSharingRef = useRef(false)
  const screenShareStreamRef = useRef(null)
  const placeholderVideoStreamRef = useRef(null)
  const screenShareStartedWithoutVideoRef = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [error, setError] = useState(null)
  const [cameraFacingMode, setCameraFacingMode] = useState('user')

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const syncLocalStream = useCallback((stream) => {
    localStreamRef.current = stream
    setLocalStream(stream)
  }, [])

  const emitCallClosed = useCallback((payload) => {
    optionsRef.current?.onCallClosed?.(payload)
  }, [])

  const emitCallError = useCallback((message, payload = {}) => {
    optionsRef.current?.onCallError?.(message, payload)
  }, [])

  const emitCallConnected = useCallback((payload = {}) => {
    optionsRef.current?.onCallConnected?.(payload)
  }, [])

  const emitIncomingCall = useCallback((payload = {}) => {
    optionsRef.current?.onIncomingCall?.(payload)
  }, [])

  const emitScreenShareState = useCallback((payload = {}) => {
    optionsRef.current?.onScreenShareStateChange?.(payload)
  }, [])

  const getMediaStream = useCallback(async (video = false, facingMode = facingModeRef.current) => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 16 },
        latency: { ideal: 0.02 },
        googEchoCancellation: true,
        googEchoCancellation2: true,
        googNoiseSuppression: true,
        googAutoGainControl: true,
        googAutoGainControl2: true,
        googHighpassFilter: true
      },
      video: video ? { facingMode: { ideal: facingMode } } : false
    })
  }, [])

  const getCameraStream = useCallback(async (facingMode = facingModeRef.current) => {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode } }
    })
  }, [])

  const handleRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream
    setRemoteStream(stream)
    emitCallConnected({
      source: 'remote_stream',
      hasAudio: stream.getAudioTracks().length > 0,
      hasVideo: stream.getVideoTracks().length > 0
    })
  }, [emitCallConnected])

  const cleanup = useCallback(() => {
    autoAnswerRequestRef.current = null

    if (closeGraceTimeoutRef.current) {
      clearTimeout(closeGraceTimeoutRef.current)
      closeGraceTimeoutRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      syncLocalStream(null)
    }

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop())
      screenShareStreamRef.current = null
    }

    if (placeholderVideoStreamRef.current) {
      placeholderVideoStreamRef.current.getTracks().forEach((track) => track.stop())
      placeholderVideoStreamRef.current = null
    }

    isScreenSharingRef.current = false
    screenShareStartedWithoutVideoRef.current = false
    emitScreenShareState({ active: false, source: 'cleanup' })
    remoteStreamRef.current = null
    setRemoteStream(null)
  }, [emitScreenShareState, syncLocalStream])

  const ensureLocalStream = useCallback(async (video = false) => {
    preferredVideoRef.current = video

    const current = localStreamRef.current
    if (current) {
      const hasLiveAudio = current.getAudioTracks().some((track) => track.readyState === 'live')
      const hasRequiredVideo = !video || current.getVideoTracks().some((track) => track.readyState === 'live')

      if (hasLiveAudio && hasRequiredVideo) {
        normalizeAudioTracks(current)
        setError(null)
        return current
      }

      current.getTracks().forEach((track) => track.stop())
    }

    let stream
    try {
      stream = await getMediaStream(video)
    } catch (error) {
      const isPermissionError =
        error?.name === 'NotAllowedError' ||
        error?.name === 'PermissionDeniedError' ||
        error?.name === 'NotFoundError' ||
        error?.name === 'DevicesNotFoundError'

      const message = isPermissionError
        ? 'Microphone access is required for calls'
        : (error?.message || 'Failed to access microphone')

      setError(message)
      throw new Error(message)
    }

    const hasAudioTrack = normalizeAudioTracks(stream)
    if (!hasAudioTrack) {
      stream.getTracks().forEach((track) => track.stop())
      const message = 'Microphone was not detected in the media stream'
      setError(message)
      throw new Error(message)
    }

    syncLocalStream(stream)
    if (video) {
      setCameraFacingMode(facingModeRef.current)
    }
    setError(null)
    return stream
  }, [getMediaStream, syncLocalStream])

  const ensureVideoSenderTrack = useCallback((stream, withRealVideo = false) => {
    if (!stream) return stream

    const hasVideoTrack = stream.getVideoTracks().some((track) => track.readyState === 'live')
    if (hasVideoTrack || withRealVideo) {
      return stream
    }

    const placeholderStream = createPlaceholderVideoStream()
    const [placeholderTrack] = placeholderStream?.getVideoTracks?.() || []
    if (!placeholderTrack) {
      return stream
    }

    placeholderTrack.__aegisPlaceholder = true
    placeholderVideoStreamRef.current = placeholderStream
    return new MediaStream([
      ...stream.getAudioTracks(),
      placeholderTrack
    ])
  }, [])

  const attachPeerConnectionListeners = useCallback((call) => {
    const pc = call?.peerConnection
    if (!pc || pc.__aegisListenersAttached) return

    pc.__aegisListenersAttached = true

    pc.ontrack = (event) => {
      const [stream] = event.streams || []
      if (stream) {
        handleRemoteStream(stream)
        return
      }

      if (event.track) {
        const fallbackStream = new MediaStream([event.track])
        handleRemoteStream(fallbackStream)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === 'connected' || state === 'completed') {
        emitCallConnected({ source: 'ice', state })
      }
      if (state === 'failed' || state === 'disconnected') {
        setError(`ICE ${state}`)
      }
    }
  }, [emitCallConnected, handleRemoteStream])

  const attachCallLifecycleHandlers = useCallback((call) => {
    if (!call || call.__aegisCallHandlersAttached) return

    call.__aegisCallHandlersAttached = true

    call.on('stream', (nextRemoteStream) => {
      handleRemoteStream(nextRemoteStream)
    })

    call.on('close', () => {
      const isActiveCall = callRef.current === call
      const isPendingIncomingCall = pendingIncomingCallRef.current === call

      if (isActiveCall) {
        callRef.current = null
        if (closeGraceTimeoutRef.current) {
          clearTimeout(closeGraceTimeoutRef.current)
        }
        closeGraceTimeoutRef.current = setTimeout(() => {
          closeGraceTimeoutRef.current = null
          if (callRef.current || pendingIncomingCallRef.current) {
            return
          }
          cleanup()
          emitCallClosed({ reason: 'peer_closed', peerId: call.peer })
        }, 500)
        return
      }

      if (isPendingIncomingCall) {
        pendingIncomingCallRef.current = null
      }
    })

    call.on('error', (err) => {
      const message = err?.message || 'WebRTC call failed'
      setError(message)
      const isActiveCall = callRef.current === call
      const isPendingIncomingCall = pendingIncomingCallRef.current === call

      if (isActiveCall) {
        callRef.current = null
        if (closeGraceTimeoutRef.current) {
          clearTimeout(closeGraceTimeoutRef.current)
          closeGraceTimeoutRef.current = null
        }
        cleanup()
        emitCallError(message, { peerId: call.peer })
        return
      }

      if (isPendingIncomingCall) {
        pendingIncomingCallRef.current = null
      }
    })
  }, [cleanup, emitCallClosed, emitCallError, handleRemoteStream])

  const answerIncomingCall = useCallback(async (video = preferredVideoRef.current) => {
    autoAnswerRequestRef.current = { video }

    if (closeGraceTimeoutRef.current) {
      clearTimeout(closeGraceTimeoutRef.current)
      closeGraceTimeoutRef.current = null
    }

    const pendingCall = pendingIncomingCallRef.current
    if (!pendingCall) {
      return false
    }

    if (callRef.current && callRef.current !== pendingCall) {
      try {
        callRef.current.close()
      } catch (error) {}
      callRef.current = null
      cleanup()
    }

    const incomingLocalStream = ensureVideoSenderTrack(await ensureLocalStream(video), video)
    if (!normalizeAudioTracks(incomingLocalStream)) {
      throw new Error('Microphone is unavailable for answering the call')
    }

    pendingIncomingCallRef.current = null
    callRef.current = pendingCall
    attachPeerConnectionListeners(pendingCall)
    attachCallLifecycleHandlers(pendingCall)
    pendingCall.answer(incomingLocalStream)
    optimizeAudioSender(pendingCall)
    autoAnswerRequestRef.current = null
    return true
  }, [attachCallLifecycleHandlers, attachPeerConnectionListeners, cleanup, ensureLocalStream, ensureVideoSenderTrack])

  const rejectIncomingCall = useCallback(() => {
    autoAnswerRequestRef.current = null

    const pendingCall = pendingIncomingCallRef.current
    if (!pendingCall) return

    pendingIncomingCallRef.current = null

    try {
      pendingCall.close()
    } catch (error) {}
  }, [])

  useEffect(() => {
    if (!userId) return

    const peer = new Peer(userId, getPeerClientConfig())

    peer.on('open', () => {
      setIsReady(true)
    })

    peer.on('call', async (call) => {
      pendingIncomingCallRef.current = call
      attachCallLifecycleHandlers(call)
      emitIncomingCall({
        peerId: call.peer,
        metadata: call.metadata || {}
      })

      const requestedVideo = call.metadata?.video ?? preferredVideoRef.current
      const requestedAutoAnswer = autoAnswerRequestRef.current
      const canAutoAnswer =
        Boolean(requestedAutoAnswer) ||
        optionsRef.current?.shouldAutoAnswerIncomingCall?.({
          peerId: call.peer,
          metadata: call.metadata || {}
        })

      if (!canAutoAnswer) {
        return
      }

      try {
        optionsRef.current?.onCallTypeChange?.(requestedVideo ? 'video' : 'audio')
        await answerIncomingCall(requestedAutoAnswer?.video ?? requestedVideo)
      } catch (err) {
        const message = err?.message || 'Microphone is unavailable for answering the call'
        setError(message)
        emitCallError(message, { peerId: call.peer })
      }
    })

    peer.on('error', (err) => {
      const message = err?.message || 'WebRTC peer error'
      setError(message)
      emitCallError(message, { peerId: userId })
    })

    peerRef.current = peer

    return () => {
      cleanup()
      peer.destroy()
    }
  }, [answerIncomingCall, attachCallLifecycleHandlers, cleanup, emitCallError, emitIncomingCall, userId])

  const callUser = useCallback(async (targetUserId, video = false) => {
    if (!peerRef.current || !isReady) {
      throw new Error('Peer not ready')
    }

    if (closeGraceTimeoutRef.current) {
      clearTimeout(closeGraceTimeoutRef.current)
      closeGraceTimeoutRef.current = null
    }

    const outgoingLocalStream = ensureVideoSenderTrack(await ensureLocalStream(video), video)
    if (!normalizeAudioTracks(outgoingLocalStream)) {
      throw new Error('Microphone is unavailable for this call')
    }

    syncLocalStream(outgoingLocalStream)

    const call = peerRef.current.call(targetUserId, outgoingLocalStream, {
      metadata: { video }
    })

    callRef.current = call
    attachPeerConnectionListeners(call)
    attachCallLifecycleHandlers(call)
    optimizeAudioSender(call)

    return call
  }, [attachCallLifecycleHandlers, attachPeerConnectionListeners, ensureLocalStream, ensureVideoSenderTrack, isReady, syncLocalStream])

  const toggleMute = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return false

    let audioTracks = stream.getAudioTracks().filter((track) => track.readyState === 'live')
    const shouldMute = audioTracks.some((track) => track.enabled)
    const audioSender = callRef.current?.peerConnection?.getSenders?.().find((sender) => sender.track?.kind === 'audio')

    if (shouldMute) {
      audioTracks.forEach((track) => {
        track.enabled = false
      })
      if (audioSender?.track) {
        audioSender.track.enabled = false
      }
      return true
    }

    if (!audioTracks.length) {
      const refreshedAudioStream = await getMediaStream(false)
      const [restoredAudioTrack] = refreshedAudioStream.getAudioTracks()
      if (!restoredAudioTrack) {
        throw new Error('Microphone was not detected in the media stream')
      }

      const videoTracks = stream.getVideoTracks().filter((track) => track.readyState === 'live')
      const mergedStream = new MediaStream([restoredAudioTrack, ...videoTracks])
      syncLocalStream(mergedStream)

      if (audioSender?.replaceTrack) {
        await audioSender.replaceTrack(restoredAudioTrack)
      }

      audioTracks = [restoredAudioTrack]
    }

    audioTracks.forEach((track) => {
      track.enabled = true
    })
    if (audioSender?.track) {
      audioSender.track.enabled = true
    }
    return false
  }, [getMediaStream, syncLocalStream])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return false

    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length === 0) return false

    const newState = !videoTracks[0].enabled
    videoTracks.forEach((track) => {
      track.enabled = newState
    })
    return newState
  }, [])

  const replaceVideoTrack = useCallback(async (newVideoStream) => {
    if (!callRef.current || !newVideoStream) return false

    const pc = callRef.current.peerConnection
    if (!pc) return false

    const [newVideoTrack] = newVideoStream.getVideoTracks()
    if (!newVideoTrack) return false

    const current = localStreamRef.current
    const audioTracks = current ? current.getAudioTracks() : []
    const sender = pc.getSenders().find((item) => item.track?.kind === 'video')

    if (sender?.replaceTrack) {
      await sender.replaceTrack(newVideoTrack)
    } else {
      pc.addTrack(newVideoTrack, current || new MediaStream([newVideoTrack]))
    }

    if (current) {
      current.getVideoTracks().forEach((track) => track.stop())
    }

    if (placeholderVideoStreamRef.current) {
      placeholderVideoStreamRef.current.getTracks().forEach((track) => track.stop())
      placeholderVideoStreamRef.current = null
    }

    const combined = new MediaStream([
      ...audioTracks,
      newVideoTrack
    ])

    syncLocalStream(combined)
    setCameraFacingMode(newVideoTrack.getSettings?.().facingMode || facingModeRef.current)
    if (!newVideoTrack.__aegisPlaceholder) {
      optionsRef.current?.onCallTypeChange?.('video')
    }
    return true
  }, [syncLocalStream])

  const upgradeToVideo = useCallback(async () => {
    if (!callRef.current) {
      throw new Error('Active call is unavailable')
    }

    preferredVideoRef.current = true

    const current = localStreamRef.current
    const hasLiveVideo = current?.getVideoTracks?.().some((track) => track.readyState === 'live' && !track.__aegisPlaceholder)
    if (hasLiveVideo) {
      optionsRef.current?.onCallTypeChange?.('video')
      return true
    }

    const cameraStream = await getCameraStream()
    const replaced = await replaceVideoTrack(cameraStream)
    if (!replaced) {
      cameraStream.getTracks().forEach((track) => track.stop())
      throw new Error('Video sender is unavailable')
    }

    return true
  }, [getCameraStream, replaceVideoTrack])

  const switchCameraFacing = useCallback(async () => {
    if (!callRef.current) {
      throw new Error('Active call is unavailable')
    }

    if (isScreenSharingRef.current) {
      return facingModeRef.current
    }

    const nextFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user'
    const cameraStream = await getCameraStream(nextFacingMode)
    const replaced = await replaceVideoTrack(cameraStream)
    if (!replaced) {
      cameraStream.getTracks().forEach((track) => track.stop())
      throw new Error('Camera switch is unavailable')
    }

    facingModeRef.current = nextFacingMode
    setCameraFacingMode(nextFacingMode)
    return nextFacingMode
  }, [getCameraStream, replaceVideoTrack])

  const stopScreenShareTracks = useCallback(() => {
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop())
      screenShareStreamRef.current = null
    }
    isScreenSharingRef.current = false
  }, [])

  const toggleScreenShare = useCallback(async () => {
    const currentlySharing = isScreenSharingRef.current
    const canShareScreen = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)
    const nextTypeFromSenders = () => (
      callRef.current?.peerConnection?.getSenders?.().some((sender) => sender.track?.kind === 'video' && !sender.track?.__aegisPlaceholder)
        ? 'video'
        : 'audio'
    )

    if (!canShareScreen) {
      return {
        active: false,
        nextType: nextTypeFromSenders(),
        unsupported: true,
        errorMessage: 'Screen sharing is not supported in this browser'
      }
    }

    try {
      if (currentlySharing) {
        if (screenShareStartedWithoutVideoRef.current) {
          const fallbackStream = createPlaceholderVideoStream()
          if (fallbackStream) {
            await replaceVideoTrack(fallbackStream)
          }
          stopScreenShareTracks()
          optionsRef.current?.onCallTypeChange?.('audio')
          emitScreenShareState({ active: false, source: 'local_toggle' })
          screenShareStartedWithoutVideoRef.current = false
          return { active: false, nextType: 'audio' }
        }

        try {
          const cameraStream = await getCameraStream()
          const restored = await replaceVideoTrack(cameraStream)
          if (!restored) {
            throw new Error('Video sender is unavailable')
          }
        } catch (cameraError) {
          const fallbackStream = createPlaceholderVideoStream()
          if (fallbackStream) {
            await replaceVideoTrack(fallbackStream)
          } else {
            throw cameraError
          }
        }

        stopScreenShareTracks()
        emitScreenShareState({ active: false, source: 'local_toggle' })
        return { active: false, nextType: 'video' }
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 24, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          displaySurface: 'browser'
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include'
      })

      const current = localStreamRef.current
      const hadRealVideoBeforeShare = current?.getVideoTracks?.().some(
        (track) => track.readyState === 'live' && !track.__aegisPlaceholder
      )

      const [screenTrack] = displayStream.getVideoTracks()
      if (screenTrack) {
        screenTrack.contentHint = 'detail'
      }

      const replaced = await replaceVideoTrack(displayStream)
      if (!replaced) {
        displayStream.getTracks().forEach((track) => track.stop())
        throw new Error('Video sender is unavailable')
      }

      screenShareStreamRef.current = displayStream
      isScreenSharingRef.current = true
      screenShareStartedWithoutVideoRef.current = !hadRealVideoBeforeShare
      emitScreenShareState({ active: true, source: 'local_toggle' })

      if (screenTrack) {
        screenTrack.onended = async () => {
          try {
            if (screenShareStartedWithoutVideoRef.current) {
              const fallbackStream = createPlaceholderVideoStream()
              if (fallbackStream) {
                await replaceVideoTrack(fallbackStream)
              }
              optionsRef.current?.onCallTypeChange?.('audio')
              emitScreenShareState({ active: false, source: 'browser_end' })
              return
            }

            const cameraStream = await getCameraStream()
            const restored = await replaceVideoTrack(cameraStream)
            if (!restored) {
              throw new Error('Video sender is unavailable')
            }
          } catch (restoreError) {
            const fallbackStream = createPlaceholderVideoStream()
            if (fallbackStream) {
              await replaceVideoTrack(fallbackStream)
            } else {
              setError(restoreError.message)
            }
          } finally {
            stopScreenShareTracks()
            emitScreenShareState({ active: false, source: 'browser_end' })
            screenShareStartedWithoutVideoRef.current = false
          }
        }
      }

      return { active: true, nextType: 'video' }
    } catch (error) {
      const isCancelled = error?.name === 'AbortError' || error?.name === 'NotAllowedError'
      if (!isCancelled) {
        setError(error.message)
      }
      stopScreenShareTracks()
      emitScreenShareState({ active: false, source: 'local_toggle' })
      return {
        active: false,
        nextType: nextTypeFromSenders(),
        cancelled: isCancelled,
        errorMessage: error?.message || 'Failed to start screen sharing'
      }
    }
  }, [emitScreenShareState, getCameraStream, replaceVideoTrack, stopScreenShareTracks])

  const endCall = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.close()
      } catch (error) {}
      callRef.current = null
    }

    if (pendingIncomingCallRef.current) {
      try {
        pendingIncomingCallRef.current.close()
      } catch (error) {}
      pendingIncomingCallRef.current = null
    }

    cleanup()
  }, [cleanup])

  return {
    isReady,
    remoteStream,
    localStream,
    error,
    cameraFacingMode,
    prepareLocalStream: ensureLocalStream,
    callUser,
    answerIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCameraFacing,
    upgradeToVideo,
    toggleScreenShare,
    cleanup
  }
}

export default useWebRTC
