import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { groupsAPI } from './api/groups'
import { authAPI } from './api/auth'
import './App.css'

// ============================================================================
// JOIN PAGE - Страница вступления по invite-ссылке
// ============================================================================
const JoinPage = ({ user, onJoinSuccess }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [groupInfo, setGroupInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    const inviteToken = searchParams.get('invite')
    if (!inviteToken) {
      setError('Неверная invite-ссылка')
      setLoading(false)
      return
    }

    // Загружаем информацию о группе
    groupsAPI.getGroupByInvite(inviteToken)
      .then(data => {
        setGroupInfo(data)
        // Проверяем, не являемся ли мы уже участником
        if (data.isMember) {
          setAlreadyMember(true)
          setError('')
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to get group info:', err)
        setError(err.message || 'Группа не найдена')
        setLoading(false)
      })
  }, [searchParams])

  const handleJoin = async () => {
    if (!user) {
      const inviteToken = searchParams.get('invite')
      localStorage.setItem('pendingInvite', inviteToken)
      navigate('/login')
      return
    }

    // Если уже участник - просто переходим в чат
    if (alreadyMember) {
      navigate('/chat')
      return
    }

    setJoining(true)
    setError('')

    try {
      const inviteToken = searchParams.get('invite')
      await groupsAPI.joinByInviteLink(inviteToken)
      onJoinSuccess?.()
      alert(`✅ Вы ${isChannel ? 'подписались на канал' : 'присоединились к группе'}!`)
      navigate('/chat')
    } catch (err) {
      console.error('Failed to join:', err)
      setError(err.message || 'Не удалось вступить')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-logo">
            <h1>🛡️ AegisTalk</h1>
            <p>Загрузка...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !groupInfo) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-logo">
            <h1>🛡️ AegisTalk</h1>
            <p className="text-error">{error}</p>
          </div>
          <div className="auth-card">
            <button className="btn-primary" onClick={() => navigate('/login')}>
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isChannel = groupInfo?.type === 'channel'

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>🛡️ AegisTalk</h1>
          <p>Secure Messenger</p>
        </div>

        <div className="auth-card" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: groupInfo?.backgroundColor || '#0E1621',
                color: groupInfo?.titleColor || '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px',
                border: `2px solid ${groupInfo?.titleColor || '#FFFFFF'}`
              }}
            >
              {isChannel ? '📢' : '👥'}
            </div>

            <h2 style={{ margin: '8px 0', color: groupInfo?.titleColor || '#FFFFFF' }}>
              {groupInfo?.name}
            </h2>

            {groupInfo?.description && (
              <p style={{ color: '#888', fontSize: '14px', margin: '8px 0' }}>
                {groupInfo.description}
              </p>
            )}

            <p style={{ color: '#666', fontSize: '13px', marginTop: '16px' }}>
              {isChannel ? '📢' : '👥'} {groupInfo?.memberCount || 0} {isChannel ? 'подписчиков' : 'участников'}
            </p>
          </div>

          {error && (
            <div className="auth-error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleJoin}
            disabled={joining || alreadyMember}
            style={{
              background: alreadyMember ? '#6c757d' : '#4A9EFF',
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: alreadyMember ? 'default' : 'pointer'
            }}
          >
            {alreadyMember
              ? isChannel
                ? '✅ Вы уже подписаны'
                : '✅ Вы уже в группе'
              : joining
                ? '⏳ Вступление...'
                : user
                  ? isChannel
                    ? '📬 Подписаться на канал'
                    : '👥 Присоединиться к группе'
                  : '🔐 Войти для вступления'
            }
          </button>

          <p className="auth-link" style={{ marginTop: '16px' }}>
            <span
              className="auth-link-button"
              onClick={() => navigate('/login')}
            >
              Отмена
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default JoinPage
