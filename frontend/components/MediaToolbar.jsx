import { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';
import VideoCircleRecorder from './VideoCircleRecorder';
import { Mic, Video } from 'lucide-react';

/**
 * Панель инструментов для записи медиа в чате
 * @param {Object} props
 * @param {string} props.userId - ID пользователя
 * @param {Function} props.onSendMessage - Callback с сообщением { type, url, duration }
 */
const MediaToolbar = ({ userId, onSendMessage }) => {
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  const handleVoiceMessage = (message) => {
    onSendMessage(message);
    setShowVoiceRecorder(false);
  };

  const handleVideoMessage = (message) => {
    onSendMessage(message);
    setShowVideoRecorder(false);
  };

  return (
    <>
      {/* Кнопки инструментов */}
      <div className="media-toolbar">
        <button
          className="toolbar-btn"
          onClick={() => setShowVoiceRecorder(true)}
          title="Голосовое сообщение"
        >
          <Mic size={20} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setShowVideoRecorder(true)}
          title="Видео-кружок"
        >
          <Video size={20} />
        </button>
      </div>

      {/* Модальное окно записи голоса */}
      {showVoiceRecorder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <VoiceRecorder
              userId={userId}
              onSendMessage={handleVoiceMessage}
              onClose={() => setShowVoiceRecorder(false)}
            />
          </div>
        </div>
      )}

      {/* Модальное окно записи видео */}
      {showVideoRecorder && (
        <VideoCircleRecorder
          userId={userId}
          onSendMessage={handleVideoMessage}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}

      <style>{`
        .media-toolbar {
          display: flex;
          gap: 8px;
          padding: 8px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }
        
        .toolbar-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .toolbar-btn:hover {
          background: var(--primary);
          color: white;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .modal-content {
          background: var(--bg-primary);
          border-radius: 16px;
          padding: 20px;
          max-width: 90%;
        }
      `}</style>
    </>
  );
};

export default MediaToolbar;
