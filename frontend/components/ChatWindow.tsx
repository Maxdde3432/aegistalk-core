import React, { useState } from 'react'

type Chat = {
  id: string
  name: string
  isOnline: boolean
  isChannel?: boolean
  lastSeen?: string
}

type Message = {
  id: string
  chatId: string
  fromMe: boolean
  text: string
  time: string
}

const demoChats: Chat[] = [
  { id: '1', name: 'Алина', isOnline: true },
  { id: '2', name: 'Команда AegisTalk', isOnline: false, isChannel: true, lastSeen: 'был(а) недавно' },
  { id: '3', name: 'Макс', isOnline: true },
  { id: '4', name: 'Техподдержка', isOnline: false, lastSeen: 'был(а) недавно' }
]

const demoMessages: Message[] = [
  { id: 'm1', chatId: '1', fromMe: false, text: 'Привет, как тебе новый дизайн?', time: '21:32' },
  { id: 'm2', chatId: '1', fromMe: true, text: 'Очень атмосферно, прям AegisTalk 💠', time: '21:33' },
  { id: 'm3', chatId: '1', fromMe: false, text: 'Скинь позже билд, хочу потестить', time: '21:34' },
  { id: 'm4', chatId: '2', fromMe: false, text: 'Добро пожаловать в канал AegisTalk.', time: '14:05' },
  { id: 'm5', chatId: '3', fromMe: true, text: 'Готов встретиться завтра?', time: '18:20' }
]

