// @ts-nocheck
import { useEffect, useState, useRef, useCallback, useMemo, useDeferredValue, startTransition } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'




import { authAPI, getAccessToken, clearTokens } from './api/auth'
import { chatsAPI, messagesAPI, wsService, usersAPI } from './api/chats'
import { groupsAPI } from './api/groups'
import { messagesAPI as msgAPI, buildProtectedMediaUrl, downloadProtectedMedia, fetchProtectedMediaBlobUrl } from './api/messages'
import { profileAPI } from './api/profile'
import { uploadFile } from './api/uploads.js'
import { toast } from './utils/toast'
import { ChannelSettingsModal, GradientThemeModal, MembersModal, GRADIENT_THEMES } from './ChannelSettings'
import ChannelMembersPanel from './components/ChannelMembersPanel'
import GroupMemberPickerModal from './components/GroupMemberPickerModal'
import ProfileSidebar from './components/ProfileSidebar'
import { CallHistory } from './components/CallHistory'
import NewGroupChannelModal from './components/NewGroupChannelModal'
import ChatWindow from './components/ChatWindow'
import ChatHeaderBar from './components/ChatHeaderBar'
import IncomingCallModal from './components/IncomingCallModal'
import ActiveCallModal from './components/ActiveCallModal'
import ChatComposer from './components/ChatComposer'
import MessageContextMenu from './components/MessageContextMenu'
import EditMessageModal from './components/EditMessageModal'
import EmptyChatState from './components/EmptyChatState'
import ForwardMessageModal from './components/ForwardMessageModal'
import ChatViewErrorBoundary from './components/ChatViewErrorBoundary'
import ChatSidebar from './components/ChatSidebar'
import MobileSidebarOverlay from './components/MobileSidebarOverlay'
import PinnedMessageBar from './components/PinnedMessageBar'
import DiscussionButton from './components/DiscussionButton'
import MessageReactions from './components/MessageReactions'
import MessageActionsMenu from './components/MessageActionsMenu'
import MessageReactionPicker from './components/MessageReactionPicker'
import BotMessageContent from './components/BotMessageContent'
import MessageMeta from './components/MessageMeta'
import MessageAuthorHeader from './components/MessageAuthorHeader'
import TextMessageContent from './components/TextMessageContent'

const NOTIFY_PREFS_KEY = 'aegistalk_notify_prefs_v3'

const readNotifyPrefs = () => {
  try {
    const raw = localStorage.getItem(NOTIFY_PREFS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      pushEnabled: parsed?.pushEnabled !== false,
      soundEnabled: parsed?.soundEnabled !== false
    }
  } catch {
    return { pushEnabled: true, soundEnabled: true }
  }
}

