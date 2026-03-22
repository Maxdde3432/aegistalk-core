import React from 'react'

const AppSimple = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a, #020617)',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif'
      }}
    >
      <div
        style={{
          padding: '32px 40px',
          borderRadius: '24px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.9)',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center'
        }}
      >
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          AegisTalk
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '20px' }}>
          Фронтенд успешно собирается, но основной чат сейчас временно отключён
          из‑за ошибок в большом компоненте <code>App.jsx</code>.
        </p>
        <p style={{ fontSize: '14px', opacity: 0.8 }}>
          Когда будете готовы, можно постепенно починить старый файл
          <code> App.jsx </code> и вернуть его в точку входа вместо упрощённой версии.
        </p>
      </div>
    </div>
  )
}

export default AppSimple

