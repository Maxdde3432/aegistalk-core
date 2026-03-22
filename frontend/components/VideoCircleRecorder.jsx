import { useState, useRef, useEffect } from 'react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { uploadFile } from '../api/uploads.js';
import { Video, Square, X, Loader2, RotateCcw, Send } from 'lucide-react';
import { toast } from '../utils/toast';

/**
 * Компонент записи видео-кружков (как в Telegram)
 * @param {Object} props
 * @param {string} props.userId - ID пользователя
 * @param {Function} props.onSendMessage - Callback с URL загруженного файла
 * @param {Function} props.onClose - Callback при закрытии
 */
const VideoCircleRecorder = ({ userId, onSendMessage, onClose }) => {
  const [uploading, setUploading] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  const videoPreviewRef = useRef(null);
  const canvasRef = useRef(null);
  
  const {
    isRecording,
    formattedTime,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording
  } = useMediaRecorder();

  // Инициализация превью при начале записи
  useEffect(() => {
    if (isRecording && videoPreviewRef.current) {
      const initializePreview = async () => {
        try {
          const stream = await startRecording('video');
          
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('[VideoCircle] Failed to initialize:', err);
          setCameraError(err.message);
        }
      };
      
      initializePreview();
    }
    
    // Очистка при размонтировании
    return () => {
      if (videoPreviewRef.current && videoPreviewRef.current.srcObject) {
        videoPreviewRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    setCameraError(null);
    try {
      await startRecording('video');
      setIsPreview(false);
      setRecordedBlob(null);
    } catch (err) {
      console.error('[VideoCircle] Failed to start:', err);
      setCameraError('Нет доступа к камере');
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      if (!blob) return;
      setRecordedBlob(blob);
      setIsPreview(true);
      
      // Останавливаем поток камеры
      if (videoPreviewRef.current && videoPreviewRef.current.srcObject) {
        videoPreviewRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error('[VideoCircle] Failed to stop:', err);
    }
  };

  const handleSend = async () => {
    if (!recordedBlob) return;
    
    setUploading(true);
    
    try {
      // Конвертация Blob в File
      const file = new File([recordedBlob], `video_${Date.now()}.webm`, {
        type: 'video/webm'
      });
      
      // Загрузка в media endpoint
      const result = await uploadFile(file, userId);
      
      if (result.success) {
        onSendMessage({
          type: 'video-circle',
          url: result.url,
          duration: formattedTime
        });
        onClose();
      } else {
        toast.error('Ошибка загрузки: ' + result.error);
      }
    } catch (err) {
      console.error('[VideoCircle] Upload error:', err);
      toast.error('Ошибка при отправке: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      cancelRecording();
      if (videoPreviewRef.current && videoPreviewRef.current.srcObject) {
        videoPreviewRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }
    setRecordedBlob(null);
    setIsPreview(false);
    setCameraError(null);
    onClose();
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setIsPreview(false);
    handleStartRecording();
  };

  return (
    <div className="video-circle-recorder">
      <div className="recorder-overlay">
        {/* Кнопка закрытия */}
        <button className="close-button" onClick={handleCancel}>
          <X size={24} />
        </button>

        {/* Основная область с превью */}
        <div className="circle-container">
          {/* Видео превью */}
          <div className="video-wrapper">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="video-preview"
            />
            
            {/* Круглая маска */}
            <div className="circle-mask" />
          </div>

          {/* Холст для захвата кадров (скрыт) */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Таймер */}
          {isRecording && (
            <div className="timer-overlay">
              <div className="recording-dot" />
              <span className="timer-text">{formattedTime}</span>
            </div>
          )}

          {/* Превью записанного */}
          {isPreview && recordedBlob && (
            <div className="preview-overlay">
              <video
                src={URL.createObjectURL(recordedBlob)}
                controls
                className="preview-video"
              />
            </div>
          )}
        </div>

        {/* Контролы */}
        <div className="controls-container">
          {!isRecording && !isPreview && (
            <button 
              className="btn-record-circle"
              onClick={handleStartRecording}
              disabled={uploading}
            >
              <Video size={32} />
            </button>
          )}

          {isRecording && (
            <button 
              className="btn-stop-circle"
              onClick={handleStopRecording}
              disabled={uploading}
            >
              <Square size={28} fill="white" />
            </button>
          )}

          {isPreview && (
            <div className="preview-controls-circle">
              <button 
                className="btn-retake"
                onClick={handleRetake}
                disabled={uploading}
              >
                <RotateCcw size={24} />
              </button>
              <button 
                className="btn-send-circle"
                onClick={handleSend}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 size={28} className="spin" />
                ) : (
                  <Send size={28} />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {(recorderError || cameraError) && (
          <div className="error-message">
            ❌ {cameraError || recorderError}
          </div>
        )}
      </div>

      <style>{`
        .video-circle-recorder {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .recorder-overlay {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .close-button {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s;
        }
        
        .close-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .circle-container {
          position: relative;
          width: 280px;
          height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .video-wrapper {
          position: relative;
          width: 280px;
          height: 280px;
          overflow: hidden;
        }
        
        .video-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* Зеркальное отражение */
        }
        
        .circle-mask {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 50%;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          border: 3px solid rgba(255, 255, 255, 0.3);
        }
        
        .timer-overlay {
          position: absolute;
          top: -50px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.6);
          padding: 8px 16px;
          border-radius: 20px;
        }
        
        .recording-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .timer-text {
          color: white;
          font-size: 18px;
          font-weight: 600;
          font-family: 'Courier New', monospace;
        }
        
        .preview-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 50%;
          overflow: hidden;
        }
        
        .preview-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .controls-container {
          position: absolute;
          bottom: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .btn-record-circle, .btn-stop-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 4px solid white;
          background: transparent;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .btn-record-circle:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .btn-stop-circle {
          background: rgba(239, 68, 68, 0.8);
          border-color: #ef4444;
        }
        
        .btn-stop-circle:hover {
          background: rgba(239, 68, 68, 1);
        }
        
        .preview-controls-circle {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        
        .btn-retake, .btn-send-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .btn-retake {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }
        
        .btn-retake:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .btn-send-circle {
          background: var(--primary, #007bff);
          color: white;
        }
        
        .btn-send-circle:hover {
          background: var(--primary-dark, #0056b3);
        }
        
        .btn-send-circle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .error-message {
          position: absolute;
          bottom: 20px;
          color: #ef4444;
          background: rgba(0, 0, 0, 0.8);
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
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

export default VideoCircleRecorder;

