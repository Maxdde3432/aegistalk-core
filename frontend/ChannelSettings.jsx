import { useEffect, useMemo, useRef, useState } from 'react'
import { groupsAPI } from './api/groups'
import { AdminPanel } from './components/AdminPanel'
import VerifySiteBanner from './components/VerifySiteBanner'
import { uploadFile } from './api/uploads.js'
import { buildProtectedMediaUrl } from './api/messages'

export const GRADIENT_THEMES = {
  tg_blue: {
    name: 'Aethel',
    type: 'gradient',
    from: '#05070d',
    to: '#10233a',
    animated: true
  },
  tg_dots: {
    name: 'Точки',
    type: 'pattern',
    backgroundColor: '#0d1622',
    css: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1.2px, transparent 0), radial-gradient(circle at 15px 15px, rgba(125,211,252,0.08) 1px, transparent 0)'
  },
  tg_lines: {
    name: 'Линии',
    type: 'pattern',
    backgroundColor: '#0e1621',
    css: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 16px)'
  },
  tg_dark: {
    name: 'Тёмный',
    type: 'gradient',
    from: '#000000',
    to: '#000000'
  }
}

const resolveEntityMeta = (group) => {
  const isDiscussionGroup = Boolean(group?.isDiscussionGroup)
  const isChannel = group?.type === 'channel'

  if (isDiscussionGroup) {
    return {
      isChannel,
      isDiscussionGroup,
      title: 'Обсуждение',
      noun: 'обсуждения',
      infoTitle: 'Информация об обсуждении'
    }
  }

  if (isChannel) {
    return {
      isChannel,
      isDiscussionGroup,
      title: 'Канал',
      noun: 'канала',
      infoTitle: 'Информация о канале'
    }
  }

  return {
    isChannel,
    isDiscussionGroup,
    title: 'Группа',
    noun: 'группы',
    infoTitle: 'Информация о группе'
  }
}

