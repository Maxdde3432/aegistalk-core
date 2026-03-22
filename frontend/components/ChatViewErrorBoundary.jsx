import React from 'react'

class ChatViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
    this.handleRetry = this.handleRetry.bind(this)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ChatViewErrorBoundary] Chat render failed:', error, errorInfo)
  }

  handleRetry() {
    this.setState({ hasError: false })
    if (typeof this.props.onRetry === 'function') {
      try {
        this.props.onRetry()
      } catch (e) {
        console.error('[ChatViewErrorBoundary] onRetry failed:', e)
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: '#e5e7eb'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '20px',
              padding: '24px',
              background: 'rgba(9, 10, 14, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Ошибка загрузки сообщений
            </div>
            <div style={{ fontSize: '14px', color: '#a1a1aa' }}>
              Чат продолжит работать. Попробуйте повторить загрузку истории.
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                marginTop: '16px',
                width: '100%',
                borderRadius: '12px',
                padding: '10px 12px',
                background: 'rgba(59, 130, 246, 0.18)',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                color: '#e5e7eb',
                cursor: 'pointer'
              }}
            >
              Повторить
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ChatViewErrorBoundary
