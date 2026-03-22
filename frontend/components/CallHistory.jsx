// CallHistory.jsx - История звонков
import { useState, useEffect } from 'react'

export const CallHistory = ({ userId, onClose }) => {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCalls = async () => {
      try {
        // Внутренний API пока без истории звонков — показываем пустой список без внешних запросов
        setCalls([])
      } catch (error) {
        console.error('[CallHistory] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      loadCalls()
    }
  }, [userId])

  const formatDuration = (seconds) => {
    if (!seconds || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return '✅'
      case 'ended': return '📞'
      case 'missed': return '🔴'
      case 'rejected': return '❌'
      default: return '📞'
    }
  }

  const getTypeIcon = (type) => {
    return type === 'video' ? '📹' : '📞'
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
        Загрузка...
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
          📞 История звонков
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B7280',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 8px'
          }}
        >
          ✕
        </button>
      </div>

      {calls.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>
          История звонков пуста
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {calls.map(call => {
            const isOutgoing = call.caller_id === userId
            const duration = call.ended_at 
              ? Math.floor((new Date(call.ended_at) - new Date(call.created_at)) / 1000)
              : 0

            return (
              <div
                key={call.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {getStatusIcon(call.status)}
                </span>
                
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '500' }}>
                    {isOutgoing ? 'Исходящий' : 'Входящий'} {getTypeIcon(call.type)}
                  </div>
                  <div style={{ color: '#6B7280', fontSize: '12px' }}>
                    {new Date(call.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {call.status === 'active' || call.status === 'ended' ? (
                  <div style={{ 
                    color: '#4ade80', 
                    fontSize: '13px', 
                    fontFamily: 'monospace',
                    fontWeight: '600'
                  }}>
                    {formatDuration(duration)}
                  </div>
                ) : (
                  <div style={{ color: '#6B7280', fontSize: '12px' }}>
                    {call.status === 'missed' ? 'Пропущен' : 'Отклонён'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CallHistory
