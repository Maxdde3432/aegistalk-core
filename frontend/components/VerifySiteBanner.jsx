import React from 'react'
import { toast } from '../utils/toast'

const VerifySiteBanner = ({ status, verificationCode, onVerify, loading = false, error = '' }) => {
  const normalized = status || 'idle'
  const needsSetup = ['idle', 'pending', 'none'].includes(normalized)
  const code = verificationCode || 'aegis-vrf-XXXXXX'
  const metaTag = `<meta name="aegis-site-verification" content="${code}">`

  if (normalized === 'verified') {
    return (
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#7ee18b', fontSize: '13px' }}>
        ✓ Сайт подтвержден
      </div>
    )
  }

  if (needsSetup) {
    return (
      <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Для подтверждения добавьте в &lt;head&gt; вашего сайта тег:
        <code style={{ display: 'block', marginTop: '6px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '6px', color: '#8ff0a4', overflowX: 'auto' }}>
          {metaTag}
        </code>
        <button
          onClick={() => {
            const copy = async () => {
              try {
                if (navigator?.clipboard?.writeText) {
                  await navigator.clipboard.writeText(metaTag)
                } else {
                  throw new Error('Clipboard API unavailable')
                }
              } catch {
                const textarea = document.createElement('textarea')
                textarea.value = metaTag
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
              }
              toast.success('Мета-тег скопирован!')
            }
            copy()
          }}
          style={{ marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          Скопировать готовый мета-тег
        </button>
        После добавления нажмите «Подтвердить».
        <button
          onClick={onVerify}
          disabled={loading}
          style={{ marginTop: '10px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Проверяем...' : 'Подтвердить'}
        </button>
        {error && (
          <div style={{ marginTop: '8px', color: '#f87171', fontSize: '12px' }}>
            {error}
          </div>
        )}
      </div>
    )
  }

  return null
}

export default VerifySiteBanner
