// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, Check, KeyRound, Lock, LogOut, Mail, Monitor, Send, Shield, Smartphone, Tablet, User, X } from 'lucide-react'
import { profileAPI } from './api/profile'
import { usersAPI } from './api/chats'
import { authAPI } from './api/auth'
import { resolveAssetUrl } from './api/runtimeConfig'
import { getShowForwardingAttribution, setShowForwardingAttribution } from './utils/privacySettings'

// Разделы настроек
const SECTIONS = {
  PROFILE: 'profile',
  NOTIFICATIONS: 'notifications',
  PRIVACY: 'privacy',
  SECURITY: 'security'
}

// Иконки для разделов
const SECTION_ICONS = {
  [SECTIONS.PROFILE]: User,
  [SECTIONS.NOTIFICATIONS]: Bell,
  [SECTIONS.PRIVACY]: Lock,
  [SECTIONS.SECURITY]: Shield
}

const SECTION_TITLES = {
  [SECTIONS.PROFILE]: 'Профиль',
  [SECTIONS.NOTIFICATIONS]: 'Уведомления',
  [SECTIONS.PRIVACY]: 'Конфиденциальность',
  [SECTIONS.SECURITY]: 'Безопасность'
}

export const ProfileSettingsModal = ({ user, onClose, onUpdate, onLogout }) => {
  const [activeSection, setActiveSection] = useState(SECTIONS.PROFILE)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Данные профиля
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    phone: user?.phone || '',
    email: user?.email || ''
  })

  // Состояние аватара
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Обновление avatarPreview когда user.avatarUrl меняется
  useEffect(() => {
    if (user?.avatarUrl) {
      const fullUrl = user.avatarUrl.startsWith('/uploads')
        ? resolveAssetUrl(user.avatarUrl)
        : user.avatarUrl;
      setAvatarPreview(fullUrl)
    } else {
      setAvatarPreview(null)
    }
  }, [user?.avatarUrl])

  useEffect(() => {
    setFormData(prev => ({ ...prev, email: user?.email || '' }))
    setEmailForm(prev => ({ ...prev, newEmail: user?.email || '' }))
  }, [user?.email])

  // Проверка username
  const [usernameStatus, setUsernameStatus] = useState('')
  const [debouncedUsername, setDebouncedUsername] = useState(formData.username)

  // Приватность
  const [showForwardingAttribution, setShowForwardingAttr] = useState(() => getShowForwardingAttribution())

  // Настройки уведомлений
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    pushEnabled: true,
    desktopEnabled: true
  })

  // Настройки конфиденциальности
  const [privacySettings, setPrivacySettings] = useState({
    phoneVisibility: 'contacts',
    groupInvites: 'contacts',
    avatarVisibility: 'all',
    lastSeen: 'contacts'
  })

  // Смена пароля
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    code: ''
  })
  const [passwordStep, setPasswordStep] = useState('idle')
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [emailForm, setEmailForm] = useState({
    newEmail: user?.email || '',
    code: ''
  })
  const [emailStep, setEmailStep] = useState('idle')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  // Активные сессии (устройства)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const sessionsLoadedRef = useRef(false)
  const [terminatingSessionIds, setTerminatingSessionIds] = useState({})
  const [terminateOthersLoading, setTerminateOthersLoading] = useState(false)

  // Удаление аккаунта
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Debounce для username
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(formData.username)
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.username])

  // Проверка username на уникальность
  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername === user?.username) {
        setUsernameStatus('')
        return
      }

      setUsernameStatus('checking')
      try {
        const results = await usersAPI.searchUsers(debouncedUsername)
        const isTaken = results.some(u => u.username?.toLowerCase() === debouncedUsername.toLowerCase())
        setUsernameStatus(isTaken ? 'taken' : 'available')
      } catch (err) {
        setUsernameStatus('')
      }
    }

    checkUsername()
  }, [debouncedUsername, user?.username])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({ ...prev, [name]: value }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleEmailInputChange = (e) => {
    const { name, value } = e.target
    setEmailForm(prev => ({ ...prev, [name]: value }))
    setEmailError('')
    setEmailSuccess('')
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

  const handleRequestEmailCode = async (e) => {
    e.preventDefault()

    const normalizedEmail = emailForm.newEmail.trim().toLowerCase()

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Введите корректный новый email')
      return
    }

    if (normalizedEmail === (formData.email || '').trim().toLowerCase()) {
      setEmailError('Укажите email, отличный от текущего')
      return
    }

    setIsEmailLoading(true)
    setEmailError('')
    setEmailSuccess('')

    try {
      const result = await profileAPI.requestEmailChange(normalizedEmail)
      setEmailStep('codeSent')
      setEmailForm(prev => ({ ...prev, newEmail: normalizedEmail }))
      setEmailSuccess(result.message || 'Код отправлен на новый email')
    } catch (err) {
      setEmailError(err.message || 'Не удалось отправить код подтверждения')
    } finally {
      setIsEmailLoading(false)
    }
  }

  const handleConfirmEmailChange = async (e) => {
    e.preventDefault()

    const normalizedEmail = emailForm.newEmail.trim().toLowerCase()

    if (!normalizedEmail || !emailForm.code.trim()) {
      setEmailError('Введите новый email и код из письма')
      return
    }

    setIsEmailLoading(true)
    setEmailError('')
    setEmailSuccess('')

    try {
      const result = await profileAPI.confirmEmailChange({
        email: normalizedEmail,
        code: emailForm.code.trim()
      })

      setFormData(prev => ({ ...prev, email: normalizedEmail }))
      setEmailForm({ newEmail: normalizedEmail, code: '' })
      setEmailStep('idle')
      setEmailSuccess(result.message || 'Email успешно изменён')

      if (onUpdate) {
        await onUpdate()
      }
    } catch (err) {
      setEmailError(err.message || 'Не удалось подтвердить смену email')
    } finally {
      setIsEmailLoading(false)
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

    setTerminatingSessionIds(prev => ({ ...prev, [sessionId]: true }))
    setSessionsError('')

    try {
      await authAPI.terminateSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      setSessionsError(err.message || 'Не удалось завершить сессию')
    } finally {
      setTerminatingSessionIds(prev => {
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
      setSessions(prev => prev.filter(s => s.isCurrent || (currentSessionId && s.id === currentSessionId)))
    } catch (err) {
      setSessionsError(err.message || 'Не удалось завершить другие сессии')
    } finally {
      setTerminateOthersLoading(false)
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

      if (onLogout) {
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

  const handleAvatarClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      if (file.size > 5 * 1024 * 1024) {
        setError('Файл слишком большой. Максимум 5MB')
        return
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setError('Недопустимый формат. Разрешены: JPEG, PNG, GIF, WebP')
        return
      }

      setError('')
      setIsUploadingAvatar(true)

      try {
        const reader = new FileReader()
        reader.onload = (e) => {
          setAvatarPreview(e.target.result)
        }
        reader.readAsDataURL(file)

        const result = await profileAPI.uploadAvatar(file)
        console.log('✅ Avatar uploaded:', result)

        if (onUpdate) {
          await onUpdate()
        }

        setSuccess('✅ Аватар загружен!')
        setTimeout(() => setSuccess(''), 3000)
      } catch (err) {
        console.error('Failed to upload avatar:', err)
        setError(err.message || 'Ошибка при загрузке аватара')
        setAvatarPreview(user?.avatarUrl)
        setTimeout(() => setError(''), 3000)
      } finally {
        setIsUploadingAvatar(false)
      }
    }
    input.click()
  }

  const handleRemoveAvatar = async () => {
    if (!confirm('Удалить аватар?')) return

    setIsUploadingAvatar(true)
    try {
      await profileAPI.removeAvatar()
      setAvatarPreview(null)
      if (onUpdate) {
        await onUpdate()
      }
      setSuccess('✅ Аватар удалён!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Failed to remove avatar:', err)
      setError(err.message || 'Ошибка при удалении аватара')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()

    if (usernameStatus === 'taken') {
      setError('Это имя пользователя уже занято')
      return
    }

    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        bio: formData.bio
      }

      const result = await profileAPI.updateProfile(updateData)
      console.log('✅ Profile updated:', result)

      if (onUpdate) {
        await onUpdate()
      }

      setSuccess('✅ Профиль обновлён!')
      setTimeout(() => {
        setSuccess('')
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Failed to update profile:', err)
      setError(err.message || 'Ошибка при обновлении профиля')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // Рендер раздела профиля
  const renderProfileSection = () => (
    <div className="settings-content-wrapper">
      {/* Hero секция с аватаром */}
      <div className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              <div className="avatar-large">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="avatar-image" />
                ) : (
                  <span className="avatar-placeholder">
                    {formData.firstName?.[0]?.toUpperCase() || '👤'}
                  </span>
                )}
              </div>
              {isUploadingAvatar && (
                <div className="avatar-upload-overlay">
                  <span className="upload-spinner">⏳</span>
                </div>
              )}
            </div>
            <div className="avatar-actions">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="btn-avatar-change"
              >
                <span>📷</span> Изменить фото
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar}
                  className="btn-avatar-remove"
                >
                  <span>🗑️</span> Удалить
                </button>
              )}
            </div>
            <p className="avatar-hint">Максимум 5MB. Форматы: JPEG, PNG, GIF, WebP</p>
          </div>

          <div className="profile-info">
            <h2 className="profile-name-large">
              {formData.firstName || 'Новый пользователь'}
              {formData.lastName && ` ${formData.lastName}`}
            </h2>
            {formData.username && (
              <p className="profile-username-display">@{formData.username}</p>
            )}
            {formData.bio && (
              <p className="profile-bio-display">{formData.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Форма профиля */}
      <div className="form-section">
        <div className="section-header">
          <h3 className="section-title">Основная информация</h3>
          <p className="section-subtitle">Измените ваши персональные данные</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>✅</span> {success}
          </div>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">👤</span>
              Имя
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Ваше имя"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">👥</span>
              Фамилия
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Ваша фамилия"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              <span className="label-icon">📛</span>
              Имя пользователя
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="@username"
              className="form-input"
            />
            {usernameStatus === 'checking' && (
              <p className="form-hint checking">Проверка…</p>
            )}
            {usernameStatus === 'available' && formData.username && (
              <p className="form-hint success">✓ Имя свободно</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="form-hint error">✗ Это имя занято</p>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              <span className="label-icon">📝</span>
              О себе
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Коротко расскажите о себе"
              rows={4}
              className="form-textarea"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn btn-secondary"
          >
            Отмена
          </button>
          <button
            type="submit"
            onClick={handleSaveProfile}
            disabled={isSaving || usernameStatus === 'taken'}
            className="btn btn-primary"
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
      </div>
    </div>
  )

  // Рендер раздела уведомлений
  const renderNotificationsSection = () => (
    <div className="settings-content-wrapper">
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
            <p className="setting-card-desc">Воспроизводить звук при новых сообщениях</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={notificationSettings.soundEnabled}
              onChange={(e) => setNotificationSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
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
              checked={notificationSettings.pushEnabled}
              onChange={(e) => setNotificationSettings(prev => ({ ...prev, pushEnabled: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-card">
          <div className="setting-card-icon">💻</div>
          <div className="setting-card-content">
            <h4 className="setting-card-title">Уведомления в браузере</h4>
            <p className="setting-card-desc">Показывать уведомления в браузере</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={notificationSettings.desktopEnabled}
              onChange={(e) => setNotificationSettings(prev => ({ ...prev, desktopEnabled: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-cards">
        <div className="setting-card full">
          <div className="setting-card-content">
            <h4 className="setting-card-title">Звук уведомления</h4>
            <p className="setting-card-desc">Выберите звук для новых сообщений</p>
          </div>
          <select className="form-select">
            <option>По умолчанию</option>
            <option>Без звука</option>
            <option>Мягкий сигнал</option>
            <option>Классический</option>
          </select>
        </div>
      </div>
    </div>
  )

  // Рендер раздела конфиденциальности
  const renderPrivacySection = () => (
    <div className="settings-content-wrapper">
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

        <div className="setting-card">
          <div className="setting-card-icon">🔀</div>
          <div className="setting-card-content">
            <h4 className="setting-card-title">Пересылка сообщений</h4>
            <p className="setting-card-desc">Показывать «Переслано от» при пересылке</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showForwardingAttribution}
              onChange={(e) => {
                const v = e.target.checked
                setShowForwardingAttr(v)
                setShowForwardingAttribution(v)
              }}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  )

  // Рендер раздела безопасности
  const renderSecuritySection = () => (
    <div className="settings-content-wrapper">
      <div className="section-header-large">
        <div className="header-icon-large">
          <Shield className="icon-svg icon-xl" strokeWidth={1.8} />
        </div>
        <h2 className="section-title-large">Безопасность</h2>
        <p className="section-desc-large">Управление паролем, email и критичными действиями</p>
      </div>

      <div className="settings-cards">
        <div className="setting-card full security-card">
          <div className="security-card-header">
            <div className="security-icon-wrapper">
              <Mail className="icon-svg icon-md" strokeWidth={2} />
            </div>
            <div>
              <h4 className="setting-card-title">Смена email</h4>
              <p className="setting-card-desc">Новый адрес подтверждается кодом, который отправляется на указанную почту</p>
            </div>
          </div>

          {emailError && (
            <div className="alert alert-error">
              <AlertTriangle className="icon-svg icon-sm" strokeWidth={2} /> {emailError}
            </div>
          )}
          {emailSuccess && (
            <div className="alert alert-success">
              <Shield className="icon-svg icon-sm" strokeWidth={2} /> {emailSuccess}
            </div>
          )}

          <div className="security-form">
            <div className="form-group">
              <label className="form-label">Текущий email</label>
              <input type="email" value={formData.email} className="form-input" disabled />
            </div>

            <div className="form-group">
              <label className="form-label">Новый email</label>
              <input
                type="email"
                name="newEmail"
                value={emailForm.newEmail}
                onChange={handleEmailInputChange}
                placeholder="name@example.com"
                className="form-input"
              />
            </div>

            {emailStep === 'codeSent' && (
              <div className="form-group">
                <label className="form-label">Код из письма</label>
                <input
                  type="text"
                  name="code"
                  value={emailForm.code}
                  onChange={handleEmailInputChange}
                  placeholder="000000"
                  className="form-input code-input"
                  maxLength={6}
                />
              </div>
            )}

            <div className="security-note">
              Подтверждение приходит на новый email. Без кода адрес не изменится.
            </div>

            <div className="form-actions security-actions">
              <button
                type="button"
                onClick={handleRequestEmailCode}
                disabled={isEmailLoading}
                className="btn btn-secondary"
              >
                {isEmailLoading ? 'Отправка...' : 'Отправить код'}
              </button>
              <button
                type="button"
                onClick={handleConfirmEmailChange}
                disabled={isEmailLoading || emailStep !== 'codeSent'}
                className="btn btn-primary"
              >
                {emailStep === 'codeSent' ? 'Подтвердить email' : 'Сменить email'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Смена пароля */}
      <div className="settings-cards">
        <div className="setting-card full security-card">
          <div className="security-card-header">
            <div className="security-icon-wrapper">
              <KeyRound className="icon-svg icon-md" strokeWidth={2} />
            </div>
            <div>
              <h4 className="setting-card-title">Смена пароля</h4>
              <p className="setting-card-desc">Старый пароль проверяется, затем код подтверждения отправляется на вашу почту</p>
            </div>
          </div>

          {passwordError && (
            <div className="alert alert-error">
              <AlertTriangle className="icon-svg icon-sm" strokeWidth={2} /> {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="alert alert-success">
              <Shield className="icon-svg icon-sm" strokeWidth={2} /> {passwordSuccess}
            </div>
          )}

          <div className="security-form">
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
                type="button"
                onClick={handleConfirmPasswordChange}
                disabled={isPasswordLoading || passwordStep !== 'codeSent'}
                className="btn btn-primary"
              >
                {passwordStep === 'codeSent' ? 'Подтвердить смену' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Удаление аккаунта */}
      <div className="settings-cards">
        <div className="setting-card full danger-card">
          <div className="danger-card-header">
            <div className="danger-icon-wrapper">
              <AlertTriangle className="icon-svg icon-md" strokeWidth={2} />
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

          {deleteError && (
            <div className="alert alert-error">
              <AlertTriangle className="icon-svg icon-sm" strokeWidth={2} /> {deleteError}
            </div>
          )}

          <div className="danger-form">
            <div className="form-group">
              <label className="form-label">Пароль от аккаунта</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Подтверждение</label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Введите: удалить"
                className="form-input danger-input"
              />
            </div>

            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="btn btn-danger"
            >
              {isDeletingAccount ? 'Удаление…' : 'Безвозвратно удалить аккаунт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="profile-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Левая панель - навигация */}
        <aside className="profile-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" />
              ) : (
                <span>{formData.firstName?.[0]?.toUpperCase() || '👤'}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <h3 className="sidebar-user-name">
                {formData.firstName || 'Пользователь'}
              </h3>
              {formData.username && (
                <p className="sidebar-username">@{formData.username}</p>
              )}
              <p className="sidebar-section-label">Настройки аккаунта</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            {Object.values(SECTIONS).map((section) => {
              const SectionIcon = SECTION_ICONS[section]
              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`sidebar-nav-item ${activeSection === section ? 'active' : ''}`}
                >
                  <span className="nav-icon">
                    <SectionIcon className="icon-svg nav-icon-svg" strokeWidth={2} />
                  </span>
                  <span className="nav-label">{SECTION_TITLES[section]}</span>
                  {activeSection === section && (
                    <span className="nav-indicator" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              onClick={() => {
                if (confirm('Выйти из аккаунта?')) {
                  onClose()
                  onLogout?.() || (window.location.href = '/login')
                }
              }}
              className="btn-logout"
            >
              <LogOut className="icon-svg icon-sm" strokeWidth={2} /> Выйти
            </button>
          </div>
        </aside>

        {/* Правая панель - контент */}
        <main className="profile-content">
          <div className="content-scroll">
            {activeSection === SECTIONS.PROFILE && renderProfileSection()}
            {activeSection === SECTIONS.NOTIFICATIONS && renderNotificationsSection()}
            {activeSection === SECTIONS.PRIVACY && renderPrivacySection()}
            {activeSection === SECTIONS.SECURITY && renderSecuritySection()}
          </div>
        </main>
      </div>

      <style>{`
        /* Основной контейнер */
        .profile-modal-content {
          display: flex;
          width: 90%;
          max-width: 1100px;
          height: 85vh;
          min-height: 600px;
          background: var(--bg-secondary);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        /* Левая панель */
        .profile-sidebar {
          width: 300px;
          background: linear-gradient(180deg, rgba(129, 140, 248, 0.08) 0%, var(--bg-secondary) 100%);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 32px 24px;
          text-align: center;
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-avatar {
          width: 96px;
          height: 96px;
          border-radius: 28px;
          margin: 0 auto 16px;
          overflow: hidden;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
        }

        .sidebar-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sidebar-avatar span {
          font-size: 40px;
          font-weight: 700;
          color: white;
        }

        .sidebar-user-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
        }

        .sidebar-username {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 8px;
        }

        .sidebar-section-label {
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          overflow-y: auto;
        }

        .sidebar-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          margin-bottom: 6px;
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

        .sidebar-nav-item:hover {
          background: rgba(129, 140, 248, 0.1);
        }

        .sidebar-nav-item.active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15));
          color: #fff;
        }

        .nav-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .icon-svg {
          display: block;
          flex-shrink: 0;
        }

        .nav-icon-svg,
        .icon-sm {
          width: 18px;
          height: 18px;
        }

        .icon-md {
          width: 28px;
          height: 28px;
        }

        .icon-xl {
          width: 48px;
          height: 48px;
        }

        .nav-label {
          flex: 1;
        }

        .nav-indicator {
          width: 4px;
          height: 20px;
          background: linear-gradient(180deg, #6366f1, #8b5cf6);
          border-radius: 2px;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .btn-logout {
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

        .btn-logout:hover {
          background: rgba(248, 113, 113, 0.15);
          border-color: rgba(248, 113, 113, 0.5);
        }

        /* Правая панель */
        .profile-content {
          flex: 1;
          overflow: hidden;
          background: var(--bg-secondary);
        }

        .content-scroll {
          height: 100%;
          overflow-y: auto;
          padding: 0;
        }

        .settings-content-wrapper {
          padding: 0;
        }

        /* Hero секция профиля */
        .profile-hero {
          position: relative;
          margin-bottom: 24px;
          border-radius: 0;
          overflow: hidden;
        }

        .profile-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
          pointer-events: none;
        }

        .profile-hero-content {
          position: relative;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .avatar-wrapper {
          position: relative;
        }

        .avatar-large {
          width: 140px;
          height: 140px;
          border-radius: 35px;
          overflow: hidden;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 40px rgba(99, 102, 241, 0.4);
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          font-size: 64px;
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

        .profile-info {
          text-align: center;
        }

        .profile-name-large {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 8px;
          background: linear-gradient(135deg, var(--text-primary), #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .profile-username-display {
          font-size: 15px;
          color: var(--text-secondary);
          margin: 0 0 8px;
        }

        .profile-bio-display {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 400px;
        }

        /* Секции формы */
        .form-section {
          padding: 32px;
          background: var(--bg-secondary);
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
          padding: 32px 32px 24px;
          text-align: center;
          background: linear-gradient(180deg, rgba(129, 140, 248, 0.08) 0%, transparent 100%);
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 24px;
        }

        .header-icon-large {
          display: flex;
          align-items: center;
          justify-content: center;
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

        /* Карточки настроек */
        .settings-cards {
          padding: 0 32px 24px;
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

        .setting-card.full {
          flex-direction: column;
          align-items: stretch;
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

        /* Форма */
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

        .form-hint {
          font-size: 12px;
          margin: 4px 0 0;
        }

        .form-hint.checking {
          color: var(--text-secondary);
        }

        .form-hint.success {
          color: #34d399;
        }

        .form-hint.error {
          color: #f87171;
        }

        .code-input {
          text-align: center;
          letter-spacing: 0.3em;
          font-size: 18px;
        }

        /* Кнопки */
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

        /* Alerts */
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 20px;
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

        /* Security card */
        .security-card {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
          border-color: rgba(129, 140, 248, 0.2);
        }

        .security-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .security-icon-wrapper {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15));
          border-radius: 14px;
        }

        .security-icon {
          font-size: 28px;
        }

        .security-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .security-note {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          padding: 12px 14px;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(129, 140, 248, 0.15);
          border-radius: 12px;
        }

        .security-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .security-actions .btn {
          flex: 1;
        }

        /* Danger card */
        .danger-card {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(185, 28, 28, 0.05));
          border-color: rgba(239, 68, 68, 0.2);
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

        .danger-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .danger-input {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .danger-input:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .profile-modal-content {
            flex-direction: column;
            width: 100%;
            height: 100vh;
            max-width: 100%;
            border-radius: 0;
          }

          .profile-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
          }

          .sidebar-header {
            padding: 20px 16px;
          }

          .sidebar-avatar {
            width: 64px;
            height: 64px;
            border-radius: 18px;
          }

          .sidebar-avatar span {
            font-size: 28px;
          }

          .sidebar-nav {
            display: flex;
            overflow-x: auto;
            padding: 12px 16px;
            gap: 8px;
          }

          .sidebar-nav-item {
            flex-shrink: 0;
            flex-direction: column;
            padding: 12px 16px;
            margin-bottom: 0;
            justify-content: center;
          }

          .nav-label {
            font-size: 12px;
          }

          .nav-indicator {
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
          }

          .sidebar-footer {
            display: none;
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

          .profile-name-large {
            font-size: 22px;
          }

          .form-section,
          .section-header-large,
          .settings-cards {
            padding-left: 16px;
            padding-right: 16px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions,
          .security-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