const writeNotifyPrefs = (prefs) => {
  try {
    localStorage.setItem(NOTIFY_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
import AdminPanel from './AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'
import MediaAttachmentContent from './components/MediaAttachmentContent'
import BotMediaContent from './components/BotMediaContent'
import { SocketProvider, useSocket } from './contexts/SocketContext'
import { onlineUsersStore } from './store/onlineUsersStore'
import { secureStorage } from './utils/secureStorage'
import { decryptMessageEnvelope, encryptMessageEnvelope, isEncryptedEnvelope } from './utils/e2ee'
import { getShowForwardingAttribution, setShowForwardingAttribution } from './utils/privacySettings'
import { parseMessageMedia, isMediaMessagePayload, getMessagePreviewLabel } from './utils/messageMedia'
import JoinPage from './JoinPage'
import { useMediaRecorder } from './hooks/useMediaRecorder'
import { useWebRTC } from './hooks/useWebRTC'
import './App.css'
import shieldIcon from './shield.svg'


const AEGIS_STICKERS = [
  {
    id: 'aegis-shield',
    title: 'Shield',
    subtitle: 'Aegis online',
    accent: '#5cc8ff',
    accentSecondary: '#7c4dff',
    glow: 'rgba(92, 200, 255, 0.35)',
    pattern: 'shield'
  },
  {
    id: 'aegis-pulse',
    title: 'Pulse',
    subtitle: 'Signal secured',
    accent: '#8b5cf6',
    accentSecondary: '#ec4899',
    glow: 'rgba(139, 92, 246, 0.35)',
    pattern: 'pulse'
  },
  {
    id: 'aegis-ghost',
    title: 'Ghost',
    subtitle: 'Silent mode',
    accent: '#34d399',
    accentSecondary: '#22d3ee',
    glow: 'rgba(52, 211, 153, 0.32)',
    pattern: 'ghost'
  },
  {
    id: 'aegis-core',
    title: 'Core',
    subtitle: 'Cipher ready',
    accent: '#f59e0b',
    accentSecondary: '#ef4444',
    glow: 'rgba(245, 158, 11, 0.30)',
    pattern: 'core'
  }
]

const AEGIS_GIFS = [
  {
    id: 'aegis-gif-signal',
    title: 'Signal',
    subtitle: 'Burst loop',
    accent: '#38bdf8',
    accentSecondary: '#8b5cf6',
    glow: 'rgba(56, 189, 248, 0.30)',
    pattern: 'pulse',
    kind: 'gif'
  },
  {
    id: 'aegis-gif-core',
    title: 'Core',
    subtitle: 'Cipher spin',
    accent: '#fb7185',
    accentSecondary: '#f59e0b',
    glow: 'rgba(251, 113, 133, 0.28)',
    pattern: 'core',
    kind: 'gif'
  }
]

const AegisSticker = ({ sticker, isOwn = false, compact = false }) => {
  const normalizedSticker = sticker || AEGIS_STICKERS[0]
  const className = [
    'aegis-sticker-card',
    isOwn ? 'own' : '',
    compact ? 'compact' : '',
    normalizedSticker.kind === 'gif' ? 'gif' : '',
    normalizedSticker.pattern || 'shield'
  ].filter(Boolean).join(' ')

  return (
    <div
      className={className}
      style={{
        '--sticker-accent': normalizedSticker.accent,
        '--sticker-accent-secondary': normalizedSticker.accentSecondary,
        '--sticker-glow': normalizedSticker.glow
      }}
    >
      <div className="aegis-sticker-orb aegis-sticker-orb-a" />
      <div className="aegis-sticker-orb aegis-sticker-orb-b" />
      <div className="aegis-sticker-grid" />
      <div className="aegis-sticker-mark">
        <img src={shieldIcon} alt="" className="aegis-sticker-shield" />
      </div>
      <div className="aegis-sticker-caption">
        <span className="aegis-sticker-title">{normalizedSticker.title}</span>
        <span className="aegis-sticker-subtitle">{normalizedSticker.subtitle}</span>
      </div>
    </div>
  )
}

const buildBackgroundStyles = (theme) => {
  if (!theme) return {}

  if (theme.type === 'pattern') {
    return {
      backgroundImage: theme.css,
      backgroundColor: theme.backgroundColor || '#0E1621',
      backgroundSize: '28px 28px',
      ...(theme.animated
        ? {
            animation: 'dmGradientShift 24s ease infinite'
          }
        : {})
    }
  }

  const isAnimated = theme.animated

  return {
    backgroundImage: theme.animated
      ? `radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.16), transparent 28%), radial-gradient(circle at 80% 30%, rgba(59, 130, 246, 0.18), transparent 26%), linear-gradient(135deg, ${theme.from}, ${theme.to})`
      : `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
    backgroundSize: isAnimated ? '400% 400%' : 'cover',
    ...(isAnimated
      ? {
          animation: 'dmGradientShift 24s ease infinite'
        }
      : {})
  }
}

const DmAppearanceModal = ({ value, onClose, onChange, chatName }) => {
  const [mode, setMode] = useState(value?.mode || 'default')
  const [gradientKey, setGradientKey] = useState(value?.gradientKey || 'tg_blue')
  const [imageDataUrl, setImageDataUrl] = useState(value?.imageDataUrl || '')

  const handleSave = () => {
    if (mode === 'default') {
      onChange(null)
      return
    }
    if (mode === 'gradient') {
      onChange({ mode: 'gradient', gradientKey })
      return
    }
    if (mode === 'image' && imageDataUrl) {
      onChange({ mode: 'image', imageDataUrl })
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      alert('Фон слишком большой. Максимум 8MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result)
        setMode('image')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>🎨 Оформление чата</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Настройте фон для личного диалога {chatName ? `с ${chatName}` : ''}.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setMode('default')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                background: mode === 'default' ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              По умолчанию
            </button>
            <button
              onClick={() => setMode('gradient')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                background: mode === 'gradient' ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Градиенты и паттерны
            </button>
            <button
              onClick={() => setMode('image')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                background: mode === 'image' ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Своя фотография
            </button>
          </div>

          {mode === 'gradient' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {Object.entries(GRADIENT_THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setGradientKey(key)}
                  style={{
                    padding: '26px 10px',
                    border: gradientKey === key ? '3px solid var(--primary)' : '3px solid transparent',
                    borderRadius: '12px',
                    background:
                      theme.type === 'pattern'
                        ? `#0E1621 ${theme.css}`
                        : `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                    backgroundSize: theme.type === 'pattern' ? '20px 20px' : theme.animated ? '400% 400%' : 'cover',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{theme.name}</span>
                  {theme.animated && <span style={{ fontSize: '14px' }}>✨</span>}
                </button>
              ))}
            </div>
          )}

          {mode === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              {imageDataUrl && (
                <div
                  style={{
                    marginTop: '8px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div
                    style={{
                      paddingBottom: '56%',
                      backgroundImage: `url(${imageDataUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '9999px', fontSize: '13px' }}
              onClick={() => {
                handleSave()
                onClose()
              }}
            >
              Сохранить фон
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// LOGIN PAGE
// ============================================================================
const GoogleAuthButton = ({ mode = 'login' }) => {
  const label = mode === 'register' ? 'Продолжить с Google' : 'Войти через Google'

  return (
    <button
      type="button"
      onClick={() => {
        void authAPI.startGoogleAuth(getPostAuthRedirectTarget())
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px 18px',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
        color: '#111827',
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)'
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3.1l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.3-.2-1.9H12z" />
        <path fill="#34A853" d="M12 21c2.5 0 4.6-.8 6.2-2.3l-3-2.3c-.8.6-1.9 1-3.2 1-2.5 0-4.5-1.7-5.2-4l-3.1 2.4C5.4 18.8 8.4 21 12 21z" />
        <path fill="#4A90E2" d="M6.8 13.4c-.2-.6-.3-1.1-.3-1.8s.1-1.2.3-1.8l-3.1-2.4C3 8.8 2.6 10.4 2.6 12s.4 3.2 1.1 4.6l3.1-2.4z" />
        <path fill="#FBBC05" d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.6 4.1 14.5 3 12 3 8.4 3 5.4 5.2 3.7 8.4l3.1 2.4c.7-2.3 2.7-4.2 5.2-4.2z" />
      </svg>
      <span>{label}</span>
    </button>
  )
}

const GoogleAuthCallbackPage = ({ onLogin }) => {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const finishGoogleAuth = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const search = new URLSearchParams(window.location.search)
      const accessToken = hash.get('accessToken')
      const refreshToken = hash.get('refreshToken')
      const next = hash.get('next') || '/chat'
      const requiresPasswordSetup = hash.get('requiresPasswordSetup') === '1'
      const googlePasswordSetupToken = hash.get('googlePasswordSetupToken')
      const callbackError = search.get('error')

      if (callbackError) {
        setError(formatAuthError(callbackError))
        return
      }

      try {
        const result = await authAPI.completeGoogleAuth({ accessToken, refreshToken })
        onLogin(result.user)
        if (requiresPasswordSetup && googlePasswordSetupToken) {
          authAPI.saveGooglePasswordSetupState({ googlePasswordSetupToken, next })
          navigate(result.user?.onboardingCompletedAt ? '/auth/google/setup-password' : '/welcome', { replace: true })
          return
        }
        navigate(getPostAuthRedirectTarget(result.user), { replace: true })
      } catch (err) {
        setError(formatAuthError(err.message || 'Не удалось завершить вход через Google'))
      }
    }

    finishGoogleAuth()
  }, [navigate, onLogin])

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>🛡️ AegisTalk</h1>
          <p>Google Auth</p>
        </div>
        <div className="auth-card">
          <h2>{error ? 'Ошибка входа' : 'Завершаем вход'}</h2>
          {error ? (
            <>
              <div className="auth-error">{error}</div>
              <button type="button" className="btn-primary" onClick={() => navigate('/login', { replace: true })}>
                Назад ко входу
              </button>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              Получаем профиль Google и открываем ваш аккаунт...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const getPostAuthRedirectTarget = (userData = null) => {
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  const normalizedUser = normalizeCurrentUser(userData)

  if (normalizedUser && !normalizedUser.onboardingCompletedAt) {
    return '/welcome'
  }

  return redirect && redirect.startsWith('/') ? redirect : '/chat'
}

const getWelcomeViewportState = () => {
  if (typeof window === 'undefined') {
    return {
      isCompact: false,
      isPhone: false,
      isShortScreen: false
    }
  }

  const width = window.innerWidth
  const height = window.innerHeight

  return {
    isCompact: width <= 920,
    isPhone: width <= 640,
    isShortScreen: height <= 760
  }
}

const GooglePasswordSetupPage = ({ onLogin }) => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { googlePasswordSetupToken } = authAPI.getGooglePasswordSetupState()
    if (!googlePasswordSetupToken) {
      navigate('/chat', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!password || !confirmPassword) {
      setError('Введите пароль и подтверждение')
      return
    }

    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    try {
      const { next } = authAPI.getGooglePasswordSetupState()
      await authAPI.setupGooglePassword({ password })
      const me = await authAPI.getMe()
      if (me) {
        onLogin(me)
      }
      setSuccess('Пароль успешно задан')
      setTimeout(() => {
        navigate(getPostAuthRedirectTarget(me), { replace: true })
      }, 700)
    } catch (err) {
      setError(formatAuthError(err.message || 'Не удалось задать пароль'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>AegisTalk</h1>
          <p>Безопасная установка пароля</p>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Задать пароль</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
            Ваш Google-аккаунт уже создан. При желании можно сразу добавить пароль для входа.
          </p>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <div className="form-group">
            <label>Новый пароль</label>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Не менее 8 символов"
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>Подтвердите пароль</label>
            <input
              type="password"
              className="auth-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сохраняем...' : 'Сохранить пароль'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              authAPI.clearGooglePasswordSetupState()
              navigate('/chat', { replace: true })
            }}
          >
            Пропустить пока
          </button>
        </form>
      </div>
    </div>
  )
}

const formatAuthError = (message) => {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()

  if (!text) {
    return 'Произошла ошибка авторизации'
  }

  if (
    /google/.test(lower) && (
      text.includes('Этот аккаунт создан через Google') ||
      lower.includes('created through google') ||
      lower.includes('created via google')
    )
  ) {
    return 'Этот аккаунт создан через Google. Используйте кнопку "Войти через Google".'
  }

  if (
    text.includes('Неверные учётные данные') ||
    text.includes('Неверные учетные данные') ||
    lower.includes('invalid credentials')
  ) {
    return 'Неверные учётные данные'
  }

  if (text.includes('Код не найден') || lower.includes('code not found')) {
    return 'Код не найден'
  }

  if (text.includes('Неверный код') || lower.includes('invalid code')) {
    return 'Неверный код'
  }

  return text
}

const VERIFICATION_RESEND_COOLDOWN_SECONDS = 180

const normalizeCurrentUser = (userData) => {
  if (!userData) return null

  return {
    ...userData,
    id: userData.id,
    email: userData.email || '',
    username: userData.username || '',
    firstName: userData.firstName ?? userData.first_name ?? '',
    lastName: userData.lastName ?? userData.last_name ?? '',
    avatarUrl: userData.avatarUrl ?? userData.avatar_url ?? '',
    bio: userData.bio ?? '',
    publicKey: userData.publicKey ?? userData.public_key ?? '',
    onboardingCompletedAt: userData.onboardingCompletedAt ?? userData.onboarding_completed_at ?? null
  }
}

const parseAppDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const normalized = String(value).trim()
  if (!normalized) return null
  if (/^\d{10,13}$/.test(normalized)) {
    const numericValue = normalized.length === 13 ? Number(normalized) : Number(normalized) * 1000
    const date = new Date(numericValue)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const withoutZone = normalized.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/)
  const date = withoutZone
    ? new Date(normalized.replace(' ', 'T') + 'Z')
    : new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

const LoginPage = ({ onLogin }) => {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('invite')
    if (inviteToken) {
      secureStorage.setItem('pendingInvite', inviteToken)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const normalizedLoginId = String(loginId || '').trim()
    const normalizedPassword = String(password || '')

    if (!normalizedLoginId) {
      setError('Введите телефон, email или имя пользователя')
      return
    }

    if (!normalizedPassword.trim()) {
      setError('Введите пароль')
      return
    }

    setLoading(true)

    try {
      const credentials = {
        password: normalizedPassword,
        ...(normalizedLoginId.startsWith('+') ? { phone: normalizedLoginId } : {}),
        ...(normalizedLoginId.includes('@') ? { email: normalizedLoginId } : {}),
        ...(!normalizedLoginId.startsWith('+') && !normalizedLoginId.includes('@') ? { username: normalizedLoginId } : {})
      }

      const result = await authAPI.login(credentials)
      
      // Если требуется верификация email - показываем поле ввода кода
      if (result.requiresEmailVerification) {
        setRequiresVerification(true)
        setResendTimer(VERIFICATION_RESEND_COOLDOWN_SECONDS)
        
        const timer = setInterval(() => {
          setResendTimer(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        onLogin(result.user)
        window.location.href = getPostAuthRedirectTarget(result.user)
      }
    } catch (err) {
      setError(formatAuthError(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')

    if (verificationCode.length !== 6) {
      setError('Код должен состоять из 6 цифр')
      return
    }

    setLoading(true)

    try {
      const result = await authAPI.verifyLoginCode(verificationCode)
      onLogin(result.user)
      window.location.href = getPostAuthRedirectTarget(result.user)
    } catch (err) {
      setError(formatAuthError(err.message || 'Неверный код. Попробуйте ещё раз.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendTimer > 0) return

    setError('')
    setLoading(true)

    try {
      await authAPI.resendLoginCode()
      setResendTimer(VERIFICATION_RESEND_COOLDOWN_SECONDS)

      const timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Шаг 2: Ввод кода подтверждения
  if (requiresVerification) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-logo">
            <h1>🛡️ AegisTalk</h1>
            <p>Подтверждение входа</p>
          </div>
          <div className="auth-card">
            <h2>Код отправлен</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Введите 6-значный код из письма<br />
              <span style={{ color: 'var(--primary)' }}>{loginId}</span>
            </p>
            {error && <div className="auth-error">{error}</div>}
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                placeholder="000000"
                className="auth-input"
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                required
              />
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="auth-link-button"
                onClick={handleResendCode}
                disabled={resendTimer > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendTimer > 0 ? 'var(--text-secondary)' : 'var(--primary)',
                  cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {resendTimer > 0 ? `Отправить повторно через ${resendTimer} сек` : 'Отправить код повторно'}
              </button>
            </div>
            <p className="auth-link" style={{ marginTop: '20px' }}>
              <span className="auth-link-button" onClick={() => { setRequiresVerification(false); setVerificationCode('') }}>← Назад</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Шаг 1: Ввод логина и пароля
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>🛡️ AegisTalk</h1>
          <p>Secure Messenger</p>
        </div>
        <div className="auth-card">
          <h2>Вход</h2>
          {error && <div className="auth-error">{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
            <GoogleAuthButton mode="login" />
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13px', margin: 0 }}>
              Основной способ входа. Пароль оставлен только для старых аккаунтов.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 18px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>или через пароль</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Телефон, email или имя"
              className="auth-input"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
            <input
              type="password"
              placeholder="Пароль"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
          <p className="auth-link">
            Нет аккаунта? <span className="auth-link-button" onClick={() => window.location.href = '/register'}>Зарегистрироваться</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// REGISTER PAGE
// ============================================================================
const RegisterPage = ({ onLogin }) => {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [resendTimer, setResendTimer] = useState(0)
  const [emailStatus, setEmailStatus] = useState('idle')
  const [emailMessage, setEmailMessage] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [usernameMessage, setUsernameMessage] = useState('')

  const stepMeta = {
    1: { eyebrow: 'Шаг 1 из 4', title: 'Введите почту', description: 'На этот адрес придёт код подтверждения.' },
    2: { eyebrow: 'Шаг 2 из 4', title: 'Придумайте пароль', description: 'Минимум 8 символов для входа в парольный аккаунт.' },
    3: { eyebrow: 'Шаг 3 из 4', title: 'Настройте профиль', description: 'Имя обязательно. Username можно выбрать сейчас или позже.' },
    4: { eyebrow: 'Шаг 4 из 4', title: 'Подтвердите почту', description: 'Введите 6-значный код из письма.' }
  }

  const renderGoogleShortcut = (compact = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '10px' : '14px', marginBottom: compact ? '16px' : '18px' }}>
      <GoogleAuthButton mode="register" />
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: compact ? '12px' : '13px', margin: 0 }}>
        Можно пропустить обычную регистрацию и войти через Google сразу.
      </p>
    </div>
  )

  const startResendTimer = () => {
    setResendTimer(VERIFICATION_RESEND_COOLDOWN_SECONDS)

    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const goToNextStep = () => {
    setError('')

    if (step === 1) {
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Введите корректный email')
        return
      }
    }

    if (step === 2) {
      if (formData.password.length < 8) {
        setError('Пароль должен быть не менее 8 символов')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Пароли не совпадают')
        return
      }
    }

    setStep(prev => Math.min(prev + 1, 4))
  }

  const goToPreviousStep = () => {
    setError('')
    setStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.firstName.trim()) {
      setError('Введите имя')
      return
    }

    const normalizedUsername = formData.username.replace(/^@+/, '').toLowerCase().trim()
    if (normalizedUsername && usernameStatus === 'taken') {
      setError(usernameMessage || 'Этот username уже занят')
      return
    }

    if (normalizedUsername && usernameStatus === 'error') {
      setError(usernameMessage || 'Не удалось проверить username')
      return
    }

    setLoading(true)

    try {
      const result = await authAPI.register({
        email: formData.email,
        username: normalizedUsername || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName?.trim() || undefined,
        password: formData.password
      })

      if (result.tempDataToken) {
        secureStorage.setItem('tempDataToken', result.tempDataToken)
      }
      
      setUserId(result.userId)
      setUserEmail(formData.email)
      setStep(4)
      startResendTimer()

    } catch (err) {
      console.error('[Register] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')

    if (verificationCode.length !== 6) {
      setError('Код должен состоять из 6 цифр')
      return
    }

    setLoading(true)

    try {
      // Проверяем код через backend API
      const result = await authAPI.verifyEmail(verificationCode)

      // Код верный - пользователь авторизован
      onLogin(result.user)
      window.location.href = getPostAuthRedirectTarget(result.user)
      
    } catch (err) {
      console.error('[Verify] Error:', err)
      setError(err.message || 'Неверный код. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendTimer > 0) return

    setError('')
    setLoading(true)

    try {
      await authAPI.resendCode()
      startResendTimer()

    } catch (err) {
      console.error('[Resend] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field) => (e) => {
    const nextValue = e.target.value

    if (field === 'email') {
      setEmailStatus('idle')
      setEmailMessage('')
    }

    if (field === 'username') {
      const cleaned = nextValue.replace(/[^a-zA-Z0-9_@]/g, '').replace(/^@{2,}/, '@')
      setUsernameStatus('idle')
      setUsernameMessage('')
      setFormData(prev => ({ ...prev, [field]: cleaned.replace(/^@/, '') }))
      return
    }

    setFormData(prev => ({ ...prev, [field]: nextValue }))
  }

  useEffect(() => {
    if (step !== 3) return undefined

    const normalizedUsername = formData.username.replace(/^@+/, '').toLowerCase().trim()

    if (!normalizedUsername) {
      setUsernameStatus('idle')
      setUsernameMessage('')
      return undefined
    }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const result = await authAPI.checkRegistrationUsername(normalizedUsername)
        setFormData(prev => ({ ...prev, username: result.normalized ?? normalizedUsername }))
        setUsernameStatus(result.available ? 'available' : 'taken')
        setUsernameMessage(
          result.available
            ? 'Username доступен'
            : (result.error || 'Этот username уже занят')
        )
      } catch (err) {
        setUsernameStatus('error')
        setUsernameMessage(err.message)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [formData.username, step])

  const handleCheckEmailAndContinue = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Введите корректный email')
      return
    }

    setLoading(true)
    setEmailStatus('checking')
    setEmailMessage('')

    try {
      const result = await authAPI.checkRegistrationEmail(formData.email)

      if (!result.available) {
        setEmailStatus('taken')
        setEmailMessage('Аккаунт с таким email уже существует')
        return
      }

      setEmailStatus('available')
      setEmailMessage('Email свободен')
      setStep(2)
    } catch (err) {
      setEmailStatus('error')
      setEmailMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>🛡️ AegisTalk</h1>
          <p>Регистрация</p>
        </div>
        <div className="auth-card auth-register-card">
          <div className="auth-step-header">
            <div className="auth-step-label">
              {stepMeta[step].eyebrow}
            </div>
            <div className="auth-step-progress" aria-hidden="true">
              {[1, 2, 3, 4].map((stepNumber) => (
                <span
                  key={stepNumber}
                  className={`auth-step-progress-dot ${stepNumber <= step ? 'is-active' : ''} ${stepNumber === step ? 'is-current' : ''}`}
                />
              ))}
            </div>
            <h2>{stepMeta[step].title}</h2>
            <p className="auth-step-description">
              {stepMeta[step].description}
              {step === 4 && (
                <>
                  <br />
                  <span style={{ color: 'var(--primary)' }}>{userEmail}</span>
                </>
              )}
            </p>
          </div>
          {error && <div className="auth-error">{error}</div>}

          {step < 4 && renderGoogleShortcut(true)}

          {step < 4 && (
            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-label">или продолжить обычную регистрацию</span>
              <div className="auth-divider-line" />
            </div>
          )}

          {step === 1 && (
            <form className="auth-form auth-step-panel" onSubmit={handleCheckEmailAndContinue}>
              <input
                type="email"
                placeholder="Email"
                className="auth-input"
                value={formData.email}
                onChange={handleChange('email')}
                autoFocus
                required
              />
              {emailMessage && (
                <div className={`auth-inline-status ${emailStatus === 'available' ? 'is-success' : 'is-error'}`}>
                  {emailMessage}
                </div>
              )}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Проверка...' : 'Продолжить'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form className="auth-form auth-step-panel" onSubmit={(e) => { e.preventDefault(); goToNextStep(); }}>
              <input
                type="password"
                placeholder="Пароль (мин. 8 символов)"
                className="auth-input"
                value={formData.password}
                onChange={handleChange('password')}
                autoFocus
                required
              />
              <input
                type="password"
                placeholder="Подтвердите пароль"
                className="auth-input"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                required
              />
              <div className="auth-step-actions">
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={goToPreviousStep}>
                  Назад
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  Продолжить
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="auth-form auth-step-panel" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Имя"
                className="auth-input"
                value={formData.firstName}
                onChange={handleChange('firstName')}
                autoFocus
                required
              />
              <input
                type="text"
                placeholder="Фамилия (необязательно)"
                className="auth-input"
                value={formData.lastName}
                onChange={handleChange('lastName')}
              />
              <div className="auth-username-field">
                <span className="auth-username-prefix">@</span>
                <input
                  type="text"
                  placeholder="username"
                  className="auth-input auth-username-input"
                  value={formData.username}
                  onChange={handleChange('username')}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <div className={`auth-inline-status ${usernameStatus === 'available' ? 'is-success' : ''} ${usernameStatus === 'taken' || usernameStatus === 'error' ? 'is-error' : ''}`}>
                {usernameStatus === 'checking' && 'Проверяем username...'}
                {usernameStatus !== 'checking' && usernameMessage}
                {usernameStatus === 'idle' && 'Латиница, цифры и _. От 5 до 32 символов.'}
              </div>
              <div className="auth-step-actions">
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={goToPreviousStep}>
                  Назад
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading || usernameStatus === 'checking'}>
                  {loading ? 'Отправка кода...' : 'Создать аккаунт'}
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <>
              <form className="auth-form auth-step-panel" onSubmit={handleVerifyCode}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="6"
                  placeholder="000000"
                  className="auth-input auth-code-input"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  required
                />
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Проверка...' : 'Подтвердить'}
                </button>
              </form>
              <div className="auth-resend-block">
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={handleResendCode}
                  disabled={resendTimer > 0 || loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendTimer > 0 ? 'var(--text-secondary)' : 'var(--primary)',
                    cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {resendTimer > 0 ? `Отправить повторно через ${resendTimer} сек` : 'Отправить код повторно'}
                </button>
              </div>
              <p className="auth-link" style={{ marginTop: '20px' }}>
                <span className="auth-link-button" onClick={() => setStep(3)}>← Назад</span>
              </p>
            </>
          )}

          <p className="auth-link" style={{ marginTop: '20px' }}>
            Есть аккаунт? <span className="auth-link-button" onClick={() => window.location.href = '/login'}>Войти</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CHAT PAGE
// ============================================================================
const ChatPage = ({ user, setUser, onLogout }) => {
  const navigate = useNavigate()
  const {
    isUserOnline,
    isTypingInChat,
    getTypingUser
  } = useSocket();
  
  // Обработчик ошибок авторизации (вместо window.location.href)
  useEffect(() => {
    const handleAuthError = (event) => {
      if (event.detail?.type === 'unauthorized') {
        navigate('/login', { replace: true });
      }
    };
    
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [navigate]);
  
  const [chats, setChats] = useState([])
  const chatsRef = useRef([])
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [wsReadyState, setWsReadyState] = useState(() => {
    if (typeof WebSocket === 'undefined') return 3 // CLOSED
    return wsService.ws?.readyState ?? WebSocket.CLOSED
  })
  const prevWsReadyStateRef = useRef(wsReadyState)
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const safeMessages = Array.isArray(messages) ? messages : []
  const [messagesLoadError, setMessagesLoadError] = useState(null)
  const [messageReactions, setMessageReactions] = useState({})
  const [showReactionPicker, setShowReactionPicker] = useState(null)
  const [selectedMessageId, setSelectedMessageId] = useState(null)
  const [messageInput, setMessageInput] = useState('')
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [composerPanelTab, setComposerPanelTab] = useState('emoji')
  const typingTimeoutRef = useRef(null)
  const activityTimerRef = useRef(null) // Таймер активности
  const favoritesChat = useMemo(() => chats.find(chat => chat.isSelf), [chats])
  const [showSidebarActionsMenu, setShowSidebarActionsMenu] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const usersSearchRequestRef = useRef(0)
  const groupsSearchRequestRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const [groupSettings, setGroupSettings] = useState(null)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [showEditModal, setShowEditModal] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [channelMembers, setChannelMembers] = useState([])
  const [showProfileSidebar, setShowProfileSidebar] = useState(false)
  const [selectedUserProfile, setSelectedUserProfile] = useState(null)
  const [profileFromMessage, setProfileFromMessage] = useState(false)
  const [showCallHistory, setShowCallHistory] = useState(false)

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  // Состояния для записи голосовых сообщений (Telegram-style)
  const [recordingMode, setRecordingMode] = useState('audio')
  const [isRecordingUI, setIsRecordingUI] = useState(false)
  // Guards against double start/stop (async) clicks.
  const recordingLifecycleRef = useRef({ starting: false, stopping: false, canceling: false })

  const [showChatActionsMenu, setShowChatActionsMenu] = useState(false)
  const [showDeleteChatOptions, setShowDeleteChatOptions] = useState(false)
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [imagePreview, setImagePreview] = useState(null)
  const [showImageActions, setShowImageActions] = useState(false)

  const {
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording
  } = useMediaRecorder()

  const showToast = (message, type = 'success') => {
    if (type === 'error') {
      toast.error(message)
    } else {
      toast.success(message)
  }
}

  // Состояния для поиска и закрепленных
  const [showSearch, setShowSearch] = useState(false)
  const [chatHistorySearch, setChatHistorySearch] = useState('')  // Поиск по сообщениям
  const deferredChatHistorySearch = useDeferredValue(chatHistorySearch)
  const [pinnedMessage, setPinnedMessage] = useState(null)

  // Состояние для мобильного вида
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showChatList, setShowChatList] = useState(true) // Показываем список чатов по умолчанию
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isForwarding, setIsForwarding] = useState(false)

  useEffect(() => {
    if (imagePreview) {
      setShowImageActions(false)
    }
  }, [imagePreview])
  
  // Контекстное меню для сообщений (долгое нажатие)
  const [messageContextMenu, setMessageContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    messageId: null,
    messageContent: '',
    isOwn: false
  })

  const [forwardState, setForwardState] = useState({
    open: false,
    message: null
  })

  const handleCloseImagePreview = () => {
    setShowImageActions(false)
    setImagePreview(null)
  }

  const handleDownloadPreview = async () => {
    if (!imagePreview) return
    try {
      if (imagePreview.messageId) {
        await downloadProtectedMedia(imagePreview.messageId, imagePreview.name || 'image')
      } else {
        const link = document.createElement('a')
        link.href = imagePreview.url
        link.download = imagePreview.name || 'image'
        link.click()
      }
    } catch (error) {
      console.error('[ImagePreview] Failed to download', error)
    } finally {
      setShowImageActions(false)
    }
  }

  const handleForwardPreview = () => {
    if (!imagePreview) return
    setForwardState({
      open: true,
      message: {
        id: imagePreview.messageId || null,
        text: imagePreview.isMedia ? '' : (imagePreview.messageContent || ''),
        content: imagePreview.messageContent || '',
        mediaPreview: imagePreview.url,
        isMedia: !!imagePreview.isMedia,
        senderName: imagePreview.senderName || 'Контакт'
      }
    })
    setSelectedMessageId(imagePreview.messageId || null)
    setShowImageActions(false)
  }

  // Оформление фона для личных чатов (хранится локально в браузере)
  const [dmThemes, setDmThemes] = useState(() => {
    try {
      const raw = localStorage.getItem('aegistalk_dm_themes_v1')
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (e) {
      console.error('[DMTheme] Failed to load themes', e)
      return {}
    }
  })
  const [showDmThemeModal, setShowDmThemeModal] = useState(false)
  const callLifecycleRef = useRef({
    onClosed: () => {},
    onError: () => {},
    onConnected: () => {},
    onIncomingCall: () => {},
    shouldAutoAnswer: () => false,
    onTypeChange: () => {},
    onScreenShareStateChange: () => {}
  })
  const isSwitchingCallRef = useRef(false)

  // WebRTC для звонков
  const {
    isReady: webrtcReady,
    remoteStream,
    localStream,
    error: webrtcError,
    cameraFacingMode,
    prepareLocalStream,
    callUser,
    answerIncomingCall: answerIncomingWebRTCCall,
    rejectIncomingCall: rejectIncomingWebRTCCall,
    endCall: endWebRTCCall,
    toggleMute: toggleWebRTCMute,
    toggleCamera,
    switchCameraFacing,
    upgradeToVideo,
    toggleScreenShare,
    cleanup: cleanupWebRTC
  } = useWebRTC(user?.id, {
    onCallClosed: (...args) => callLifecycleRef.current.onClosed?.(...args),
    onCallError: (...args) => callLifecycleRef.current.onError?.(...args),
    onCallConnected: (...args) => callLifecycleRef.current.onConnected?.(...args),
    onIncomingCall: (...args) => callLifecycleRef.current.onIncomingCall?.(...args),
    shouldAutoAnswerIncomingCall: (...args) => callLifecycleRef.current.shouldAutoAnswer?.(...args),
    onCallTypeChange: (...args) => callLifecycleRef.current.onTypeChange?.(...args),
    onScreenShareStateChange: (...args) => callLifecycleRef.current.onScreenShareStateChange?.(...args)
  })

  // Состояния для звонков
  const [showCallModal, setShowCallModal] = useState(false)
  const [callType, setCallType] = useState('audio')
  const [callStatus, setCallStatus] = useState('ringing')
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const callSoundRef = useRef(null)
  const callTimerRef = useRef(null)
  const showCallModalRef = useRef(false)
  const incomingCallRef = useRef(null)
  const webrtcReadyRef = useRef(webrtcReady)
  const callTypeRef = useRef(callType)
  const callStatusRef = useRef(callStatus)
  const callUserRef = useRef(callUser)
  const activeCallIdRef = useRef(null)
  const activeCallPeerIdRef = useRef(null)

  const messagesEndRef = useRef(null)
  const messagesListRef = useRef(null)
  const pendingScrollToLatestRef = useRef(null) // chatId -> scroll to bottom once after loading finishes
  const selectedChatIdRef = useRef(null)
  const selectedChatRef = useRef(null)
  const loadMessagesSeqRef = useRef(0)
  const messageTouchTimersRef = useRef(new Map())
  const messageMouseTimersRef = useRef(new Map())
  const currentAudioRef = useRef(null)
  const recordingTimeoutRef = useRef(null)  // Таймер для различения клика и зажатия
  const sidebarSearchInputRef = useRef(null)

  const decryptedMessageCacheRef = useRef(new Map())
  const parsedMessageCacheRef = useRef(new Map())
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(max-width: 768px)').matches
  })
  const e2eeSecretKey = typeof secureStorage.getItem('secretKey') === 'string'
    ? secureStorage.getItem('secretKey')
    : ''

  // Функция расшифровки сообщений
  const base64ToUtf8 = (b64) => {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      return new TextDecoder('utf-8').decode(bytes)
    } catch (e) {
      return b64
    }
  }

  const decryptMessage = (text) => {
    if (!text) {
      return text
    }

    const cached = decryptedMessageCacheRef.current.get(text)
    if (cached !== undefined) {
      return cached
    }

    const trimmed = text.trim()
    if (isEncryptedEnvelope(trimmed) && user?.id && e2eeSecretKey) {
      try {
        const decrypted = decryptMessageEnvelope({
          ciphertext: trimmed,
          selfUserId: user.id,
          selfSecretKey: e2eeSecretKey
        })
        decryptedMessageCacheRef.current.set(text, decrypted)
        return decrypted
      } catch (error) {
        decryptedMessageCacheRef.current.set(text, '[Encrypted message]')
        return '[Encrypted message]'
      }
    }

    // Если уже JSON, возвращаем как есть
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      decryptedMessageCacheRef.current.set(text, trimmed)
      return trimmed
    }

    // Пытаемся расшифровать base64 (UTF-8)
    try {
      const decoded = base64ToUtf8(text)
      const trimmedDecoded = decoded.trim()

      if (trimmedDecoded.startsWith('{') || trimmedDecoded.startsWith('[')) {
        decryptedMessageCacheRef.current.set(text, trimmedDecoded)
        return trimmedDecoded
      }

      decryptedMessageCacheRef.current.set(text, decoded)
      return decoded
    } catch (e) {
      decryptedMessageCacheRef.current.set(text, text)
      return text
    }
  }

  const buildChatRecipients = useCallback((chat, groupInfoOverride = null) => {
    if (!chat || !user?.id || !user?.publicKey) return []

    const recipients = [{ userId: user.id, publicKey: user.publicKey }]
    const groupInfo = groupInfoOverride || groupSettings

    if (chat.type === 'private') {
      if (!chat.isSelf && chat.userId && chat.publicKey) {
        recipients.push({ userId: chat.userId, publicKey: chat.publicKey })
      }
      return recipients
    }

    const members = Array.isArray(groupInfo?.members) ? groupInfo.members : []
    members.forEach((member) => {
      if (member?.id && member?.publicKey) {
        recipients.push({ userId: member.id, publicKey: member.publicKey })
      }
    })

    return recipients
  }, [groupSettings, user?.id, user?.publicKey])

  const encryptContentForChat = useCallback((chat, plaintext, groupInfoOverride = null) => {
    if (!chat || !plaintext || !user?.id || !user?.publicKey || !e2eeSecretKey) {
      return plaintext
    }

    const recipients = buildChatRecipients(chat, groupInfoOverride)
    if (!recipients.length) return plaintext

    try {
      return encryptMessageEnvelope({
        plaintext,
        recipients,
        senderUserId: user.id,
        senderPublicKey: user.publicKey,
        senderSecretKey: e2eeSecretKey
      })
    } catch (error) {
      console.error('[E2EE] encrypt error:', error)
      return plaintext
    }
  }, [buildChatRecipients, e2eeSecretKey, user?.id, user?.publicKey])

  const preparedMessages = useMemo(() => {
    const normalizedSearch = (deferredChatHistorySearch || '').trim().toLowerCase()

    return safeMessages
      .map((msg, index) => {
        const decryptedText = decryptMessage(msg.content)
        const trimmedText = decryptedText?.trim() || ''

        if (normalizedSearch && !trimmedText.toLowerCase().includes(normalizedSearch)) {
          return null
        }

        let parsedMediaData = null
        if (trimmedText.startsWith('{')) {
          if (parsedMessageCacheRef.current.has(trimmedText)) {
            parsedMediaData = parsedMessageCacheRef.current.get(trimmedText)
          } else {
            parsedMediaData = parseMessageMedia(trimmedText)
            parsedMessageCacheRef.current.set(trimmedText, parsedMediaData)
          }
        }

        const isOwn = msg.senderId === user.id
        const isBot = msg.senderId === '00000000-0000-0000-0000-000000000001' || msg.isBot
        const isMediaMessage = isMediaMessagePayload(parsedMediaData)
        const prevMsg = safeMessages[index - 1]
        const isDifferentAuthor = !prevMsg || prevMsg.senderId !== msg.senderId

        return {
          msg,
          decryptedText,
          parsedMediaData,
          isOwn,
          isBot,
          isMediaMessage,
          marginBottom: isDifferentAuthor ? '16px' : '8px'
        }
      })
      .filter(Boolean)
  }, [safeMessages, deferredChatHistorySearch, user.id])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(max-width: 768px)')
    const handle = (e) => setIsMobileViewport(Boolean(e.matches))
    // Init
    setIsMobileViewport(Boolean(mql.matches))
    if (mql.addEventListener) mql.addEventListener('change', handle)
    else mql.addListener(handle)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handle)
      else mql.removeListener(handle)
    }
  }, [])

  const renderMessages = useMemo(() => {
    // On mobile we use column-reverse, so we reverse DOM order to keep chronological visual order.
    return isMobileViewport ? [...preparedMessages].reverse() : preparedMessages
  }, [isMobileViewport, preparedMessages])

  const scrollMessagesToBottom = useCallback((behavior = 'auto') => {
    const el = messagesListRef.current
    if (!el) return
    try {
      const dir = window.getComputedStyle(el).flexDirection || ''
      const top = dir.includes('reverse') ? 0 : el.scrollHeight
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top, behavior })
      } else {
        el.scrollTop = top
      }
    } catch (e) {}
  }, [])

  const isNearBottom = useCallback(() => {
    const el = messagesListRef.current
    if (!el) return true
    try {
      const dir = window.getComputedStyle(el).flexDirection || ''
      if (dir.includes('reverse')) {
        return el.scrollTop <= 48
      }
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
      return remaining <= 48
    } catch {
      return true
    }
  }, [])

  const isPinnedToBottomRef = useRef(true)
  useEffect(() => {
    const el = messagesListRef.current
    if (!el) return
    const onScroll = () => {
      isPinnedToBottomRef.current = isNearBottom()
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isNearBottom, isMobileViewport])

  // Авто-подстановка текста для редактирования
  useEffect(() => {
    if (!showEditModal) return
    const msgToEdit = safeMessages.find((m) => m.id === showEditModal)
    if (!msgToEdit) return
    const decrypted = decryptMessage(msgToEdit.content || '')
    setEditContent(decrypted || '')
  }, [showEditModal, safeMessages])

  const updateDmThemes = useCallback((updater) => {
    setDmThemes((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem('aegistalk_dm_themes_v1', JSON.stringify(next))
      } catch (e) {
        console.error('[DMTheme] Failed to save themes', e)
      }
      return next
    })
  }, [])

  const activeDmTheme =
    selectedChat?.type === 'private'
      ? dmThemes[selectedChat.chatId || selectedChat.id]
      : null

  const loadChats = useCallback(async () => {
    try {
      const chatsData = (await chatsAPI.getMyChats())
        .filter(chat => chat.username !== 'system-ai' && chat.name !== 'System AI')

      const processedChats = chatsData.map(chat => {
        if (chat.type === 'group' || chat.type === 'channel') {
          return {
            id: chat.id,  // Используем chat.id (UUID чата), а не groupId
            chatId: chat.id,
            groupId: chat.groupId,  // Сохраняем groupId для reference
            type: chat.type,
            name: chat.name,
            avatar: chat.avatar,
            lastMessage: chat.lastMessage,
            lastMessageTime: chat.lastMessageTime,
            createdAt: chat.createdAt
          }
        }
        const isUser1 = chat.user1_id === user.id
        const otherUserId = isUser1 ? chat.user2_id : chat.user1_id
        const processedChat = {
          id: chat.id,
          chatId: chat.id,
          type: chat.type,
          name: chat.name,
          avatar: chat.avatar,
          isOnline: chat.isOnline,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          createdAt: chat.createdAt,
          userId: otherUserId,
          isBot: chat.isBot || false,
          isAi: false,
          isSelf: chat.isSelf || false,
          username: chat.username,
          publicKey: chat.publicKey || ''
        };
        return processedChat;
      })

      const uniqueChats = []
      const seenIds = new Set()
      for (const chat of processedChats) {
        if (!seenIds.has(chat.id)) {
          seenIds.add(chat.id)
          uniqueChats.push(chat)
        }
      }

      setChats(uniqueChats)
      uniqueChats.forEach(chat => {
        const wsId = chat.chatId || chat.id
        if (wsId) {
          wsService.subscribe(wsId)
        }
      })
      
      // Автовыбор чата с ботом ТОЛЬКО если ещё ничего не выбрано
      // И у пользователя нет сохранённого последнего чата
      if (uniqueChats.length > 0 && !selectedChat && !window.lastSelectedChatId) {
        const botChat = uniqueChats.find(c => c.isBot || c.name === 'AegisBot' || c.username === 'AegisBot');
        if (botChat) {
          // Не вызываем selectChat сразу, даём пользователю выбрать самому
        }
      }

      return uniqueChats
    } catch (error) {
      console.error('Failed to load chats:', error)
      return []
    }
  }, [callType, callUser, cleanupWebRTC, endWebRTCCall, remoteStream, user.id, webrtcReady])

  const loadUsers = async (q = searchQuery) => {
    const requestId = ++usersSearchRequestRef.current
    try {
      const queryValue = typeof q === 'string' ? q.trim() : ''
      const normalizedQueryValue = queryValue.startsWith('@') ? queryValue.slice(1).trim() : queryValue

      if (!normalizedQueryValue || normalizedQueryValue.length < 2) {
        if (requestId === usersSearchRequestRef.current) {
          setUsers([])
        }
        return
      }

      const usersData = await usersAPI.searchUsers(normalizedQueryValue)
      if (requestId !== usersSearchRequestRef.current) {
        return
      }

      setUsers(Array.isArray(usersData) ? usersData : [])
    } catch (error) {
      if (requestId === usersSearchRequestRef.current) {
        setUsers([])
      }
    }
  }

  const loadGroups = async (q = searchQuery) => {
    const requestId = ++groupsSearchRequestRef.current
    try {
      const queryValue = typeof q === 'string' ? q.trim() : ''
      const normalizedQueryValue = queryValue.startsWith('@') ? queryValue.slice(1).trim().toLowerCase() : queryValue.toLowerCase()

      if (!normalizedQueryValue || normalizedQueryValue.length < 2) {
        if (requestId === groupsSearchRequestRef.current) {
          setGroups([])
        }
        return
      }

      const [myGroups, publicChannels] = await Promise.allSettled([
        groupsAPI.getMyGroups(),
        groupsAPI.getPublicChannels(normalizedQueryValue)
      ])

      if (requestId !== groupsSearchRequestRef.current) {
        return
      }

      const ownGroups = myGroups.status === 'fulfilled' && Array.isArray(myGroups.value)
        ? myGroups.value
        : []
      const searchableOwnGroups = ownGroups.filter(g => {
        const name = String(g.name || '').toLowerCase()
        const description = String(g.description || '').toLowerCase()
        return name.includes(normalizedQueryValue) || description.includes(normalizedQueryValue)
      })

      const openChannels = publicChannels.status === 'fulfilled' && Array.isArray(publicChannels.value)
        ? publicChannels.value.map(channel => ({
            ...channel,
            type: channel.type || 'channel',
            avatar: channel.avatar || channel.avatarUrl || null,
            description: channel.description || ''
          }))
        : []

      const mergedGroups = [...searchableOwnGroups, ...openChannels].filter((group, index, array) => (
        group?.id && array.findIndex(item => item?.id === group.id) === index
      ))

      setGroups(mergedGroups)
    } catch (error) {
      if (requestId === groupsSearchRequestRef.current) {
        setGroups([])
      }
    }
  }

  const createNewChat = async (targetUserId) => {
    try {
      const id = typeof targetUserId === 'string' ? targetUserId.trim() : ''
      // Avoid 400s from the backend validator and make the UX clearer.
      // "Loose" UUID check (allows system users like 000...0002).
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      if (!isUuid) {
        alert('Некорректный ID пользователя')
        return
      }

      const result = await chatsAPI.createChat(id)
      setShowNewChatModal(false)
      setSearchQuery('')
      const updatedChats = await loadChats()
      const createdChat = updatedChats.find(chat => chat.id === result.id || chat.chatId === result.id)
      if (createdChat) {
        selectChat(createdChat)
        return
      }

      const fallbackChat = { id: result.id, chatId: result.id, type: 'private' }
      selectChat(fallbackChat)
    } catch (error) {
      console.error('Failed to create chat:', error)
      alert(error?.message || 'Не удалось создать чат')
    }
  }

  const createGroup = async (payload) => {
    if (!payload?.name?.trim()) {
      alert('Введите название группы')
      return
    }

    try {
      const result = await groupsAPI.createGroup({
        name: payload.name.trim(),
        description: payload.description?.trim() || '',
        type: payload.type || 'group',
        isPublic: payload.type === 'channel' ? !!payload.isPublic : false
      })

      setShowNewGroupModal(false)
      await loadChats()
      const newGroup = { id: result.id, type: result.type, name: result.name }
      selectChat(newGroup)
    } catch (error) {
      console.error('Failed to create group:', error)
      alert('Ошибка при создании: ' + (error.message || 'Неизвестная ошибка'))
    }
  }

  const loadGroupSettings = async (groupId) => {
    try {
      const groupInfo = await groupsAPI.getGroupInfo(groupId)
      setGroupSettings(groupInfo)
      // Загружаем участников для панели
      if (groupInfo.members) {
        setChannelMembers(groupInfo.members)
      }
      setShowChannelSettingsModal(true)
    } catch (error) {
      console.error('[LoadGroupSettings] Failed to load group settings:', error);
      alert('Ошибка загрузки настроек: ' + (error.message || 'Неизвестная ошибка'));
    }
  }

  const refreshCurrentGroupInfo = async (groupIdOverride = null) => {
    const groupId = groupIdOverride || groupSettings?.id || selectedChat?.id
    if (!groupId) return null

    const groupInfo = await groupsAPI.getGroupInfo(groupId)
    setGroupSettings(groupInfo)
    setChannelMembers(groupInfo.members || [])
    setSelectedChat(prev => prev ? {
      ...prev,
      myRole: groupInfo.myRole,
      name: groupInfo.name || prev.name,
      avatar: groupInfo.avatarUrl || prev.avatar,
      description: groupInfo.description || prev.description,
      gradientTheme: groupInfo.gradientTheme || prev.gradientTheme,
      backgroundImageUrl: groupInfo.backgroundImageUrl || prev.backgroundImageUrl
    } : prev)
    return groupInfo
  }

  const handleUpdateMembers = async () => {
    try {
      await refreshCurrentGroupInfo(groupSettings?.id)
    } catch (error) {
      console.error('Failed to update members:', error)
      alert('??????: ' + error.message)
    }
  }

  const handleAddMemberToGroup = async (targetUser) => {
    const targetUserId = typeof targetUser === 'string' ? targetUser : targetUser?.id
    if (!targetUserId) {
      throw new Error('?? ??????? ?????????? ???????????? ??? ??????????')
    }

    const groupId = groupSettings?.id || selectedChat?.id
    await groupsAPI.addMember(groupId, targetUserId)
    await refreshCurrentGroupInfo(groupId)
    await loadChats()
    setShowAddMemberModal(false)
  }

  const handleChangeMemberRole = async (targetUserId, role) => {
    try {
      const groupId = groupSettings?.id || selectedChat?.id
      await groupsAPI.updateMemberRole(groupId, targetUserId, role)
      await refreshCurrentGroupInfo(groupId)
    } catch (error) {
      console.error('Failed to update member role:', error)
      alert('??????: ' + error.message)
      throw error
    }
  }

  // ?????????? ??????????? ??????
  const handlePromote = async (userId) => {
    try {
      const groupId = groupSettings?.id || selectedChat?.id
      await groupsAPI.promoteMember(groupId, userId)
      await refreshCurrentGroupInfo(groupId)
    } catch (error) {
      console.error('Failed to promote:', error)
      alert('??????: ' + error.message)
    }
  }

  const handleDemote = async (userId) => {
    try {
      const groupId = groupSettings?.id || selectedChat?.id
      await groupsAPI.demoteMember(groupId, userId)
      await refreshCurrentGroupInfo(groupId)
    } catch (error) {
      console.error('Failed to demote:', error)
      alert('??????: ' + error.message)
    }
  }

  const handleKick = async (userId) => {
    try {
      const groupId = groupSettings?.id || selectedChat?.id
      await groupsAPI.removeMember(groupId, userId)
      await refreshCurrentGroupInfo(groupId)
    } catch (error) {
      console.error('Failed to kick:', error)
      alert('??????: ' + error.message)
    }
  }

  const handleOpenProfile = async (fromMessage = false) => {
    if (!selectedChat || selectedChat.type === 'channel' || selectedChat.type === 'group') return

    try {
      // Получаем информацию о пользователе из текущего чата
      const userProfile = {
        id: selectedChat.userId,
        firstName: selectedChat.name.split(' ')[0],
        lastName: selectedChat.name.split(' ')[1] || '',
        username: selectedChat.username || '',
        avatarUrl: selectedChat.avatar || null,
        isOnline: isUserOnline(selectedChat.userId),
        lastSeen: selectedChat.lastSeen || null
      }

      setSelectedUserProfile(userProfile)
      setProfileFromMessage(fromMessage)
      setShowProfileSidebar(true)
    } catch (error) {
      console.error('[OpenProfile] Error:', error)
    }
  }

  // Начало звонка
  const startCall = async (type) => {
    if (!user?.id) {
      alert('Ошибка: пользователь не авторизован')
      return
    }

    const receiverId = selectedChat?.userId || selectedChat?.id

    if (!receiverId) {
      alert('Ошибка: невозможно определить получателя')
      return
    }

    if (selectedChat?.isSelf || receiverId === user.id) {
      alert('Нельзя звонить самому себе')
      return
    }

    try {
      const callerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || 'Contact'
      const callerAvatar = user?.avatarUrl || user?.avatar || user?.photoURL || null

      setCallType(type)
      setCallStatus('ringing')
      setIsMuted(false)
      setShowCallModal(true)

      const callId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      activeCallIdRef.current = callId
      activeCallPeerIdRef.current = receiverId

      if (wsService.ws?.readyState === WebSocket.OPEN) {
        wsService.ws.send(JSON.stringify({
          type: 'call_offer',
          callId,
          callerId: user.id,
          receiverId: receiverId,
          callType: type,
          callerName,
          callerAvatar
        }))
      }

      playCallSound()

      if (webrtcReady) {
        callUser(receiverId, type === 'video').catch((error) => {
          console.error('[StartCall] prepareLocalStream error:', error)
          resetCallState('ended')
          alert(error.message || 'Microphone access is required for calls')
        })
      }

    } catch (error) {
      alert('Ошибка: ' + error.message)
      setShowCallModal(false)
    }
  }

  // Завершение звонка
  const endCall = async () => {
    // Останавливаем таймер
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    
    try {
      const durationStr = formatCallDuration(callDuration)
      const emoji = callType === 'video' ? '📹' : '📞'
      const messageContent = `${emoji} Звонок (${durationStr})`

      try {
        if (selectedChat?.chatId || selectedChat?.id) {
          const encryptedContent = encryptContentForChat(selectedChat, messageContent)
          await messagesAPI.sendMessage(
            selectedChat.chatId || selectedChat.id,
            encryptedContent,
            { type: 'system', senderPublicKey: user.publicKey || '' }
          );
        }
      } catch (e) {
        console.error('[Call] Failed to send call message:', e);
      }
      
        if (wsService.ws?.readyState === WebSocket.OPEN) {
          wsService.ws.send(JSON.stringify({
            type: 'call_end',
            callerId: user.id,
            receiverId: activeCallPeerIdRef.current || selectedChat?.userId || selectedChat?.id,
            callId: activeCallIdRef.current
          }))
        }
      } catch (error) {}

    endWebRTCCall()
    resetCallState('ringing')
  }

  // Переключение с аудиозвонка на видеозвонок
  const switchToVideoCall = async (shareScreenAfterConnect = false) => {
    const targetUserId =
      activeCallPeerIdRef.current ||
      incomingCallRef.current?.callerId ||
      selectedChat?.userId ||
      selectedChat?.id
    if (!targetUserId || !webrtcReady) return

    activeCallPeerIdRef.current = targetUserId
    setCallType('video')
    setShowCallModal(true)

    try {
      isSwitchingCallRef.current = true
      await upgradeToVideo()
      setCallStatus('connected')
      if (wsService.ws?.readyState === WebSocket.OPEN) {
        wsService.ws.send(JSON.stringify({
          type: 'call_type_change',
          callId: activeCallIdRef.current,
          targetUserId,
          callType: 'video'
        }))
      }
      if (shareScreenAfterConnect) {
        await handleToggleScreenShare()
      }
    } catch (e) {
      console.error('[SwitchToVideo] Error:', e)
      resetCallState('ended')
    } finally {
      setTimeout(() => {
        isSwitchingCallRef.current = false
      }, 150)
    }
  }

  const handleToggleScreenShare = async () => {
    const targetUserId =
      activeCallPeerIdRef.current ||
      incomingCallRef.current?.callerId ||
      selectedChat?.userId ||
      selectedChat?.id

    if (!targetUserId || !webrtcReady) return false

    const wasSharing = isScreenSharing

    try {
      const result = await toggleScreenShare()
      const active = typeof result === 'object' ? Boolean(result.active) : Boolean(result)
      const nextType =
        typeof result === 'object' && (result.nextType === 'video' || result.nextType === 'audio')
          ? result.nextType
          : (active ? 'video' : callTypeRef.current)

      if (result?.unsupported) {
        toast.error('В этом браузере демонстрация экрана недоступна')
        return false
      }

      if (result?.cancelled) {
        return false
      }

      setIsScreenSharing(active)
      if (nextType === 'video' || nextType === 'audio') {
        setCallType(nextType)
      }
      setShowCallModal(true)
      setCallStatus('connected')

      if (wsService.ws?.readyState === WebSocket.OPEN) {
        wsService.ws.send(JSON.stringify({
          type: 'call_type_change',
          callId: activeCallIdRef.current,
          targetUserId,
          callType: nextType === 'video' ? 'video' : 'audio'
        }))
      }

      if (!wasSharing && !active) {
        const isMobileBrowser =
          typeof navigator !== 'undefined' &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
        toast.error(
          isMobileBrowser
            ? 'На мобильном браузере демонстрация экрана может не поддерживаться'
            : (result?.errorMessage || 'Не удалось включить демонстрацию экрана')
        )
      }

      return active
    } catch (error) {
      console.error('[ScreenShare] Error:', error)
      toast.error('Не удалось включить демонстрацию экрана')
      return false
    }
  }

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Отклонение входящего звонка
  const rejectCall = async () => {
    if (!incomingCall) return
    const rejectedCallId = incomingCall.id
    const rejectedCallerId = incomingCall.callerId
    try {
      if (wsService.ws?.readyState === WebSocket.OPEN) {
        wsService.ws.send(JSON.stringify({
          type: 'call_rejected',
          callId: rejectedCallId,
          receiverId: user.id,
          callerId: rejectedCallerId
        }))
      }
      rejectIncomingWebRTCCall()
    } catch (error) {}
    activeCallIdRef.current = null
    activeCallPeerIdRef.current = null
    resetCallState('ended')
  }

  // Принятие входящего звонка
  const acceptCall = async () => {
    if (!incomingCall) return
    const acceptedCall = incomingCall

    activeCallIdRef.current = acceptedCall.id
    activeCallPeerIdRef.current = acceptedCall.callerId
    incomingCallRef.current = null
    showCallModalRef.current = true
    callStatusRef.current = 'connected'

    setIncomingCall(null)
    setShowCallModal(true)
    setCallType(acceptedCall.type)
    setCallStatus('connected')
    setIsMuted(false)
    setCallDuration(0)
    stopCallSound()

    try {
      if (webrtcReady) {
        await prepareLocalStream(acceptedCall.type === 'video')
      }
      
      if (wsService.ws?.readyState === WebSocket.OPEN) {
        wsService.ws.send(JSON.stringify({
          type: 'call_accepted',
          callId: acceptedCall.id,
          receiverId: user.id,
          callerId: acceptedCall.callerId,
          callType: acceptedCall.type
        }))
      }

      await answerIncomingWebRTCCall(acceptedCall.type === 'video')
      
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      
    } catch (error) {
      console.error('[AcceptCall] Error:', error)
      resetCallState('ended')
      alert(error.message || 'Microphone access is required to answer the call')
    }
  }

  // Отключение микрофона
  const toggleMute = useCallback(async () => {
    try {
      const muted = await toggleWebRTCMute()
      setIsMuted(muted)
    } catch (error) {
      console.error('[ToggleMute] Error:', error)
    }
  }, [toggleWebRTCMute])

  const playCallSound = () => {
    try {
      const userActivated = typeof navigator === 'undefined'
        ? true
        : Boolean(navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)

      if (!userActivated) {
        return
      }

      // Останавливаем предыдущий звук, если он ещё играет
      if (callSoundRef.current) {
        if (callSoundRef.current.intervalId) {
          clearInterval(callSoundRef.current.intervalId)
        }
        if (callSoundRef.current.ctx && callSoundRef.current.ctx.state !== 'closed') {
          callSoundRef.current.ctx.close()
        }
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return

      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      const gain = ctx.createGain()
      gain.gain.value = 0.0
      gain.connect(ctx.destination)

      const playPattern = () => {
        const now = ctx.currentTime

        const tones = [
          { freq: 740, start: 0.0, duration: 0.16, gain: 0.30 },
          { freq: 1046, start: 0.18, duration: 0.16, gain: 0.34 },
          { freq: 1318, start: 0.36, duration: 0.16, gain: 0.38 },
          { freq: 1046, start: 0.66, duration: 0.18, gain: 0.28 },
          { freq: 784, start: 0.88, duration: 0.24, gain: 0.24 }
        ]

        tones.forEach(t => {
          const osc = ctx.createOscillator()
          const toneGain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = t.freq

          osc.connect(toneGain)
          toneGain.connect(gain)

          const startTime = now + t.start
          const endTime = startTime + t.duration

          toneGain.gain.setValueAtTime(0.0, startTime)
          toneGain.gain.linearRampToValueAtTime(t.gain || 0.34, startTime + 0.04)
          toneGain.gain.linearRampToValueAtTime(0.0, endTime)

          osc.start(startTime)
          osc.stop(endTime + 0.05)
        })
      }

      // Первое проигрывание сразу
      playPattern()
      // Повторяем уникальный паттерн каждые ~1.1 секунды
      const intervalId = setInterval(playPattern, 1500)

      callSoundRef.current = { ctx, intervalId }
    } catch (e) {
      console.error('[CallSound] Failed to play sound:', e)
    }
  }

  const stopCallSound = () => {
    const active = callSoundRef.current
    if (!active) return

    try {
      if (active.intervalId) {
        clearInterval(active.intervalId)
      }
      if (active.ctx && active.ctx.state !== 'closed') {
        active.ctx.close()
      }
    } catch (e) {
      console.error('[CallSound] Failed to stop sound:', e)
    } finally {
      callSoundRef.current = null
    }
  }

  const resetCallState = useCallback((nextStatus = 'ringing') => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    activeCallIdRef.current = null
    activeCallPeerIdRef.current = null

    setIncomingCall(null)
    setShowCallModal(false)
    setCallStatus(nextStatus)
    setIsMuted(false)
    setIsScreenSharing(false)
    setCallDuration(0)

    stopCallSound()
    cleanupWebRTC()
  }, [cleanupWebRTC])

  useEffect(() => {
    callLifecycleRef.current.onClosed = () => {
      if (isSwitchingCallRef.current) return
      if (!showCallModalRef.current && !incomingCallRef.current) return
      resetCallState('ended')
    }

    callLifecycleRef.current.onError = (message) => {
      if (isSwitchingCallRef.current) return
      console.error('[WebRTC] Call error:', message)
    }

    callLifecycleRef.current.onConnected = () => {
      setCallStatus('connected')
      stopCallSound()

      if (!callTimerRef.current) {
        setCallDuration(0)
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      }
    }

    callLifecycleRef.current.shouldAutoAnswer = ({ peerId }) => {
      return (
        showCallModalRef.current &&
        callStatusRef.current === 'connected' &&
        Boolean(activeCallPeerIdRef.current) &&
        activeCallPeerIdRef.current === peerId
      )
    }

    callLifecycleRef.current.onIncomingCall = ({ peerId, metadata }) => {
      if (!peerId) return
      if (showCallModalRef.current || incomingCallRef.current) return

      const callerChat = chatsRef.current.find(
        (chat) => chat?.userId === peerId || chat?.id === peerId || chat?.chatId === peerId
      )

      activeCallPeerIdRef.current = peerId
      setCallType(metadata?.video ? 'video' : 'audio')
      setCallStatus('ringing')
      setShowCallModal(false)
      setIncomingCall({
        id: activeCallIdRef.current || `${Date.now()}-${peerId}`,
        callerId: peerId,
        callerNameResolved: callerChat?.name || 'Контакт',
        callerAvatar: callerChat?.avatar || null,
        callerName: 'Звонящий',
        type: metadata?.video ? 'video' : 'audio',
        status: 'ringing'
      })
      playCallSound()
    }

    callLifecycleRef.current.onTypeChange = (nextType) => {
      if (nextType === 'video' || nextType === 'audio') {
        setCallType(nextType)
      }
      setShowCallModal(true)
      setCallStatus('connected')
      setIncomingCall(null)
    }

    callLifecycleRef.current.onScreenShareStateChange = ({ active }) => {
      setIsScreenSharing(Boolean(active))
      if (!active && callTypeRef.current !== 'video') {
        setCallType('audio')
      }
    }
  }, [resetCallState])

  // Открытие профиля конкретного пользователя (из сообщения)
  const handleOpenUserProfile = async (senderId, senderName, senderAvatar) => {
    try {
      // Если это канал - показываем информацию о канале
      if (selectedChat?.type === 'channel' || selectedChat?.type === 'group') {
        // Для канала открываем настройки канала
        if (groupSettings) {
          setShowChannelSettingsModal(true)
        }
        return
      }
      
      // Для личного чата - открываем профиль собеседника
      const userProfile = {
        id: senderId,
        firstName: senderName?.split(' ')[0] || 'Пользователь',
        lastName: senderName?.split(' ').slice(1).join(' ') || '',
        username: '',
        avatarUrl: senderAvatar || null,
        isOnline: isUserOnline(senderId),
        lastSeen: null
      }
      
      setSelectedUserProfile(userProfile)
      setProfileFromMessage(true)
      setShowProfileSidebar(true)
    } catch (error) {
      console.error('[OpenUserProfile] Error:', error)
    }
  }

  // Переключение на личную переписку из профиля
  const handleSwitchToPrivateChat = async (targetUserId, targetUserName) => {
    try {
      // Закрываем профиль
      setShowProfileSidebar(false);

      // Ищем существующий чат с этим пользователем
      const existingChat = chats.find(chat =>
        chat.type === 'private' &&
        (chat.userId === targetUserId || chat.id === targetUserId)
      );

      if (existingChat) {
        // Переключаемся на существующий чат
        selectChat(existingChat);
      } else {
        // Создаём новый чат через API
        const newChat = await chatsAPI.createChat(targetUserId);

        // Обновляем список чатов и переключаемся
        const updatedChats = await loadChats();
        const createdChat = updatedChats.find(c => c.id === newChat.id || c.chatId === newChat.id);
        if (createdChat) {
          selectChat(createdChat);
        }
      }
    } catch (error) {
      console.error('[SwitchToPrivateChat] Error:', error);
      alert('Ошибка при переключении на чат: ' + error.message);
    }
  };

  // Переключение на другой чат из профиля
  const handleSwitchChat = (chat) => {
    if (!chat) return;
    
    setShowProfileSidebar(false);
    
    // Находим чат в списке
    const chatToSwitch = chats.find(c => c.id === chat.id || c.chatId === chat.id);
    if (chatToSwitch) {
      selectChat(chatToSwitch);
    }
  };

  const saveChannelSettings = async (settings) => {
    try {
      const payload = {
        name: settings.name,
        description: settings.description,
        externalLink: settings.externalLink ?? settings.external_link ?? null,
        gradientTheme: settings.gradientTheme,
        backgroundImageUrl: settings.backgroundImageUrl ?? null,
        reactionsEnabled: settings.reactionsEnabled,
        discussionChatId: settings.discussionChatId,
        allowMemberInvites: settings.allowMemberInvites,
        isPublic: settings.isPublic
      }

      const result = await groupsAPI.updateGroup(groupSettings.id, payload)
      setShowChannelSettingsModal(false)

      // Перезагружаем полные настройки из API
      const updatedGroupInfo = await groupsAPI.getGroupInfo(groupSettings.id)

      // Обновляем groupSettings полностью
      setGroupSettings(updatedGroupInfo)
      
      // Обновляем selectedChat с ВСЕМИ полями из updatedGroupInfo
      setSelectedChat(prev => ({
        ...prev,
        name: updatedGroupInfo.name || prev.name,
        avatar: updatedGroupInfo.avatarUrl || prev.avatar,
        description: updatedGroupInfo.description || prev.description,
        externalLink: updatedGroupInfo.externalLink || null,
        siteVerificationStatus: updatedGroupInfo.siteVerificationStatus || 'none',
        gradientTheme: updatedGroupInfo.gradientTheme || prev.gradientTheme,
        backgroundImageUrl: updatedGroupInfo.backgroundImageUrl || null
      }))
      
      await loadChats()
      showToast('Настройки канала сохранены')
    } catch (error) {
      console.error('Failed to save channel settings:', error)
      showToast('Ошибка при сохранении настроек')
      throw error
    }
  }

  const handleCreateDiscussion = async () => {
    const groupId = groupSettings?.id || selectedChat?.id
    if (!groupId) {
      throw new Error('Канал не выбран')
    }

    const result = await groupsAPI.linkDiscussionGroup(groupId)
    const updatedGroupInfo = await refreshCurrentGroupInfo(groupId)
    await loadChats()

    if (updatedGroupInfo?.discussionChatId) {
      setSelectedChat(prev => prev ? {
        ...prev,
        discussionChatId: updatedGroupInfo.discussionChatId
      } : prev)
    }

    showToast(result?.message || 'Обсуждение создано')
    return {
      ...result,
      discussionChatId: updatedGroupInfo?.discussionChatId || result?.discussionChatId || null
    }
  }

  const handleVerifySite = async () => {
    if (!groupSettings?.id) return
    try {
      const res = await groupsAPI.verifySite(groupSettings.id)
      const updatedGroupInfo = await groupsAPI.getGroupInfo(groupSettings.id)
      setGroupSettings(updatedGroupInfo)
      setSelectedChat(prev => ({
        ...prev,
        externalLink: updatedGroupInfo.externalLink || prev.externalLink,
        siteVerificationStatus: updatedGroupInfo.siteVerificationStatus || 'none'
      }))
      showToast('Сайт подтвержден')
      return res
    } catch (error) {
      showToast(error.message || 'Не удалось подтвердить сайт')
      throw error
    }
  }

  const handleSaveExternalLink = async (value) => {
    if (!groupSettings?.id) return
    try {
      await groupsAPI.updateGroup(groupSettings.id, { external_link: value })
      const updatedGroupInfo = await groupsAPI.getGroupInfo(groupSettings.id)
      setGroupSettings(updatedGroupInfo)
      setSelectedChat(prev => ({
        ...prev,
        externalLink: updatedGroupInfo.externalLink || null,
        siteVerificationStatus: updatedGroupInfo.siteVerificationStatus || 'none'
      }))
      showToast('Ссылка сохранена')
    } catch (error) {
      showToast(error.message || 'Не удалось сохранить ссылку')
    }
  }

  const handleDeleteCurrentGroup = async () => {
    const targetGroupId = groupSettings?.id || selectedChat?.groupId || null
    if (!targetGroupId) {
      showToast('Группа или канал не выбран')
      return
    }

    const targetName = groupSettings?.name || selectedChat?.name || 'этот чат'
    if (!window.confirm(`Удалить "${targetName}"? Это действие нельзя отменить.`)) {
      return
    }

    try {
      const result = await groupsAPI.deleteGroup(targetGroupId)
      const deletedGroupIds = Array.isArray(result?.deletedGroupIds) && result.deletedGroupIds.length > 0
        ? result.deletedGroupIds
        : [targetGroupId]
      const deletedChatIds = Array.isArray(result?.deletedChatIds) ? result.deletedChatIds : []
      const deletedGroupSet = new Set(deletedGroupIds.map(String))
      const deletedChatSet = new Set(deletedChatIds.map(String))

      setChats((prev) => prev.filter((chat) => (
        !deletedGroupSet.has(String(chat.groupId || '')) &&
        !deletedChatSet.has(String(chat.chatId || chat.id || ''))
      )))

      setUnreadCounts((prev) => {
        const next = { ...prev }
        deletedChatIds.forEach((chatId) => {
          delete next[chatId]
        })
        return next
      })

      const currentSelectedChatId = String(selectedChatIdRef.current || selectedChat?.chatId || selectedChat?.id || '')
      const currentSelectedGroupId = String(selectedChat?.groupId || '')
      const shouldClearSelectedChat =
        deletedChatSet.has(currentSelectedChatId) ||
        deletedGroupSet.has(currentSelectedGroupId)

      setShowChannelSettingsModal(false)
      setShowMembersPanel(false)
      setChannelMembers([])
      setGroupSettings((prev) => (prev && deletedGroupSet.has(String(prev.id)) ? null : prev))

      if (shouldClearSelectedChat) {
        selectedChatIdRef.current = null
        setSelectedChat(null)
        setMessages([])
        setMessagesLoadError(null)
        setMessageReactions({})
        setPinnedMessage(null)
        setShowChatActionsMenu(false)
        setShowDeleteChatOptions(false)
        setShowMobileChat(false)
        setShowChatList(true)
      }

      await loadChats()
      showToast(result?.message || 'Чат удалён')
    } catch (error) {
      console.error('Failed to delete group:', error)
      showToast(error.message || 'Не удалось удалить чат')
    }
  }

  const loadMessages = async (chatId, chat = null) => {
    const reqSeq = ++loadMessagesSeqRef.current
    const targetChatId = chatId

    if (!chatId) {
      console.error('[LoadMessages] chatId is undefined!');
      startTransition(() => {
        setMessages([])
      })
      return;
    }

    // Avoid "page refresh" feel on reconnect: keep current messages until we have a new snapshot,
    // but clear immediately when switching to a different chat.
    const currentChatId = selectedChatRef.current?.chatId || selectedChatRef.current?.id
    const isSameChat = currentChatId && String(currentChatId) === String(chatId)
    if (!isSameChat) {
      startTransition(() => {
        setMessages([])
      })
    }
    setMessagesLoadError(null)
    setMessageReactions({})

    try {
      const messagesData = await messagesAPI.getMessages(chatId);
      if (!Array.isArray(messagesData)) {
        throw new Error('messages payload is not an array')
      }
      // Преобразуем snake_case в camelCase для совместимости
      const formattedMessages = messagesData.map(msg => ({
        ...msg,
        createdAt: msg.created_at || msg.createdAt,
        chatId: msg.chat_id || msg.chatId,
        senderId: msg.sender_id || msg.senderId,
        // Бэкенд может возвращать content_encrypted, а фронтенд ожидает content
        content: msg.content || msg.content_encrypted || ''
      }));

      startTransition(() => {
        // Guard against race: if new WS messages arrived while the HTTP fetch was in-flight,
        // don't overwrite them (this is the main reason users needed F5).
        if (reqSeq !== loadMessagesSeqRef.current) return
        const currentChatId = selectedChatRef.current?.chatId || selectedChatRef.current?.id
        if (currentChatId && String(currentChatId) !== String(targetChatId)) return

        setMessages(prev => {
          const byId = new Map()
          const sameChatPrevMessages = prev.filter((m) => {
            const prevChatId = m?.chatId || m?.chat_id
            return prevChatId && String(prevChatId) === String(targetChatId)
          })

          // Server snapshot first...
          for (const m of formattedMessages) {
            if (!m?.id) continue
            byId.set(m.id, m)
          }
          // ...then overlay any newer/live data already in state.
          for (const m of sameChatPrevMessages) {
            if (!m?.id) continue
            const existing = byId.get(m.id)
            byId.set(m.id, existing ? { ...existing, ...m } : m)
          }

          const merged = Array.from(byId.values())
          merged.sort((a, b) => {
            const at = Date.parse(a.createdAt || a.created_at || '') || 0
            const bt = Date.parse(b.createdAt || b.created_at || '') || 0
            return at - bt
          })
          return merged
        })
      })

      // Реакции грузим одним запросом (batch), чтобы не спамить БД сотнями SELECT'ов.
      try {
        if (reqSeq !== loadMessagesSeqRef.current) return
        const messageIds = messagesData.map((m) => m.id).filter(Boolean)
        if (messageIds.length && msgAPI.getReactionsBatch) {
          const reactionsMap = await msgAPI.getReactionsBatch(messageIds)
          if (reactionsMap && typeof reactionsMap === 'object') {
            setMessageReactions(reactionsMap)
          }
        }
      } catch (e) {
        console.error('[LoadMessages] Failed to load reactions batch:', e)
      }
    } catch (error) {
      console.error('[LoadMessages] Failed to load messages:', error)
      setMessagesLoadError(error?.message || 'Не удалось загрузить сообщения')
    }
  }

  const appendLocalMessage = useCallback((message, fallbackChatId) => {
    if (!message?.id) return

    const normalizedMessage = {
      ...message,
      createdAt: message.createdAt || message.created_at || new Date().toISOString(),
      chatId: message.chatId || message.chat_id || fallbackChatId,
      senderId: message.senderId || message.sender_id || user.id,
      type: message.type || message.message_type || 'text',
      content: message.content || ''
    }

    startTransition(() => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === normalizedMessage.id)) {
          return prev
        }
        return [...prev, normalizedMessage]
      })
    })

    setTimeout(() => {
      scrollMessagesToBottom('smooth')
    }, 60)
  }, [user.id, scrollMessagesToBottom])

  const replaceLocalMessage = useCallback((tempId, message, fallbackChatId) => {
    if (!tempId || !message?.id) return

    const normalizedMessage = {
      ...message,
      createdAt: message.createdAt || message.created_at || new Date().toISOString(),
      chatId: message.chatId || message.chat_id || fallbackChatId,
      senderId: message.senderId || message.sender_id || user.id,
      type: message.type || message.message_type || 'text',
      content: message.content || ''
    }

    startTransition(() => {
      setMessages((prev) =>
        prev.map((item) => (item.id === tempId ? normalizedMessage : item))
      )
    })
  }, [user.id])

  // Отправка медиа-сообщений (объявляем ПЕРЕД handleStartRecording/handleStopRecording)
  const handleMediaMessage = useCallback(async ({ type, url, duration }) => {
    if (!selectedChat) {
      console.error('[handleMediaMessage] No selected chat')
      return
    }

    // Проверяем права для канала
    if (selectedChat.type === 'channel' && groupSettings?.myRole === 'member') {
      alert('📢 Только администраторы могут писать в этом канале')
      return
    }

    try {
      const content = JSON.stringify({
        type: type,
        url: url,
        duration: duration
      })
      const encryptedContent = encryptContentForChat(selectedChat, content)

      const response = await messagesAPI.sendMessage(
        selectedChat.chatId || selectedChat.id,
        encryptedContent,
        { type: type, senderPublicKey: user.publicKey || '' }
      )
      appendLocalMessage(response, selectedChat.chatId || selectedChat.id)
      updateChatPreview(
        response.chat_id || selectedChat.chatId || selectedChat.id,
        content,
        response.created_at || new Date().toISOString()
      )

      // Обновляем чаты асинхронно
      loadChats().catch(err => console.error('[handleMediaMessage] loadChats error:', err))
    } catch (error) {
      console.error('[handleMediaMessage] Error:', error)
      alert('Ошибка при отправке медиа: ' + error.message)
    }
  }, [appendLocalMessage, encryptContentForChat, selectedChat, groupSettings, loadChats, user.id, user.publicKey])

  // Обработка остановки записи (кнопка "Отправить" в панели записи)
  const handleStopRecording = useCallback(async () => {
    if (recordingLifecycleRef.current.stopping || recordingLifecycleRef.current.canceling) return
    if (!isRecordingUI) return

    recordingLifecycleRef.current.stopping = true

    // Мгновенно возвращаем обычный UI, не дожидаясь upload/БД.
    setIsRecordingUI(false)

    try {
      const result = await stopRecording()
      if (!result) return

      const blob = result.blob
      const duration = result.duration || 0
      const messageType = result.type || 'voice'

      const file = new File([blob], `${messageType}_${Date.now()}.webm`, { type: blob.type })
      const resultUpload = await uploadFile(file, user.id)

      if (resultUpload.success) {
        handleMediaMessage({
          type: messageType === 'video' ? 'video-circle' : 'voice',
          url: resultUpload.url,
          duration
        })
      } else {
        alert('Ошибка загрузки: ' + resultUpload.error)
      }
    } catch (err) {
      if (String(err?.message || '').includes('не инициализирован')) return
      console.error('[App] stopRecording error:', err)
      toast.error(err?.message || 'Ошибка записи')
    } finally {
      recordingLifecycleRef.current.stopping = false
    }
  }, [handleMediaMessage, isRecordingUI, stopRecording, user.id])

  // Обработка отмены записи (корзина) — без upload/запросов в БД.
  const handleCancelRecording = useCallback(() => {
    if (recordingLifecycleRef.current.starting || recordingLifecycleRef.current.stopping || recordingLifecycleRef.current.canceling) return
    if (!isRecordingUI) return

    recordingLifecycleRef.current.canceling = true
    setIsRecordingUI(false)
    try {
      cancelRecording()
    } catch (err) {
      console.error('[App] cancelRecording error:', err)
    } finally {
      recordingLifecycleRef.current.canceling = false
    }
  }, [cancelRecording, isRecordingUI])

  // Обработка начала записи (кнопка микрофона)
  const handleStartRecording = useCallback(async (initialType = 'audio') => {
    if (recordingLifecycleRef.current.starting || recordingLifecycleRef.current.stopping || recordingLifecycleRef.current.canceling) return
    if (isRecordingUI) return

    recordingLifecycleRef.current.starting = true
    setRecordingMode(initialType)

    try {
      await startRecording(initialType)
      setIsRecordingUI(true)
    } catch (err) {
      console.error('[App] startRecording error:', err)
      // Важно: если микрофон недоступен — НЕ меняем UI, чтобы избежать мерцания.
      alert(initialType === 'video' ? 'Камера или микрофон не доступны' : 'Микрофон не доступен')
      setIsRecordingUI(false)
    } finally {
      recordingLifecycleRef.current.starting = false
    }
  }, [isRecordingUI, startRecording])

  const [isSending, setIsSending] = useState(false);  // Флаг для защиты от дублирования
  const isSendingRef = useRef(false);

  const getChatPreviewText = (content) => {
    const rawContent = typeof content === 'string' ? content : content?.content || ''
    if (!rawContent) return ''
    return getMessagePreviewLabel(rawContent) || rawContent
  }

  const updateChatPreview = (chatId, content, createdAt = new Date().toISOString()) => {
    if (!chatId) return

    const previewText = getChatPreviewText(content)
    setChats(prev => {
      const next = [...prev]
      const index = next.findIndex(chat => (chat.chatId || chat.id) === chatId || chat.id === chatId)
      if (index === -1) return prev

      const updatedChat = {
        ...next[index],
        lastMessage: previewText,
        lastMessageTime: createdAt,
        last_message_time: createdAt
      }

      next.splice(index, 1)
      next.unshift(updatedChat)
      return next
    })
  }

  const sendMessage = async () => {
    // Защита от дублирования
    if (isSendingRef.current || isSending) {
      return;
    }


    if (!messageInput.trim() || !selectedChat) {
      console.error('[SendMessage] No message or no chat');
      return;
    }

    if (selectedChat.type === 'channel' && groupSettings?.myRole === 'member') {
      alert('📢 Только администраторы могут писать в этом канале');
      return;
    }

    // Получаем валидный chat ID
    const chatId = selectedChat?.chatId || selectedChat?.id;
    const messageText = messageInput.trim();
    
    // Генерируем уникальный ID для предотвращения дублирования
    const tempMessageId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    

    if (!chatId) {
      console.error('[SendMessage] No chatId!', selectedChat);
      alert('Ошибка: не выбран чат');
      return;
    }

    // Устанавливаем флаг отправки
    isSendingRef.current = true;
    setIsSending(true);

    try {
      const encryptedContent = encryptContentForChat(selectedChat, messageText)
      const baseUserMessage = {
        id: tempMessageId,
        chatId,
        senderId: user.id,
        type: 'text',
        content: messageText,
        nonce: tempMessageId,
        status: 'sending',
        createdAt: new Date().toISOString()
      }

      appendLocalMessage(baseUserMessage, chatId)
      setMessageInput('');
      setShowStickerPicker(false)

      // Send via the same messages API for all chats.
      // Rendering is driven by WebSocket acks (nonce => temp message replacement) to prevent duplicates.
      await messagesAPI.sendMessage(chatId, encryptedContent, {
        nonce: tempMessageId,
        senderPublicKey: user.publicKey || ''
      })
      updateChatPreview(chatId, messageText, new Date().toISOString())
      
      // Обновляем список чатов асинхронно (без ожидания)
      loadChats().catch(err => console.error('[SendMessage] loadChats error:', err));
      
    } catch (error) {
      console.error('[SendMessage] Error:', error);
      // Mark the optimistic message as failed so user can retry/copy.
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMessageId ? { ...m, status: 'error' } : m))
      )
    } finally {
      // Сбрасываем флаг после отправки
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  const addReaction = async (messageId, emoji) => {
    try {
      const result = await msgAPI.addReaction(messageId, emoji)
      setMessageReactions(prev => ({ ...prev, [messageId]: result.reactions }))
      setShowReactionPicker(null)
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const removeReaction = async (messageId, emoji) => {
    try {
      const result = await msgAPI.removeReaction(messageId, emoji)
      setMessageReactions(prev => ({ ...prev, [messageId]: result.reactions }))
    } catch (error) {
      console.error('Failed to remove reaction:', error)
      setMessageReactions(prev => {
        const reactions = prev[messageId] || []
        const nextReactions = reactions
          .map(reaction => {
            if (reaction.emoji !== emoji) return reaction
            const nextUsers = reaction.users.filter(u => String(u.userId) !== String(user.id))
            if (nextUsers.length === 0) return null
            return {
              ...reaction,
              count: nextUsers.length,
              users: nextUsers
            }
          })
          .filter(Boolean)

        return { ...prev, [messageId]: nextReactions }
      })
    }
  }

  const toggleReaction = async (messageId, emoji) => {
    const reactions = messageReactions[messageId] || []
    const hasMyReaction = reactions.some(
      r => r.emoji === emoji && r.users.some(u => String(u.userId) === String(user.id))
    )
    if (hasMyReaction) {
      setMessageReactions(prev => {
        const current = prev[messageId] || []
        const next = current
          .map(reaction => {
            if (reaction.emoji !== emoji) return reaction
            const nextUsers = reaction.users.filter(u => String(u.userId) !== String(user.id))
            if (nextUsers.length === 0) return null
            return {
              ...reaction,
              count: nextUsers.length,
              users: nextUsers
            }
          })
          .filter(Boolean)

        return { ...prev, [messageId]: next }
      })
      await removeReaction(messageId, emoji)
    } else {
      const myOtherEmoji = reactions
        .filter(r => r.users.some(u => String(u.userId) === String(user.id)) && r.emoji !== emoji)
        .map(r => r.emoji)

      if (myOtherEmoji.length > 0) {
        await msgAPI.removeReaction(messageId, myOtherEmoji[0])
      }
      await addReaction(messageId, emoji)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!confirm('Удалить это сообщение?')) return
    try {
      await msgAPI.deleteMessage(messageId)
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (error) {
      console.error('Failed to delete message:', error)
      alert(error.message || 'Не удалось удалить сообщение')
    }
  }

  const editMessage = async (messageId, newContent) => {
    try {
      const encryptedContent = encryptContentForChat(selectedChat, newContent)
      await msgAPI.editMessage(messageId, encryptedContent)
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent, isEdited: true, editedAt: new Date().toISOString() }
          : msg
      ))
      setShowEditModal(null)
      setMessageContextMenu({ visible: false, x: 0, y: 0, messageId: null, messageContent: '', isOwn: false })
    } catch (error) {
      console.error('Failed to edit message:', error)
      alert(error.message || 'Не удалось редактировать сообщение')
    }
  }
  
  // Удалить сообщение через контекстное меню
  const deleteMessageFromMenu = async () => {
    if (!messageContextMenu.messageId) return
    
    if (!confirm('Удалить это сообщение?')) return
    
    try {
      await msgAPI.deleteMessage(messageContextMenu.messageId)
      setMessages(prev => prev.filter(m => m.id !== messageContextMenu.messageId))
      setMessageContextMenu({ visible: false, x: 0, y: 0, messageId: null, messageContent: '', isOwn: false })
    } catch (error) {
      console.error('Failed to delete message:', error)
      alert(error.message || 'Не удалось удалить сообщение')
    }
  }
  
  // Закрыть контекстное меню
  const closeMessageContextMenu = () => {
    setMessageContextMenu({ visible: false, x: 0, y: 0, messageId: null, messageContent: '', isOwn: false })
  }

  const normalizedSidebarQuery = searchQuery.trim().toLowerCase()
  const filteredChats = chats.filter(chat => {
    if (!normalizedSidebarQuery) return true
    const haystack = [
      chat.name,
      chat.username,
      chat.lastMessage
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(normalizedSidebarQuery)
  })

  const copyMessageFromMenu = async () => {
    if (!messageContextMenu.messageContent) return
    try {
      await navigator.clipboard.writeText(messageContextMenu.messageContent)
      closeMessageContextMenu()
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  const openForwardModal = (messageId, text, originalMessage = null) => {
    const msg = originalMessage || safeMessages.find((m) => m.id === messageId)

    let mediaPreview = null
    let isMedia = false
    try {
      const trimmed = (text || '').trim()
      if (trimmed.startsWith('{')) {
        const parsed = parseMessageMedia(trimmed)
        if (parsed && parsed.type) {
          isMedia = true
          mediaPreview = parsed
        }
      }
    } catch (e) {
      console.error('[ForwardModal] Failed to parse media JSON for preview:', e)
    }

    const senderName = msg?.senderName
      || (msg?.senderId === user.id ? (user.firstName || user.displayName || 'Вы') : null)
      || (selectedChat?.type === 'group' || selectedChat?.type === 'channel' ? (msg?.senderName || 'Участник') : selectedChat?.name || 'Контакт')

    setForwardState({
      open: true,
      message: {
        id: messageId,
        text: !isMedia ? (text || '') : '',
        content: msg?.content || '',
        mediaPreview,
        isMedia,
        senderName: senderName || 'Контакт'
      }
    })
    setSelectedMessageId(messageId)
  }

  const closeForwardModal = () => {
    setForwardState({
      open: false,
      message: null
    })
  }

  const buildForwardContent = (messagePayload, targetChatId, options = {}) => {
    const { text, content, isMedia, senderName } = messagePayload || {}
    const currentChatId = options.currentChatId
    const sourceName = options.sourceName
    const forceSourceLabel = options.forceSourceLabel
    const showAttribution = forceSourceLabel || getShowForwardingAttribution()

    if (isMedia && content) {
      return content
    }

    const originalText = text || ''
    const safeSender = senderName || 'контакта'
    const fromName = sourceName || selectedChat?.name || 'чата'

    if (showAttribution && (forceSourceLabel || (currentChatId && currentChatId !== targetChatId))) {
      return `${forceSourceLabel ? 'Сохранено из' : `Переслано от ${safeSender} в`} «${fromName}»:\n${originalText}`
    }

    if (showAttribution && currentChatId && currentChatId === targetChatId) {
      return `Переслано от ${safeSender}:\n${originalText}`
    }

    return originalText
  }

  const handleForwardToChat = async (targetChat) => {
    if (!forwardState.message || !targetChat || isForwarding) return

    const targetChatId = targetChat.chatId || targetChat.id
    if (!targetChatId) return

    try {
      setIsForwarding(true)

      const payloadContent = buildForwardContent(
        forwardState.message,
        targetChatId,
        { currentChatId: selectedChat?.chatId || selectedChat?.id, sourceName: selectedChat?.name }
      )

      const encryptedContent = encryptContentForChat(targetChat, payloadContent)
      const response = await messagesAPI.sendMessage(targetChatId, encryptedContent, {
        senderPublicKey: user.publicKey || ''
      })

      updateChatPreview(targetChatId, payloadContent, response.created_at || new Date().toISOString())

      loadChats().catch((err) => console.error('[ForwardMessage] loadChats error:', err))
      closeForwardModal()
    } catch (error) {
      console.error('[ForwardMessage] Error:', error)
      alert(error.message || 'Не удалось переслать сообщение')
    } finally {
      setIsForwarding(false)
    }
  }

  const saveMessageToFavorites = async (messageId, decryptedText, originalMessage = null) => {
    if (!favoritesChat) {
      alert('Избранное ещё не готово. Обновите список чатов.')
      return
    }

    const targetChatId = favoritesChat.chatId || favoritesChat.id
    const msg = originalMessage || safeMessages.find((m) => m.id === messageId)
    if (!msg) return

    let isMedia = false
    try {
      const trimmed = (msg.content || decryptedText || '').trim()
      if (trimmed.startsWith('{')) {
        const parsed = parseMessageMedia(trimmed)
        if (parsed && parsed.type) isMedia = true
      }
    } catch (e) {
      // ignore
    }

    const payloadContent = buildForwardContent(
      {
        text: decryptedText || msg.content || '',
        content: msg.content || decryptedText || '',
        isMedia,
        senderName: msg.senderName || (msg.senderId === user.id ? (user.firstName || 'Вы') : 'контакта')
      },
      targetChatId,
      {
        currentChatId: selectedChat?.chatId || selectedChat?.id,
        sourceName: selectedChat?.name || 'чата',
        forceSourceLabel: true
      }
    )

    try {
      setIsForwarding(true)
      const encryptedContent = encryptContentForChat(favoritesChat, payloadContent)
      const response = await messagesAPI.sendMessage(targetChatId, encryptedContent, {
        senderPublicKey: user.publicKey || ''
      })
      updateChatPreview(targetChatId, payloadContent, response.created_at || new Date().toISOString())
      loadChats().catch((err) => console.error('[SaveToFavorites] loadChats error:', err))
      if (selectedChatIdRef.current === targetChatId) {
        loadMessages(targetChatId).catch((err) => console.error('[SaveToFavorites] loadMessages error:', err))
      }
    } catch (error) {
      console.error('[SaveToFavorites] Error:', error)
      alert(error.message || 'Не удалось сохранить сообщение')
    } finally {
      setIsForwarding(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Не используем preventDefault чтобы избежать предупреждений о пассивных листенерах
      e.stopPropagation();
      sendMessage()
    }
  }

  const handleBackToChatList = () => {
    setShowMobileChat(false);
    setShowChatList(true);
    setIsMobileSidebarOpen(false);
    setSelectedChat(null);
  }

  const selectChat = async (chat) => {

    // Закрываем мобильное меню при выборе чата
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebar-overlay')
    if (sidebar) {
      sidebar.classList.remove('visible')
    }
    if (overlay) {
      overlay.classList.remove('visible')
    }
    setIsMobileSidebarOpen(false)

    // Проверяем валидность chatId (должен быть полный UUID - 36 символов)
    const chatId = chat?.chatId || chat?.id;


    if (!chatId) {
      console.error('[SelectChat] chatId is undefined!');
      alert('Ошибка: не выбран чат');
      return;
    }

    // Use the same id for HTTP + WS rooms. Some search results may not have `chat.chatId` populated.
    const wsId = chat?.chatId || chat?.id;
    selectedChatIdRef.current = wsId;

    if (chatId.length !== 36) {
      console.error('[SelectChat] Invalid chatId length:', chatId.length);
      alert('Ошибка: некорректный ID чата');
      return;
    }

    // Очищаем таймаут и статус "печатает" при переключении
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    const prevChatId = selectedChat?.chatId || selectedChat?.id;
    if (prevChatId) {
      wsService.sendTypingStop(prevChatId);
    }

    
    // СНАЧАЛА устанавливаем выбранный чат
    setSelectedChat(chat)
    
    // На мобильном переключаем вид
    if (window.innerWidth <= 768) {
      setShowChatList(false);  // Скрываем список
      setShowMobileChat(true); // Показываем чат
      setIsMobileSidebarOpen(false)
    }
    
    setUnreadCounts(prev => ({ ...prev, [chat.chatId || chat.id]: 0 }))
    setChatHistorySearch('')  // Сброс поиска при переключении чата

    // Сохраняем ID выбранного чата
    window.lastSelectedChatId = chatId;

    if (chat.isPublic) {
      setMessages([])
      setIsLoading(false)
      return
    }

    // Обновляем selectedChatIdRef для WebSocket (уже объявлен выше)
    selectedChatIdRef.current = wsId
    setIsLoading(true)
    pendingScrollToLatestRef.current = wsId
    if (chat.type === 'channel' || chat.type === 'group') {
      try {
        // Используем groupId (из таблицы groups), а не chat.id (из таблицы chats)
        const groupId = chat.groupId || chat.id;
        const groupInfo = await groupsAPI.getGroupInfo(groupId);
        setGroupSettings(groupInfo);
      } catch (error) {
        console.error('[SelectChat] Failed to load group info:', error);
        
        // Если группа не найдена (404) — пробуем перезагрузить список чатов
        if (error.status === 404) {
          console.warn('[SelectChat] Group not found, refreshing chats list...');
          await loadChats();
        }
        
        // Не блокируем открытие чата если группа не загрузилась
        setGroupSettings(null);
      }
    }

    await loadMessages(chatId, chat);

    // подписываемся на чат и вступаем в комнату
    wsService.subscribe(wsId);

    // Отправляем join_room для новой системы rooms
    if (wsService.ws && wsService.ws.readyState === WebSocket.OPEN) {
      wsService.ws.send(JSON.stringify({ type: 'join_room', chatId: wsId }));
    } else {
      console.error('[SelectChat] WebSocket not connected! ReadyState:', wsService.ws ? wsService.ws.readyState : 'null');
    }

    setIsLoading(false);
  }

  const handleDeleteSelectedChat = async (scope) => {
    if (!selectedChat) return

    try {
      const chatId = selectedChat.chatId || selectedChat.id
      await chatsAPI.deleteChat(chatId, scope)
      setChats(prev => prev.filter(chat => (chat.chatId || chat.id) !== chatId))
      if ((selectedChat?.chatId || selectedChat?.id) === chatId) {
        selectedChatIdRef.current = null
        setSelectedChat(null)
        setMessages([])
        setShowMobileChat(false)
        setShowChatList(true)
        setIsLoading(false)
      }
      setShowDeleteChatOptions(false)
      setShowChatActionsMenu(false)
      loadChats().catch(err => console.error('[DeleteChat] loadChats error:', err))
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert(error.message || 'Не удалось удалить чат')
    }
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      wsService.checkConnection(user.id)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const handleConnState = ({ readyState }) => {
      setWsReadyState(readyState)

      const prev = prevWsReadyStateRef.current
      prevWsReadyStateRef.current = readyState

      // On successful (re)connect: refresh chats once.
      if (typeof WebSocket !== 'undefined' && readyState === WebSocket.OPEN && prev !== WebSocket.OPEN) {
        loadChats().catch(err => console.error('[WS] loadChats after reconnect error:', err))
        const currentChatId = selectedChatRef.current?.chatId || selectedChatRef.current?.id
        if (currentChatId) {
          // Catch up missed messages during disconnect without requiring a full page refresh (F5).
          loadMessages(currentChatId).catch(err => console.error('[WS] loadMessages after reconnect error:', err))
        }
      }
    }

    wsService.onConnectionState(handleConnState)
    handleConnState(wsService.getConnectionState())

    wsService.checkConnection(user.id)
    selectedChatIdRef.current = null
    setUnreadCounts({})

    const requestNotificationPermission = () => {
      const prefs = readNotifyPrefs()
      if (!prefs.pushEnabled) return
      if (!('Notification' in window) || Notification.permission !== 'default') return

      Notification.requestPermission()
        .then(permission => {
          if (permission === 'granted') {
            new Notification('🔔 Уведомления включены', {
              body: 'Вы будете получать уведомления о новых сообщениях',
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            })
          }
        })
        .catch(err => {
          console.error('[Notification] Error requesting permission:', err)
        })
    }

    requestNotificationPermission()
    window.addEventListener('pointerdown', requestNotificationPermission, { once: true })
    window.addEventListener('keydown', requestNotificationPermission, { once: true })

    // Звук уведомления
    const notificationSound = new Audio('/notification.wav')
    notificationSound.volume = 0.5

    setUnreadCounts({})

    const handleMessage = (data) => {
      if (data.type !== 'new_message') return

      const rawMsg = data.message || data // на случай, если сервер прислал без обёртки
      const rawSenderId = rawMsg.senderId ?? rawMsg.sender_id
      const isOwnMessage = String(rawSenderId) === String(user.id)
      const rawNonce = rawMsg.nonce ?? rawMsg.clientNonce ?? rawMsg.clientMessageId
      const incomingMessage = {
        ...rawMsg,
        senderId: rawSenderId ?? rawMsg.senderId,
        nonce: rawNonce ?? rawMsg.nonce,
        imageUrl:
          rawMsg.imageUrl ||
          (rawMsg.mediaUrl && String(rawMsg.mediaUrl).startsWith('data:image')
            ? rawMsg.mediaUrl
            : undefined)
      }

      // If this is the current chat — reconcile optimistic temp message by nonce (ack), otherwise merge/append by id.
      if (data.chatId === selectedChatIdRef.current) {
        setMessages(prev => {
          // 1) Replace optimistic temp message by nonce (our temp id is used as nonce)
          if (incomingMessage.nonce) {
            const optimisticIdx = prev.findIndex(m => m.id === incomingMessage.nonce || m.nonce === incomingMessage.nonce)
            if (optimisticIdx !== -1) {
              const next = [...prev]
              next[optimisticIdx] = { ...prev[optimisticIdx], ...incomingMessage, status: incomingMessage.status || 'sent' }
              // Avoid duplicate with same server id if it exists elsewhere
              return next.filter((m, i) => i === optimisticIdx || m.id !== incomingMessage.id)
            }
          }

          // 2) Merge by server message id
          const idx = prev.findIndex(m => m.id === incomingMessage.id)
          if (idx !== -1) {
            const next = [...prev]
            next[idx] = { ...prev[idx], ...incomingMessage }
            return next
          }

          // 3) Append new
          return [...prev, incomingMessage]
        })
        const shouldAutoScroll = isOwnMessage || isPinnedToBottomRef.current
        if (shouldAutoScroll) {
          setTimeout(() => scrollMessagesToBottom('smooth'), 30)
        }
      }

      if (data.chatId !== selectedChatIdRef.current) {
        if (!isOwnMessage) {
          setUnreadCounts(prev => {
            const newCounts = {
              ...prev,
              [data.chatId]: (prev[data.chatId] || 0) + 1
            }
            return newCounts
          })
        }

        const prefs = readNotifyPrefs()
        const notificationsEnabled = prefs.pushEnabled && 'Notification' in window && Notification.permission === 'granted'

        // Уведомление показываем всегда, когда страница не в фокусе ИЛИ свёрнута
        if (!isOwnMessage && (!document.hasFocus() || document.hidden)) {
          // Звук уведомления
          if (prefs.soundEnabled && notificationSound) {
            notificationSound.currentTime = 0
            notificationSound.play().catch(err => {
              console.error('[Notification] Sound play error:', err)
            })
          }

          // Браузерное уведомление
          if (notificationsEnabled) {
            const senderName = String(data.message.senderId) === String(user.id)
              ? 'Вы'
              : (data.chatName || selectedChatRef.current?.name || 'Контакт')
            const messageText = (() => {
              try {
                const decryptedContent = decryptMessage(data.message.content)
                if (decryptedContent && decryptedContent.startsWith('{')) {
                  const media = parseMessageMedia(decryptedContent)
                  const previewLabel = getMessagePreviewLabel(media || decryptedContent)
                  if (previewLabel) return previewLabel
                }
                return decryptedContent?.substring(0, 100) || ''
              } catch (e) {}
              return data.message.content?.substring(0, 100) || ''
            })()
            new Notification('📨 Новое сообщение', {
              body: `${senderName}: ${messageText}`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: data.chatId,
              requireInteraction: false
            })
          }
        }
      }

      const previewPayload =
        incomingMessage.type === 'image'
          ? JSON.stringify({ type: 'image' })
          : data.message?.content_encrypted || data.message?.content || ''

      // Если пришло сообщение в чат, которого нет в текущем списке (например, новый диалог),
      // подгружаем список чатов один раз с дебаунсом, чтобы он появился без F5.
      const chatExistsInList = chatsRef.current.some(chat => (chat.chatId || chat.id) === data.chatId || chat.id === data.chatId)
      if (!chatExistsInList) {
        scheduleChatsRefresh()
      }

      updateChatPreview(
        data.chatId,
        previewPayload,
        data.message?.createdAt || data.message?.created_at || new Date().toISOString()
      )

      // Не дергаем loadChats на каждое сообщение (слишком тяжело); превью/порядок обновляются локально.
    }

    wsService.onMessage(handleMessage)

    const handleReaction = (data) => {
      if (data.chatId === selectedChatIdRef.current) {
        setMessageReactions(prev => ({
          ...prev,
          [data.messageId]: data.reactions
        }))
      }
    }

    wsService.onReaction(handleReaction)

    const handleEditMessage = (data) => {
      if (data.chatId === selectedChatIdRef.current) {
        setMessages(prev => prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, isEdited: true, editedAt: new Date().toISOString() }
            : msg
        ))
      }
    }

    wsService.onEditMessage(handleEditMessage)

    const handleDeleteMessage = (data) => {
      if (data.chatId === selectedChatIdRef.current) {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId))
      }
      setTimeout(() => loadChats(), 100)
    }

    wsService.onDeleteMessage(handleDeleteMessage)

    const handleChatDeleted = (data) => {
      const deletedChatId = data.chatId
      setChats(prev => prev.filter(chat => (chat.chatId || chat.id) !== deletedChatId))
      setUnreadCounts(prev => {
        const next = { ...prev }
        delete next[deletedChatId]
        return next
      })

      if ((selectedChatIdRef.current || selectedChat?.chatId || selectedChat?.id) === deletedChatId) {
        selectedChatIdRef.current = null
        setSelectedChat(null)
        setMessages([])
        setShowChatActionsMenu(false)
        setShowDeleteChatOptions(false)
        setShowMobileChat(false)
        setShowChatList(true)
        setIsLoading(false)
      }

      setTimeout(() => {
        loadChats().catch(err => console.error('[HandleChatDeleted] loadChats error:', err))
      }, 50)
    }

    wsService.onChatDeleted(handleChatDeleted)

    // Обработчик обновления профиля пользователя
    const handleUserUpdated = (data) => {
      // Обновляем список чатов
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          // Для личных чатов - обновляем если userId совпадает
          if (chat.type === 'private' && chat.userId === data.userId) {
            return {
              ...chat,
              name: data.firstName || data.lastName
                ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
                : chat.name,
              avatar: data.avatarUrl !== undefined ? data.avatarUrl : chat.avatar
            }
          }
          return chat
        })
        return updatedChats
      })

      // Обновляем активный чат если это тот же пользователь
      if (selectedChatRef.current?.userId === data.userId) {
        setSelectedChat(prev => ({
          ...prev,
          name: data.firstName || data.lastName
            ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
            : prev.name,
          avatar: data.avatarUrl !== undefined ? data.avatarUrl : prev.avatar
        }))
      }
    }

    wsService.onUserUpdated(handleUserUpdated)

    // Обработчик изменения роли участника
    const handleMemberRoleChanged = (data) => {
      // Обновляем список участников канала если это тот же канал
      if (selectedChat?.chatId === data.groupId || selectedChat?.id === data.groupId) {
        setChannelMembers(prev => {
          const updated = prev.map(member => {
            if (member.id === data.userId) {
              return { ...member, role: data.newRole }
            }
            return member
          })
          return updated
        })

        // Также обновляем в groupSettings для настроек канала
        setGroupSettings(prev => {
          if (!prev) {
            return prev
          }
          if (!prev.members) {
            return { ...prev, myRole: data.userId === user.id ? data.newRole : prev.myRole }
          }

          const updated = {
            ...prev,
            myRole: data.userId === user.id ? data.newRole : prev.myRole,
            members: prev.members.map(m => {
              if (m.id === data.userId) {
                return { ...m, role: data.newRole }
              }
              return m
            })
          }
          return updated
        })
      }

      // Если изменили  роль текущего пользователя - обновляем groupSettings
      if (data.userId === user.id) {
        setGroupSettings(prev => {
          return prev ? { ...prev, myRole: data.newRole } : null
        })
      }
    }

    wsService.onMemberRoleChanged(handleMemberRoleChanged)

    // Обработчик исключения участника
    // ?????????? ?????????? ?????????
    const handleParticipantKicked = (data) => {
      // ???? ??????? ???????? ???????????? - ????????? ???
      if (data.userId === user.id) {
        if (selectedChat?.chatId === data.groupId || selectedChat?.id === data.groupId) {
          setSelectedChat(null)
        }
        // ??????? ??? ?? ??????
        setChats(prev => prev.filter(chat => chat.chatId !== data.groupId && chat.id !== data.groupId))
        alert('? ??? ????????? ?? ??????')
      } else {
        setChannelMembers(prev => prev.filter(member => member.id !== data.userId))
        setGroupSettings(prev => prev ? {
          ...prev,
          members: prev.members?.filter(member => member.id !== data.userId)
        } : null)
      }
    }

    wsService.onParticipantKicked(handleParticipantKicked)

    // ?????????? ?????????? ? ?????
    const handleAddedToChannel = async (data) => {
      if (data.userId === user.id) {
        await loadChats()
        alert('? ??? ???????? ? ?????!')
      }
    }

    wsService.onAddedToChannel(handleAddedToChannel)

    const handleMemberAdded = async (data) => {
      if (selectedChatRef.current?.chatId === data.groupId || selectedChatRef.current?.id === data.groupId) {
        try {
          const groupInfo = await groupsAPI.getGroupInfo(data.groupId)
          setGroupSettings(groupInfo)
          setChannelMembers(groupInfo.members || [])
        } catch (error) {
          console.error('[Members] Failed to refresh after member_added:', error)
        }
      }
    }

    wsService.onMemberAdded(handleMemberAdded)

    // Подписка на изменение статуса пользователя (для обновления в других местах)
    const handleUserStatus = (data) => {
      // SocketContext уже обновил onlineUsers, здесь можно добавить доп. логику
    };

    wsService.onUserUpdated(handleUserStatus);

    loadChats()

    // Очистка при закрытии вкладки
    const handleBeforeUnload = () => {
      endWebRTCCall()
      cleanupWebRTC()
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // === WEBSOCKET ОБРАБОТЧИКИ ДЛЯ ЗВОНКОВ ===
    const handleCallEnd = (data) => {
      if (activeCallIdRef.current && data.callId && activeCallIdRef.current !== data.callId) return
      const isMyCall = data.callerId === user.id || data.receiverId === user.id
      if (isMyCall) {
        resetCallState('ended')
      }
    }

    const handleCallRejected = (data) => {
      if (activeCallIdRef.current && data.callId && activeCallIdRef.current !== data.callId) return
      resetCallState('ended')
    }

    const handleCallError = (data) => {
      const hasActiveCallUi = showCallModalRef.current || incomingCallRef.current || activeCallIdRef.current
      if (!hasActiveCallUi) return
      if (activeCallIdRef.current && data.callId && activeCallIdRef.current !== data.callId) return

      resetCallState('ended')

      const messageByCode = {
        invalid_call_target: 'Нельзя звонить самому себе',
        TARGET_UNAVAILABLE: 'Пользователь сейчас недоступен',
        CALL_RATE_LIMIT: 'Слишком много попыток звонка. Попробуйте чуть позже'
      }

      alert(messageByCode[data.code] || 'Не удалось установить звонок')
    }

    const handleCallAccepted = async (data) => {
      try {
        if (activeCallIdRef.current && data.callId && activeCallIdRef.current !== data.callId) return
        activeCallIdRef.current = data.callId || activeCallIdRef.current
        const targetUserId = activeCallPeerIdRef.current || selectedChatRef.current?.userId || data.receiverId

        activeCallPeerIdRef.current = targetUserId || activeCallPeerIdRef.current
        setCallStatus('connected')
        stopCallSound()

        if (callTimerRef.current) clearInterval(callTimerRef.current)
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      } catch (error) {
        console.error('[CallAccepted] Error:', error)
        resetCallState('ended')
        alert(error.message || 'Microphone is unavailable for this call')
      }
    }

    const handleCallOffer = (data) => {
      if (showCallModalRef.current || incomingCallRef.current) {
        if (wsService.ws?.readyState === WebSocket.OPEN) {
          wsService.ws.send(JSON.stringify({
            type: 'call_rejected',
            callId: data.callId,
            receiverId: user.id,
            callerId: data.callerId,
            reason: 'busy'
          }))
        }
        return
      }

      const callerChat = chatsRef.current.find(
        (chat) => chat?.userId === data.callerId || chat?.id === data.callerId || chat?.chatId === data.callerId
      )

      activeCallIdRef.current = data.callId || null
      activeCallPeerIdRef.current = data.callerId || null
      setCallType(data.callType || 'audio')
      setCallStatus('ringing')
      setShowCallModal(false)
      setIncomingCall({
        id: data.callId || 'unknown',
        callerId: data.callerId,
        callerNameResolved: data.callerName || callerChat?.name || 'Контакт',
        callerAvatar: data.callerAvatar || callerChat?.avatar || null,
        callerName: 'Звонящий',
        type: data.callType || 'audio',
        status: 'ringing'
      })
      playCallSound()
    }

    const handleCallEvent = (data) => {
      try {
        if (data.type === 'call_end') handleCallEnd(data)
        if (data.type === 'call_rejected') handleCallRejected(data)
        if (data.type === 'call_error') handleCallError(data)
        if (data.type === 'call_accepted') handleCallAccepted(data)
        if (data.type === 'call_offer') handleCallOffer(data)
        if (data.type === 'call_type_change') {
          if (activeCallIdRef.current && data.callId && activeCallIdRef.current !== data.callId) return
          if (data.callType === 'video' || data.callType === 'audio') {
            setCallType(data.callType)
            setShowCallModal(true)
            setCallStatus('connected')
          }
        }
      } catch (e) {}
    }

    wsService.onCall(handleCallEvent)

    return () => {
      wsService.offCall(handleCallEvent)
      wsService.offMessage(handleMessage)
      wsService.offConnectionState(handleConnState)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pointerdown', requestNotificationPermission)
      window.removeEventListener('keydown', requestNotificationPermission)
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
        setCurrentlyPlayingId(null)
        setAudioProgress(0)
        setAudioCurrentTime(0)
        setAudioDuration(0)
      }
      cleanupWebRTC()
      stopCallSound()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user.id])

  const refreshChatsTimerRef = useRef(null)
  const scheduleChatsRefresh = useCallback(() => {
    if (refreshChatsTimerRef.current) return
    refreshChatsTimerRef.current = setTimeout(() => {
      refreshChatsTimerRef.current = null
      loadChats().catch((err) => console.error('[ChatsRefresh] loadChats error:', err))
    }, 350)
  }, [loadChats])

  // SocketContext теперь отвечает только за online/typing.
  // Сообщения обновляются напрямую из wsService.onMessage(handleMessage) без промежуточных буферов.

  // Синхронизация selectedChatRef
  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    showCallModalRef.current = showCallModal
  }, [showCallModal])

  useEffect(() => {
    incomingCallRef.current = incomingCall
  }, [incomingCall])

  useEffect(() => {
    webrtcReadyRef.current = webrtcReady
  }, [webrtcReady])

  useEffect(() => {
    callTypeRef.current = callType
  }, [callType])

  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  useEffect(() => {
    callUserRef.current = callUser
  }, [callUser])

  useEffect(() => {
    return () => {
      messageTouchTimersRef.current.forEach((timer) => clearTimeout(timer))
      messageMouseTimersRef.current.forEach((timer) => clearTimeout(timer))
      messageTouchTimersRef.current.clear()
      messageMouseTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    // Don't steal scroll if the user is reading older messages.
    // Initial open/switch is handled by the isLoading->false effect.
    if (!isPinnedToBottomRef.current) return
    scrollMessagesToBottom('auto')
  }, [messages, scrollMessagesToBottom])

  useEffect(() => {
    if (isLoading) return
    const chatId = selectedChat?.chatId || selectedChat?.id
    if (!chatId) return
    if (pendingScrollToLatestRef.current !== chatId) return
    if (!Array.isArray(messages) || messages.length === 0) return

    // Messages often arrive while the UI still shows the loading placeholder.
    // When loading finishes, force-scroll once to the latest message.
    requestAnimationFrame(() => scrollMessagesToBottom('auto'))
    requestAnimationFrame(() => scrollMessagesToBottom('auto'))
    setTimeout(() => scrollMessagesToBottom('auto'), 120)
    pendingScrollToLatestRef.current = null
  }, [isLoading, selectedChat?.chatId, selectedChat?.id, messages?.length, scrollMessagesToBottom])

  // Очистка таймера записи при размонтировании
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(prev => {
        const newVal = prev + 1
        return newVal
      })
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (dateString) => {
    const date = parseAppDate(dateString)
    if (!date) return ''
    const diff = Date.now() - date

    if (diff < 60000) return 'только что'
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return mins === 1 ? '1 мин назад' : `${mins} мин назад`
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return hours === 1 ? '1 ч назад' : `${hours} ч назад`
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  // Форматирование времени для аудио (секунды -> "0:04", "1:23")
  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAvatarColor = (seed) => {
    const palette = ['#ef4444', '#a855f7', '#f59e0b'] // red, purple, yellow/orange
    const str = String(seed ?? '')
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
    return palette[hash % palette.length]
  }

  const getInitial = (value) => {
    const s = String(value ?? '').trim()
    return (s[0] || '?').toUpperCase()
  }

  // Компонент видео-превью для записи кружков
  const VideoPreview = ({ isActive, onStreamReady }) => {
    const videoRef = useRef(null)
    const streamRef = useRef(null)

    useEffect(() => {
      if (isActive && videoRef.current && !streamRef.current) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
          .then(stream => {
            streamRef.current = stream
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.play()
            }
            if (onStreamReady) onStreamReady(stream)
          })
          .catch(err => {
            console.error('Video preview error:', err)
          })
      }

      return () => {
        // Не останавливаем поток здесь - это делает handleStopRecording
      }
    }, [isActive])

    return (
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)'  // Зеркальное отражение
        }}
      />
    )
  }

  const sendStickerMessage = async (sticker) => {
    if (!selectedChat || !sticker || isSendingRef.current || isSending) return

    if (selectedChat.type === 'channel' && groupSettings?.myRole === 'member') {
      alert('📢 Только администраторы могут писать в этом канале')
      return
    }

    const chatId = selectedChat?.chatId || selectedChat?.id
    if (!chatId) return

    const stickerPayload = JSON.stringify({
      type: 'sticker',
      kind: sticker.kind || 'sticker',
      stickerId: sticker.id,
      title: sticker.title,
      subtitle: sticker.subtitle,
      accent: sticker.accent,
      accentSecondary: sticker.accentSecondary,
      glow: sticker.glow,
      pattern: sticker.pattern
    })

    isSendingRef.current = true
    setIsSending(true)
    try {
      const response = await msgAPI.sendMessage(chatId, stickerPayload, { type: 'sticker' })
      appendLocalMessage(response, chatId)
      updateChatPreview(chatId, stickerPayload, response.created_at || new Date().toISOString())
      setShowStickerPicker(false)
      loadChats().catch(err => console.error('[SendSticker] loadChats error:', err))
    } catch (error) {
      console.error('[SendSticker] Error:', error)
      alert(error.message || 'Не удалось отправить стикер')
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const appendEmojiToInput = (emoji) => {
    setMessageInput(prev => `${prev}${emoji}`)
  }

  const WS_OPEN = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1
  const WS_CONNECTING = typeof WebSocket !== 'undefined' ? WebSocket.CONNECTING : 0
  const showConnectionBanner = !isOnline || wsReadyState !== WS_OPEN
  const connectionBannerText = !isOnline
    ? 'Ожидание сети...'
    : (wsReadyState === WS_CONNECTING ? 'Соединение...' : 'Ожидание сети...')
  const activeGroupBackgroundImageUrl =
    (selectedChat?.type === 'channel' || selectedChat?.type === 'group') && groupSettings?.backgroundImageUrl
      ? buildProtectedMediaUrl(groupSettings.backgroundImageUrl)
      : ''
  const activeGroupTheme =
    (selectedChat?.type === 'channel' || selectedChat?.type === 'group') && groupSettings?.gradientTheme
      ? GRADIENT_THEMES[groupSettings.gradientTheme] || GRADIENT_THEMES.tg_blue
      : null
  const hasCustomGroupBackground = Boolean(activeGroupBackgroundImageUrl || activeGroupTheme)

  return (
    <div className="chat-layout">
      {/* Overlay для мобильного - затемнение фона */}
      <MobileSidebarOverlay
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
      
      <ChatSidebar
        showChatList={showChatList}
        isMobileSidebarOpen={isMobileSidebarOpen}
        showConnectionBanner={showConnectionBanner}
        connectionBannerText={connectionBannerText}
        user={user}
        navigateToProfile={() => navigate('/profile')}
        showSidebarActionsMenu={showSidebarActionsMenu}
        setShowSidebarActionsMenu={setShowSidebarActionsMenu}
        setShowNewGroupModal={setShowNewGroupModal}
        sidebarSearchInputRef={sidebarSearchInputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        loadUsers={loadUsers}
        loadGroups={loadGroups}
        setUsers={setUsers}
        setGroups={setGroups}
        filteredChats={filteredChats}
        selectedChat={selectedChat}
        selectChat={selectChat}
        getAvatarColor={getAvatarColor}
        getInitial={getInitial}
        users={users}
        groups={groups}
        createNewChat={createNewChat}
        chats={chats}
        groupsAPI={groupsAPI}
        forceUpdate={forceUpdate}
        formatTime={formatTime}
        unreadCounts={unreadCounts}
        isTypingInChat={isTypingInChat}
        decryptMessage={decryptMessage}
      />

      <main
        className={`chat-main ${hasCustomGroupBackground ? 'themed-chat-main' : ''} ${isMobileViewport ? (selectedChat ? 'mobile-chat-visible' : 'mobile-chat-hidden') : ''}`}
        style={{
          display: 'flex',
          visibility: 'visible',
          opacity: 1,
          position: 'relative',
          zIndex: 1,
          background: '#111111',
          minHeight: '100dvh',
          ...(activeGroupBackgroundImageUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(2, 6, 23, 0.22), rgba(2, 6, 23, 0.5)), url(${activeGroupBackgroundImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }
            : activeGroupTheme
            ? buildBackgroundStyles(activeGroupTheme)
            : (selectedChat?.type === 'channel' || selectedChat?.type === 'group') && groupSettings?.backgroundColor
              ? {
                  background: groupSettings.backgroundColor
                }
              : {}),
          ...(selectedChat?.type === 'private' && activeDmTheme
            ? activeDmTheme.mode === 'gradient'
              ? buildBackgroundStyles(GRADIENT_THEMES[activeDmTheme.gradientKey])
              : activeDmTheme.mode === 'image' && activeDmTheme.imageDataUrl
                ? {
                    backgroundImage: `url(${activeDmTheme.imageDataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }
                : {}
            : {})
        }}
      >
        <div className="chat-content">
          {!selectedChat && (
            <div className={`net-status-banner ${showConnectionBanner ? 'show' : ''}`} aria-live="polite">
              <div className="net-status-banner-inner">{connectionBannerText}</div>
            </div>
          )}
          {selectedChat ? (
            <ChatViewErrorBoundary
              onRetry={() => {
                loadChats().catch((err) => console.error('[ChatRetry] loadChats error:', err))
                const currentChatId = selectedChat?.chatId || selectedChat?.id
                if (currentChatId) {
                  loadMessages(currentChatId, selectedChat).catch((err) =>
                    console.error('[ChatRetry] loadMessages error:', err)
                  )
                }
              }}
            >
            <>
            <PinnedMessageBar
              pinnedMessage={pinnedMessage}
              onClose={() => setPinnedMessage(null)}
            />

            <ChatHeaderBar
              selectedChat={selectedChat}
              groupSettings={groupSettings}
              showSearch={showSearch}
              chatHistorySearch={chatHistorySearch}
              setChatHistorySearch={setChatHistorySearch}
              setShowSearch={setShowSearch}
              pinnedMessage={pinnedMessage}
              handleBackToChatList={handleBackToChatList}
              setIsMobileSidebarOpen={setIsMobileSidebarOpen}
              handleOpenProfile={handleOpenProfile}
              loadGroupSettings={loadGroupSettings}
              getTypingUser={getTypingUser}
              isUserOnline={isUserOnline}
              onlineUsersStore={onlineUsersStore}
              startCall={startCall}
              showChatActionsMenu={showChatActionsMenu}
              setShowChatActionsMenu={setShowChatActionsMenu}
              showDeleteChatOptions={showDeleteChatOptions}
              setShowDeleteChatOptions={setShowDeleteChatOptions}
              setShowDmThemeModal={setShowDmThemeModal}
              activeDmTheme={activeDmTheme}
              updateDmThemes={updateDmThemes}
              handleDeleteSelectedChat={handleDeleteSelectedChat}
              openChannelSettings={() => setShowChannelSettingsModal(true)}
            />

            <div className={`net-status-banner ${showConnectionBanner ? 'show' : ''}`} aria-live="polite">
              <div className="net-status-banner-inner">{connectionBannerText}</div>
            </div>
            <div
              className="chat-messages-animated"
              ref={messagesListRef}
              style={{
                display: 'flex',
                flexDirection: isMobileViewport ? 'column-reverse' : 'column',
                gap: '6px',
                padding: '20px',
                paddingBottom: showStickerPicker ? '250px' : '20px',
                flexGrow: 1,
                overflowY: 'auto',
                minHeight: 0,
                ...(hasCustomGroupBackground
                  ? {
                      backgroundColor: 'transparent',
                      backgroundImage: 'none',
                      animation: 'none'
                    }
                  : {})
              }}
            >
              {messagesLoadError && (
                <div
                  style={{
                    alignSelf: 'center',
                    width: '100%',
                    maxWidth: '560px',
                    padding: '10px 12px',
                    borderRadius: '14px',
                    background: 'rgba(255, 82, 82, 0.10)',
                    border: '1px solid rgba(255, 82, 82, 0.35)',
                    color: '#fff'
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.95 }}>
                    Ошибка загрузки сообщений: {String(messagesLoadError)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentChatId = selectedChat?.chatId || selectedChat?.id
                      if (!currentChatId) return
                      loadMessages(currentChatId, selectedChat).catch((err) =>
                        console.error('[MessagesRetry] loadMessages error:', err)
                      )
                    }}
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.10)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Повторить
                  </button>
                </div>
              )}

              {!Array.isArray(messages) ? (
                <div className="loading-messages">Загрузка...</div>
              ) : isLoading ? <div className="loading-messages">Загрузка...</div> : (
                  renderMessages
                    .map(({ msg, decryptedText, parsedMediaData, isOwn, isBot, isMediaMessage, marginBottom }) => {
                      return (
                        <div
                          key={msg.id}
                          className={`message ${isOwn ? 'own' : ''}`}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setSelectedMessageId(msg.id)
                            setMessageContextMenu({
                              visible: true,
                              x: e.clientX,
                              y: e.clientY,
                              messageId: msg.id,
                              messageContent: decryptedText,
                              isOwn: isOwn
                            })
                          }}
                          onTouchStart={(e) => {
                            // Долгое нажатие 3 секунды для выбора сообщения на мобильном
                            const timer = setTimeout(() => {
                              setSelectedMessageId(msg.id)
                              setMessageContextMenu({
                                visible: true,
                                x: e.touches[0].clientX,
                                y: e.touches[0].clientY,
                                messageId: msg.id,
                                messageContent: decryptedText,
                                isOwn: isOwn
                              })
                            }, 3000)
                            messageTouchTimersRef.current.set(msg.id, timer)
                          }}
                          onTouchEnd={() => {
                            // Отменяем таймер если палец убран раньше долгого нажатия
                            const timer = messageTouchTimersRef.current.get(msg.id)
                            if (timer) {
                              clearTimeout(timer)
                              messageTouchTimersRef.current.delete(msg.id)
                            }
                          }}
                          onTouchMove={() => {
                            // Отменяем если палец двигается
                            const timer = messageTouchTimersRef.current.get(msg.id)
                            if (timer) {
                              clearTimeout(timer)
                              messageTouchTimersRef.current.delete(msg.id)
                            }
                          }}
                          onMouseDown={(e) => {
                            // На десктопе выделяем сообщение только при долгом зажатии (3 секунды) ЛКМ
                            if (e.button !== 0) return
                            const timer = setTimeout(() => {
                              setSelectedMessageId(msg.id)
                              setMessageContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                messageId: msg.id,
                                messageContent: decryptedText,
                                isOwn: isOwn
                              })
                            }, 3000)
                            messageMouseTimersRef.current.set(msg.id, timer)
                          }}
                          onMouseUp={() => {
                            const timer = messageMouseTimersRef.current.get(msg.id)
                            if (timer) {
                              clearTimeout(timer)
                              messageMouseTimersRef.current.delete(msg.id)
                            }
                          }}
                          onMouseLeave={() => {
                            const timer = messageMouseTimersRef.current.get(msg.id)
                            if (timer) {
                              clearTimeout(timer)
                              messageMouseTimersRef.current.delete(msg.id)
                            }
                          }}
                          onMouseEnter={() => {}}
                          style={{
                            position: 'relative',
                            marginBottom: marginBottom,
                            borderRadius: isMediaMessage ? '24px' : '22px',
                            background: msg.id === selectedMessageId
                              ? 'rgba(15,23,42,0.9)'
                              : isBot
                                ? 'transparent'
                                : isMediaMessage
                                  ? 'transparent'
                                  : isOwn
                                    ? 'linear-gradient(180deg, rgba(99,102,241,0.95), rgba(124,58,237,0.94))'
                                    : 'linear-gradient(180deg, rgba(20,23,34,0.96), rgba(11,14,22,0.96))',
                            padding: isBot || isMediaMessage ? '0' : '10px 14px 8px',
                            maxWidth: isMediaMessage ? 'min(400px, 82vw)' : 'min(560px, 72vw)',
                            border: isBot || isMediaMessage
                              ? 'none'
                              : isOwn
                                ? '1px solid rgba(167,139,250,0.28)'
                                : '1px solid rgba(148,163,184,0.12)',
                            boxShadow:
                              msg.id === selectedMessageId
                                ? '0 0 0 1px rgba(59,130,246,0.8), 0 0 20px rgba(37,99,235,0.6)'
                                : isBot || isMediaMessage
                                  ? 'none'
                                  : isOwn
                                    ? '0 18px 30px rgba(76,29,149,0.22)'
                                    : '0 16px 28px rgba(0,0,0,0.28)',
                            transform: msg.id === selectedMessageId ? 'scale(1.01)' : 'none',
                            transition: 'box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease'
                          }}
                        >
                  <MessageAuthorHeader
                    msg={msg}
                    isOwn={isOwn}
                    isBot={isBot}
                    selectedChat={selectedChat}
                    groupSettings={groupSettings}
                    gradientThemes={GRADIENT_THEMES}
                    onOpenUserProfile={handleOpenUserProfile}
                    onOpenChannelSettings={() => setShowChannelSettingsModal(true)}
                  />
                  
                  {/* Сообщение бота - Aegis карточка */}
                  {isBot ? (
                    <BotMessageContent msg={msg}>
                      <BotMediaContent
                        msg={msg}
                        isOwn={isOwn}
                        mediaData={(() => {
                          if (decryptedText && decryptedText.trim().startsWith('{')) {
                            return parseMessageMedia(decryptedText)
                          }
                          return null
                        })()}
                        decryptedText={decryptedText}
                        AegisSticker={AegisSticker}
                        currentlyPlayingId={currentlyPlayingId}
                        currentAudioRef={currentAudioRef}
                        setCurrentlyPlayingId={setCurrentlyPlayingId}
                        audioProgress={audioProgress}
                        setAudioProgress={setAudioProgress}
                        audioCurrentTime={audioCurrentTime}
                        setAudioCurrentTime={setAudioCurrentTime}
                        audioDuration={audioDuration}
                        setAudioDuration={setAudioDuration}
                        formatAudioTime={formatAudioTime}
                        setImagePreview={setImagePreview}
                      />
                    </BotMessageContent>
                  ) : (
                    <>
                      {(() => {
                        // Проверяем на JSON
                        let mediaData = null
                        if (decryptedText && decryptedText.trim().startsWith('{')) {
                          mediaData = parseMessageMedia(decryptedText)
                        }

                        const inlineImage =
                          (msg?.mediaUrl && msg.mediaUrl.startsWith('data:image')) ||
                          (msg?.imageUrl && msg.imageUrl.startsWith('data:image'))
                            ? msg.mediaUrl || msg.imageUrl
                            : null

                        if (inlineImage) {
                          return (
                            <div
                              style={{
                                maxWidth: '100%',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '1px solid rgba(148, 163, 184, 0.4)',
                                marginTop: '4px'
                              }}
                            >
                              <img
                                src={inlineImage}
                                alt="AI Generated"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  height: 'auto',
                                  objectFit: 'contain',
                                  maxHeight: '460px',
                                  borderRadius: '16px'
                                }}
                              />
                            </div>
                          )
                        }

                        if (mediaData && mediaData.type === 'sticker') {
                          return (
                            <>
                              <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                                <AegisSticker sticker={mediaData} isOwn={isOwn} />
                              </div>
                              <div style={{ paddingInline: '8px' }}>
                                <MessageMeta
                                  createdAt={msg.createdAt}
                                  isOwn={isOwn}
                                  status={msg.status}
                                  fontSize="11px"
                                  opacity={0.72}
                                  marginTop="6px"
                                  justifyContent={isOwn ? 'flex-end' : 'flex-start'}
                                  alignSelf="auto"
                                />
                              </div>
                            </>
                          )
                        }

                        // Голосовое сообщение
                        if (mediaData && mediaData.type === 'voice' && mediaData.url) {
                          const voiceUrl = buildProtectedMediaUrl(mediaData?.url || msg.content || msg.id, 'view', { messageId: msg.id })
                          const voiceDuration = Number(mediaData.duration) || 0
                          const isPlaying = currentlyPlayingId === msg.id
                          const waveHeights = [6, 10, 14, 8, 12, 16, 10, 6, 12, 14, 8, 10, 16, 12, 6, 14, 10, 8, 12, 16, 10, 6, 14, 12, 8]

                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.10)', padding: '6px 10px 4px 10px', borderRadius: '12px', width: 'min(360px, 100%)', maxWidth: '100%', minWidth: 'min(220px, 100%)', position: 'relative' }}>
                                <button onClick={async (e) => {
                                  e.stopPropagation()
                                  if (currentlyPlayingId === msg.id && currentAudioRef.current) {
                                    currentAudioRef.current.pause()
                                    currentAudioRef.current = null
                                    setCurrentlyPlayingId(null)
                                    setAudioProgress(0)
                                    setAudioCurrentTime(0)
                                    setAudioDuration(0)
                                  } else {
                                    setAudioDuration(0)
                                    if (currentAudioRef.current) {
                                      currentAudioRef.current.pause()
                                      currentAudioRef.current = null
                                    }
                                    let audioSrc
                                    try {
                                      audioSrc = await fetchProtectedMediaBlobUrl(
                                        msg.id,
                                        'view',
                                        mediaData.key && mediaData.iv
                                          ? { key: mediaData.key, iv: mediaData.iv, mime: mediaData.mime || 'audio/webm' }
                                          : null
                                      )
                                    } catch (err) {
                                      console.error('[Voice] load/decrypt failed', err)
                                      return
                                    }
                                    const audio = new Audio(audioSrc)
                                    audio.onloadedmetadata = () => setAudioDuration(audio.duration || 0)
                                    audio.ontimeupdate = () => {
                                      setAudioProgress((audio.currentTime / audio.duration) * 100 || 0)
                                      setAudioCurrentTime(audio.currentTime || 0)
                                    }
                                    audio.onended = () => {
                                      URL.revokeObjectURL(audioSrc)
                                      setCurrentlyPlayingId(null)
                                      setAudioProgress(0)
                                      setAudioCurrentTime(0)
                                      currentAudioRef.current = null
                                    }
                                    audio.onerror = () => {
                                      URL.revokeObjectURL(audioSrc)
                                      setCurrentlyPlayingId(null)
                                      setAudioProgress(0)
                                      setAudioCurrentTime(0)
                                      currentAudioRef.current = null
                                    }
                                    currentAudioRef.current = audio
                                    setCurrentlyPlayingId(msg.id)
                                    setAudioProgress(0)
                                    setAudioCurrentTime(0)
                                    audio.play().catch(() => {
                                      URL.revokeObjectURL(audioSrc)
                                      setCurrentlyPlayingId(null)
                                      setAudioProgress(0)
                                      setAudioCurrentTime(0)
                                      currentAudioRef.current = null
                                    })
                                  }
                                }} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'white', opacity: 0.9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                                  {isPlaying ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z" /></svg>
                                  )}
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '32px', flex: '1', flexShrink: 0 }}>
                                    {waveHeights.map((h, i) => {
                                      const barPosition = ((i + 1) / waveHeights.length) * 100
                                      const isPassed = isPlaying && audioProgress >= barPosition
                                      return (<span key={i} style={{ width: '3px', height: `${Math.max(4, h)}px`, background: isPassed ? 'rgba(255,255,255,0.95)' : 'rgba(255, 255, 255, 0.35)', borderRadius: '2px', display: 'inline-block', transition: 'background 0.1s ease' }} />)
                                    })}
                                  </div>
                                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {isPlaying ? formatAudioTime(audioCurrentTime) : formatAudioTime(voiceDuration || audioDuration)}
                                  </span>
                                </div>
                              </div>
                              {/* Время и статус — компактно в углу */}
                              <MessageMeta
                                createdAt={msg.createdAt}
                                isOwn={isOwn}
                                status={msg.status}
                                isEdited={msg.isEdited}
                                fontSize="10px"
                                opacity={0.6}
                                gap="3px"
                                marginTop="0"
                                justifyContent="flex-end"
                                alignSelf="auto"
                                position="absolute"
                                bottom="3px"
                                right="8px"
                              />
                            </>
                          )
                        }

                        // Видео-кружок (для старых клиентов, где type может быть video-circle)
                        if (mediaData && mediaData.type === 'video-circle' && mediaData.url) {
                          const videoUrl = buildProtectedMediaUrl(mediaData?.url || msg.content || msg.id, 'view', { messageId: msg.id })
                          return (
                            <>
                              <div className={`telegram-video-orb ${isOwn ? 'own' : ''}`}>
                                <video
                                  controls
                                  src={videoUrl}
                                  style={{
                                    width: '220px',
                                    height: '220px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    background: '#000'
                                  }}
                                />
                              </div>
                            </>
                          )
                        }

                        if (mediaData && ['image', 'video', 'file', 'audio'].includes(mediaData.type)) {
                          return (
                            <MediaAttachmentContent
                              msg={msg}
                              mediaData={mediaData}
                              isOwn={isOwn}
                              onOpenImagePreview={setImagePreview}
                            />
                          )
                        }

                        return (
                          <TextMessageContent
                            msg={msg}
                            decryptedText={decryptedText}
                            isOwn={isOwn}
                          />
                        )
                      })()}
                    </>
                  )}

                  {/* Реакции — компактно под сообщением, рядом с ним */}
                  <MessageReactions
                    reactions={messageReactions[msg.id] || []}
                    messageId={msg.id}
                    selectedChat={selectedChat}
                    groupSettings={groupSettings}
                    user={user}
                    toggleReaction={toggleReaction}
                  />

                  <MessageActionsMenu
                    msg={msg}
                    decryptedText={decryptedText}
                    selectedChat={selectedChat}
                    groupSettings={groupSettings}
                    user={user}
                    toggleReaction={toggleReaction}
                    openForwardModal={openForwardModal}
                    saveMessageToFavorites={saveMessageToFavorites}
                    showReactionPicker={showReactionPicker}
                    setShowReactionPicker={setShowReactionPicker}
                    setShowEditModal={setShowEditModal}
                    setEditContent={setEditContent}
                    deleteMessage={deleteMessage}
                  />

                  <MessageReactionPicker
                    visible={false && showReactionPicker === msg.id}
                    messageId={msg.id}
                    selectedChat={selectedChat}
                    groupSettings={groupSettings}
                    addReaction={addReaction}
                    onClose={() => setShowReactionPicker(null)}
                  />
                </div>
              )
            })
            )
            }
            <div ref={messagesEndRef} />
            </div>

            <DiscussionButton
              selectedChat={selectedChat}
              groupSettings={groupSettings}
              messagesCount={safeMessages.length}
              chats={chats}
              selectChat={selectChat}
            />

            <ChatComposer
              selectedChat={selectedChat}
              groupSettings={groupSettings}
              isRecording={isRecordingUI}
              recordingTime={recordingTime}
              recordingMode={recordingMode}
              setRecordingMode={setRecordingMode}
              formatAudioTime={formatAudioTime}
              loadChats={loadChats}
              loadMessages={loadMessages}
              user={user}
              setSelectedChat={setSelectedChat}
              selectedChatIdRef={selectedChatIdRef}
              setComposerPanelTab={setComposerPanelTab}
              composerPanelTab={composerPanelTab}
              setShowStickerPicker={setShowStickerPicker}
              showStickerPicker={showStickerPicker}
              appendEmojiToInput={appendEmojiToInput}
              sendStickerMessage={sendStickerMessage}
              AEGIS_GIFS={AEGIS_GIFS}
              AEGIS_STICKERS={AEGIS_STICKERS}
              AegisSticker={AegisSticker}
              shieldIcon={shieldIcon}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              typingTimeoutRef={typingTimeoutRef}
              handleKeyPress={handleKeyPress}
              handleStartRecording={handleStartRecording}
              handleStopRecording={handleStopRecording}
              handleCancelRecording={handleCancelRecording}
              sendMessage={sendMessage}
              encryptContentForChat={encryptContentForChat}
              onJoinPublicChat={async () => {
                try {
                  const result = await groupsAPI.joinPublicChannel(selectedChat.id)
                  alert(`✅ Вы подписались на ${selectedChat.type === 'channel' ? 'канал' : 'группу'}!`)
                  setSelectedChat(prev => ({ ...prev, isPublic: false, chatId: result.chatId || prev.id }))
                  const wsId = result.chatId || selectedChat.id
                  selectedChatIdRef.current = wsId
                  await loadMessages(result.chatId || selectedChat.id)
                  wsService.subscribe(wsId)
                  await loadChats()
                  await loadGroups()
                } catch (err) {
                  alert('Ошибка: ' + err.message)
                }
              }}
            />
          </>
          </ChatViewErrorBoundary>
        ) : (
          <EmptyChatState
            shieldIcon={shieldIcon}
            setShowMobileChat={setShowMobileChat}
            sidebarSearchInputRef={sidebarSearchInputRef}
            setShowNewGroupModal={setShowNewGroupModal}
            createNewChat={createNewChat}
          />
        )}
              </div>
    </main>

      <MessageContextMenu
        messageContextMenu={messageContextMenu}
        closeMessageContextMenu={closeMessageContextMenu}
        toggleReaction={toggleReaction}
        setShowEditModal={setShowEditModal}
        setEditContent={setEditContent}
        copyMessageFromMenu={copyMessageFromMenu}
        openForwardModal={openForwardModal}
        saveMessageToFavorites={saveMessageToFavorites}
        setSelectedMessageId={setSelectedMessageId}
        deleteMessageFromMenu={deleteMessageFromMenu}
      />

      <EditMessageModal
        showEditModal={showEditModal}
        setShowEditModal={setShowEditModal}
        editContent={editContent}
        setEditContent={setEditContent}
        editMessage={editMessage}
      />

      <ForwardMessageModal
        forwardState={forwardState}
        closeForwardModal={closeForwardModal}
        chats={chats}
        selectedChat={selectedChat}
        isForwarding={isForwarding}
        handleForwardToChat={handleForwardToChat}
        AegisSticker={AegisSticker}
      />

      {showNewGroupModal && (
        <NewGroupChannelModal
          onClose={() => setShowNewGroupModal(false)}
          onCreate={createGroup}
        />
      )}

      {showDmThemeModal && selectedChat && selectedChat.type === 'private' && (
        <DmAppearanceModal
          value={activeDmTheme}
          chatName={selectedChat.name}
          onClose={() => setShowDmThemeModal(false)}
          onChange={(nextValue) => {
            const key = selectedChat.chatId || selectedChat.id
            updateDmThemes((prev) => {
              const next = { ...prev }
              if (!nextValue) {
                delete next[key]
              } else {
                next[key] = nextValue
              }
              return next
            })
          }}
        />
      )}

      {showChannelSettingsModal && groupSettings && (
        <ChannelSettingsModal
          group={groupSettings}
          onClose={() => setShowChannelSettingsModal(false)}
          onSave={saveChannelSettings}
          onDeleteGroup={handleDeleteCurrentGroup}
          onCreateDiscussion={handleCreateDiscussion}
          onVerifySite={handleVerifySite}
          onSaveExternalLink={handleSaveExternalLink}
          onManageMembers={() => {
            setShowChannelSettingsModal(false)
            setShowMembersPanel(true)
          }}
        />
      )}

      {showMembersPanel && selectedChat && (
        <ChannelMembersPanel
          isOpen={showMembersPanel}
          onClose={() => setShowMembersPanel(false)}
          channelId={selectedChat.id}
          members={channelMembers}
          myRole={groupSettings?.myRole || 'member'}
          userId={user?.id}
          onPromote={handlePromote}
          onDemote={handleDemote}
          onKick={handleKick}
          onChangeRole={handleChangeMemberRole}
          onAddMember={() => setShowAddMemberModal(true)}
          allowMemberInvites={groupSettings?.allowMemberInvites || false}
        />
      )}

      {showAddMemberModal && selectedChat && (
        <GroupMemberPickerModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          existingMembers={channelMembers}
          onAddMember={handleAddMemberToGroup}
        />
      )}

      {showProfileSidebar && selectedUserProfile && (
        <ProfileSidebar
          isOpen={showProfileSidebar}
          onClose={() => setShowProfileSidebar(false)}
          user={selectedUserProfile}
          chatId={selectedChat?.chatId || selectedChat?.id}
          messages={messages}
          onSwitchChat={handleSwitchChat}
          onSwitchToPrivateChat={handleSwitchToPrivateChat}
          showWriteButton={profileFromMessage || selectedChat?.type === 'private'}
          onViewCallHistory={() => {
            setShowProfileSidebar(false)
            setShowCallHistory(true)
          }}
        />
      )}

      {/* История звонков */}
      {showCallHistory && (
        <div className="modal-overlay" onClick={() => setShowCallHistory(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <CallHistory userId={user.id} onClose={() => setShowCallHistory(false)} />
          </div>
        </div>
      )}

      <ActiveCallModal
        show={showCallModal}
        callType={callType}
        remoteStream={remoteStream}
        localStream={localStream}
        selectedChat={selectedChat}
        callStatus={callStatus}
        isMuted={isMuted}
        callDuration={callDuration}
        formatCallDuration={formatCallDuration}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        switchCameraFacing={switchCameraFacing}
        cameraFacingMode={cameraFacingMode}
        toggleScreenShare={handleToggleScreenShare}
        switchToVideoCall={switchToVideoCall}
        endCall={endCall}
        isScreenSharing={isScreenSharing}
        setIsScreenSharing={setIsScreenSharing}
      />

      <IncomingCallModal incomingCall={incomingCall} onAccept={acceptCall} onReject={rejectCall} />

      {/* Просмотр картинки в полноэкранном режиме */}
      {imagePreview && (
        <div
          className="modal-overlay"
          onClick={handleCloseImagePreview}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            cursor: 'zoom-out'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 'min(90vw, 980px)',
              maxHeight: '90vh',
              width: 'fit-content',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'rgba(13,16,36,0.96)',
              borderRadius: '18px',
              padding: '12px 14px 18px',
              boxShadow: '0 18px 45px rgba(0,0,0,0.75)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' }}>
              <div style={{ flex: 1, color: '#E5E7EB', fontSize: '13px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Изображение
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowImageActions((prev) => !prev)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(17,24,39,0.9)',
                    color: '#E5E7EB',
                    fontSize: '16px',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ⋮
                </button>
                <button
                  type="button"
                  onClick={handleCloseImagePreview}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(17,24,39,0.9)',
                    color: '#E5E7EB',
                    fontSize: '18px',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {showImageActions && (
              <div
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: '14px',
                  background: 'rgba(17,24,39,0.96)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: '14px',
                  boxShadow: '0 18px 35px rgba(0,0,0,0.65)',
                  overflow: 'hidden',
                  minWidth: '160px',
                  zIndex: 11010
                }}
              >
                <button
                  type="button"
                  onClick={handleDownloadPreview}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    color: '#E5E7EB',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Скачать
                </button>
                <div style={{ height: '1px', background: 'rgba(148,163,184,0.25)' }} />
                <button
                  type="button"
                  onClick={handleForwardPreview}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    color: '#E5E7EB',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Переслать
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src={imagePreview.url}
                alt="Изображение"
                style={{
                  maxWidth: 'min(80vw, 860px)',
                  maxHeight: '70vh',
                  borderRadius: '14px',
                  objectFit: 'contain',
                  boxShadow: '0 18px 45px rgba(0,0,0,0.75)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PRIVACY SECTION (раздел приватности в профиле)
// ============================================================================
const PrivacySection = ({ onLogout }) => {
  const [showForwardingAttribution, setForwardingAttribution] = useState(() => getShowForwardingAttribution())

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    code: ''
  })
  const [passwordStep, setPasswordStep] = useState('idle') // idle | codeSent
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleToggle = () => {
    const next = !showForwardingAttribution
    setForwardingAttribution(next)
    setShowForwardingAttribution(next)
  }

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({ ...prev, [name]: value }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleRequestPasswordCode = async (e) => {
    e.preventDefault()

    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError('Введите старый и новый пароль')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Новый пароль должен быть не менее 8 символов')
      return
    }

    setIsPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const result = await authAPI.requestPasswordChange({
        oldPassword: passwordForm.oldPassword
      })

      setPasswordStep('codeSent')
      setPasswordSuccess(result.message || 'Код отправлен на вашу почту')
    } catch (err) {
      setPasswordError(err.message || 'Не удалось отправить код')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleConfirmPasswordChange = async (e) => {
    e.preventDefault()

    if (!passwordForm.code || !passwordForm.newPassword) {
      setPasswordError('Введите код из почты и новый пароль')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Новый пароль должен быть не менее 8 символов')
      return
    }

    setIsPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const result = await authAPI.confirmPasswordChange({
        code: passwordForm.code,
        newPassword: passwordForm.newPassword
      })

      setPasswordSuccess(result.message || 'Пароль успешно изменён')
      setPasswordForm({ oldPassword: '', newPassword: '', code: '' })
      setPasswordStep('idle')
    } catch (err) {
      setPasswordError(err.message || 'Не удалось изменить пароль')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()

    setDeleteError('')

    if (deleteConfirm.trim().toLowerCase() !== 'удалить') {
      setDeleteError('Для подтверждения введите слово «удалить»')
      return
    }

    if (!deletePassword) {
      setDeleteError('Введите пароль от аккаунта')
      return
    }

    if (!window.confirm('Вы точно хотите безвозвратно удалить аккаунт? Это действие нельзя отменить.')) {
      return
    }

    setIsDeletingAccount(true)

    try {
      await profileAPI.deleteAccount({ password: deletePassword })

      if (typeof onLogout === 'function') {
        onLogout()
      } else {
        window.location.href = '/login'
      }
    } catch (err) {
      setDeleteError(err.message || 'Не удалось удалить аккаунт')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-50">Конфиденциальность</h2>

      {/* Основные настройки приватности */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-2xl bg-[#111113] border border-[#27272a] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-100">
              Показывать «Переслано от» при пересылке
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              При включении получатель видит, от кого и из какого чата было переслано сообщение
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 self-start',
              showForwardingAttribution
                ? 'border-blue-500 bg-blue-500/80'
                : 'border-zinc-600 bg-zinc-700'
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                showForwardingAttribution ? 'translate-x-5' : 'translate-x-1'
              ].join(' ')}
            />
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-400">Кто видит мой номер телефона</label>
          <select className="w-full rounded-[18px] bg-[#111113] border border-[#27272a] px-3.5 py-2.5 text-sm text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.7)] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-[#050505]">
            <option>Все</option>
            <option>Только контакты</option>
            <option>Никто</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-400">Кто видит моё фото профиля</label>
          <select className="w-full rounded-[18px] bg-[#111113] border border-[#27272a] px-3.5 py-2.5 text-sm text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.7)] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-[#050505]">
            <option>Все</option>
            <option>Только контакты</option>
            <option>Никто</option>
          </select>
        </div>
      </div>

      {/* Смена пароля */}
      <div className="rounded-2xl bg-[#111113] border border-[#27272a] px-4 py-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-100">Безопасность аккаунта</div>
        <p className="text-xs text-zinc-500">
          Смена пароля доступна только при вводе старого пароля и подтверждении кода из вашей почты.
        </p>

        {passwordError && (
          <div className="rounded-xl bg-red-900/70 border border-red-500/60 px-3 py-2 text-xs text-red-100">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="rounded-xl bg-emerald-900/70 border border-emerald-500/60 px-3 py-2 text-xs text-emerald-100">
            {passwordSuccess}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">Старый пароль</label>
            <input
              type="password"
              name="oldPassword"
              value={passwordForm.oldPassword}
              onChange={handlePasswordInputChange}
              className="w-full rounded-[14px] bg-[#050505] border border-[#27272a] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-[#050505]"
              placeholder="Старый пароль"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">Новый пароль</label>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordInputChange}
              className="w-full rounded-[14px] bg-[#050505] border border-[#27272a] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-[#050505]"
              placeholder="Мин. 8 символов"
            />
          </div>
        </div>

        {passwordStep === 'codeSent' && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">Код из почты</label>
            <input
              type="text"
              name="code"
              value={passwordForm.code}
              onChange={handlePasswordInputChange}
              className="w-full rounded-[14px] bg-[#050505] border border-[#27272a] px-3 py-2 text-sm text-zinc-100 tracking-[0.3em] uppercase focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-[#050505]"
              placeholder="XXXXXX"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleRequestPasswordCode}
            disabled={isPasswordLoading}
            className={[
              'flex-1 inline-flex items-center justify-center rounded-[14px] px-3 py-2 text-xs font-medium transition-all',
              isPasswordLoading
                ? 'bg-zinc-700 text-zinc-300 cursor-not-allowed'
                : 'bg-[#111827] text-zinc-100 hover:bg-[#1f2937]'
            ].join(' ')}
          >
            {isPasswordLoading ? 'Отправка…' : 'Отправить код'}
          </button>
          <button
            type="button"
            onClick={handleConfirmPasswordChange}
            disabled={isPasswordLoading || passwordStep !== 'codeSent'}
            className={[
              'flex-1 inline-flex items-center justify-center rounded-[14px] px-3 py-2 text-xs font-medium transition-all',
              passwordStep === 'codeSent' && !isPasswordLoading
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            ].join(' ')}
          >
            Подтвердить смену пароля
          </button>
        </div>
      </div>

      {/* Удаление аккаунта */}
      <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#111827] to-[#7f1d1d] border border-red-500/40 px-4 py-4 space-y-3">
        <div className="text-sm font-semibold text-red-200">Удалить аккаунт</div>
        <p className="text-xs text-red-200/80">
          Это навсегда деактивирует ваш профиль, отключит уведомления и завершит все активные сессии. Сообщения в чатах могут остаться у собеседников.
        </p>

        {deleteError && (
          <div className="rounded-xl bg-red-900/80 border border-red-400 px-3 py-2 text-xs text-red-50">
            {deleteError}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-red-200/80">Пароль от аккаунта</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-[14px] bg-[#050505]/90 border border-red-500/60 px-3 py-2 text-sm text-red-50 placeholder:text-red-300/60 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/60 focus:ring-offset-2 focus:ring-offset-[#050505]"
              placeholder="Введите ваш пароль"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-red-200/80">Подтверждение</label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full rounded-[14px] bg-[#050505]/90 border border-red-500/60 px-3 py-2 text-sm text-red-50 placeholder:text-red-300/60 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/60 focus:ring-offset-2 focus:ring-offset-[#050505]"
              placeholder="Введите: удалить"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className={[
            'w-full inline-flex items-center justify-center rounded-[16px] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-all shadow-[0_16px_40px_rgba(248,113,113,0.45)]',
            isDeletingAccount
              ? 'bg-red-900/80 text-red-100 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-500 hover:-translate-y-0.5'
          ].join(' ')}
        >
          {isDeletingAccount ? 'Удаление…' : 'Безвозвратно удалить аккаунт'}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// PROFILE PAGE (Modern Design)
// ============================================================================
const ProfilePage = ({ user, setUser, onLogout }) => {
  const navigate = useNavigate()
  const [activeMenu, setActiveMenu] = useState('profile')

  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [about, setAbout] = useState(user?.bio || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(true)
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Privacy & security settings state
  const [privacySettings, setPrivacySettings] = useState({
    phoneVisibility: 'contacts',
    groupInvites: 'contacts',
    avatarVisibility: 'all',
    lastSeen: 'contacts'
  })

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    code: ''
  })
  const [passwordStep, setPasswordStep] = useState('idle') // idle | codeSent
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [securityEmail, setSecurityEmail] = useState(user?.email || '')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  const displayInitial = (name) =>
    name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'A'

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const showError = (msg) => {
    setErrorMessage(msg)
    setTimeout(() => setErrorMessage(''), 3000)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      setErrorMessage('')
      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        bio: about.trim()
      }
      await profileAPI.updateProfile(updateData)
      if (setUser) {
        setUser(prev => ({
          ...prev,
          ...updateData
        }))
      }
      showSuccess('✅ Профиль сохранён!')
    } catch (err) {
      console.error('Failed to save profile:', err)
      showError(err.message || 'Ошибка при сохранении профиля')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePhoto = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        showError('Файл слишком большой. Максимум 5MB')
        return
      }
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowed.includes(file.type)) {
        showError('Недопустимый формат. Разрешены: JPEG, PNG, GIF, WebP')
        return
      }
      try {
        setIsUploading(true)
        const reader = new FileReader()
        reader.onload = (ev) => {
          setAvatarPreview(ev.target.result)
        }
        reader.readAsDataURL(file)
        const result = await profileAPI.uploadAvatar(file)
        if (setUser) {
          setUser(prev => ({
            ...prev,
            avatarUrl: result.avatarUrl || prev.avatarUrl
          }))
        }
        showSuccess('✅ Аватар загружен!')
      } catch (err) {
        console.error('Failed to upload avatar:', err)
        showError(err.message || 'Ошибка при загрузке аватара')
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }

  const handleDeletePhoto = async () => {
    if (!confirm('Удалить аватар?')) return
    try {
      setIsUploading(true)
      await profileAPI.removeAvatar()
      setAvatarPreview(null)
      if (setUser) {
        setUser(prev => ({
          ...prev,
          avatarUrl: null
        }))
      }
      showSuccess('✅ Аватар удалён!')
    } catch (err) {
      console.error('Failed to remove avatar:', err)
      showError(err.message || 'Ошибка при удалении аватара')
    } finally {
      setIsUploading(false)
    }
  }

  const handleLogout = () => {
    if (onLogout) onLogout()
  }

  const handleBackToChat = () => {
    navigate('/chat')
  }

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({ ...prev, [name]: value }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleRequestPasswordCode = async (e) => {
    e.preventDefault()

    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError('Введите старый и новый пароль')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Новый пароль должен быть не менее 8 символов')
      return
    }

    setIsPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const result = await authAPI.requestPasswordChange({
        oldPassword: passwordForm.oldPassword
      })

      setPasswordStep('codeSent')
      setPasswordSuccess(result.message || 'Код отправлен на вашу почту')
    } catch (err) {
      setPasswordError(err.message || 'Не удалось отправить код')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleConfirmPasswordChange = async (e) => {
    e.preventDefault()

    if (!passwordForm.code || !passwordForm.newPassword) {
      setPasswordError('Введите код из почты и новый пароль')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Новый пароль должен быть не менее 8 символов')
      return
    }

    setIsPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const result = await authAPI.confirmPasswordChange({
        code: passwordForm.code,
        newPassword: passwordForm.newPassword
      })

      setPasswordSuccess(result.message || 'Пароль успешно изменён')
      setPasswordForm({ oldPassword: '', newPassword: '', code: '' })
      setPasswordStep('idle')
    } catch (err) {
      setPasswordError(err.message || 'Не удалось изменить пароль')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleEmailChangeSubmit = async (e) => {
    e.preventDefault()

    const nextEmail = securityEmail.trim()

    if (!nextEmail) {
      setEmailError('Введите новый email')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setEmailError('Введите корректный email')
      return
    }

    setIsEmailLoading(true)
    setEmailError('')
    setEmailSuccess('')

    try {
      await profileAPI.updateProfile({ email: nextEmail })
      setEmail(nextEmail)
      if (setUser) {
        setUser(prev => ({
          ...prev,
          email: nextEmail
        }))
      }
      setEmailSuccess('Email успешно обновлён')
    } catch (err) {
      setEmailError(err.message || 'Не удалось обновить email')
    } finally {
      setIsEmailLoading(false)
    }
  }

  const menuItems = [
    { key: 'profile', label: 'Профиль', icon: '👤' },
    { key: 'notifications', label: 'Уведомления', icon: '🔔' },
    { key: 'privacy', label: 'Конфиденциальность', icon: '🔐' },
    { key: 'security', label: 'Безопасность', icon: '🛡️' }
  ]

  return (
    <div className="profile-page-wrapper">
      <div className="profile-page-container">
        <div className="profile-header-bar">
          <button
            type="button"
            onClick={handleBackToChat}
            className="btn-back-to-chat"
          >
            <span className="back-arrow">←</span>
            <span className="back-text">Назад к чатам</span>
          </button>
        </div>

        <div className="profile-main-grid">
          {/* Sidebar Navigation */}
          <aside className="profile-sidebar-nav">
            <div className="sidebar-top">
              <nav className="sidebar-menu">
                {menuItems.map((item) => {
                  const isActive = activeMenu === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveMenu(item.key)}
                      className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                      {isActive && <span className="menu-indicator" />}
                    </button>
                  )
                })}
              </nav>
            </div>
            <div className="sidebar-bottom">
              <button
                type="button"
                onClick={handleLogout}
                className="btn-logout-sidebar"
              >
                <span>🚪</span> Выйти
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="profile-content-main">
            {/* Profile Hero Section */}
            <div className="profile-hero-section">
              <div className="profile-hero-bg" />
              <div className="profile-hero-content">
                <div className="avatar-section">
                  <div className="avatar-wrapper">
                    <div className="avatar-large">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="avatar-image" />
                      ) : (
                        <span className="avatar-placeholder">
                          {displayInitial(firstName || username || user?.firstName || '')}
                        </span>
                      )}
                    </div>
                    {isUploading && (
                      <div className="avatar-upload-overlay">
                        <span className="upload-spinner">⏳</span>
                      </div>
                    )}
                  </div>
                  <div className="avatar-actions">
                    <button
                      type="button"
                      onClick={handleChangePhoto}
                      disabled={isUploading}
                      className="btn-avatar-change"
                    >
                      <span>📷</span> Изменить фото
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleDeletePhoto}
                        disabled={isUploading}
                        className="btn-avatar-remove"
                      >
                        <span>🗑️</span> Удалить
                      </button>
                    )}
                  </div>
                  <p className="avatar-hint">Макс. 5MB · JPEG, PNG, GIF, WebP</p>
                </div>

                <div className="profile-info-hero">
                  <h1 className="profile-name-hero">
                    {(firstName || user?.firstName || '').trim()}{' '}
                    {(lastName || user?.lastName || '').trim()}
                  </h1>
                  <p className="profile-username-hero">
                    @{(username || user?.username || '').trim() || 'username'}
                  </p>
                  {about && (
                    <p className="profile-bio-hero">{about}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Alerts */}
            {successMessage && (
              <div className="alert alert-success">
                <span>✅</span> {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="alert alert-error">
                <span>⚠️</span> {errorMessage}
              </div>
            )}

            {/* Profile Section */}
            {activeMenu === 'profile' && (
              <form onSubmit={handleSave} className="profile-form-section">
                <div className="section-header">
                  <h2 className="section-title">Основная информация</h2>
                  <p className="section-subtitle">Измените ваши персональные данные</p>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">👤</span> Имя
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="form-input"
                      placeholder="Введите имя"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">👥</span> Фамилия
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="form-input"
                      placeholder="Введите фамилию"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">📧</span> Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">📛</span> Имя пользователя
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                        className="form-input"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">
                      <span className="label-icon">📝</span> О себе
                    </label>
                    <textarea
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      rows={4}
                      className="form-textarea"
                      placeholder="Расскажите немного о себе..."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleBackToChat}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="btn-spinner">⟳</span> Сохранение…
                      </>
                    ) : (
                      'Сохранить изменения'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Notifications Section */}
            {activeMenu === 'notifications' && (
              <div className="settings-section">
                <div className="section-header-large">
                  <div className="header-icon-large">🔔</div>
                  <h2 className="section-title-large">Уведомления</h2>
                  <p className="section-desc-large">Настройте способы получения уведомлений</p>
                </div>

                <div className="settings-cards">
                  <div className="setting-card">
                    <div className="setting-card-icon">🔊</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Звуковые уведомления</h4>
                      <p className="setting-card-desc">Проигрывать звук при новых сообщениях</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={soundNotificationsEnabled}
                        onChange={(e) => setSoundNotificationsEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  <div className="setting-card">
                    <div className="setting-card-icon">📱</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Push-уведомления</h4>
                      <p className="setting-card-desc">Показывать уведомления на рабочем столе</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={pushNotificationsEnabled}
                        onChange={(e) => setPushNotificationsEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Section */}
            {activeMenu === 'privacy' && (
              <div className="settings-section">
                <div className="section-header-large">
                  <div className="header-icon-large">🔐</div>
                  <h2 className="section-title-large">Конфиденциальность</h2>
                  <p className="section-desc-large">Управляйте тем, кто видит вашу информацию</p>
                </div>

                <div className="settings-cards">
                  <div className="setting-card">
                    <div className="setting-card-icon">📞</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Номер телефона</h4>
                      <p className="setting-card-desc">Кто может видеть ваш номер телефона</p>
                    </div>
                    <select
                      className="form-select"
                      value={privacySettings.phoneVisibility}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, phoneVisibility: e.target.value }))}
                    >
                      <option value="all">Все</option>
                      <option value="contacts">Только контакты</option>
                      <option value="nobody">Никто</option>
                    </select>
                  </div>

                  <div className="setting-card">
                    <div className="setting-card-icon">👥</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Группы</h4>
                      <p className="setting-card-desc">Кто может добавлять вас в группы</p>
                    </div>
                    <select
                      className="form-select"
                      value={privacySettings.groupInvites}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, groupInvites: e.target.value }))}
                    >
                      <option value="all">Все</option>
                      <option value="contacts">Только контакты</option>
                    </select>
                  </div>

                  <div className="setting-card">
                    <div className="setting-card-icon">🖼️</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Фото профиля</h4>
                      <p className="setting-card-desc">Кто видит ваше фото профиля</p>
                    </div>
                    <select
                      className="form-select"
                      value={privacySettings.avatarVisibility}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, avatarVisibility: e.target.value }))}
                    >
                      <option value="all">Все</option>
                      <option value="contacts">Только контакты</option>
                      <option value="nobody">Никто</option>
                    </select>
                  </div>

                  <div className="setting-card">
                    <div className="setting-card-icon">⏱️</div>
                    <div className="setting-card-content">
                      <h4 className="setting-card-title">Был(а) недавно</h4>
                      <p className="setting-card-desc">Кто видит время вашей активности</p>
                    </div>
                    <select
                      className="form-select"
                      value={privacySettings.lastSeen}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, lastSeen: e.target.value }))}
                    >
                      <option value="all">Все</option>
                      <option value="contacts">Только контакты</option>
                      <option value="nobody">Никто</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeMenu === 'security' && (
              <div className="settings-section">
                <div className="section-header-large">
                  <div className="header-icon-large">🛡️</div>
                  <h2 className="section-title-large">Безопасность</h2>
                  <p className="section-desc-large">Смена пароля, почты и удаление аккаунта</p>
                </div>

                <div className="settings-cards">
                  {/* Change password */}
                  <div className="setting-card full security-card">
                    <div className="security-card-header">
                      <div className="security-icon-wrapper">
                        <span className="security-icon">🔑</span>
                      </div>
                      <div>
                        <h4 className="setting-card-title">Смена пароля</h4>
                        <p className="setting-card-desc">Измените пароль от вашего аккаунта</p>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="alert alert-error">
                        <span>⚠️</span> {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="alert alert-success">
                        <span>✅</span> {passwordSuccess}
                      </div>
                    )}

                    <form className="security-form" onSubmit={handleConfirmPasswordChange}>
                      <div className="form-group">
                        <label className="form-label">Старый пароль</label>
                        <input
                          type="password"
                          name="oldPassword"
                          value={passwordForm.oldPassword}
                          onChange={handlePasswordInputChange}
                          placeholder="••••••••"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Новый пароль</label>
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordInputChange}
                          placeholder="Минимум 8 символов"
                          className="form-input"
                        />
                      </div>

                      {passwordStep === 'codeSent' && (
                        <div className="form-group">
                          <label className="form-label">Код из почты</label>
                          <input
                            type="text"
                            name="code"
                            value={passwordForm.code}
                            onChange={handlePasswordInputChange}
                            placeholder="000000"
                            className="form-input code-input"
                            maxLength={6}
                          />
                        </div>
                      )}

                      <div className="form-actions security-actions">
                        <button
                          type="button"
                          onClick={handleRequestPasswordCode}
                          disabled={isPasswordLoading}
                          className="btn btn-secondary"
                        >
                          {isPasswordLoading ? 'Отправка...' : 'Отправить код'}
                        </button>
                        <button
                          type="submit"
                          disabled={isPasswordLoading || passwordStep !== 'codeSent'}
                          className="btn btn-primary"
                        >
                          {passwordStep === 'codeSent' ? 'Подтвердить смену' : 'Сменить пароль'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Change email */}
                  <div className="setting-card full security-card">
                    <div className="security-card-header">
                      <div className="security-icon-wrapper">
                        <span className="security-icon">📧</span>
                      </div>
                      <div>
                        <h4 className="setting-card-title">Смена email</h4>
                        <p className="setting-card-desc">Обновите почту, к которой привязан аккаунт</p>
                      </div>
                    </div>

                    {emailError && (
                      <div className="alert alert-error">
                        <span>⚠️</span> {emailError}
                      </div>
                    )}
                    {emailSuccess && (
                      <div className="alert alert-success">
                        <span>✅</span> {emailSuccess}
                      </div>
                    )}

                    <form className="security-form" onSubmit={handleEmailChangeSubmit}>
                      <div className="form-group">
                        <label className="form-label">Новый email</label>
                        <input
                          type="email"
                          value={securityEmail}
                          onChange={(e) => setSecurityEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="form-input"
                        />
                      </div>

                      <div className="form-actions security-actions">
                        <button
                          type="submit"
                          disabled={isEmailLoading}
                          className="btn btn-primary"
                        >
                          {isEmailLoading ? 'Сохранение…' : 'Обновить email'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Delete account */}
                  <div className="setting-card full danger-card">
                    <div className="danger-card-header">
                      <div className="danger-icon-wrapper">
                        <span className="danger-icon">⚠️</span>
                      </div>
                      <div>
                        <h4 className="danger-card-title">Удалить аккаунт</h4>
                        <p className="danger-card-desc">Это действие нельзя отменить</p>
                      </div>
                    </div>
                    <p className="danger-card-warning">
                      Это навсегда деактивирует ваш профиль, очистит активные сессии и отключит уведомления.
                      Сообщения в чатах могут сохраниться у других пользователей.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Вы точно хотите удалить аккаунт?')) {
                          handleLogout()
                        }
                      }}
                      className="btn btn-danger"
                    >
                      🗑️ Удалить аккаунт
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        /* Main wrapper */
        .profile-page-wrapper {
          min-height: 100vh;
          background: var(--bg-secondary);
          padding: 16px 12px;
          overflow-x: hidden;
        }

        .profile-page-container {
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        /* Header bar */
        .profile-header-bar {
          margin-bottom: 24px;
        }

        .btn-back-to-chat {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-back-to-chat:hover {
          background: rgba(30, 41, 59, 0.7);
          border-color: rgba(129, 140, 248, 0.3);
          color: var(--text-primary);
        }

        .back-arrow {
          font-size: 18px;
        }

        /* Main grid */
        .profile-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
          gap: 20px;
        }

        /* Sidebar */
        .profile-sidebar-nav {
          background: linear-gradient(180deg, rgba(129, 140, 248, 0.08) 0%, var(--bg-secondary) 100%);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: fit-content;
        }

        .sidebar-menu {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sidebar-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          position: relative;
        }

        .sidebar-menu-item:hover {
          background: rgba(129, 140, 248, 0.1);
        }

        .sidebar-menu-item.active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15));
          color: #fff;
        }

        .menu-icon {
          font-size: 20px;
          width: 24px;
          text-align: center;
        }

        .menu-label {
          flex: 1;
        }

        .menu-indicator {
          width: 4px;
          height: 20px;
          background: linear-gradient(180deg, #6366f1, #8b5cf6);
          border-radius: 2px;
        }

        .btn-logout-sidebar {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout-sidebar:hover {
          background: rgba(248, 113, 113, 0.15);
          border-color: rgba(248, 113, 113, 0.5);
        }

        /* Main content */
        .profile-content-main {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          overflow: hidden;
        }

        /* Hero section */
        .profile-hero-section {
          position: relative;
          border-bottom: 1px solid var(--border-color);
        }

        .profile-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
          pointer-events: none;
        }

        .profile-hero-content {
          position: relative;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .avatar-wrapper {
          position: relative;
        }

        .avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          font-size: 36px;
          font-weight: 700;
          color: white;
        }

        .avatar-upload-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 35px;
        }

        .upload-spinner {
          font-size: 32px;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .avatar-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn-avatar-change,
        .btn-avatar-remove {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-avatar-change {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .btn-avatar-change:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        .btn-avatar-remove {
          background: rgba(239, 68, 68, 0.9);
          color: white;
        }

        .btn-avatar-remove:hover {
          background: rgba(220, 38, 38, 0.9);
          transform: translateY(-2px);
        }

        .avatar-hint {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
        }

        .profile-info-hero {
          text-align: center;
        }

        .profile-name-hero {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 6px;
          background: linear-gradient(135deg, var(--text-primary), #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .profile-username-hero {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 6px;
        }

        .profile-bio-hero {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 380px;
        }

        /* Alerts */
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          margin: 20px 32px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .alert-success {
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.3);
          color: #6ee7b7;
        }

        /* Form section */
        .profile-form-section,
        .settings-section {
          padding: 32px;
        }

        .section-header {
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px;
        }

        .section-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        .section-header-large {
          text-align: center;
          margin-bottom: 24px;
        }

        .header-icon-large {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .section-title-large {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 8px;
        }

        .section-desc-large {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Form grid */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .label-icon {
          font-size: 14px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 15px;
          outline: none;
          transition: all 0.2s;
        }

        .form-input:hover,
        .form-textarea:hover {
          border-color: rgba(129, 140, 248, 0.5);
        }

        .form-input:focus,
        .form-textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }

        .input-with-prefix {
          position: relative;
        }

        .input-prefix {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
          font-size: 15px;
        }

        .input-with-prefix .form-input {
          padding-left: 36px;
        }

        /* Buttons */
        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: flex-end;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: rgba(129, 140, 248, 0.1);
          border-color: rgba(129, 140, 248, 0.3);
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        }

        .btn-danger {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          width: 100%;
          margin-top: 16px;
        }

        .btn-danger:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
        }

        .btn-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Settings cards */
        .settings-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .setting-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          transition: all 0.2s;
        }

        .setting-card:hover {
          background: rgba(30, 41, 59, 0.7);
          border-color: rgba(129, 140, 248, 0.3);
        }

        .setting-card-icon {
          font-size: 32px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15));
          border-radius: 14px;
          flex-shrink: 0;
        }

        .setting-card-content {
          flex: 1;
        }

        .setting-card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 4px;
        }

        .setting-card-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Toggle switch */
        .toggle-switch {
          position: relative;
          width: 52px;
          height: 28px;
          flex-shrink: 0;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background: var(--bg-tertiary);
          border-radius: 28px;
          transition: all 0.3s;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s;
        }

        .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        /* Select */
        .form-select {
          padding: 10px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        .form-select:hover {
          border-color: rgba(129, 140, 248, 0.5);
        }

        .form-select:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        /* Danger card */
        .danger-card {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(185, 28, 28, 0.05));
          border-color: rgba(239, 68, 68, 0.2);
          flex-direction: column;
          align-items: stretch;
        }

        .danger-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .danger-icon-wrapper {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.15));
          border-radius: 14px;
        }

        .danger-icon {
          font-size: 28px;
        }

        .danger-card-title {
          font-size: 18px;
          font-weight: 700;
          color: #fca5a5;
          margin: 0 0 4px;
        }

        .danger-card-desc {
          font-size: 13px;
          color: #f87171;
          margin: 0;
        }

        .danger-card-warning {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 20px;
          line-height: 1.6;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .profile-page-wrapper {
            padding: 12px;
          }

          .profile-main-grid {
            grid-template-columns: 1fr;
          }

          .profile-sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            padding: 12px;
          }

          .sidebar-top {
            display: flex;
            flex: 1;
          }

          .sidebar-menu {
            flex-direction: row;
            overflow-x: auto;
          }

          .sidebar-menu-item {
            flex-direction: column;
            padding: 10px 14px;
            flex-shrink: 0;
          }

          .menu-indicator {
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
          }

          .sidebar-bottom {
            margin-left: 12px;
          }

          .btn-logout-sidebar {
            width: auto;
            white-space: nowrap;
          }

          .profile-hero-content {
            padding: 24px 16px;
          }

          .avatar-large {
            width: 100px;
            height: 100px;
            border-radius: 28px;
          }

          .avatar-placeholder {
            font-size: 48px;
          }

          .profile-name-hero {
            font-size: 22px;
          }

          .profile-form-section,
          .settings-section {
            padding: 20px 16px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }

          .alert {
            margin-left: 16px;
            margin-right: 16px;
          }
        }
      `}
      </style>
    </div>
  )
}

// ============================================================================
// APP
// ============================================================================
const WelcomeSlidesPage = ({ user, onFinish }) => {
  const navigate = useNavigate()
  const [activeSlide, setActiveSlide] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [{ isCompact, isPhone, isShortScreen }, setViewportState] = useState(getWelcomeViewportState)
  const touchStartXRef = useRef(null)

  useEffect(() => {
    if (user?.onboardingCompletedAt) {
      navigate('/chat', { replace: true })
    }
  }, [navigate, user?.onboardingCompletedAt])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => {
      setViewportState(getWelcomeViewportState())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    const prevHtmlOverflow = html.style.overflow
    const prevHtmlHeight = html.style.height
    const prevBodyOverflow = body.style.overflow
    const prevBodyOverflowY = body.style.overflowY
    const prevBodyMinHeight = body.style.minHeight
    const prevBodyTouchAction = body.style.touchAction
    const prevBodyWebkitOverflowScrolling = body.style.webkitOverflowScrolling
    const prevRootHeight = root?.style.height ?? ''
    const prevRootMinHeight = root?.style.minHeight ?? ''
    const prevRootOverflow = root?.style.overflow ?? ''

    html.style.overflow = 'auto'
    html.style.height = 'auto'
    body.style.overflow = 'auto'
    body.style.overflowY = 'auto'
    body.style.minHeight = '100dvh'
    body.style.touchAction = isPhone ? 'pan-x pan-y' : 'auto'
    body.style.webkitOverflowScrolling = 'touch'

    if (root) {
      root.style.height = 'auto'
      root.style.minHeight = '100dvh'
      root.style.overflow = 'visible'
    }

    return () => {
      html.style.overflow = prevHtmlOverflow
      html.style.height = prevHtmlHeight
      body.style.overflow = prevBodyOverflow
      body.style.overflowY = prevBodyOverflowY
      body.style.minHeight = prevBodyMinHeight
      body.style.touchAction = prevBodyTouchAction
      body.style.webkitOverflowScrolling = prevBodyWebkitOverflowScrolling

      if (root) {
        root.style.height = prevRootHeight
        root.style.minHeight = prevRootMinHeight
        root.style.overflow = prevRootOverflow
      }
    }
  }, [isPhone])

  const slides = [
    {
      eyebrow: 'AegisTalk',
      title: 'Мессенджер, где важны люди, а не шум',
      description: 'Мы собираем AegisTalk как спокойное и защищённое место для общения: личные чаты, звонки, каналы и AI-помощник в одном аккуратном пространстве.',
      accent: 'linear-gradient(135deg, rgba(34, 211, 238, 0.30), rgba(59, 130, 246, 0.18))',
      points: ['Чистый интерфейс без перегруза', 'Быстрый вход с телефона и ПК', 'Один аккаунт для всех основных сценариев'],
      tag: 'Спокойный ритм',
      heroStat: '1 место',
      heroCaption: 'для чатов, звонков и AI без лишней суеты'
    },
    {
      eyebrow: 'Приватность',
      title: 'Безопасность встроена в основу',
      description: 'Мы изначально строим проект вокруг защиты аккаунта, верификации и управляемых сессий, чтобы тебе было проще доверять сервису каждый день.',
      accent: 'linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(20, 184, 166, 0.16))',
      points: ['Коды подтверждения и контроль сессий', 'Отдельные настройки приватности', 'Фокус на защите без лишней сложности'],
      tag: 'Защитный контур',
      heroStat: '24/7',
      heroCaption: 'контроль устройства, сессий и входов в одном профиле'
    },
    {
      eyebrow: 'Дальше',
      title: 'Чаты и звонки — в одном ритме',
      description: 'После этого экрана можно сразу переходить в приложение: общаться, настраивать профиль и пользоваться звонками без лишних шагов.',
      accent: 'linear-gradient(135deg, rgba(129, 140, 248, 0.30), rgba(168, 85, 247, 0.18))',
      points: ['Удобные чаты и избранное', 'Видео- и аудиозвонки', 'Плавный старт без лишних модулей'],
      tag: 'Готово к старту',
      heroStat: '3 шага',
      heroCaption: 'и ты уже внутри приложения, где всё под рукой'
    }
  ]

  const currentSlide = slides[activeSlide]
  const isLastSlide = activeSlide === slides.length - 1

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.changedTouches?.[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    if (!isPhone || touchStartXRef.current == null) return

    const endX = event.changedTouches?.[0]?.clientX ?? touchStartXRef.current
    const deltaX = endX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(deltaX) < 42) return
    if (deltaX < 0) {
      setActiveSlide((prev) => Math.min(slides.length - 1, prev + 1))
      return
    }

    setActiveSlide((prev) => Math.max(0, prev - 1))
  }

  const finishOnboarding = async () => {
    setBusy(true)
    setError('')

    try {
      const updatedUser = await authAPI.completeOnboarding()
      onFinish(updatedUser)
      const { googlePasswordSetupToken } = authAPI.getGooglePasswordSetupState()
      navigate(googlePasswordSetupToken ? '/auth/google/setup-password' : '/chat', { replace: true })
    } catch (err) {
      setError(err.message || 'Не удалось завершить приветствие')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at top, rgba(14, 165, 233, 0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(129, 140, 248, 0.12), transparent 24%), linear-gradient(180deg, #020617 0%, #050816 48%, #020617 100%)',
        color: '#f8fafc',
        display: 'flex',
        alignItems: isCompact ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isPhone
          ? 'max(12px, env(safe-area-inset-top)) 10px calc(14px + env(safe-area-inset-bottom))'
          : isCompact
            ? '18px 12px calc(20px + env(safe-area-inset-bottom))'
            : '32px 18px',
        overflowY: 'auto'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>
        {`
          @keyframes welcomeFadeUp {
            0% { opacity: 0; transform: translateY(18px) scale(0.985); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes welcomeFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
        `}
      </style>
      <div
        style={{
          width: '100%',
          maxWidth: isCompact ? '720px' : '1120px',
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.1fr) minmax(320px, 420px)',
          gap: isPhone ? '12px' : isCompact ? '16px' : '22px',
          alignItems: 'stretch'
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: isPhone ? '24px' : isCompact ? '28px' : '36px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: `${currentSlide.accent}, linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.98))`,
            minHeight: isPhone ? (isShortScreen ? '220px' : '248px') : isCompact ? '300px' : '560px',
            boxShadow: '0 32px 90px rgba(2, 6, 23, 0.46)',
            transform: activeSlide === 1 && !isCompact ? 'translateY(-4px)' : 'translateY(0)',
            transition: 'transform 320ms ease, box-shadow 320ms ease'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.08), rgba(2, 6, 23, 0.78))'
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: isPhone ? '132px' : isCompact ? '180px' : '260px',
              height: isPhone ? '132px' : isCompact ? '180px' : '260px',
              right: isPhone ? '-34px' : isCompact ? '-48px' : '-64px',
              top: isPhone ? '-28px' : isCompact ? '-42px' : '-58px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.16)',
              filter: 'blur(8px)',
              opacity: 0.45,
              animation: 'welcomeFloat 7s ease-in-out infinite'
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: isPhone ? '92px' : isCompact ? '120px' : '160px',
              height: isPhone ? '92px' : isCompact ? '120px' : '160px',
              left: isPhone ? '-26px' : isCompact ? '-34px' : '-46px',
              bottom: isPhone ? '62px' : isCompact ? '78px' : '42px',
              borderRadius: '40px',
              background: 'rgba(15, 23, 42, 0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              transform: 'rotate(-18deg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          />
          <div
            key={`visual-${activeSlide}`}
            style={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: isPhone ? '16px' : isCompact ? '22px' : '34px',
              animation: 'welcomeFadeUp 420ms ease'
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: isPhone ? '8px' : '10px', padding: isPhone ? '8px 12px' : '10px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#67e8f9', boxShadow: '0 0 18px rgba(103, 232, 249, 0.9)' }} />
                <span style={{ fontSize: isPhone ? '10px' : '11px', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.86 }}>{currentSlide.eyebrow}</span>
              </div>
              <h1 style={{ margin: isPhone ? '14px 0 10px' : '18px 0 12px', fontSize: isPhone ? '24px' : isCompact ? '30px' : '50px', lineHeight: 1.02, letterSpacing: '-0.05em', maxWidth: '620px' }}>
                {currentSlide.title}
              </h1>
              <p style={{ margin: 0, maxWidth: '560px', fontSize: isPhone ? '13px' : isCompact ? '14px' : '18px', lineHeight: isPhone ? 1.55 : 1.7, color: 'rgba(226, 232, 240, 0.92)' }}>
                {currentSlide.description}
              </p>
              <div
                style={{
                  marginTop: isPhone ? '12px' : '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: isPhone ? '8px 12px' : '10px 14px',
                  borderRadius: isPhone ? '14px' : '16px',
                  background: 'rgba(2, 6, 23, 0.28)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dbeafe',
                  fontSize: isPhone ? '12px' : '13px',
                  fontWeight: 600
                }}
              >
                {currentSlide.tag}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.1fr) minmax(220px, 0.9fr)',
                gap: isPhone ? '10px' : '14px',
                alignItems: 'end'
              }}
            >
              <div
                style={{
                  padding: isPhone ? '12px' : isCompact ? '16px' : '18px',
                  borderRadius: isPhone ? '18px' : '24px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  display: 'grid',
                  gap: isPhone ? '8px' : '10px'
                }}
              >
                {currentSlide.points.map((point) => (
                  <div
                    key={point}
                    style={{
                      padding: isPhone ? '10px 12px' : '12px 14px',
                      borderRadius: isPhone ? '14px' : '18px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: isPhone ? '12px' : isCompact ? '13px' : '14px',
                      lineHeight: isPhone ? 1.4 : 1.5,
                      color: '#e2e8f0'
                    }}
                  >
                    {point}
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: isPhone ? '12px' : isCompact ? '16px' : '18px',
                  borderRadius: isPhone ? '18px' : '26px',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(15, 23, 42, 0.82))',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 24px 60px rgba(2, 6, 23, 0.22)'
                }}
              >
                <div style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(191, 219, 254, 0.88)' }}>
                  AegisTalk Focus
                </div>
                <div style={{ marginTop: '10px', fontSize: isPhone ? '28px' : isCompact ? '34px' : '40px', fontWeight: 900, letterSpacing: '-0.05em' }}>
                  {currentSlide.heroStat}
                </div>
                <div style={{ marginTop: '8px', fontSize: isPhone ? '12px' : isCompact ? '13px' : '14px', lineHeight: isPhone ? 1.45 : 1.6, color: 'rgba(226, 232, 240, 0.86)' }}>
                  {currentSlide.heroCaption}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: isPhone ? '24px' : isCompact ? '28px' : '36px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98))',
            boxShadow: '0 32px 90px rgba(2, 6, 23, 0.46)',
            padding: isPhone ? '16px' : isCompact ? '20px' : '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: isCompact ? 'auto' : '560px'
          }}
        >
          <div key={`panel-${activeSlide}`} style={{ animation: 'welcomeFadeUp 440ms ease' }}>
            <div style={{ display: 'flex', alignItems: isPhone ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', marginBottom: isPhone ? '14px' : '18px', flexDirection: isPhone ? 'column' : 'row' }}>
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(148, 163, 184, 0.84)' }}>
                  Добро пожаловать
                </div>
                <div style={{ marginTop: '8px', fontSize: isPhone ? '20px' : isCompact ? '22px' : '28px', fontWeight: 800 }}>
                  {user?.firstName || user?.username || 'Новый участник'}
                </div>
              </div>
              <div style={{ fontSize: isPhone ? '13px' : '14px', color: 'rgba(148, 163, 184, 0.88)' }}>
                {activeSlide + 1} / {slides.length}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '999px',
                    border: 'none',
                    background: index === activeSlide ? 'linear-gradient(90deg, #38bdf8, #818cf8)' : 'rgba(255,255,255,0.12)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>

            <div
              style={{
                borderRadius: isPhone ? '18px' : '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                padding: isPhone ? '12px' : isCompact ? '16px' : '18px'
              }}
            >
              <div style={{ fontSize: '13px', color: 'rgba(96, 165, 250, 0.96)', marginBottom: '12px' }}>
                Что тебя ждёт дальше
              </div>
              {isPhone ? (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '16px',
                    background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.14), rgba(99, 102, 241, 0.10))',
                    border: '1px solid rgba(96, 165, 250, 0.22)'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.84)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                    Сейчас открыт
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{currentSlide.title}</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {slides.map((slide, index) => (
                    <div
                      key={slide.eyebrow}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '18px',
                        background: index === activeSlide ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.16), rgba(99, 102, 241, 0.12))' : 'rgba(255,255,255,0.02)',
                        border: index === activeSlide ? '1px solid rgba(96, 165, 250, 0.28)' : '1px solid rgba(255,255,255,0.04)',
                        transform: index === activeSlide ? 'translateX(4px)' : 'translateX(0)',
                        transition: 'transform 220ms ease, background 220ms ease, border-color 220ms ease'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'rgba(148, 163, 184, 0.84)', marginBottom: '4px' }}>{slide.eyebrow}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{slide.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.22)',
                  color: '#fecaca',
                  fontSize: '14px'
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: isCompact ? '18px' : '24px', position: isPhone ? 'sticky' : 'static', bottom: isPhone ? '0' : 'auto', paddingTop: isPhone ? '12px' : '0', background: isPhone ? 'linear-gradient(180deg, rgba(2, 6, 23, 0), rgba(2, 6, 23, 0.96) 22%)' : 'transparent' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || activeSlide === 0}
              onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
              style={{ flex: 1, opacity: activeSlide === 0 ? 0.55 : 1, minHeight: isPhone ? '48px' : isCompact ? '52px' : '56px', fontSize: isPhone ? '14px' : '15px' }}
            >
              Назад
            </button>
            {isLastSlide ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={finishOnboarding}
                style={{ flex: 1.25, minHeight: isPhone ? '48px' : isCompact ? '52px' : '56px', boxShadow: '0 20px 44px rgba(99, 102, 241, 0.28)', fontSize: isPhone ? '14px' : '15px' }}
              >
                {busy ? 'Запускаем...' : 'Войти в AegisTalk'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveSlide((prev) => Math.min(slides.length - 1, prev + 1))}
                style={{ flex: 1.25, minHeight: isPhone ? '48px' : isCompact ? '52px' : '56px', boxShadow: '0 20px 44px rgba(99, 102, 241, 0.28)', fontSize: isPhone ? '14px' : '15px' }}
               >
                Дальше
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const App = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const hasPendingOnboarding = Boolean(user && !user.onboardingCompletedAt)
  const hasPendingGooglePasswordSetup = Boolean(user && authAPI.getGooglePasswordSetupState().googlePasswordSetupToken)

  // Блокируем случайный зум страницы при прокрутке с зажатым Ctrl (выглядело как лупа/масштаб)
  useEffect(() => {
    const preventBrowserZoom = (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    }
    window.addEventListener('wheel', preventBrowserZoom, { passive: false })
    return () => window.removeEventListener('wheel', preventBrowserZoom)
  }, [])

  useEffect(() => {
    // Проверяем текущую сиссию при загрузке через backend API
    const checkSession = async () => {
      try {
        const token = getAccessToken()
        if (!token) {
          setLoading(false)
          return
        }
        const userData = await authAPI.getMe()
        if (userData) {
          setUser(normalizeCurrentUser(userData))
        }
      } catch (error) {
        clearTokens()
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  useEffect(() => {
    const handleAppState = async (event) => {
      if (!event?.detail?.isActive) return

      try {
        const token = getAccessToken()
        if (!token) return

        await authAPI.ensureValidToken()
        const userData = await authAPI.getMe()
        if (userData) {
          setUser(normalizeCurrentUser(userData))
        }
      } catch (error) {
        console.error('[NativeApp] session resume check failed:', error)
      }
    }

    window.addEventListener('aegis:app-state', handleAppState)
    return () => window.removeEventListener('aegis:app-state', handleAppState)
  }, [])

  useEffect(() => {
    const handleNativeUrlOpen = (event) => {
      const rawUrl = event?.detail?.url
      if (!rawUrl) return

      try {
        const parsed = new URL(rawUrl)
        if (parsed.protocol !== 'aegistalk:') return

        const internalPath = `/${parsed.host}${parsed.pathname}`.replace(/\/+/g, '/')
        const target = `${internalPath}${parsed.search || ''}${parsed.hash || ''}`

        window.history.replaceState({}, '', target)
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch (error) {
        console.error('[NativeApp] failed to handle deep link:', error)
      }
    }

    window.addEventListener('aegis:url-open', handleNativeUrlOpen)
    return () => window.removeEventListener('aegis:url-open', handleNativeUrlOpen)
  }, [])

  const handleLogin = (userData) => {
    setUser(normalizeCurrentUser(userData))
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      clearTokens()
      setUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--bg-tertiary)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    )
  }

  return (
    <SocketProvider userId={user?.id}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallbackPage onLogin={handleLogin} />} />
          <Route path="/auth/google/setup-password" element={<GooglePasswordSetupPage onLogin={handleLogin} />} />
          <Route path="/welcome" element={user ? <WelcomeSlidesPage user={user} onFinish={handleLogin} /> : <Navigate to="/login" />} />
          <Route path="/join" element={<JoinPage user={user} />} />
          <Route
            path="/profile"
            element={
              user
                ? (hasPendingOnboarding
                  ? <Navigate to="/welcome" replace />
                  : hasPendingGooglePasswordSetup
                    ? <Navigate to="/auth/google/setup-password" replace />
                  : <ProfileDemoAppV3 user={user} setUser={setUser} onLogout={handleLogout} />)
                : <Navigate to="/login" />
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute user={user} requireOwner unauthorized="404">
                <AdminPanel user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              user
                ? (hasPendingOnboarding
                  ? <Navigate to="/welcome" replace />
                  : hasPendingGooglePasswordSetup
                    ? <Navigate to="/auth/google/setup-password" replace />
                  : <ChatPage user={user} setUser={setUser} onLogout={handleLogout} />)
                : <Navigate to="/login" />
            }
          />
          <Route path="/" element={<Navigate to={hasPendingOnboarding ? '/welcome' : (hasPendingGooglePasswordSetup ? '/auth/google/setup-password' : '/chat')} replace />} />
        </Routes>
      </Router>
      <div className="copy-footer-badge">Копия</div>
    </SocketProvider>
  )
}

export default App

// Новый профиль V3 - нормальное разрешение
const ProfileDemoAppV3 = ({ user, setUser, onLogout }) => {
  const navigate = useNavigate()
  const [isBooting, setIsBooting] = useState(!user)
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false))
  const [activeTab, setActiveTab] = useState(0)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isWatchModalOpen, setIsWatchModalOpen] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [editModal, setEditModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [modalBusy, setModalBusy] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    username: user?.username || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || ''
  })
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', code: '' })
  const [passwordStep, setPasswordStep] = useState('idle')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: user?.email || '', code: '' })
  const [emailStep, setEmailStep] = useState('idle')
  const [emailLoading, setEmailLoading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const sessionsLoadedRef = useRef(false)
  const [terminatingSessionIds, setTerminatingSessionIds] = useState({})
  const [terminateOthersLoading, setTerminateOthersLoading] = useState(false)
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false)
  const [privacySettings, setPrivacySettings] = useState({
    phoneVisibility: 'contacts',
    groupInvites: 'contacts',
    avatarVisibility: 'contacts',
    lastSeen: 'contacts'
  })

  useEffect(() => {
    const prefs = readNotifyPrefs()
    setPushEnabled(Boolean(prefs.pushEnabled))
    setSoundEnabled(Boolean(prefs.soundEnabled))
  }, [])

  useEffect(() => {
    writeNotifyPrefs({ pushEnabled, soundEnabled })
  }, [pushEnabled, soundEnabled])

  const showStatus = (type, message) => {
    setStatusType(type)
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(''), 3000)

    const text = String(message || '').trim()
    if (!text) return
    if (type === 'error') toast.error(text)
    else toast.success(text)
  }

  useEffect(() => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      username: user?.username || '',
      bio: user?.bio || '',
      avatarUrl: user?.avatarUrl || ''
    })
    setEmailForm((prev) => ({ ...prev, newEmail: user?.email || '' }))
  }, [user?.firstName, user?.lastName, user?.email, user?.username, user?.bio, user?.avatarUrl])

  // Tailwind и иконки собираются через PostCSS/Vite, CDN не нужен
  useEffect(() => {
    if (!document.querySelector('link[data-aegistalk-fa]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
      link.integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=='
      link.crossOrigin = 'anonymous'
      link.referrerPolicy = 'no-referrer'
      link.setAttribute('data-aegistalk-fa', 'true')
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (isBooting) setIsBooting(false)
  }, [user, navigate, isBooting])

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aegistalk_profile_privacy_v3')
      if (stored) {
        const parsed = JSON.parse(stored)
        setPrivacySettings((prev) => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignore malformed data
    }
  }, [])

  if (!user || isBooting) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-zinc-950 text-white">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  const persistPrivacySettings = (next) => {
    setPrivacySettings(next)
    try {
      localStorage.setItem('aegistalk_profile_privacy_v3', JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  const displayName = formData.firstName?.trim() || user?.firstName?.trim() || 'A'
  const displayLastName = formData.lastName?.trim() || user?.lastName?.trim() || ''
  const displayUsername = (formData.username?.trim() || user?.username?.trim() || 'user').replace(/^@+/, '')
  const displayBio = formData.bio?.trim() || 'Tap to add bio'
  const avatarInitial = displayName.charAt(0).toUpperCase()
  const groupedSessions = (() => {
    const map = new Map()
    for (const s of sessions) {
      const ua = String(s?.userAgent || '').trim()
      const key = ua || `${s?.deviceType || ''}|${s?.deviceName || ''}|${s?.ipAddress || ''}`
      const isThisDevice = !!(s?.isCurrent || (currentSessionId && s?.id === currentSessionId))

      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ...s, _isThisDevice: isThisDevice })
        continue
      }

      const prevTs = new Date(existing?.lastActiveAt || existing?.createdAt || 0).getTime()
      const nextTs = new Date(s?.lastActiveAt || s?.createdAt || 0).getTime()
      if (nextTs > prevTs) {
        map.set(key, { ...s, _isThisDevice: existing._isThisDevice || isThisDevice })
      } else if (isThisDevice && !existing._isThisDevice) {
        map.set(key, { ...existing, _isThisDevice: true })
      }
    }
    return Array.from(map.values())
  })()

  const otherSessionsCount = groupedSessions.filter((s) => !s?._isThisDevice).length

  const sortedSessions = [...groupedSessions].sort((a, b) => {
    const aCur = !!a?._isThisDevice
    const bCur = !!b?._isThisDevice
    if (aCur !== bCur) return aCur ? -1 : 1
    const aTs = new Date(a?.lastActiveAt || a?.createdAt || 0).getTime()
    const bTs = new Date(b?.lastActiveAt || b?.createdAt || 0).getTime()
    return bTs - aTs
  })

  const updateUserState = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }))
    if (setUser) {
      setUser((prev) => ({ ...prev, ...patch }))
    }
  }

  const updateProfileFields = async (patch, successText) => {
    await profileAPI.updateProfile(patch)
    updateUserState(patch)
    showStatus('success', successText)
  }

  const handleRequestPasswordCode = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      showStatus('error', 'Введите текущий и новый пароль')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      showStatus('error', 'Новый пароль должен быть не менее 8 символов')
      return
    }
    try {
      setPasswordLoading(true)
      const result = await authAPI.requestPasswordChange({ oldPassword: passwordForm.oldPassword })
      setPasswordStep('codeSent')
      showStatus('success', result.message || 'Код отправлен на почту')
    } catch (err) {
      showStatus('error', err.message || 'Не удалось отправить код')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleConfirmPasswordChange = async () => {
    if (!passwordForm.code || !passwordForm.newPassword) {
      showStatus('error', 'Введите код из письма и новый пароль')
      return
    }
    try {
      setPasswordLoading(true)
      const result = await authAPI.confirmPasswordChange({
        code: passwordForm.code,
        newPassword: passwordForm.newPassword
      })
      setPasswordForm({ oldPassword: '', newPassword: '', code: '' })
      setPasswordStep('idle')
      showStatus('success', result.message || 'Пароль изменён')
    } catch (err) {
      showStatus('error', err.message || 'Не удалось изменить пароль')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleRequestEmailCode = async () => {
    const normalizedEmail = emailForm.newEmail.trim().toLowerCase()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showStatus('error', 'Введите корректный email')
      return
    }
    if (normalizedEmail === (formData.email || '').trim().toLowerCase()) {
      showStatus('error', 'Новый email должен отличаться от текущего')
      return
    }
    try {
      setEmailLoading(true)
      const result = await profileAPI.requestEmailChange(normalizedEmail)
      setEmailForm((prev) => ({ ...prev, newEmail: normalizedEmail }))
      setEmailStep('codeSent')
      showStatus('success', result.message || 'Код отправлен на новый email')
    } catch (err) {
      showStatus('error', err.message || 'Не удалось отправить код')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleConfirmEmailChange = async () => {
    const normalizedEmail = emailForm.newEmail.trim().toLowerCase()
    if (!normalizedEmail || !emailForm.code.trim()) {
      showStatus('error', 'Введите email и код из письма')
      return
    }
    try {
      setEmailLoading(true)
      const result = await profileAPI.confirmEmailChange({
        email: normalizedEmail,
        code: emailForm.code.trim()
      })
      updateUserState({ email: normalizedEmail })
      setEmailForm({ newEmail: normalizedEmail, code: '' })
      setEmailStep('idle')
      showStatus('success', result.message || 'Email изменён')
    } catch (err) {
      showStatus('error', err.message || 'Не удалось изменить email')
    } finally {
      setEmailLoading(false)
    }
  }

  const loadSessions = async () => {
    if (sessionsLoading) return

    setSessionsLoading(true)
    setSessionsError('')

    try {
      await authAPI.ensureValidToken()
      const result = await authAPI.getSessions()
      setSessions(Array.isArray(result.sessions) ? result.sessions : [])
      setCurrentSessionId(result.currentSessionId || null)
    } catch (err) {
      setSessionsError(err.message || 'Не удалось получить список сессий')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleTerminateSession = async (sessionId) => {
    if (!sessionId || terminatingSessionIds[sessionId]) return

    setTerminatingSessionIds((prev) => ({ ...prev, [sessionId]: true }))
    setSessionsError('')

    try {
      await authAPI.terminateSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      setSessionsError(err.message || 'Не удалось завершить сессию')
    } finally {
      setTerminatingSessionIds((prev) => {
        const next = { ...prev }
        delete next[sessionId]
        return next
      })
    }
  }

  const handleTerminateOtherSessions = async () => {
    if (terminateOthersLoading) return

    setTerminateOthersLoading(true)
    setSessionsError('')

    try {
      await authAPI.terminateOtherSessions()
      setSessions((prev) => prev.filter((s) => s.isCurrent || (currentSessionId && s.id === currentSessionId)))
    } catch (err) {
      setSessionsError(err.message || 'Не удалось завершить другие сессии')
    } finally {
      setTerminateOthersLoading(false)
    }
  }

  const openSessionsModal = () => {
    setIsSessionsModalOpen(true)
    if (!sessionsLoadedRef.current) {
      sessionsLoadedRef.current = true
      loadSessions()
    }
  }

  const closeSessionsModal = () => setIsSessionsModalOpen(false)

  const getSessionIconClass = (deviceType) => {
    const t = String(deviceType || '').toLowerCase()
    if (t === 'mobile') return 'fa-mobile-screen'
    if (t === 'tablet') return 'fa-tablet-screen-button'
    return 'fa-laptop'
  }

  const toggleAvatarMenu = () => setIsAvatarMenuOpen((prev) => !prev)
  const openWatchPreview = () => setIsWatchModalOpen(true)
  const closeWatchPreview = () => setIsWatchModalOpen(false)
  const handleBackToChat = () => navigate('/chat')

  const changePhoto = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (event) => {
      const file = event.target?.files?.[0]
      if (!file) return
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (file.size > 5 * 1024 * 1024) {
        showStatus('error', 'Avatar must be up to 5MB')
        return
      }
      if (!allowed.includes(file.type)) {
        showStatus('error', 'Allowed formats: JPEG, PNG, GIF, WebP')
        return
      }

      try {
        setIsUploadingAvatar(true)
        const result = await profileAPI.uploadAvatar(file)
        const avatarUrl = result?.avatarUrl || ''
        updateUserState({ avatarUrl })
        showStatus('success', 'Photo updated')
      } catch (err) {
        showStatus('error', err.message || 'Failed to upload photo')
      } finally {
        setIsUploadingAvatar(false)
      }
    }
    input.click()
  }

  const deletePhoto = async () => {
    try {
      setIsUploadingAvatar(true)
      await profileAPI.removeAvatar()
      updateUserState({ avatarUrl: '' })
      showStatus('success', 'Photo removed')
    } catch (err) {
      showStatus('error', err.message || 'Failed to remove photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const editName = async () => {
    setEditModal({
      type: 'name',
      title: 'Изменить имя',
      description: 'Укажите отображаемое имя профиля.',
      value: displayName,
      placeholder: 'Ваше имя',
      actionLabel: 'Сохранить',
      multiline: false
    })
  }

  const editLastName = async () => {
    setEditModal({
      type: 'lastName',
      title: 'Изменить фамилию',
      description: 'Фамилию можно оставить пустой.',
      value: formData.lastName || '',
      placeholder: 'Фамилия',
      actionLabel: 'Сохранить',
      multiline: false,
      allowEmpty: true
    })
  }

  const editUsername = async () => {
    setEditModal({
      type: 'username',
      title: 'Изменить username',
      description: 'Этот username будут видеть другие пользователи.',
      value: displayUsername,
      placeholder: 'username',
      actionLabel: 'Сохранить',
      multiline: false
    })
  }

  const editBio = async () => {
    setEditModal({
      type: 'bio',
      title: 'О себе',
      description: 'Короткое описание профиля.',
      value: formData.bio || '',
      placeholder: 'Расскажите о себе',
      actionLabel: 'Сохранить',
      multiline: true
    })
  }

  const deleteAccount = async () => {
    setConfirmModal({
      type: 'deleteAccount',
      title: 'Удалить аккаунт',
      description: 'Это действие нельзя отменить. Введите пароль, чтобы подтвердить удаление аккаунта.',
      password: '',
      actionLabel: 'Удалить аккаунт',
      danger: true
    })
  }

  const logout = () => {
    setConfirmModal({
      type: 'logout',
      title: 'Выйти из аккаунта',
      description: 'Текущая сессия будет завершена на этом устройстве.',
      actionLabel: 'Выйти',
      danger: false
    })
  }

  const submitEditModal = async () => {
    if (!editModal) return

    const rawValue = editModal.value ?? ''
    const trimmedValue = editModal.type === 'bio'
      ? rawValue.trim()
      : rawValue.trim().replace(/^@+/, '')

    if (editModal.type !== 'bio' && !editModal.allowEmpty && !trimmedValue) {
      showStatus('error', editModal.type === 'name' ? 'Name cannot be empty' : 'Username cannot be empty')
      return
    }

    try {
      setModalBusy(true)
      if (editModal.type === 'name') {
        await updateProfileFields({ firstName: trimmedValue }, 'Name updated')
      } else if (editModal.type === 'lastName') {
        await updateProfileFields({ lastName: trimmedValue || '' }, 'Last name updated')
      } else if (editModal.type === 'username') {
        await updateProfileFields({ username: trimmedValue }, 'Username updated')
      } else if (editModal.type === 'bio') {
        await updateProfileFields({ bio: trimmedValue }, 'Bio updated')
      }
      setEditModal(null)
    } catch (err) {
      showStatus('error', err.message || 'Failed to update profile')
    } finally {
      setModalBusy(false)
    }
  }

  const submitConfirmModal = async () => {
    if (!confirmModal) return

    try {
      setModalBusy(true)

      if (confirmModal.type === 'deletePhoto') {
        await deletePhoto()
      } else if (confirmModal.type === 'logout') {
        if (onLogout) onLogout()
        navigate('/login')
      } else if (confirmModal.type === 'deleteAccount') {
        const password = (confirmModal.password || '').trim()
        if (!password) {
          showStatus('error', 'Enter your password')
          return
        }
        setIsDeletingAccount(true)
        await profileAPI.deleteAccount({ password })
        if (onLogout) onLogout()
        navigate('/login')
      }

      setConfirmModal(null)
    } catch (err) {
      showStatus('error', err.message || 'Action failed')
    } finally {
      setModalBusy(false)
      setIsDeletingAccount(false)
    }
  }

  const handleAvatarMenuBackdropClick = (event) => {
    if (event.target.id === 'avatarMenu') toggleAvatarMenu()
  }
  const handleWatchModalBackdropClick = (event) => {
    if (event.target.id === 'watchModal') closeWatchPreview()
  }
  const switchTab = (n) => setActiveTab(n)

  const updatePrivacySetting = (key, value) => {
    persistPrivacySettings({
      ...privacySettings,
      [key]: value
    })
    showStatus('success', 'Настройка сохранена')
  }

  return (
    <div
      className="profile-v3-root relative h-screen overflow-y-auto overflow-x-hidden"
      style={{ fontSize: isDesktop ? '15px' : '14px' }}
    >
      <div className="profile-v3-bg" aria-hidden="true" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .profile-v3-root {
          --p-bg0: #000000;
          --p-bg1: #000000;
          --p-card: rgba(18, 18, 24, 0.72);
          --p-card2: rgba(18, 18, 24, 0.86);
          --p-border: rgba(255, 255, 255, 0.10);
          --p-border2: rgba(255, 255, 255, 0.16);
          --p-text: #e8edf6;
          --p-muted: rgba(232, 237, 246, 0.68);
          --p-accent: #22d3ee;
          --p-accent2: #34d399;

          color: var(--p-text);
          font-family: 'Manrope', Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          background: #000000;
        }

        .profile-v3-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.55;
        }
        .profile-v3-bg::before {
          content: '';
          position: absolute;
          inset: -24px;
          background:
            radial-gradient(circle at 20% 15%, rgba(34, 211, 238, 0.16), transparent 46%),
            radial-gradient(circle at 80% 10%, rgba(52, 211, 153, 0.10), transparent 46%),
            radial-gradient(circle at 50% 110%, rgba(34, 211, 238, 0.07), transparent 55%),
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.030) 0, rgba(255, 255, 255, 0.030) 1px, transparent 1px, transparent 20px);
          filter: blur(0.25px);
          animation: bgDrift 10s ease-in-out infinite alternate;
        }
        .profile-v3-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.08), transparent);
          opacity: 0.18;
          transform: translateY(-40%);
          animation: scanLine 6.5s linear infinite;
          mix-blend-mode: screen;
        }
        @keyframes bgDrift {
          from { transform: translate3d(0, 0, 0) scale(1); opacity: 0.9; }
          to { transform: translate3d(-2.5%, 1.2%, 0) scale(1.02); opacity: 1; }
        }
        @keyframes scanLine {
          from { transform: translateY(-60%); }
          to { transform: translateY(140%); }
        }

        .profile-v3-shell { position: relative; z-index: 1; }
        .profile-v3-header {
          background: rgba(0, 0, 0, 0.26);
          border: 1px solid var(--p-border);
          border-radius: 18px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(16px);
          margin: 14px 0 10px;
        }
        .profile-v3-header::after {
          content: '';
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.40), rgba(52, 211, 153, 0.30), transparent);
          opacity: 0.9;
        }

        .profile-v3-setting-toggle .profile-v3-switch {
          width: 54px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid var(--p-border);
          background: rgba(255, 255, 255, 0.06);
          position: relative;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
          transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .profile-v3-setting-toggle .profile-v3-switch::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: rgba(232, 237, 246, 0.92);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.55);
          transition: transform 0.18s ease, background 0.18s ease;
        }
        .profile-v3-setting-toggle .peer:checked + .profile-v3-switch {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.92), rgba(52, 211, 153, 0.86));
          border-color: rgba(34, 211, 238, 0.55);
          box-shadow: 0 18px 50px rgba(0,0,0,0.40);
        }
        .profile-v3-setting-toggle .peer:checked + .profile-v3-switch::after {
          transform: translateX(24px);
          background: rgba(8, 16, 20, 0.92);
        }

        .avatar { transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease; }
        .avatar:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 0 0 10px rgba(34, 211, 238, 0.15), 0 25px 60px rgba(0,0,0,0.55); filter: saturate(1.05); }
        .menu { animation: menuPop 0.25s ease; }
        @keyframes menuPop { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        .watch-modal { animation: watchPop 0.3s ease; }
        @keyframes watchPop { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
        .watch { width: 200px; height: 260px; background: linear-gradient(145deg, #1f1f1f, #0a0a0a); border-radius: 40px; border: 10px solid #111; box-shadow: 0 20px 40px -10px rgb(0 0 0 / 0.7); overflow: hidden; position: relative; }
        .watch::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 50px; height: 4px; background: #222; border-radius: 9999px; z-index: 10; }
        .tab-active { color: #081014; background: linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(52, 211, 153, 0.90)); box-shadow: 0 14px 40px rgba(0,0,0,0.45); }
        .tab-content { animation: tabFade 0.18s ease both; }
        @keyframes tabFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .status-message { margin: 10px 20px 0; padding: 12px 14px; border-radius: 12px; font-size: 12px; text-align: center; border: 1px solid transparent; }
        .status-message.success { background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.45); color: #6ee7b7; }
        .status-message.error { background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.45); color: #fca5a5; }
        .avatar-image-real { width: 100%; height: 100%; object-fit: cover; border-radius: 9999px; }
        .avatar-upload-state { position: absolute; inset: 0; background: rgba(10, 10, 10, 0.6); display: flex; align-items: center; justify-content: center; border-radius: 9999px; font-weight: 600; font-size: 12px; }
        .privacy-select { background: rgba(0, 0, 0, 0.28); border: 1px solid var(--p-border); border-radius: 14px; padding: 12px 14px; font-size: 12px; color: var(--p-text); backdrop-filter: blur(10px); }
        .privacy-select:focus { outline: 2px solid rgba(34, 211, 238, 0.55); outline-offset: 1px; }
        .profile-v3-shell { width: min(100%, 1140px); margin: 0 auto; padding: 0 16px 32px; animation: profileEnter 0.22s ease both; }
        @keyframes profileEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .profile-v3-shell, .tab-content, .menu, .watch-modal, .profile-v3-bg::before, .profile-v3-bg::after { animation: none !important; }
          .avatar, .profile-v3-tabs-row > button, .profile-v3-action-button { transition: none !important; }
        }
        .profile-v3-content-card { max-width: 940px; margin: 0 auto; background: var(--p-card2) !important; border: 1px solid var(--p-border); box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
        .profile-v3-tabs-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          background: rgba(0, 0, 0, 0.20);
          border: 1px solid var(--p-border);
          border-radius: 18px;
          padding: 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2px;
          gap: 6px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        }
        .profile-v3-tabs-row > button {
          min-width: 0;
          padding: 10px 10px;
          border-radius: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: transform 0.16s ease, background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
        }
        .profile-v3-tabs-row > button:not(.tab-active):hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.05);
        }
        .profile-v3-actions {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 28px;
          flex-wrap: wrap;
        }
        .profile-v3-action-button {
          width: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 10px 12px;
          border-radius: 22px;
          border: 1px solid var(--p-border);
          background: rgba(0, 0, 0, 0.18);
          box-shadow: 0 20px 55px rgba(0,0,0,0.40);
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .profile-v3-action-button:hover {
          transform: translateY(-2px);
          border-color: var(--p-border2);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 28px 70px rgba(0,0,0,0.55);
        }
        .profile-v3-action-icon {
          width: 56px;
          height: 56px;
          font-size: 24px;
        }
        .profile-v3-privacy-card {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) minmax(220px, 240px);
          align-items: center;
          gap: 16px;
          background: var(--p-card2) !important;
          border: 1px solid var(--p-border);
          border-radius: 22px;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.50);
        }
        .profile-v3-privacy-card > i {
          justify-self: center;
        }
        .profile-v3-privacy-content {
          min-width: 0;
        }
        .profile-v3-privacy-select {
          width: 100%;
          margin-top: 0;
          justify-self: end;
        }
        .profile-v3-security-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        #content2 .profile-v3-security-card {
          border: 1px solid var(--p-border);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.18);
        }
        #content2 .auth-input {
          height: 40px;
          padding: 9px 12px;
          border-radius: 16px;
          border-color: var(--p-border) !important;
          background: rgba(0, 0, 0, 0.22);
          color: var(--p-text);
        }
        #content2 .profile-v3-inline-row {
          display: flex;
          align-items: stretch;
          gap: 10px;
        }
        #content2 .profile-v3-inline-row > .auth-input {
          flex: 1;
          min-width: 0;
        }
        #content2 .profile-v3-mini-btn {
          height: 40px;
          padding: 0 12px;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid #333;
          color: #e5e7eb;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
          white-space: nowrap;
        }
        #content2 .profile-v3-mini-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.04);
        }
        #content2 .profile-v3-mini-btn.primary {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
        #content2 .profile-v3-mini-btn.primary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.22);
        }
        #content2 .profile-v3-mini-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
        #content2 .profile-v3-setting-btn {
          width: 100%;
          height: 40px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid #333;
          color: #e5e7eb;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 14px;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
        }
        #content2 .profile-v3-setting-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.04);
        }
        #content2 .profile-v3-setting-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
        .profile-v3-danger-link {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.45);
          padding: 8px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: transparent;
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .profile-v3-danger-link:hover {
          color: rgba(252, 165, 165, 0.95);
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.06);
        }
        .profile-v3-danger-link:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        #content2 .profile-v3-inline-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
          font-size: 12px;
        }
        #content2 .profile-v3-sessions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
        #content2 .profile-v3-session-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #333;
          background: rgba(0, 0, 0, 0.22);
        }
        #content2 .profile-v3-session-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        #content2 .profile-v3-session-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          color: #93c5fd;
          flex-shrink: 0;
        }
        #content2 .profile-v3-session-meta {
          min-width: 0;
        }
        #content2 .profile-v3-session-title {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #content2 .profile-v3-session-sub {
          font-size: 11px;
          color: #a1a1aa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #content2 .profile-v3-session-right {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        #content2 .profile-v3-badge-online {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.14);
          border: 1px solid rgba(16, 185, 129, 0.45);
          color: #6ee7b7;
        }
        #content2 .profile-v3-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #333;
          background: rgba(0, 0, 0, 0.2);
          color: #d4d4d8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        #content2 .profile-v3-icon-btn:hover {
          transform: translateY(-1px);
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.55);
          color: #fca5a5;
        }
        #content2 .profile-v3-icon-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        #content2 .profile-v3-terminate-others-btn {
          width: 100%;
          margin-top: 12px;
          height: 40px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(220, 38, 38, 1));
          color: #ffffff;
          border: 1px solid rgba(239, 68, 68, 0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }
        #content2 .profile-v3-terminate-others-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(239, 68, 68, 0.35);
        }
        #content2 .profile-v3-terminate-others-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .profile-v3-sessions-modal .profile-v3-sessions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
          padding-right: 6px;
        }
        .profile-v3-sessions-modal .profile-v3-session-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #333;
          background: rgba(0, 0, 0, 0.22);
          max-width: 100%;
        }
        .profile-v3-sessions-modal .profile-v3-session-left {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }
        .profile-v3-sessions-modal .profile-v3-session-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          color: #93c5fd;
          flex-shrink: 0;
        }
        .profile-v3-sessions-modal .profile-v3-session-meta {
          min-width: 0;
        }
        .profile-v3-sessions-modal .profile-v3-session-title {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-v3-sessions-modal .profile-v3-session-sub {
          font-size: 11px;
          color: #a1a1aa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-v3-sessions-modal .profile-v3-session-right {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .profile-v3-sessions-modal .profile-v3-badge-online {
          font-size: 10px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 9999px;
          background: rgba(59, 130, 246, 0.14);
          border: 1px solid rgba(59, 130, 246, 0.45);
          color: #bfdbfe;
        }
        .profile-v3-sessions-modal .profile-v3-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #333;
          background: rgba(0, 0, 0, 0.2);
          color: #d4d4d8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .profile-v3-sessions-modal .profile-v3-icon-btn:hover {
          transform: translateY(-1px);
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.55);
          color: #fca5a5;
        }
        .profile-v3-sessions-modal .profile-v3-icon-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        .profile-v3-sessions-modal .profile-v3-terminate-others-btn {
          width: 100%;
          margin-top: 12px;
          height: 40px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(220, 38, 38, 1));
          color: #ffffff;
          border: 1px solid rgba(239, 68, 68, 0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }
        .profile-v3-sessions-modal .profile-v3-terminate-others-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(239, 68, 68, 0.35);
        }
        .profile-v3-sessions-modal .profile-v3-terminate-others-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        #content2 .profile-v3-device-mgmt-btn {
          width: 100%;
          height: 40px;
          margin-top: 12px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(99, 102, 241, 1));
          color: #ffffff;
          border: 1px solid rgba(99, 102, 241, 0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }
        #content2 .profile-v3-device-mgmt-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(99, 102, 241, 0.35);
        }
        #content2 .profile-v3-device-mgmt-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .profile-v3-setting-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
        }
        .profile-v3-setting-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .profile-v3-setting-copy {
          min-width: 0;
        }
        .profile-v3-setting-copy > div:last-child {
          line-height: 1.35;
        }
        .profile-v3-setting-toggle {
          justify-self: end;
          flex-shrink: 0;
        }
        @media (min-width: 1024px) {
          .profile-v3-shell { padding: 16px 24px 40px; }
          .profile-v3-header { border-radius: 20px; margin-bottom: 12px; }
          .profile-v3-profile-top { padding-top: 28px; }
          .profile-v3-actions { margin-top: 24px; }
          .profile-v3-tabs-wrap { margin-top: 30px; }
          .profile-v3-tabs-row { font-size: 13px; padding: 7px; gap: 8px; }
          .profile-v3-tabs-row > button { padding: 12px 14px; }
          .tab-content { padding-top: 20px; padding-bottom: 24px; }
          #content1 .space-y-3 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          #content1 .space-y-3 > * + * { margin-top: 0 !important; }
          #content1 .profile-v3-privacy-card { min-height: 132px; }
          #content2 .bg-zinc-900 { max-width: 760px; margin: 0 auto; }
        }
        @media (max-width: 640px) {
          .profile-v3-shell { padding-left: 12px; padding-right: 12px; }
          .profile-v3-header { padding-left: 16px; padding-right: 16px; }
          .profile-v3-profile-top { padding-top: 22px; }
          .profile-v3-profile-top .mt-5 { margin-top: 16px; }
          .profile-v3-tabs-wrap { margin-top: 26px; padding-left: 0; padding-right: 0; }
          .profile-v3-tabs-row { font-size: 10px; }
          .profile-v3-privacy-card {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .profile-v3-privacy-content {
            width: 100%;
          }
          .profile-v3-privacy-select {
            margin-top: 0;
          }
          .profile-v3-security-header {
            align-items: flex-start;
          }
          .profile-v3-security-header i {
            font-size: 28px !important;
          }
          .profile-v3-setting-row {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }
          .profile-v3-setting-main {
            width: 100%;
          }
          .profile-v3-setting-toggle {
            justify-self: start;
          }
          #content2 .bg-zinc-900 {
            padding: 20px;
          }
          #content2 .profile-v3-inline-row {
            flex-direction: column;
          }
          #content2 .profile-v3-mini-btn {
            width: 100%;
          }
        }
      `}</style>

      <div className="profile-v3-shell">
        <div className="profile-v3-header px-5 py-4 flex items-center sticky top-0 z-50">
          <button type="button" onClick={handleBackToChat} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left text-xl" />
          </button>
          <div className="flex-1 text-center font-bold text-xl tracking-tighter">Профиль</div>
        </div>

        {/* Profile uses bottom-right toasts for feedback; keep state for internal flows if needed. */}

        <div className="profile-v3-profile-top pt-8 flex flex-col items-center">
          <button type="button" onClick={toggleAvatarMenu} id="avatarBtn" className="avatar w-28 h-28 bg-gradient-to-br from-cyan-400 via-sky-500 to-emerald-400 rounded-full flex items-center justify-center cursor-pointer shadow-xl relative ring-6 ring-cyan-500/20">
            {formData.avatarUrl ? (
              <img src={formData.avatarUrl} alt="Avatar" className="avatar-image-real" />
            ) : (
              <span className="text-5xl font-black text-white tracking-[-2px]">{avatarInitial}</span>
            )}
            {isUploadingAvatar && <div className="avatar-upload-state">Uploading...</div>}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-400 rounded-2xl border-4 border-zinc-950 flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-circle text-[8px] text-emerald-950" />
            </div>
          </button>

          <div className="mt-5 flex items-center gap-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button type="button" onClick={editName} className="text-3xl font-bold cursor-pointer hover:text-cyan-200 transition-colors">{displayName}</button>
              <button type="button" onClick={editLastName} className="text-3xl font-bold cursor-pointer hover:text-cyan-200 transition-colors">
                {displayLastName || <span style={{ display: 'inline-block', minWidth: '12px' }} aria-label="Добавить фамилию" />}
              </button>
            </div>
            <button type="button" onClick={editName}><i className="fa-solid fa-pencil text-cyan-300 text-lg cursor-pointer" /></button>
          </div>
          <button type="button" onClick={editUsername} className="text-zinc-300/80 text-lg cursor-pointer hover:text-cyan-200 transition-colors">@{displayUsername}</button>

          <button type="button" onClick={editBio} className="mt-6 mx-6 bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-center text-zinc-300 cursor-pointer transition-all max-w-xs text-sm">
            {displayBio}
          </button>
        </div>

        <div className="profile-v3-actions">
          <button type="button" onClick={changePhoto} className="group profile-v3-action-button">
            <div className="profile-v3-action-icon bg-black/25 ring-1 ring-white/10 group-hover:bg-white/5 transition-all rounded-2xl flex items-center justify-center text-2xl">📸</div>
            <span className="text-xs font-medium mt-2 text-cyan-200">Фото</span>
          </button>
          <button type="button" onClick={openWatchPreview} className="group profile-v3-action-button">
            <div className="profile-v3-action-icon bg-black/25 ring-1 ring-white/10 group-hover:bg-white/5 transition-all rounded-2xl flex items-center justify-center text-2xl">⌚</div>
            <span className="text-xs font-medium mt-2 text-cyan-200">На часах</span>
          </button>
        </div>

        <div className="profile-v3-tabs-wrap mt-12 px-5">
          <div className="profile-v3-tabs-row">
            <button type="button" onClick={() => switchTab(0)} id="tab0" className={`flex-1 pb-3 ${activeTab === 0 ? 'tab-active' : 'text-zinc-400'}`}>🔔 Уведомления</button>
            <button type="button" onClick={() => switchTab(1)} id="tab1" className={`flex-1 pb-3 ${activeTab === 1 ? 'tab-active' : 'text-zinc-400'}`}>🔐 Конфиденциальность</button>
            <button type="button" onClick={() => switchTab(2)} id="tab2" className={`flex-1 pb-3 ${activeTab === 2 ? 'tab-active' : 'text-zinc-400'}`}>🛡️ Безопасность</button>
          </div>
        </div>

        {activeTab === 0 && (
          <div id="content0" className="tab-content px-5 py-8">
            <div className="profile-v3-content-card bg-zinc-900 rounded-2xl p-6 space-y-6">
              <div className="profile-v3-setting-row">
                <div className="profile-v3-setting-main">
                  <i className="fa-solid fa-bell text-3xl text-amber-400" />
                  <div className="profile-v3-setting-copy">
                    <div className="font-semibold text-base">Push-уведомления</div>
                    <div className="text-zinc-400 text-sm">Новые сообщения, звонки, упоминания</div>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer profile-v3-setting-toggle">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={pushEnabled}
                    onChange={async () => {
                      const next = !pushEnabled
                      if (!next) {
                        setPushEnabled(false)
                        showStatus('success', 'Уведомления выключены')
                        return
                      }

                      if (!('Notification' in window)) {
                        showStatus('error', 'Уведомления не поддерживаются этим браузером')
                        setPushEnabled(false)
                        return
                      }

                      if (Notification.permission === 'denied') {
                        showStatus('error', 'Разрешите уведомления в настройках браузера')
                        setPushEnabled(false)
                        return
                      }

                      if (Notification.permission === 'default') {
                        try {
                          const perm = await Notification.requestPermission()
                          if (perm !== 'granted') {
                            showStatus('error', 'Уведомления не разрешены')
                            setPushEnabled(false)
                            return
                          }
                        } catch {
                          showStatus('error', 'Не удалось запросить разрешение')
                          setPushEnabled(false)
                          return
                        }
                      }

                      setPushEnabled(true)
                      showStatus('success', 'Уведомления включены')
                    }}
                  />
                  <span className="profile-v3-switch" aria-hidden="true" />
                </label>
              </div>
              <div className="profile-v3-setting-row">
                <div className="profile-v3-setting-main">
                  <i className="fa-solid fa-volume-high text-2xl text-violet-400" />
                  <div className="profile-v3-setting-copy">
                    <div className="font-semibold text-base">Звуковые уведомления</div>
                    <div className="text-zinc-400 text-sm">Проигрывать звук при новых сообщениях</div>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer profile-v3-setting-toggle">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={soundEnabled}
                    onChange={() => {
                      const next = !soundEnabled
                      setSoundEnabled(next)
                      showStatus('success', next ? 'Звук уведомлений включен' : 'Звук уведомлений выключен')
                    }}
                  />
                  <span className="profile-v3-switch" aria-hidden="true" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div id="content1" className="tab-content px-5 py-8">
            <div className="profile-v3-content-card space-y-3">
              <div className="bg-zinc-900 rounded-2xl p-5 profile-v3-privacy-card">
                <i className="fa-solid fa-phone text-3xl text-red-400" />
                <div className="profile-v3-privacy-content">
                  <div className="font-semibold text-sm">Номер телефона</div>
                  <div className="text-xs text-zinc-400">Кто может видеть ваш номер</div>
                </div>
                <select value={privacySettings.phoneVisibility} onChange={(e) => updatePrivacySetting('phoneVisibility', e.target.value)} className="privacy-select profile-v3-privacy-select">
                  <option value="contacts">Только контакты</option>
                  <option value="all">Все</option>
                  <option value="nobody">Никто</option>
                </select>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 profile-v3-privacy-card">
                <i className="fa-solid fa-users text-3xl text-blue-400" />
                <div className="profile-v3-privacy-content">
                  <div className="font-semibold text-sm">Группы</div>
                  <div className="text-xs text-zinc-400">Кто может добавлять вас в группы</div>
                </div>
                <select value={privacySettings.groupInvites} onChange={(e) => updatePrivacySetting('groupInvites', e.target.value)} className="privacy-select profile-v3-privacy-select">
                  <option value="contacts">Только контакты</option>
                  <option value="all">Все</option>
                  <option value="nobody">Никто</option>
                </select>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 profile-v3-privacy-card">
                <i className="fa-solid fa-image text-3xl text-green-400" />
                <div className="profile-v3-privacy-content">
                  <div className="font-semibold text-sm">Фото профиля</div>
                  <div className="text-xs text-zinc-400">Кто видит ваше фото</div>
                </div>
                <select value={privacySettings.avatarVisibility} onChange={(e) => updatePrivacySetting('avatarVisibility', e.target.value)} className="privacy-select profile-v3-privacy-select">
                  <option value="contacts">Только контакты</option>
                  <option value="all">Все</option>
                  <option value="nobody">Никто</option>
                </select>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 profile-v3-privacy-card">
                <i className="fa-solid fa-clock text-3xl text-amber-400" />
                <div className="profile-v3-privacy-content">
                  <div className="font-semibold text-sm">Был(а) недавно</div>
                  <div className="text-xs text-zinc-400">Кто видит время вашей активности</div>
                </div>
                <select value={privacySettings.lastSeen} onChange={(e) => updatePrivacySetting('lastSeen', e.target.value)} className="privacy-select profile-v3-privacy-select">
                  <option value="contacts">Только контакты</option>
                  <option value="all">Все</option>
                  <option value="nobody">Никто</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div id="content2" className="tab-content px-5 py-8">
            <div className="profile-v3-content-card space-y-6">
              <div className="bg-zinc-900 rounded-2xl p-6 profile-v3-security-card">
                <div className="profile-v3-security-header">
                  <i className="fa-solid fa-envelope text-3xl text-sky-400" />
                  <div>
                    <div className="font-semibold text-base">Смена почты</div>
                    <div className="text-zinc-400 text-sm">Подтверждение приходит на новый email</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input type="email" value={formData.email || ''} disabled className="auth-input" placeholder="Текущий email" />

                  <div className="profile-v3-inline-row">
                    <input
                      type="email"
                      value={emailForm.newEmail}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                      className="auth-input"
                      placeholder="Новый email"
                    />
                    <button type="button" onClick={handleRequestEmailCode} disabled={emailLoading} className="profile-v3-mini-btn">
                      {emailLoading ? 'Отправка…' : 'Отправить код'}
                    </button>
                  </div>

                  {emailStep === 'codeSent' && (
                    <div className="profile-v3-inline-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength="6"
                        value={emailForm.code}
                        onChange={(e) => setEmailForm((prev) => ({ ...prev, code: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="auth-input"
                        placeholder="Код из письма"
                      />
                      <button type="button" onClick={handleConfirmEmailChange} disabled={emailLoading} className="profile-v3-mini-btn primary">
                        Подтвердить
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-6 profile-v3-security-card">
                <div className="profile-v3-security-header">
                  <i className="fa-solid fa-key text-3xl text-violet-400" />
                  <div>
                    <div className="font-semibold text-base">Смена пароля</div>
                    <div className="text-zinc-400 text-sm">Код подтверждения отправляется на вашу почту</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                    className="auth-input"
                    placeholder="Текущий пароль"
                  />

                  <div className="profile-v3-inline-row">
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      className="auth-input"
                      placeholder="Новый пароль"
                    />
                    <button type="button" onClick={handleRequestPasswordCode} disabled={passwordLoading} className="profile-v3-mini-btn">
                      {passwordLoading ? 'Отправка…' : 'Отправить код'}
                    </button>
                  </div>

                  {passwordStep === 'codeSent' && (
                    <div className="profile-v3-inline-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength="6"
                        value={passwordForm.code}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, code: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="auth-input"
                        placeholder="Код из письма"
                      />
                      <button type="button" onClick={handleConfirmPasswordChange} disabled={passwordLoading} className="profile-v3-mini-btn primary">
                        Подтвердить
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-6 profile-v3-security-card">
                <div className="profile-v3-security-header">
                  <i className="fa-solid fa-display text-3xl text-emerald-400" />
                  <div>
                    <div className="font-semibold text-base">Устройства и сессии</div>
                    <div className="text-zinc-400 text-sm">Управление активными входами</div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  AegisTalk не хранит ваши пароли в открытом виде и использует сквозное шифрование для сессий.
                </div>

                <button type="button" onClick={openSessionsModal} className="profile-v3-setting-btn mt-3">
                  <span>Управление устройствами</span>
                  <i className="fa-solid fa-chevron-right text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="profile-v3-content-card mt-8 text-center">
              <button type="button" onClick={deleteAccount} disabled={isDeletingAccount} className="profile-v3-danger-link">
                {isDeletingAccount ? 'Удаление…' : 'Удалить аккаунт'}
              </button>
            </div>
          </div>
        )}

        <div className="px-5 mt-10 profile-v3-content-card">
          <button type="button" onClick={logout} className="w-full py-5 bg-zinc-900 hover:bg-red-900/30 text-red-400 rounded-2xl font-medium flex items-center justify-center gap-2 text-sm transition-all">
            <i className="fa-solid fa-right-from-bracket" />
            Выйти из аккаунта
          </button>
        </div>
      </div>

      {isAvatarMenuOpen && (
        <div id="avatarMenu" onClick={handleAvatarMenuBackdropClick} className="fixed inset-0 bg-black/70 z-[100] flex items-end justify-center pb-10">
          <div onClick={(event) => event.stopPropagation()} className="menu bg-zinc-900 w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-3">
              <button type="button" onClick={() => { changePhoto(); toggleAvatarMenu(); }} className="w-full px-5 py-5 hover:bg-zinc-800 rounded-xl flex gap-4 items-center text-left">
                <i className="fa-solid fa-camera text-2xl text-cyan-300" />
                <div>
                  <div className="font-medium text-sm">Изменить фото</div>
                  <div className="text-xs text-zinc-400">до 5 МБ • JPEG, PNG, GIF, WebP</div>
                </div>
              </button>
              <button type="button" onClick={() => { setConfirmModal({ type: 'deletePhoto', title: 'Удалить фото профиля', description: 'Фото будет удалено из вашего профиля.', actionLabel: 'Удалить фото', danger: true }); toggleAvatarMenu(); }} className="w-full px-5 py-5 hover:bg-zinc-800 rounded-xl flex gap-4 items-center text-left">
                <i className="fa-solid fa-trash text-2xl text-red-400" />
                <div className="font-medium text-sm">Удалить фото</div>
              </button>
              <button type="button" onClick={() => { openWatchPreview(); toggleAvatarMenu(); }} className="w-full px-5 py-5 hover:bg-zinc-800 rounded-xl flex gap-4 items-center text-left">
                <i className="fa-solid fa-watch text-2xl text-cyan-300" />
                <div className="font-medium text-sm">Посмотреть на часах</div>
              </button>
            </div>
            <div className="border-t border-zinc-800 px-4 py-4">
              <button type="button" onClick={toggleAvatarMenu} className="w-full text-zinc-400 text-xs font-medium">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {isWatchModalOpen && (
        <div id="watchModal" onClick={handleWatchModalBackdropClick} className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
          <div onClick={(event) => event.stopPropagation()} className="watch-modal bg-zinc-900 rounded-2xl p-6 max-w-[280px] text-center">
            <div className="flex justify-between items-center mb-4">
              <div />
              <div className="font-medium text-sm">Превью на AegisTalk Watch</div>
              <button type="button" onClick={closeWatchPreview} className="text-2xl text-zinc-400">×</button>
            </div>
            <div className="flex justify-center">
              <div className="watch">
                <div className="w-full h-full bg-black rounded-3xl p-4 flex flex-col">
                  <div className="flex-1 bg-zinc-950 rounded-2xl overflow-hidden flex flex-col">
                    <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1"><span className="text-cyan-300">AT</span></div>
                      <div className="flex items-center gap-2"><span>09:41</span><i className="fa-solid fa-battery-three-quarters" /></div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl">{avatarInitial}</div>
                      <div className="text-center">
                      <div className="font-semibold text-white text-sm">{[displayName, displayLastName].filter(Boolean).join(' ')}</div>
                        <div className="text-cyan-300 text-[10px]">@{displayUsername}</div>
                      </div>
                      <div className="text-[9px] text-zinc-400 text-center leading-tight">{displayBio}<br/>Онлайн</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 mt-6">Как будет выглядеть твой профиль на умных часах</p>
            <button type="button" onClick={closeWatchPreview} className="mt-6 w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-medium text-sm transition-colors">Закрыть</button>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-4" onClick={() => !modalBusy && setEditModal(null)}>
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-semibold text-white">{editModal.title}</h3>
                <p className="text-sm text-zinc-400 mt-2">{editModal.description}</p>
              </div>
              <button type="button" onClick={() => setEditModal(null)} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {editModal.multiline ? (
              <textarea
                value={editModal.value}
                onChange={(e) => setEditModal((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={editModal.placeholder}
                rows={5}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-purple-500 resize-none"
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={editModal.value}
                onChange={(e) => setEditModal((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={editModal.placeholder}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-purple-500"
                autoFocus
              />
            )}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setEditModal(null)} className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Отмена</button>
              <button type="button" onClick={submitEditModal} disabled={modalBusy} className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60">
                {modalBusy ? 'Сохранение...' : editModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-4" onClick={() => !modalBusy && setConfirmModal(null)}>
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-semibold text-white">{confirmModal.title}</h3>
                <p className="text-sm text-zinc-400 mt-2">{confirmModal.description}</p>
              </div>
              <button type="button" onClick={() => setConfirmModal(null)} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {confirmModal.type === 'deleteAccount' && (
              <input
                type="password"
                value={confirmModal.password || ''}
                onChange={(e) => setConfirmModal((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Введите пароль"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-red-500"
                autoFocus
              />
            )}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirmModal(null)} className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Отмена</button>
              <button
                type="button"
                onClick={submitConfirmModal}
                disabled={modalBusy}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${confirmModal.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                {modalBusy ? 'Подождите...' : confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSessionsModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeSessionsModal}>
          <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl p-6 profile-v3-sessions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-semibold text-white">Устройства и сессии</h3>
                <p className="text-sm text-zinc-400 mt-2">Текущая сессия помечена как «Это устройство»</p>
              </div>
              <button type="button" onClick={closeSessionsModal} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {sessionsError && (
              <div className="profile-v3-inline-alert mb-3">
                <i className="fa-solid fa-triangle-exclamation" />
                <span className="min-w-0">{sessionsError}</span>
              </div>
            )}

            {sessionsLoading && (
              <div className="text-xs text-zinc-500 mb-3">Загрузка сессий…</div>
            )}

            <div className="profile-v3-sessions-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {!sessionsLoading && sortedSessions.length === 0 && (
                <div className="text-xs text-zinc-500">Активных сессий не найдено</div>
              )}
              {sortedSessions.map((s) => {
                const isThisDevice = !!s?._isThisDevice
                return (
                  <div key={s.id} className="profile-v3-session-item">
                    <div className="profile-v3-session-left">
                      <div className="profile-v3-session-icon" aria-hidden="true">
                        <i className={`fa-solid ${getSessionIconClass(s.deviceType)}`} />
                      </div>
                      <div className="profile-v3-session-meta">
                        <div className="profile-v3-session-title">{s.deviceName || 'Неизвестное устройство'}</div>
                        <div className="profile-v3-session-sub">
                          {(s.ipAddress ? `IP ${s.ipAddress}` : 'IP скрыт')}
                          {s.city ? ` • ${s.city}` : ' • Локация скрыта'}
                        </div>
                      </div>
                    </div>
                    <div className="profile-v3-session-right">
                      {isThisDevice && <span className="profile-v3-badge-online">Это устройство</span>}
                      {!isThisDevice && (
                        <button
                          type="button"
                          onClick={() => handleTerminateSession(s.id)}
                          disabled={!!terminatingSessionIds[s.id]}
                          className="profile-v3-icon-btn"
                          title="Завершить сессию"
                          aria-label="Завершить сессию"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleTerminateOtherSessions}
              disabled={terminateOthersLoading || otherSessionsCount === 0}
              className="profile-v3-terminate-others-btn"
            >
              {terminateOthersLoading ? 'Завершение…' : 'ЗАВЕРШИТЬ ВСЕ ДРУГИЕ СЕАНСЫ'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export { ProfileDemoAppV3 }