const ChatWindow: React.FC = () => {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages] = useState<Message[]>(demoMessages)
  const [inputValue, setInputValue] = useState('')

  const activeChat = demoChats.find((c) => c.id === activeChatId) || null
  const activeChatMessages = messages.filter((m) => m.chatId === activeChatId)

  const getChannelBackgroundPreset = (chat: Chat | null) => {
    if (!chat || !chat.isChannel) return 'default'
    return 'default'
  }

  const handleSend = () => {
    if (!inputValue.trim() || !activeChatId) return
    setInputValue('')
  }

  const statusText = (chat: Chat | null) => {
    if (!chat) return ''
    if (chat.isOnline) return 'в сети'
    return chat.lastSeen || 'был(а) недавно'
  }

  return (
    <div className="h-full w-full bg-[#050505] text-zinc-50 flex overflow-hidden rounded-2xl border border-[#18181b]">
      <aside className="w-[340px] border-r border-[#18181b] bg-[#050505] flex flex-col">
        <div className="px-4 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Чаты</h2>
          <button className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
            Новый
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {demoChats.map((chat) => {
            const isActive = chat.id === activeChatId
            return (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={[
                  'w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200',
                  'bg-[#0b0b0f] hover:bg-[#111118]',
                  isActive ? 'shadow-[0_14px_40px_rgba(37,99,235,0.45)]' : 'shadow-none'
                ].join(' ')}
              >
                {isActive && (
                  <span className="h-10 w-1 rounded-full bg-gradient-to-b from-[#2563eb] to-[#3b82f6]" />
                )}
                {!isActive && <span className="w-1" />}

                <div className="relative h-[52px] w-[52px] rounded-2xl bg-gradient-to-br from-[#111827] via-[#020617] to-[#111827] flex items-center justify-center text-sm font-semibold text-zinc-200">
                  <span>{chat.name.charAt(0).toUpperCase()}</span>
                  <span
                    className={[
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#050505]',
                      chat.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'
                    ].join(' ')}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {chat.name}
                    </span>
                    <span className="text-[0.65rem] text-zinc-500">21:33</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                    {chat.isChannel ? 'Канал AegisTalk' : 'Последнее сообщение · демо'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {!activeChat && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6">
              <div className="mx-auto h-[140px] w-[140px] rounded-[40px] bg-gradient-to-br from-[#2563eb] via-[#3b82f6] to-[#60a5fa] shadow-[0_30px_90px_rgba(37,99,235,0.75)] flex items-center justify-center text-5xl">
                🛡️
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-zinc-100">
                  Выберите чат или начните новый
                </p>
                <p className="text-xs text-zinc-500">
                  AegisTalk хранит ваши диалоги в защищённом пространстве.
                </p>
              </div>
              <button className="inline-flex items-center justify-center rounded-full bg-white px-8 py-2.5 text-sm font-semibold text-black shadow-[0_22px_60px_rgba(255,255,255,0.24)] hover:-translate-y-[3px] hover:shadow-[0_26px_80px_rgba(255,255,255,0.35)] transition-all duration-200">
                Новый чат
              </button>
            </div>
          </div>
        )}

        {activeChat && (
          <>
            <header className="h-16 flex items-center justify-between px-5 border-b border-[#18181b] bg-[#050505]/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-[#111827] via-[#020617] to-[#111827] flex items-center justify-center text-sm font-semibold text-zinc-200">
                  <span>{activeChat.name.charAt(0).toUpperCase()}</span>
                  <span
                    className={[
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#050505]',
                      activeChat.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'
                    ].join(' ')}
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-zinc-100">
                    {activeChat.name}
                  </span>
                  <span className="text-[0.7rem] text-emerald-400">
                    {statusText(activeChat)}
                  </span>
                </div>
              </div>

              <button className="h-9 w-9 rounded-full bg-[#09090b] border border-[#27272a] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-[#111113] transition-colors">
                <span className="text-lg leading-none">•••</span>
              </button>
            </header>

            <div className="relative flex-1 overflow-hidden">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 opacity-60">
                  <div className="absolute -top-1/3 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.35),_transparent_65%)] animate-[pulseField_18s_ease-in-out_infinite]" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden opacity-20">
                  <div className="absolute inset-x-0 bottom-[-60%] h-[200%] bg-[linear-gradient(to_top,_rgba(37,99,235,0.25)_1px,transparent_1px)] bg-[length:1px_40px] animate-[energyLines_26s_linear_infinite]" />
                </div>
              </div>

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                  {activeChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={[
                        'flex w-full',
                        msg.fromMe ? 'justify-end' : 'justify-start'
                      ].join(' ')}
                    >
                      <div className="max-w-[72%] space-y-1">
                        <div
                          className={[
                            'px-3.5 py-2 text-sm',
                            'rounded-2xl',
                            msg.fromMe
                              ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6] text-zinc-50 rounded-tr-[2px]'
                              : 'bg-[#17171b] text-zinc-100 rounded-tl-[2px]'
                          ].join(' ')}
                        >
                          {msg.text}
                        </div>
                        <div
                          className={[
                            'text-[0.68rem] text-slate-500/80',
                            msg.fromMe ? 'text-right pr-1' : 'text-left pl-1'
                          ].join(' ')}
                        >
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#18181b] bg-[#050505]/95 backdrop-blur px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <button className="h-8 w-8 flex items-center justify-center rounded-full hover:text-zinc-100 hover:bg-[#111113] transition-colors">
                        <span className="text-lg">😊</span>
                      </button>
                      <button className="h-8 w-8 flex items-center justify-center rounded-full hover:text-zinc-100 hover:bg-[#111113] transition-colors">
                        <span className="text-lg">📎</span>
                      </button>
                      <button className="h-8 w-8 flex items-center justify-center rounded-full hover:text-zinc-100 hover:bg-[#111113] transition-colors">
                        <span className="text-lg">🎤</span>
                      </button>
                    </div>

                    <div className="flex-1 flex items-center rounded-full bg-[rgba(17,17,19,0.7)] border border-[#27272a] px-4 py-2 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                      <input
                        className="flex-1 bg-transparent outline-none text-sm text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Напишите сообщение..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                      />
                    </div>

                    <button
                      onClick={handleSend}
                      className="h-10 w-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-sm text-white shadow-[0_18px_45px_rgba(37,99,235,0.75)] hover:scale-110 hover:bg-[#2563eb] transition-transform duration-150"
                    >
                      ➤
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden">
              {getChannelBackgroundPreset(activeChat)}
            </div>
          </>
        )}
      </div>

      <style>
        {`
          @keyframes pulseField {
            0%, 100% {
              transform: translate(-50%, 0) scale(0.95);
              opacity: 0.35;
            }
            50% {
              transform: translate(-50%, 10px) scale(1.05);
              opacity: 0.7;
            }
          }

          @keyframes energyLines {
            0% {
              transform: translateY(0);
            }
            100% {
              transform: translateY(-50%);
            }
          }
        `}
      </style>
    </div>
  )
}

export default ChatWindow
