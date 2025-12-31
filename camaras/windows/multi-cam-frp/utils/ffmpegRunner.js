import { spawn } from 'child_process';
import path from 'path';

/**
 * Inicia o actualiza un stream HLS vía FFmpeg.
 */
export function startStream({ camId, rtspUrl }) {
  const outDir = path.join('streams', camId);
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments',
    path.join(outDir, 'index.m3u8')
  ];
  const proc = spawn('ffmpeg', args);
  proc.stdout.on('data', d => console.log(`[FFMPEG:${camId}]`, d.toString()));
  proc.stderr.on('data', d => console.error(`[FFMPEG:${camId}]`, d.toString()));
}

/**
 * Graba un segmento definido y retorna la ruta del archivo generado.
 */
export function recordStream({ camId, rtspUrl, duration }) {
  return new Promise((resolve, reject) => {
    const filePath = path.join('records', `${camId}-${Date.now()}.mp4`);
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-t', duration.toString(),
      '-c', 'copy',
      filePath
    ];
    const proc = spawn('ffmpeg', args);
    proc.on('exit', code => {
      if (code === 0) resolve(filePath);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });
}