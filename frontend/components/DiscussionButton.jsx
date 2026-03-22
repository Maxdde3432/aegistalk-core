const DiscussionButton = ({ selectedChat, groupSettings, messagesCount = 0, chats, selectChat }) => {
  const hasPosts = Number(messagesCount || 0) > 0

  if (!(selectedChat?.type === 'channel' && groupSettings?.discussionChatId && hasPosts)) {
    return null
  }

  return (
    <button
      onClick={(event) => {
        event.stopPropagation()

        const discussionChat = chats.find(
          (chat) => chat.chatId === groupSettings.discussionChatId || chat.id === groupSettings.discussionChatId
        )

        if (discussionChat) {
          selectChat(discussionChat)
        } else {
          alert('Обсуждение ещё не создано')
        }
      }}
      style={{
        marginTop: '8px',
        padding: '6px 12px',
        background: 'transparent',
        border: '1px solid var(--text-secondary)',
        borderRadius: '12px',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        cursor: 'pointer',
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      Комментировать
    </button>
  )
}

export default DiscussionButton
