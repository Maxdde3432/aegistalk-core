import { useState, useRef } from 'react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { uploadFile } from '../api/uploads.js';
import { Mic, Square, Send, X, Loader2 } from 'lucide-react';
import { toast } from '../utils/toast';

/**
 * Компонент записи голосовых сообщений
 * @param {Object} props
 * @param {string} props.userId - ID пользователя
 * @param {Function} props.onSendMessage - Callback с URL загруженного файла
 * @param {Function} props.onClose - Callback при закрытии
 */
const VoiceRecorder = ({ userId, onSendMessage, onClose }) => {
  const [uploading, setUploading] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedType, setRecordedType] = useState('audio');
  const [isPreview, setIsPreview] = useState(false);
  
  const {
    isRecording,
    formattedTime,
    error,
    startRecording,
    stopRecording,
    cancelRecording
  } = useMediaRecorder();

  const handleStartRecording = async () => {
    try {
      // Проверка прав на микрофон перед записью
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error('Ваш браузер не поддерживает запись голоса');
        console.error('[VoiceRecorder] MediaDevices API not supported:', error);
        throw error;
      }

      // Пробуем получить доступ к микрофону
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      await startRecording('audio');
      setIsPreview(false);
      setRecordedBlob(null);
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start:', err);
      // Не вешаем весь чат, просто показываем ошибку
      if (err.name === 'NotAllowedError') {
        toast.error('Доступ к микрофону запрещён. Разрешите доступ и попробуйте снова.');
      } else if (err.name === 'NotFoundError') {
        toast.error('Микрофон не найден. Подключите его и попробуйте снова.');
      } else {
        toast.error('Ошибка записи голоса: ' + err.message);
      }
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();
      if (!result) return;
      // result содержит { blob, duration, type }
      console.log('[VoiceRecorder] stopRecording result:', result);
      setRecordedBlob(result.blob);
      // Сохраняем длительность и тип для последующей отправки
      setRecordedDuration(result.duration || 0);
      setRecordedType(result.type || 'audio');
      setIsPreview(true);
    } catch (err) {
      console.error('[VoiceRecorder] Failed to stop:', err);
    }
  };

  const handleSend = async () => {
    if (!recordedBlob) return;

    setUploading(true);

    try {
      console.log('[VoiceRecorder] === ОТПРАВКА ===');
      console.log('[VoiceRecorder] recordedBlob:', recordedBlob);
      console.log('[VoiceRecorder] recordedBlob.type:', recordedBlob.type);
      console.log('[VoiceRecorder] recordedBlob.size:', recordedBlob.size);
      console.log('[VoiceRecorder] recordedDuration:', recordedDuration);
      console.log('[VoiceRecorder] recordedType:', recordedType);

      // Конвертация Blob в File
      const file = new File([recordedBlob], `voice_${Date.now()}.webm`, {
        type: 'audio/webm'
      });

      console.log('[VoiceRecorder] File создан:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      // Загрузка в media endpoint
      const result = await uploadFile(file, userId);

      console.log('[VoiceRecorder] Результат загрузки:', result);

      if (result.success) {
        onSendMessage({
          type: 'voice',
          url: result.url,
          duration: recordedDuration || 0
        });
        onClose();
      } else {
        toast.error('Ошибка загрузки: ' + result.error);
      }
    } catch (err) {
      console.error('[VoiceRecorder] Upload error:', err);
      toast.error('Ошибка при отправке: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      cancelRecording();
    }
    setRecordedBlob(null);
    setIsPreview(false);
    onClose();
  };

  return (
    <div className="voice-recorder">
      <div className="recorder-content">
        {/* Заголовок */}
        <div className="recorder-header">
          <span className="recorder-title">
            {isRecording ? '🔴 Запись...' : isPreview ? '🎤 Готово к отправке' : '🎤 Голосовое сообщение'}
          </span>
          <button className="recorder-close" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        {/* Основная область */}
        <div className="recorder-body">
          {/* Визуализация времени */}
          <div className="timer-display">
            {isRecording ? (
              <div className="recording-timer">
                <div className="pulse-indicator" />
                <span className="timer-text">{formattedTime}</span>
              </div>
            ) : isPreview ? (
              <div className="preview-timer">
                <span className="timer-text">⏱️ {formattedTime}</span>
              </div>
            ) : (
              <div className="ready-text">
                Нажмите для записи
              </div>
            )}
          </div>

          {/* Кнопка записи */}
          <div className="recorder-controls">
            {!isRecording && !isPreview && (
              <button 
                className="btn-record"
                onClick={handleStartRecording}
                disabled={uploading}
              >
                <Mic size={32} />
                <span>Записать</span>
              </button>
            )}

            {isRecording && (
              <button 
                className="btn-stop"
                onClick={handleStopRecording}
                disabled={uploading}
              >
                <Square size={32} fill="white" />
                <span>Стоп</span>
              </button>
            )}

            {isPreview && (
              <div className="preview-controls">
                <button 
                  className="btn-cancel"
                  onClick={() => {
                    setIsPreview(false);
                    setRecordedBlob(null);
                  }}
                >
                  <X size={24} />
                  <span>Заново</span>
                </button>
                <button 
                  className="btn-send"
                  onClick={handleSend}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 size={24} className="spin" />
                  ) : (
                    <Send size={24} />
                  )}
                  <span>{uploading ? 'Отправка...' : 'Отправить'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div className="recorder-error">
              ❌ {error}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .voice-recorder {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 16px;
          max-width: 400px;
        }
        
        .recorder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .recorder-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .recorder-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .recorder-close:hover {
          color: var(--text-primary);
        }
        
        .recorder-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        
        .timer-display {
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .recording-timer {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .pulse-indicator {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        
        .timer-text {
          font-size: 32px;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          color: var(--text-primary);
        }
        
        .preview-timer {
          font-size: 24px;
          color: var(--text-primary);
        }
        
        .ready-text {
          font-size: 16px;
          color: var(--text-secondary);
        }
        
        .recorder-controls {
          display: flex;
          gap: 12px;
        }
        
        .btn-record, .btn-stop {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-record {
          background: var(--primary);
          color: white;
        }
        
        .btn-record:hover {
          background: var(--primary-dark);
        }
        
        .btn-stop {
          background: #ef4444;
          color: white;
        }
        
        .btn-stop:hover {
          background: #dc2626;
        }
        
        .preview-controls {
          display: flex;
          gap: 12px;
        }
        
        .btn-cancel, .btn-send {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-cancel {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        
        .btn-cancel:hover {
          background: var(--bg-secondary);
        }
        
        .btn-send {
          background: var(--primary);
          color: white;
        }
        
        .btn-send:hover {
          background: var(--primary-dark);
        }
        
        .btn-send:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .recorder-error {
          color: #ef4444;
          font-size: 14px;
          text-align: center;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;