export const GradientThemeModal = ({ value, onClose, onSelect }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Оформление чата</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            Выберите фон для сообщений.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {Object.entries(GRADIENT_THEMES).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => onSelect(key)}
                style={{
                  padding: '40px 10px',
                  border: value === key ? '3px solid var(--primary)' : '3px solid transparent',
                  borderRadius: '12px',
                  background: theme.type === 'pattern'
                    ? `${theme.backgroundColor || '#0E1621'} ${theme.css}`
                    : `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                  backgroundSize: theme.type === 'pattern' ? '28px 28px' : theme.animated ? '400% 400%' : 'cover',
                  animation: theme.animated ? 'dmGradientShift 24s ease infinite' : 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: value === key ? '0 4px 16px rgba(74, 158, 255, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
                  transform: value === key ? 'scale(1.02)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  minHeight: '100px'
                }}
              >
                <span>{theme.name}</span>
                {value === key ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: '#fff',
                      color: 'var(--primary)',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Предпросмотр</h4>
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                background: GRADIENT_THEMES[value]?.type === 'pattern'
                  ? `${GRADIENT_THEMES[value]?.backgroundColor || '#0E1621'} ${GRADIENT_THEMES[value]?.css}`
                  : `linear-gradient(135deg, ${GRADIENT_THEMES[value]?.from}, ${GRADIENT_THEMES[value]?.to})`,
                backgroundSize: GRADIENT_THEMES[value]?.type === 'pattern' ? '28px 28px' : GRADIENT_THEMES[value]?.animated ? '400% 400%' : 'cover',
                animation: GRADIENT_THEMES[value]?.animated ? 'dmGradientShift 24s ease infinite' : 'none',
                color: '#fff',
                minHeight: '80px'
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '12px' }}>
                {GRADIENT_THEMES[value]?.name}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.8 }}>
                Этот фон будет использоваться в сообщениях.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ChannelSettingsModal = ({
  group,
  onClose,
  onSave,
  onDeleteGroup,
  onManageMembers,
  onCreateDiscussion,
  onVerifySite,
  onSaveExternalLink
}) => {
  const [gradientTheme, setGradientTheme] = useState(group.gradientTheme || 'tg_blue')
  const [name, setName] = useState(group.name || '')
  const [description, setDescription] = useState(group.description || '')
  const [externalLink, setExternalLink] = useState(group.externalLink || group.external_link || '')
  const [siteStatus, setSiteStatus] = useState(group.siteVerificationStatus || group.site_verification_status || 'none')
  const [verificationCode, setVerificationCode] = useState(group.verificationCode || group.verification_code || '')
  const [verifyError, setVerifyError] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [discussionChatId, setDiscussionChatId] = useState(group.discussionChatId || null)
  const [reactionsEnabled, setReactionsEnabled] = useState(group.reactionsEnabled !== false)
  const [allowMemberInvites, setAllowMemberInvites] = useState(Boolean(group.allowMemberInvites))
  const [isPublic, setIsPublic] = useState(Boolean(group.isPublic))
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(group.backgroundImageUrl || '')
  const [backgroundUploadBusy, setBackgroundUploadBusy] = useState(false)
  const [backgroundUploadError, setBackgroundUploadError] = useState('')
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const backgroundInputRef = useRef(null)

  const entity = useMemo(() => resolveEntityMeta(group), [group])
  const settingsTitle = `${entity.title} — настройки`
  const managementButtonLabel = entity.isChannel
    ? 'Управление каналом'
    : entity.isDiscussionGroup
      ? 'Управление обсуждением'
      : 'Управление группой'
  const backgroundPreviewUrl = backgroundImageUrl ? buildProtectedMediaUrl(backgroundImageUrl) : ''

  useEffect(() => {
    if (group?.name) setName(group.name)
    setDescription(group?.description ?? '')
    setExternalLink(group?.externalLink ?? group?.external_link ?? '')
    setSiteStatus(group?.siteVerificationStatus ?? group?.site_verification_status ?? 'none')
    setVerificationCode(group?.verificationCode ?? group?.verification_code ?? '')
    if (group?.gradientTheme) setGradientTheme(group.gradientTheme)
    setBackgroundImageUrl(group?.backgroundImageUrl ?? '')
    if (group?.discussionChatId !== undefined) setDiscussionChatId(group.discussionChatId)
    if (group?.reactionsEnabled !== undefined) setReactionsEnabled(group.reactionsEnabled !== false)
    if (group?.allowMemberInvites !== undefined) setAllowMemberInvites(Boolean(group.allowMemberInvites))
    if (group?.isPublic !== undefined) setIsPublic(Boolean(group.isPublic))
  }, [group])

  if (showAdminPanel) {
    return (
      <AdminPanel
        group={group}
        onClose={() => setShowAdminPanel(false)}
        onUpdate={onSave}
        onDeleteGroup={onDeleteGroup}
      />
    )
  }

  const handleSave = async () => {
    try {
      await onSave({
        name,
        description,
        externalLink,
        gradientTheme,
        backgroundImageUrl,
        discussionChatId,
        reactionsEnabled,
        allowMemberInvites,
        isPublic
      })
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
    }
  }

  const handleInviteLink = async () => {
    try {
      const result = await groupsAPI.generateInviteLink(group.id)
      const url = `${window.location.origin}/join?invite=${result.inviteLink}`
      navigator.clipboard.writeText(url)
      alert('Ссылка приглашения скопирована')
    } catch (error) {
      alert(`Ошибка: ${error.message}`)
    }
  }

  const handleCreateDiscussion = async () => {
    if (!onCreateDiscussion) return

    try {
      const result = await onCreateDiscussion()
      if (result?.discussionChatId) {
        setDiscussionChatId(result.discussionChatId)
      }
    } catch (error) {
      alert(error?.message || 'Не удалось создать обсуждение')
    }
  }

  const handlePickBackgroundImage = async (event) => {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setBackgroundUploadError('Можно выбрать только изображение')
      return
    }

    setBackgroundUploadBusy(true)
    setBackgroundUploadError('')

    try {
      const uploaded = await uploadFile(file)
      if (!uploaded.success) {
        throw new Error(uploaded.error || 'Не удалось загрузить фон')
      }

      setBackgroundImageUrl(uploaded.path || uploaded.url || '')
    } catch (error) {
      setBackgroundUploadError(error?.message || 'Не удалось загрузить фон')
    } finally {
      setBackgroundUploadBusy(false)
    }
  }

  return (
    <>
      {showThemeModal ? (
        <GradientThemeModal
          value={gradientTheme}
          onClose={() => setShowThemeModal(false)}
          onSelect={(theme) => {
            setGradientTheme(theme)
            setShowThemeModal(false)
          }}
        />
      ) : (
        <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
          <div
            className="drawer-panel"
            style={{
              width: '400px',
              maxWidth: '90vw',
              right: 0,
              top: 0,
              height: '100vh',
              position: 'fixed',
              borderTopLeftRadius: '18px',
              borderBottomLeftRadius: '18px',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              background: 'rgba(12,14,22,0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(91, 152, 255, 0.25)',
              boxShadow: '-12px 0 32px rgba(0,0,0,0.5)'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <h3>{settingsTitle}</h3>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>

            <div style={{ padding: '20px 20px 16px', overflowY: 'auto', maxHeight: '80vh' }}>
              {(group.myRole === 'owner' || group.myRole === 'admin') ? (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    marginBottom: '20px',
                    background: 'linear-gradient(135deg, var(--primary), #4da3ff)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {managementButtonLabel}
                </button>
              ) : null}

              {group.myRole === 'member' ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p>{entity.infoTitle}</p>
                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    {`У вас нет прав для изменения настроек ${entity.noun}.`}
                  </p>
                </div>
              ) : null}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '600', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                  {`Название ${entity.noun}`}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px' }}
                  placeholder={`Введите название ${entity.noun}`}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '600', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', minHeight: '80px', resize: 'vertical' }}
                  placeholder={`Введите описание ${entity.noun}`}
                />
              </div>

              {entity.isChannel && !entity.isDiscussionGroup ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                    Ссылка на сайт
                  </label>
                  <input
                    type="url"
                    value={externalLink}
                    onChange={(event) => setExternalLink(event.target.value)}
                    onBlur={() => {
                      if (onSaveExternalLink && (group.myRole === 'owner' || group.myRole === 'admin')) {
                        onSaveExternalLink(externalLink)
                      }
                    }}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px' }}
                    placeholder="https://example.com"
                  />
                  {(group.myRole === 'owner' || group.myRole === 'admin') && externalLink?.trim() ? (
                    <VerifySiteBanner
                      status={siteStatus}
                      verificationCode={verificationCode}
                      onVerify={async () => {
                        if (!onVerifySite) return
                        setVerifyError('')
                        setVerifyLoading(true)
                        try {
                          await onVerifySite()
                        } catch (error) {
                          setVerifyError(error?.message || 'Не удалось подтвердить сайт')
                        } finally {
                          setVerifyLoading(false)
                        }
                      }}
                      loading={verifyLoading}
                      error={verifyError}
                    />
                  ) : null}
                </div>
              ) : null}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '600', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                  Оформление
                </label>
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePickBackgroundImage}
                />
                <button
                  onClick={() => setShowThemeModal(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '2px solid var(--bg-tertiary)',
                    background: GRADIENT_THEMES[gradientTheme]?.type === 'pattern'
                      ? `${GRADIENT_THEMES[gradientTheme]?.backgroundColor || '#0E1621'} ${GRADIENT_THEMES[gradientTheme]?.css}`
                      : `linear-gradient(135deg, ${GRADIENT_THEMES[gradientTheme]?.from}, ${GRADIENT_THEMES[gradientTheme]?.to})`,
                    backgroundSize: GRADIENT_THEMES[gradientTheme]?.type === 'pattern' ? '28px 28px' : GRADIENT_THEMES[gradientTheme]?.animated ? '400% 400%' : 'cover',
                    animation: GRADIENT_THEMES[gradientTheme]?.animated ? 'dmGradientShift 24s ease infinite' : 'none',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                  <span>{GRADIENT_THEMES[gradientTheme]?.name}</span>
                  <span style={{ fontSize: '20px' }}>›</span>
                </button>
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: backgroundPreviewUrl ? '10px' : 0 }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Своя фотография</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Поставьте своё изображение как фон {entity.noun}.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => backgroundInputRef.current?.click()}
                      disabled={backgroundUploadBusy}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(96, 165, 250, 0.35)',
                        background: 'rgba(37, 99, 235, 0.18)',
                        color: '#dbeafe',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: backgroundUploadBusy ? 'wait' : 'pointer'
                      }}
                    >
                      {backgroundUploadBusy ? 'Загрузка...' : 'Выбрать фото'}
                    </button>
                  </div>

                  {backgroundPreviewUrl ? (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', minHeight: '132px', background: '#020617' }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${backgroundPreviewUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(2,6,23,0.12), rgba(2,6,23,0.68))'
                        }}
                      />
                      <div style={{ position: 'relative', zIndex: 1, padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: '132px' }}>
                        <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>Фон {entity.noun}</div>
                        <button
                          type="button"
                          onClick={() => setBackgroundImageUrl('')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(248, 113, 113, 0.35)',
                            background: 'rgba(127, 29, 29, 0.28)',
                            color: '#fecaca',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Убрать фото
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {backgroundUploadError ? (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#fca5a5' }}>
                      {backgroundUploadError}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  onClick={onManageMembers}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Участники
                </button>
                <button
                  onClick={handleInviteLink}
                  style={{ flex: 1, padding: '12px', background: 'rgba(76, 175, 80, 0.18)', color: '#8ff0a4', border: '1px solid rgba(76,175,80,0.4)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Инвайт
                </button>
              </div>

              {entity.isChannel && !entity.isDiscussionGroup ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                    Обсуждение
                  </label>
                  {discussionChatId ? (
                    <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <p style={{ margin: 0, fontSize: '14px' }}>Обсуждение привязано</p>
                      <button
                        onClick={() => setDiscussionChatId(null)}
                        style={{ marginTop: '8px', padding: '6px 12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Отвязать обсуждение
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        Обсуждение создаётся только по желанию владельца и сразу привязывается к каналу.
                      </p>
                      <button
                        onClick={handleCreateDiscussion}
                        style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                      >
                        Создать обсуждение
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Отмена</button>
                <button className="btn-primary" onClick={handleSave} style={{ flex: 1 }}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const MembersModal = ({ group, onClose }) => {
  const members = group?.members || []
  const entity = resolveEntityMeta(group)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{`Участники ${entity.noun}`}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '16px' }}>
          {members.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
              Пока нет участников
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id || member.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600' }}>
                    {member.firstName || member.username || 'Участник'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {member.role || 'member'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
