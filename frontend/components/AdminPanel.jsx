import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Link, BarChart3, Users, Shield, MessageSquare, Radio, ImagePlus, Trash2 } from 'lucide-react'
import { groupsAPI } from '../api/groups'
import { storiesAPI } from '../api/stories'
import { AdminToggle } from './AdminToggle'
import StoryComposerModal from './stories/StoryComposerModal.jsx'

const formatDateTime = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getLogIcon = (action) => {
  switch (action) {
    case 'member_added':
      return '👤'
    case 'member_removed':
      return '🗑️'
    case 'invite_created':
      return '🔗'
    case 'settings_updated':
      return '⚙️'
    case 'discussion_linked':
      return '💬'
    default:
      return '•'
  }
}

export const AdminPanel = ({ group, onClose, onUpdate, onDeleteGroup }) => {
  const canManage = group?.myRole === 'owner' || group?.myRole === 'admin'
  const isOwner = group?.myRole === 'owner'
  const isChannel = group?.type === 'channel'
  const isDiscussionGroup = Boolean(group?.isDiscussionGroup)
  const entityTitle = isDiscussionGroup ? 'Обсуждение' : isChannel ? 'Канал' : 'Группа'
  const managementTitle = isDiscussionGroup ? 'Управление обсуждением' : isChannel ? 'Управление каналом' : 'Управление группой'
  const emptyNameLabel = 'Без названия'

  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState(isChannel && !isDiscussionGroup ? 'stories' : 'overview')
  const [inviteLinks, setInviteLinks] = useState([])
  const [adminLogs, setAdminLogs] = useState([])
  const [channelStats, setChannelStats] = useState({
    activeStories: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    lastStoryAt: null
  })
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [draftFile, setDraftFile] = useState(null)
  const [showComposer, setShowComposer] = useState(false)

  const [reactionsEnabled, setReactionsEnabled] = useState(group?.reactionsEnabled !== false)
  const [allowMemberInvites, setAllowMemberInvites] = useState(Boolean(group?.allowMemberInvites))
  const [isPublic, setIsPublic] = useState(Boolean(group?.isPublic))
  const [discussionChatId, setDiscussionChatId] = useState(group?.discussionChatId || null)

  useEffect(() => {
    setReactionsEnabled(group?.reactionsEnabled !== false)
    setAllowMemberInvites(Boolean(group?.allowMemberInvites))
    setIsPublic(Boolean(group?.isPublic))
    setDiscussionChatId(group?.discussionChatId || null)
    setStatusMessage('')
  }, [group])

  const loadInviteLinks = async () => {
    setLoading(true)
    try {
      const links = await groupsAPI.getInviteLinks(group.id)
      setInviteLinks(links)
    } finally {
      setLoading(false)
    }
  }

  const loadAdminLogs = async () => {
    setLoading(true)
    try {
      const logs = await groupsAPI.getAdminLogs(group.id)
      setAdminLogs(logs)
    } finally {
      setLoading(false)
    }
  }

  const loadChannelStats = async () => {
    if (!isChannel || isDiscussionGroup || !canManage) return

    setStatsLoading(true)
    try {
      const stats = await storiesAPI.getChannelStats(group.id)
      setChannelStats(stats)
    } catch (error) {
      setStatusMessage(error.message || 'Не удалось загрузить статистику историй канала')
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'invites') {
      void loadInviteLinks()
    }
    if (activeTab === 'logs') {
      void loadAdminLogs()
    }
  }, [activeTab])

  useEffect(() => {
    if (!isChannel || isDiscussionGroup || !canManage) return undefined

    void loadChannelStats()

    const intervalId = window.setInterval(() => {
      void loadChannelStats()
    }, 20_000)

    return () => window.clearInterval(intervalId)
  }, [group?.id, isChannel, isDiscussionGroup, canManage])

  const statsCards = useMemo(() => {
    if (isChannel && !isDiscussionGroup) {
      return [
        {
          icon: <Users size={22} />,
          value: group?.memberCount || 0,
          label: 'Подписчиков'
        },
        {
          icon: <Shield size={22} />,
          value: group?.myRole === 'owner' ? 'Владелец' : 'Администратор',
          label: 'Твоя роль'
        },
        {
          icon: <Link size={22} />,
          value: isPublic ? 'Публичный' : 'Закрытый',
          label: 'Режим доступа'
        },
        {
          icon: <Radio size={22} />,
          value: statsLoading ? '...' : channelStats.activeStories,
          label: 'Активных историй'
        }
      ]
    }

    return [
      {
        icon: <Users size={22} />,
        value: group?.memberCount || 0,
        label: isDiscussionGroup ? 'Участников обсуждения' : 'Участников'
      },
      {
        icon: <Shield size={22} />,
        value: group?.myRole === 'owner' ? 'Владелец' : 'Администратор',
        label: 'Твоя роль'
      },
      {
        icon: <MessageSquare size={22} />,
        value: reactionsEnabled ? 'Включены' : 'Выключены',
        label: 'Реакции'
      },
      {
        icon: <Link size={22} />,
        value: allowMemberInvites ? 'Разрешены' : 'Только админы',
        label: 'Приглашения'
      }
    ]
  }, [
    group?.memberCount,
    group?.myRole,
    isPublic,
    isChannel,
    isDiscussionGroup,
    channelStats.activeStories,
    statsLoading,
    reactionsEnabled,
    allowMemberInvites
  ])

  const handleSaveSettings = async () => {
    try {
      await onUpdate({
        reactionsEnabled,
        allowMemberInvites,
        isPublic,
        discussionChatId
      })
      setStatusMessage('Настройки сохранены')
    } catch (error) {
      setStatusMessage(error.message || 'Не удалось сохранить настройки')
    }
  }

  const handleCreateLink = async () => {
    try {
      const newLink = await groupsAPI.createInviteLink(group.id, `Ссылка ${inviteLinks.length + 1}`)
      setInviteLinks((prev) => [...prev, newLink])
    } catch (error) {
      setStatusMessage(error.message || 'Не удалось создать ссылку')
    }
  }

  const handleDeleteLink = async (linkId) => {
    if (!confirm('Удалить эту пригласительную ссылку?')) return

    try {
      await groupsAPI.deleteInviteLink(group.id, linkId)
      setInviteLinks((prev) => prev.filter((link) => link.id !== linkId))
    } catch (error) {
      setStatusMessage(error.message || 'Не удалось удалить ссылку')
    }
  }

  const handleCreateDiscussion = async () => {
    try {
      const result = await groupsAPI.linkDiscussionGroup(group.id)
      if (result?.discussionChatId) {
        setDiscussionChatId(result.discussionChatId)
      }
      setStatusMessage(result?.message || 'Обсуждение создано и привязано')
    } catch (error) {
      setStatusMessage(error.message || 'Не удалось создать обсуждение')
    }
  }

  const handlePickedStoryFile = (event) => {
    const nextFile = event.target.files?.[0]
    if (event.target) {
      event.target.value = ''
    }

    if (!nextFile) return

    setStatusMessage('')
    setDraftFile(nextFile)
    setShowComposer(true)
  }

  const handlePublishChannelStory = async (storyPayload) => {
    const createdStory = await storiesAPI.create({
      ...storyPayload,
      groupId: group.id
    })

    await loadChannelStats()
    window.dispatchEvent(new CustomEvent('stories:refresh'))
    setStatusMessage('История канала опубликована')
    return createdStory
  }

  const handleDeleteEntity = async () => {
    if (!onDeleteGroup) return
    await onDeleteGroup()
  }

  const closeComposer = () => {
    setShowComposer(false)
    setDraftFile(null)
  }

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: <BarChart3 size={18} /> },
    ...(isChannel && !isDiscussionGroup ? [{ id: 'stories', label: 'Истории', icon: <Radio size={18} /> }] : []),
    { id: 'invites', label: 'Ссылки', icon: <Link size={18} /> },
    { id: 'settings', label: 'Настройки', icon: <Shield size={18} /> },
    { id: 'logs', label: 'Журнал', icon: <MessageSquare size={18} /> }
  ]

  if (!canManage) {
    return null
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 3200 }}>
        <div
          className="admin-drawer-panel"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handlePickedStoryFile}
          />

          <div className="admin-panel-header">
            <div>
              <h3>{managementTitle}</h3>
              <p className="admin-panel-subtitle">
                {entityTitle}: {group?.name || emptyNameLabel}
              </p>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>

          <div className="admin-panel-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="admin-panel-content">
            {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}

            {activeTab === 'overview' ? (
              <div className="overview-section">
                <div className="stats-grid">
                  {statsCards.map((card) => (
                    <div key={card.label} className="stat-card">
                      <div className="stat-icon">{card.icon}</div>
                      <div className="stat-info">
                        <div className="stat-value">{card.value}</div>
                        <div className="stat-label">{card.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {isChannel && !isDiscussionGroup ? (
                  <div className="spotlight-card">
                    <div className="spotlight-copy">
                      <div className="spotlight-kicker">Истории канала</div>
                      <div className="spotlight-title">Публикуйте истории для подписчиков</div>
                      <div className="spotlight-text">
                        Истории канала видят только ваши подписчики. Публикации появляются в их ленте и помогают держать аудиторию в курсе.
                      </div>
                    </div>
                    <button className="btn-primary large" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus size={18} />
                      <span>Опубликовать историю</span>
                    </button>
                  </div>
                ) : (
                  <div className="spotlight-card">
                    <div className="spotlight-copy">
                      <div className="spotlight-kicker">Командная работа</div>
                      <div className="spotlight-title">Следите за ролями и приглашениями</div>
                      <div className="spotlight-text">
                        В группе важны участники, приглашения и правила общения. Здесь вы можете быстро проверить режимы и подготовить пространство для команды.
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>
                        Приглашения: {allowMemberInvites ? 'разрешены' : 'только для админов'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Реакции: {reactionsEnabled ? 'включены' : 'выключены'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'stories' ? (
              <div className="stories-section">
                <div className="stories-actions">
                  <button className="btn-primary large" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus size={18} />
                    <span>Новая история канала</span>
                  </button>
                </div>

                <div className="stats-grid compact">
                  <div className="stat-card">
                    <div className="stat-icon"><Radio size={22} /></div>
                    <div className="stat-info">
                      <div className="stat-value">{statsLoading ? '...' : channelStats.activeStories}</div>
                      <div className="stat-label">Активных историй</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Users size={22} /></div>
                    <div className="stat-info">
                      <div className="stat-value">{statsLoading ? '...' : channelStats.totalViews}</div>
                      <div className="stat-label">Просмотров</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Shield size={22} /></div>
                    <div className="stat-info">
                      <div className="stat-value">{statsLoading ? '...' : channelStats.totalLikes}</div>
                      <div className="stat-label">Лайков</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><MessageSquare size={22} /></div>
                    <div className="stat-info">
                      <div className="stat-value">{statsLoading ? '...' : channelStats.totalComments}</div>
                      <div className="stat-label">Комментариев</div>
                    </div>
                  </div>
                </div>

                <div className="story-meta-card">
                  <div className="story-meta-row">
                    <span>Последняя история</span>
                    <strong>{formatDateTime(channelStats.lastStoryAt)}</strong>
                  </div>
                  <div className="story-meta-row muted">
                    <span>Видимость</span>
                    <strong>Только для подписчиков канала</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'invites' ? (
              <div className="invites-section">
                <button className="btn-primary" onClick={handleCreateLink} style={{ marginBottom: '16px' }}>
                  Создать ссылку
                </button>
                {loading ? (
                  <div className="loading">Загрузка...</div>
                ) : inviteLinks.length === 0 ? (
                  <div className="empty-state">Пригласительных ссылок пока нет</div>
                ) : (
                  <div className="invite-list">
                    {inviteLinks.map((link) => (
                      <div key={link.id} className="invite-card">
                        <div className="invite-info">
                          <div className="invite-name">{link.name || 'Ссылка'}</div>
                          <div className="invite-stats">
                            <span>Просмотров: {link.views || 0}</span>
                            <span>Вступлений: {link.joins || 0}</span>
                          </div>
                        </div>
                        <div className="invite-actions">
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              const url = `${window.location.origin}/join?invite=${link.code}`
                              navigator.clipboard.writeText(url)
                              setStatusMessage('Ссылка скопирована')
                            }}
                          >
                            Копировать
                          </button>
                          <button className="btn-danger" onClick={() => void handleDeleteLink(link.id)}>
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'settings' ? (
              <div className="settings-section">
                <div className="toggle-setting-row">
                  <div className="toggle-setting-label">
                    <span className="setting-title">Включить реакции</span>
                  </div>
                  <AdminToggle enabled={reactionsEnabled} onToggle={setReactionsEnabled} />
                </div>

                <div className="toggle-setting-row">
                  <div className="toggle-setting-label">
                    <span className="setting-title">Разрешить участникам приглашать</span>
                  </div>
                  <AdminToggle enabled={allowMemberInvites} onToggle={setAllowMemberInvites} />
                </div>
                <p className="setting-help">
                  Обычные участники смогут добавлять других пользователей только если этот режим включён.
                </p>

                {isChannel ? (
                  <>
                    <div className="toggle-setting-row">
                      <div className="toggle-setting-label">
                        <span className="setting-title">Публичный канал</span>
                      </div>
                      <AdminToggle enabled={isPublic} onToggle={setIsPublic} />
                    </div>
                    <p className="setting-help">
                      {isPublic ? 'Канал виден в глобальном поиске.' : 'Канал скрыт из глобального поиска.'}
                    </p>
                  </>
                ) : null}

                {isChannel && !isDiscussionGroup ? (
                  <div className="discussion-section">
                    <div className="toggle-setting-label" style={{ marginBottom: '12px' }}>
                      <span className="setting-title">Обсуждение</span>
                    </div>
                    {discussionChatId ? (
                      <div className="discussion-linked">
                        <div className="discussion-info">Обсуждение уже привязано к каналу</div>
                        <button className="btn-danger" onClick={() => setDiscussionChatId(null)}>
                          Отвязать
                        </button>
                      </div>
                    ) : (
                      <div className="discussion-not-linked">
                        <p className="discussion-copy">
                          Обсуждение создаётся только по желанию владельца и сразу привязывается к каналу.
                        </p>
                        <button className="btn-primary" onClick={() => void handleCreateDiscussion()} style={{ marginTop: '12px', width: '100%' }}>
                          Создать и привязать
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                <button className="btn-primary" onClick={() => void handleSaveSettings()} style={{ width: '100%', marginTop: '20px' }}>
                  Сохранить настройки
                </button>

                {isOwner ? (
                  <div className="danger-section">
                    <div className="danger-title">Опасная зона</div>
                    <p className="danger-copy">
                      Удаление выполняется сразу. Если это канал, вместе с ним удалится и привязанное обсуждение.
                    </p>
                    <button className="btn-danger wide" onClick={() => void handleDeleteEntity()}>
                      <Trash2 size={16} />
                      <span>
                        Удалить {isDiscussionGroup ? 'обсуждение' : isChannel ? 'канал' : 'группу'}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'logs' ? (
              <div className="logs-section">
                {loading ? (
                  <div className="loading">Загрузка...</div>
                ) : adminLogs.length === 0 ? (
                  <div className="empty-state">Журнал пока пуст</div>
                ) : (
                  <div className="log-list">
                    {adminLogs.map((log, index) => (
                      <div key={`${log.createdAt || index}-${index}`} className="log-item">
                        <div className="log-icon">{getLogIcon(log.action)}</div>
                        <div className="log-content">
                          <div className="log-text">{log.description}</div>
                          <div className="log-time">{new Date(log.createdAt).toLocaleString('ru-RU')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <style>{`
            .admin-drawer-panel {
              width: 440px;
              max-width: 92vw;
              position: fixed;
              right: 0;
              top: 0;
              height: 100dvh;
              background: linear-gradient(180deg, rgba(10, 15, 25, 0.98), rgba(7, 10, 19, 0.98));
              border-left: 1px solid rgba(255,255,255,0.08);
              box-shadow: -18px 0 48px rgba(2, 6, 23, 0.48);
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }

            .admin-panel-header {
              padding: 20px;
              border-bottom: 1px solid rgba(255,255,255,0.07);
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
            }

            .admin-panel-header h3 {
              margin: 0;
              font-size: 20px;
            }

            .admin-panel-subtitle {
              margin: 6px 0 0;
              color: var(--text-secondary);
              font-size: 13px;
            }

            .admin-panel-tabs {
              display: flex;
              gap: 8px;
              padding: 14px 20px;
              background: rgba(255,255,255,0.03);
              overflow-x: auto;
            }

            .admin-tab {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 12px;
              background: transparent;
              border: none;
              border-radius: 10px;
              color: var(--text-secondary);
              cursor: pointer;
              transition: all 0.2s;
              min-width: 108px;
            }

            .admin-tab.active {
              background: linear-gradient(135deg, rgba(56, 189, 248, 0.92), rgba(59, 130, 246, 0.86));
              color: white;
              box-shadow: 0 10px 24px rgba(37, 99, 235, 0.25);
            }

            .admin-panel-content {
              padding: 20px;
              overflow-y: auto;
              flex: 1;
            }

            .status-banner {
              margin-bottom: 16px;
              padding: 12px 14px;
              border-radius: 12px;
              background: rgba(56, 189, 248, 0.08);
              border: 1px solid rgba(56, 189, 248, 0.22);
              color: #bae6fd;
              font-size: 13px;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
              gap: 14px;
            }

            .stats-grid.compact {
              margin-top: 16px;
            }

            .stat-card,
            .spotlight-card,
            .story-meta-card,
            .invite-card,
            .log-item,
            .discussion-linked,
            .discussion-not-linked,
            .danger-section {
              background: rgba(255,255,255,0.04);
              border: 1px solid rgba(255,255,255,0.07);
              border-radius: 14px;
            }

            .stat-card {
              padding: 18px;
              display: flex;
              align-items: center;
              gap: 14px;
            }

            .stat-icon {
              color: #7dd3fc;
            }

            .stat-value {
              font-size: 24px;
              font-weight: 800;
            }

            .stat-label {
              font-size: 13px;
              color: var(--text-secondary);
              margin-top: 4px;
            }

            .spotlight-card {
              margin-top: 16px;
              padding: 16px;
              display: flex;
              flex-direction: column;
              gap: 14px;
              align-items: stretch;
            }

            .spotlight-kicker {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.14em;
              color: #7dd3fc;
            }

            .spotlight-title {
              margin-top: 6px;
              font-size: 18px;
              font-weight: 800;
            }

            .spotlight-text {
              margin-top: 8px;
              color: var(--text-secondary);
              font-size: 13px;
            }

            .stories-actions {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }

            .story-meta-card {
              margin-top: 16px;
              padding: 16px;
              display: grid;
              gap: 10px;
            }

            .story-meta-row {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              font-size: 14px;
            }

            .story-meta-row.muted {
              color: var(--text-secondary);
            }

            .invite-list,
            .log-list {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .invite-card {
              padding: 16px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }

            .invite-name {
              font-weight: 700;
              margin-bottom: 6px;
            }

            .invite-stats {
              display: flex;
              gap: 12px;
              color: var(--text-secondary);
              font-size: 13px;
              flex-wrap: wrap;
            }

            .invite-actions {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
            }

            .toggle-setting-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              margin-bottom: 14px;
            }

            .setting-title {
              font-weight: 700;
              font-size: 14px;
            }

            .setting-help {
              margin: -8px 0 16px 0;
              font-size: 12px;
              color: var(--text-secondary);
            }

            .discussion-linked,
            .discussion-not-linked {
              padding: 16px;
            }

            .discussion-copy {
              color: var(--text-secondary);
              font-size: 13px;
              margin: 0;
            }

            .discussion-info {
              margin-bottom: 10px;
              font-weight: 700;
            }

            .danger-section {
              margin-top: 24px;
              padding: 16px;
              border-color: rgba(239, 68, 68, 0.18);
              background: rgba(239, 68, 68, 0.06);
            }

            .danger-title {
              font-size: 15px;
              font-weight: 800;
              color: #fecaca;
            }

            .danger-copy {
              margin: 8px 0 14px;
              color: #fca5a5;
              font-size: 13px;
              line-height: 1.5;
            }

            .log-item {
              padding: 16px;
              display: flex;
              gap: 12px;
            }

            .log-icon {
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: rgba(255,255,255,0.08);
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .log-text {
              font-size: 14px;
              margin-bottom: 4px;
            }

            .log-time {
              font-size: 12px;
              color: var(--text-secondary);
            }

            .loading,
            .empty-state {
              color: var(--text-secondary);
              text-align: center;
              padding: 24px 0;
            }

            .close-btn,
            .btn-primary,
            .btn-secondary,
            .btn-danger {
              border: none;
              cursor: pointer;
            }

            .close-btn {
              background: transparent;
              color: var(--text-secondary);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .btn-primary,
            .btn-secondary,
            .btn-danger {
              border-radius: 12px;
              padding: 11px 14px;
              font-size: 14px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            }

            .btn-primary {
              background: linear-gradient(135deg, #38bdf8, #2563eb);
              color: white;
            }

            .btn-primary.large {
              min-height: 46px;
            }

            .btn-secondary {
              background: rgba(255,255,255,0.07);
              color: white;
            }

            .btn-danger {
              background: rgba(239, 68, 68, 0.12);
              color: #fca5a5;
              border: 1px solid rgba(239, 68, 68, 0.22);
            }

            .btn-danger.wide {
              width: 100%;
            }

            @media (max-width: 640px) {
              .admin-drawer-panel {
                width: 100vw;
                max-width: 100vw;
              }

              .invite-card,
              .stories-actions {
                flex-direction: column;
                align-items: stretch;
              }

              .invite-actions {
                width: 100%;
              }

              .invite-actions button,
              .stories-actions button {
                width: 100%;
              }
            }
          `}</style>
        </div>
      </div>

      {showComposer ? (
        <StoryComposerModal
          user={group}
          initialFile={draftFile}
          onClose={closeComposer}
          onPublish={handlePublishChannelStory}
        />
      ) : null}
    </>
  )
}

export default AdminPanel
