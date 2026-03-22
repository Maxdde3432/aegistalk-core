import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

// Кэш подписанных URL чтобы не запрашивать повторно
const signedUrlCache = new Map();

/**
 * Компонент для воспроизведения аудио/голосовых сообщений
 * @param {Object} props
 * @param {string} props.url - URL или filePath аудио файла
 * @param {number} props.duration - Длительность в секундах (опционально)
 * @param {boolean} props.isOwn - Своё ли сообщение
 * @param {boolean} props.isPlaying - Воспроизводится ли сейчас (из родителя)
 * @param {Function} props.onPlay - Функция вызываемая при нажатии Play
 */
const VoiceMessage = ({ url, duration, isOwn, isPlaying: parentIsPlaying, onPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cachedUrl, setCachedUrl] = useState(null);

  const audioRef = useRef(null);
  const animationRef = useRef(null);

  // Инициализация аудио при изменении URL
  useEffect(() => {
    // Проверяем кэш сначала
    if (signedUrlCache.has(url)) {
      const cached = signedUrlCache.get(url);
      console.log('[VoiceMessage] Using cached signedUrl for:', url);
      setCachedUrl(cached);
      setIsLoading(false);
      return;
    }

    // Если это уже полная ссылка (начинается с https), используем её
    if (url && url.startsWith('https://')) {
      console.log('[VoiceMessage] Using direct URL:', url.substring(0, 50) + '...');
      setCachedUrl(url);
      setIsLoading(false);
      return;
    }

    // Иначе это filePath - нужно получить signedUrl
    console.log('[VoiceMessage] Need signedUrl for filePath:', url);
    setIsLoading(true);
  }, [url]);

  // Инициализация аудио при изменении cachedUrl
  useEffect(() => {
    let isMounted = true;  // Флаг чтобы не обновлять unmounted компонент

    if (!cachedUrl) {
      console.log('[VoiceMessage] No URL provided');
      setError('URL не указан');
      setIsLoading(false);
      return;
    }

    // Проверка на истекший токен
    let tokenExpired = false;
    if (cachedUrl.includes('token=eyJ')) {
      try {
        const tokenPart = cachedUrl.split('token=')[1].split('&')[0];
        const tokenPayload = JSON.parse(atob(tokenPart.split('.')[1]));
        const now = Date.now() / 1000;
        const expiresIn = tokenPayload.exp - now;
        
        console.log('[VoiceMessage] Token expires in:', expiresIn, 'seconds');
        
        if (now > tokenPayload.exp) {
          console.error('[VoiceMessage] Token expired! exp:', new Date(tokenPayload.exp * 1000));
          tokenExpired = true;
          setError('Срок действия ссылки истек. Обновите страницу.');
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Не удалось распарсить токен
      }
    }

    if (tokenExpired) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    console.log('[VoiceMessage] Initializing audio with URL');
    const audio = new Audio(cachedUrl);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audioRef.current = audio;
    setIsLoading(true);
    setError(null);

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      animationRef.current = requestAnimationFrame(handleTimeUpdate);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    const handleLoadedMetadata = () => {
      console.log('[VoiceMessage] Метаданные загружены');
      console.log('[VoiceMessage] Duration:', audio.duration);
      console.log('[VoiceMessage] Duration is finite:', isFinite(audio.duration));
      console.log('[VoiceMessage] MIME type:', audio.type);

      // Проверка на корректность duration
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      } else if (duration) {
        setAudioDuration(duration);
      } else {
        setAudioDuration(0);
      }

      setIsLoading(false);
    };

    const handleError = (e) => {
      console.error('[VoiceMessage] === ОШИБКА АУДИО ===');
      console.error('[VoiceMessage] Error event:', e);
      console.error('[VoiceMessage] URL:', cachedUrl);
      console.error('[VoiceMessage] Детальная ошибка:', e.target?.error);
      console.error('[VoiceMessage] Error code:', e.target?.error?.code);
      console.error('[VoiceMessage] Error message:', e.target?.error?.message);

      const errorMessages = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
      };
      console.error('[VoiceMessage] Error type:', errorMessages[e.target?.error?.code]);

      setError(`Ошибка: ${e.target?.error?.message || 'Не удалось загрузить аудио'}`);
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audio.pause();
    };
  }, [cachedUrl, duration]);

  // Синхронизация с родителем - остановка если другой плеер играет
  useEffect(() => {
    if (!parentIsPlaying && isPlaying) {
      // Родитель сказал остановить (другой плеер начал играть)
      console.log('[VoiceMessage] Stopped by parent (another player started)');
      audioRef.current?.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [parentIsPlaying]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Вызываем onPlay чтобы сообщить родителю что мы начинаем играть
        if (onPlay) {
          onPlay();
        }
        await audioRef.current.play();
        setIsPlaying(true);
        console.log('[VoiceMessage] Playing:', url);
      }
    } catch (err) {
      console.error('[VoiceMessage] Play error:', err);
      setError('Не удалось воспроизвести');
      setIsPlaying(false);
    }
  };

  // Обработчик клика по прогресс-бару для перемотки
  const handleProgressClick = (e) => {
    if (!audioRef.current || !validDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, offsetX / width));  // 0 to 1

    // Устанавливаем новое время
    audioRef.current.currentTime = percentage * validDuration;
    setCurrentTime(percentage * validDuration);

    console.log('[VoiceMessage] Seek to:', percentage * 100, '%', 'time:', percentage * validDuration, 's');
  };

  const formatTime = (seconds) => {
    // Проверка на NaN, Infinity, null, undefined
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Проверка audioDuration на корректность
  const validDuration = (audioDuration && isFinite(audioDuration) && !isNaN(audioDuration)) ? audioDuration : 0;
  const progress = validDuration > 0 ? (currentTime / validDuration) * 100 : 0;

  // Форматирование длительности с проверкой (для подписанных URL)
  const displayTime = isFinite(validDuration) && !isNaN(validDuration) ? formatTime(validDuration) : "0:00";

  return (
    <div className={`voice-message ${isOwn ? 'own' : ''}`}>
      <button className="play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={isLoading || error}>
        {isLoading ? (
          <div className="loading-spinner" />
        ) : error ? (
          <span className="error-icon">⚠️</span>
        ) : isPlaying ? (
          <Pause size={18} />
        ) : (
          <Play size={18} />
        )}
      </button>

      <div className="waveform-container">
        <div 
          className="waveform"
          onClick={handleProgressClick}
          style={{ cursor: 'pointer' }}
          title="Кликните для перемотки"
        >
          {/* Визуализация прогресса */}
          <div
            className="waveform-progress"
            style={{ width: `${progress}%` }}
          />

          {/* Фейковые "волны" для визуализации */}
          <div className="waveform-bars">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`waveform-bar ${i / 20 < progress / 100 ? 'played' : ''}`}
                style={{
                  height: `${Math.random() * 60 + 40}%`,  /* Меньше разброс */
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        </div>

        <span className="duration">{displayTime}</span>
      </div>

      {error && <div className="audio-error">{error}</div>}

      {/* Скрытый аудио элемент для воспроизведения */}
      <audio 
        ref={audioRef} 
        src={`${url}?t=${Date.now()}`} 
        preload="metadata" 
        style={{ display: 'none' }}
        onLoadedMetadata={(e) => {
          console.log('[VoiceMessage] onLoadedMetadata fired');
          console.log('[VoiceMessage] duration:', e.target.duration);
          if (e.target.duration && isFinite(e.target.duration)) {
            setAudioDuration(e.target.duration);
          }
        }}
      />

      <style>{`
        .voice-message {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-secondary);
          border-radius: 16px;
          min-width: 220px;
        }

        .voice-message.own {
          background: var(--primary);
        }

        .play-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--primary);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.1s;
        }

        .play-btn svg {
          width: 18px;
          height: 18px;
        }

        .play-btn:active {
          transform: scale(0.95);
        }

        .play-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .voice-message.own .play-btn {
          background: white;
        }

        .voice-message.own .play-btn svg {
          fill: var(--primary);
        }

        .loading-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-icon {
          font-size: 16px;
        }

        .audio-error {
          position: absolute;
          bottom: -18px;
          left: 0;
          font-size: 10px;
          color: #ef4444;
        }

        .voice-message.own .audio-error {
          color: rgba(255, 255, 255, 0.8);
        }
        
        .waveform-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .waveform {
          flex: 1;
          position: relative;
          height: 28px;  /* Компактная высота */
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          overflow: hidden;
          transition: background 0.2s;
        }

        .waveform:hover {
          background: rgba(0, 0, 0, 0.15);  /* Подсветка при наведении */
        }

        .voice-message.own .waveform:hover {
          background: rgba(255, 255, 255, 0.25);  /* Подсветка для своих */
        }

        .waveform-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: rgba(0, 0, 0, 0.2);
          transition: width 0.1s linear;
        }

        .voice-message.own .waveform-progress {
          background: rgba(255, 255, 255, 0.2);
        }

        .waveform-bars {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 0 4px;
        }

        .waveform-bar {
          flex: 1;
          background: var(--text-secondary);
          border-radius: 2px;
          transition: background 0.2s;
        }

        .waveform-bar.played {
          background: var(--primary);
        }

        .voice-message.own .waveform-bar {
          background: rgba(255, 255, 255, 0.5);
        }

        .voice-message.own .waveform-bar.played {
          background: white;
        }

        .duration {
          font-size: 12px;
          color: var(--text-secondary);
          font-family: 'Courier New', monospace;
          white-space: nowrap;
          min-width: 40px;
          text-align: right;
        }

        .voice-message.own .duration {
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
};

/**
 * Компонент для отображения видео-кружков
 */
export const VideoCircleMessage = ({ url, duration, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div className={`video-circle-message ${isOwn ? 'own' : ''}`}>
      <div className="video-container">
        <video
          ref={videoRef}
          src={url}
          className="video-circle"
          onClick={togglePlay}
          onEnded={handleEnded}
          playsInline
        />
        
        {!isPlaying && (
          <div className="play-overlay" onClick={togglePlay}>
            <Play size={32} fill="white" />
          </div>
        )}
        
        {duration && (
          <div className="video-duration">
            {duration}
          </div>
        )}
      </div>

      <style>{`
        .video-circle-message {
          display: inline-block;
        }
        
        .video-container {
          position: relative;
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .video-circle {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          cursor: pointer;
          border: 3px solid var(--bg-tertiary);
        }
        
        .video-circle-message.own .video-circle {
          border-color: var(--primary);
        }
        
        .play-overlay {
          position: absolute;
          width: 60px;
          height: 60px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .play-overlay:hover {
          background: rgba(0, 0, 0, 0.8);
        }
        
        .video-duration {
          position: absolute;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Courier New', monospace;
        }
      `}</style>
    </div>
  );
};

export default VoiceMessage;
