const EditMessageModal = ({
  showEditModal,
  setShowEditModal,
  editContent,
  setEditContent,
  editMessage
}) => {
  if (!showEditModal) return null

  return (
    <div
      className="modal-overlay"
      onClick={() => setShowEditModal(null)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#050505',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          padding: '18px 18px 14px 18px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
        }}
      >
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Редактировать сообщение</h3>
          <button
            type="button"
            onClick={() => setShowEditModal(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: '96px',
            maxHeight: '220px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            background: '#0b0b0f',
            color: 'var(--text-primary)',
            padding: '10px 12px',
            fontSize: '14px',
            outline: 'none'
          }}
          placeholder="Измените текст сообщения..."
        />

        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={() => setShowEditModal(null)}
            style={{
              padding: '8px 14px',
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
            onClick={() => {
              const trimmed = (editContent || '').trim()
              if (!trimmed) {
                alert('Сообщение не может быть пустым')
                return
              }
              editMessage(showEditModal, trimmed)
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditMessageModal
