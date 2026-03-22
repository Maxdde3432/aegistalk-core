const EmptyChatState = ({
  shieldIcon,
  setShowMobileChat,
  sidebarSearchInputRef,
  setShowNewGroupModal,
  createNewChat
}) => {
  return (
    <div className="aegis-home">
      <div className="main-center-content">
        <div className="main-logo-square" aria-hidden="true">
          <img className="aegis-home-shield" src={shieldIcon} alt="" />
        </div>
        <div className="main-title">AegisTalk</div>
        <div className="main-subtitle">Ваша связь под защитой</div>
        <button
          className="main-new-chat-btn"
          onClick={() => {
            setShowMobileChat(false)
            setTimeout(() => sidebarSearchInputRef.current?.focus(), 0)
          }}
        >
          Новый чат
        </button>

        <div className="main-bottom-links">
          <button className="main-link-btn main-link-purple" onClick={() => setShowNewGroupModal(true)}>
            👥 Группа
          </button>
          <button
            className="main-link-btn main-link-cyan"
            onClick={async () => {
              const id = prompt('Введите ID пользователя')
              if (!id) return
              await createNewChat(id.trim())
            }}
          >
            🆔 По ID
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmptyChatState
