import { useState, useRef, useEffect } from 'react';
import { Mic, Video, Send, Paperclip } from 'lucide-react';

/**
 * Современный Input Bar в стиле Telegram/WhatsApp
 */
const InputBar = ({ 
  onSendMessage, 
  onStartRecording, 
  onStopRecording, 
  isRecording,
  recordingType = 'audio' // 'audio' или 'video'
}) => {
  const [message, setMessage] = useState('');
  const [recordingMode, setRecordingMode] = useState(recordingType);
  const [showWaveVisualizer, setShowWaveVisualizer] = useState(false);
  
  const longPressTimer = useRef(null);
  const inputRef = useRef(null);
  const isLongPressRef = useRef(false);

  // Проверяем состояние при загрузке и изменении текста
  useEffect(() => {
    checkInputState();
  }, [message]);

  // Синхронизация recordingType из родителя
  useEffect(() => {
    setRecordingMode(recordingType);
  }, [recordingType]);

  // Проверка состояния ввода
  const checkInputState = () => {
    // Просто обновляем состояние на основе текста
    // Это нужно для правильного отображения кнопки
  };

  // Получение текущего значения инпута ПРЯМО СЕЙЧАС
  const getCurrentMessage = () => {
    return inputRef.current?.value?.trim() || '';
  };

  // Обработка нажатия на кнопку (приоритет: отправка текста > запись > переключение)
  const handlePressStart = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    // ПРИОРИТЕТ 1: ПРЯМАЯ ПРОВЕРКА инпута - отправляем НЕМЕДЛЕННО
    const currentMessage = getCurrentMessage();
    if (currentMessage.length > 0) {
      console.log('[InputBar] Text detected in input - sending immediately:', currentMessage);
      handleSend(currentMessage);
      return;
    }

    // ПРИОРИТЕТ 2: Запуск таймера долгого нажатия для записи
    console.log('[InputBar] No text - starting long press timer');
    longPressTimer.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowWaveVisualizer(true);
      try {
        onStartRecording(recordingMode);
        console.log('[InputBar] Long press detected - recording started');
      } catch (err) {
        console.error('[InputBar] Failed to start recording:', err);
        isLongPressRef.current = false;
        setShowWaveVisualizer(false);
        alert('Ошибка записи: ' + err.message);
      }
    }, 500);
  };

  const handlePressEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    
    // Очищаем таймер
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Если была запись - останавливаем
    if (isLongPressRef.current) {
      console.log('[InputBar] Recording stopped');
      isLongPressRef.current = false;
      setShowWaveVisualizer(false);
      onStopRecording();
    }
    // Если не long press - ничего не делаем (короткий клик обработается в onClick)
  };

  // Обработка клика - ТОЛЬКО переключение режима (если нет текста и не было записи)
  const handleClick = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    
    // ПРЯМАЯ ПРОВЕРКА инпута
    const currentMessage = getCurrentMessage();
    
    console.log('[InputBar] Click event - message:', currentMessage, 'isLongPress:', isLongPressRef.current);
    
    // Если есть текст - уже отправили в handlePressStart
    if (currentMessage.length > 0) {
      console.log('[InputBar] Text already sent');
      return;
    }
    
    // Если была запись - уже обработали в handlePressEnd
    if (isLongPressRef.current) {
      console.log('[InputBar] Recording already handled');
      return;
    }
    
    // Короткий клик без текста - переключаем режим
    console.log('[InputBar] Toggling recording mode');
    const newMode = recordingMode === 'audio' ? 'video' : 'audio';
    setRecordingMode(newMode);
  };

  // Отправка текстового сообщения
  const handleSend = (text) => {
    const messageText = text || getCurrentMessage();
    if (messageText) {
      console.log('[InputBar] Sending message:', messageText);
      onSendMessage(messageText);
      setMessage('');
      // Принудительно очищаем инпут
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      // Возвращаем иконку к микрофону
      setRecordingMode('audio');
    }
  };

  // Обработка Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Не используем preventDefault чтобы избежать предупреждений о пассивных листенерах
      e.stopPropagation();
      handleSend();
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Определяем тип кнопки
  const hasText = message.trim().length > 0;
  const isRecordingActive = isRecording && showWaveVisualizer;

  return (
    <div className="input-bar-container">
      {/* Визуализация записи */}
      {showWaveVisualizer && (
        <div className="wave-visualizer">
          <div className="wave-bar"></div>
          <div className="wave-bar"></div>
          <div className="wave-bar"></div>
          <div className="wave-bar"></div>
          <div className="wave-bar"></div>
          <span className="recording-text">
            {recordingMode === 'audio' ? '🎤 Запись голоса...' : '📹 Запись видео...'}
          </span>
        </div>
      )}

      {/* Основная строка ввода */}
      <div className="input-pill">
        {/* Кнопка скрепки (выбор файлов) */}
        <button className="attach-button" title="Прикрепить файл" type="button">
          <Paperclip size={20} />
        </button>

        {/* Поле ввода текста */}
        <input
          id="message-input"
          name="message"
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder={showWaveVisualizer ? "Запись идет..." : "Сообщение..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isRecordingActive}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />

        {/* Умная кнопка - ВСЕГДА активна! */}
        <button
          id="send-message-button"
          name="sendMessage"
          className={`smart-button ${hasText ? 'send-mode' : ''} ${isRecordingActive ? 'recording-mode' : ''} ${recordingMode}`}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={() => {
            if (isLongPressRef.current) {
              handlePressEnd();
            }
          }}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          onClick={handleClick}
          type="button"
          disabled={false} // НИКОГДА не отключаем!
        >
          {hasText ? (
            <Send size={20} />
          ) : isRecordingActive ? (
            <div className="recording-indicator">
              <div className="pulse-ring"></div>
            </div>
          ) : recordingMode === 'audio' ? (
            <Mic size={20} className="mode-icon" />
          ) : (
            <Video size={20} className="mode-icon" />
          )}
        </button>
      </div>

      <style>{`
        .input-bar-container {
          padding: 8px 16px;
          background: var(--bg-primary);
          border-top: 1px solid var(--border-color);
        }

        /* Визуализация записи */
        .wave-visualizer {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: var(--bg-secondary);
          border-radius: 12px;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .wave-bar {
          width: 4px;
          height: 20px;
          background: var(--primary);
          border-radius: 2px;
          animation: wave 0.8s ease-in-out infinite;
        }

        .wave-bar:nth-child(1) { animation-delay: 0s; }
        .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .wave-bar:nth-child(4) { animation-delay: 0.3s; }
        .wave-bar:nth-child(5) { animation-delay: 0.4s; }

        @keyframes wave {
          0%, 100% {
            height: 20px;
            opacity: 0.5;
          }
          50% {
            height: 32px;
            opacity: 1;
          }
        }

        .recording-text {
          flex: 1;
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
        }

        /* Основная строка ввода */
        .input-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-secondary);
          border-radius: 24px;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          transition: border-color 0.2s;
        }

        .input-pill:focus-within {
          border-color: var(--primary);
        }

        /* Кнопка скрепки */
        .attach-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .attach-button:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        /* Поле ввода */
        .message-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 14px;
          padding: 8px 12px;
        }

        .message-input::placeholder {
          color: var(--text-secondary);
        }

        .message-input:disabled {
          opacity: 0.5;
        }

        /* Умная кнопка */
        .smart-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        /* Режим отправки (синяя стрелка) */
        .smart-button.send-mode {
          background: var(--primary);
          color: white;
          transform: rotate(0deg);
        }

        .smart-button.send-mode:hover {
          background: var(--primary-dark);
          transform: scale(1.05);
        }

        /* Режим записи (пульсация) */
        .smart-button.recording-mode {
          background: #ef4444;
          color: white;
          animation: pulse-red 1.5s infinite;
        }

        @keyframes pulse-red {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
          }
        }

        /* Индикатор записи */
        .recording-indicator {
          position: relative;
          width: 16px;
          height: 16px;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: white;
          animation: pulse-ring 1.5s infinite;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        /* Анимация переключения режима */
        .smart-button .mode-icon {
          transition: transform 0.3s ease;
        }

        .smart-button.audio .mode-icon {
          transform: rotate(0deg);
        }

        .smart-button.video .mode-icon {
          transform: rotate(90deg);
        }

        /* Hover эффекты */
        .smart-button:not(.send-mode):not(.recording-mode):hover {
          background: var(--bg-secondary);
          transform: scale(1.05);
        }

        .smart-button:disabled {
          cursor: default;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default InputBar;
