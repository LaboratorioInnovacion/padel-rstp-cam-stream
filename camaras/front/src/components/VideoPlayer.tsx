import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { Stream } from '../types';

interface VideoPlayerProps {
  stream: Stream;
  isRecording: boolean;
  onToggleRecording: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, isRecording, onToggleRecording }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const setupHls = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,           // Priorizar estabilidad sobre latencia
          maxBufferLength: 30,             // Buffer de 30 segundos para smooth playback
          maxMaxBufferLength: 60,          // Máximo 60s de buffer
          maxBufferSize: 60 * 1000 * 1000, // 60MB de buffer máximo
          maxBufferHole: 1.0,              // 🎯 Mayor tolerancia de huecos (era 0.5)
          liveSyncDurationCount: 3,        // Sincronizar con 3 segmentos de distancia
          liveMaxLatencyDurationCount: 10, // Latencia máxima 10 segmentos
          liveDurationInfinity: true,      // Stream infinito (live)
          highBufferWatchdogPeriod: 2,     // Watchdog cada 2s
          fragLoadingTimeOut: 20000,       // Timeout de fragmentos 20s
          manifestLoadingTimeOut: 20000,   // Timeout de manifest 20s
          levelLoadingTimeOut: 20000,      // Timeout de niveles 20s
          startLevel: -1,                  // Auto-seleccionar calidad
          // 🎯 Opciones para tolerar errores de audio/video
          nudgeOffset: 0.1,                // Ajuste fino de sincronización
          nudgeMaxRetry: 5,                // Reintentos de nudge
          stretchShortVideoTrack: true,    // 🎯 Estirar track de video corto
          forceKeyFrameOnDiscontinuity: true, // Forzar keyframe en discontinuidades
          debug: false,                    // Sin debug en producción
        });
        
        hls.loadSource(stream.url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play()
            .then(() => setIsPlaying(true))
            .catch(error => console.error('Error playing video:', error));
        });
        
        // Manejo de errores mejorado con recuperación automática
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS event:', data.type, data.details);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Error de red - intentar recuperar
                console.log('🔄 Network error, intentando recuperar...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Error de media - intentar recuperar
                console.log('🔄 Media error, intentando recuperar...');
                hls.recoverMediaError();
                break;
              default:
                // Error fatal no recuperable - reiniciar HLS
                console.error('❌ Fatal error, reiniciando HLS en 3s...', data);
                hls.destroy();
                setTimeout(setupHls, 3000);
                break;
            }
          }
        });
        
        // Detectar cuando el buffer está vacío y reiniciar
        video.addEventListener('waiting', () => {
          console.log('⏳ Video esperando datos...');
        });
        
        video.addEventListener('stalled', () => {
          console.warn('⚠️ Video stalled, forzando recarga...');
          if (hls) {
            hls.startLoad();
          }
        });
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.addEventListener('loadedmetadata', () => {
          video.play()
            .then(() => setIsPlaying(true))
            .catch(error => console.error('Error playing video:', error));
        });
      }
    };

    setupHls();

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (hls) {
        hls.destroy();
      }
    };
  }, [stream.url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play()
        .catch(error => console.error('Error playing video:', error));
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative group w-full h-full bg-black rounded-lg overflow-hidden">
      <video 
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
      />
      
      {/* Live indicator */}
      <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center space-x-1">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
        <span>LIVE</span>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span>REC</span>
        </div>
      )}
      
      {/* Controls overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="text-white text-xs">
              {stream.title}
            </div>
          </div>
          
          <div className="w-full bg-gray-600 h-1 rounded-full mb-3">
            <div 
              className="bg-purple-500 h-1 rounded-full" 
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={togglePlay} 
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <button 
                onClick={toggleMute} 
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={onToggleRecording} 
                className={`px-3 py-1 rounded text-xs font-semibold ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'} text-white transition-colors`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              
              <button 
                onClick={toggleFullscreen} 
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;