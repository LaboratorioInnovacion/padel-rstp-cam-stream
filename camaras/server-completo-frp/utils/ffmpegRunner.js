import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Mapa para almacenar procesos de FFmpeg activos
const activeStreams = new Map();

/**
 * Inicia o actualiza un stream HLS vía FFmpeg.
 * @param {Object} options - Opciones de configuración
 * @param {string} options.camId - ID único de la cámara
 * @param {string} options.rtspUrl - URL RTSP de la cámara
 */
export function startStream({ camId, rtspUrl }) {
  // Si ya existe un stream activo para esta cámara, detenerlo primero
  if (activeStreams.has(camId)) {
    console.log(`⚠️ Deteniendo stream anterior de ${camId}`);
    const oldProc = activeStreams.get(camId);
    oldProc.kill('SIGTERM');
    activeStreams.delete(camId);
  }

  // Crear directorio de salida si no existe
  const outDir = path.join('streams', 'live', camId);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`🎥 Iniciando stream para ${camId} desde ${rtspUrl}`);

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(outDir, 'segment_%03d.ts'),
    path.join(outDir, 'index.m3u8')
  ];

  const proc = spawn('ffmpeg', args);
  
  proc.stdout.on('data', d => {
    console.log(`[FFMPEG:${camId}] ${d.toString().trim()}`);
  });
  
  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg.includes('frame=') || msg.includes('time=')) {
      // Log de progreso cada 10 segundos para no saturar
      if (Math.random() < 0.01) {
        console.log(`[FFMPEG:${camId}] ✓ Streaming...`);
      }
    } else {
      console.error(`[FFMPEG:${camId}] ${msg}`);
    }
  });

  proc.on('error', err => {
    console.error(`❌ Error iniciando FFmpeg para ${camId}:`, err.message);
    activeStreams.delete(camId);
  });

  proc.on('exit', (code, signal) => {
    console.log(`⚠️ FFmpeg para ${camId} terminó con código ${code}, señal ${signal}`);
    activeStreams.delete(camId);
  });

  // Guardar referencia al proceso
  activeStreams.set(camId, proc);
}

/**
 * Graba un segmento definido y retorna la ruta del archivo generado.
 * @param {Object} options - Opciones de configuración
 * @param {string} options.camId - ID único de la cámara
 * @param {string} options.rtspUrl - URL RTSP de la cámara
 * @param {number} options.duration - Duración de la grabación en segundos
 * @returns {Promise<string>} Ruta del archivo generado
 */
export function recordStream({ camId, rtspUrl, duration }) {
  return new Promise((resolve, reject) => {
    // Crear directorio de grabaciones si no existe
    const recordsDir = 'videos';
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }

    const filePath = path.join(recordsDir, `${camId}_${Date.now()}.mp4`);
    console.log(`📼 Grabando ${duration}s desde ${camId} → ${filePath}`);

    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-t', duration.toString(),
      '-c:v', 'copy',
      '-c:a', 'aac',
      filePath
    ];

    const proc = spawn('ffmpeg', args);
    
    proc.stderr.on('data', d => {
      const msg = d.toString().trim();
      if (msg.includes('time=')) {
        console.log(`[RECORD:${camId}] ${msg}`);
      }
    });

    proc.on('exit', code => {
      if (code === 0) {
        console.log(`✅ Grabación completada: ${filePath}`);
        resolve(filePath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Detiene el stream de una cámara específica
 * @param {string} camId - ID de la cámara
 */
export function stopStream(camId) {
  if (activeStreams.has(camId)) {
    const proc = activeStreams.get(camId);
    proc.kill('SIGTERM');
    activeStreams.delete(camId);
    console.log(`⏹️ Stream detenido: ${camId}`);
    return true;
  }
  return false;
}

/**
 * Obtiene la lista de streams activos
 * @returns {string[]} Array de IDs de cámaras con streams activos
 */
export function getActiveStreams() {
  return Array.from(activeStreams.keys());
}
