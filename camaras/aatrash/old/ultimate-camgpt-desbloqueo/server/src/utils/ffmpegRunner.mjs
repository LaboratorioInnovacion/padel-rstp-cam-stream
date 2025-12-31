// ffmpegRunner.js
import { spawn } from 'child_process';
import fs from 'fs';

export function startStream({ camId, rtspUrl }) {
  const liveDir = `streams/live/${camId}`;
  const recDir  = `streams/recordings/${camId}/${Date.now()}`;

  fs.mkdirSync(liveDir, { recursive: true });
  fs.mkdirSync(recDir,  { recursive: true });

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments',
    `${liveDir}/index.m3u8`,
    // grabación simultánea
    '-map', '0',
    '-c:v', 'copy',
    '-f', 'segment',
    '-segment_time', '60',
    '-reset_timestamps', '1',
    `${recDir}/%03d.ts`
  ];

  const ffmpeg = spawn('ffmpeg', args);
  ffmpeg.stderr.on('data', d => console.log(`[FFmpeg ${camId}] ${d}`));
  ffmpeg.on('close', () => console.log(`❌ FFmpeg finalizó para ${camId}`));
}

export function recordStream({ camId, rtspUrl, duration = 3600 }) {
  const recDir = `streams/recordings/${camId}`;
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });
  const filename = `${recDir}/${Date.now()}.mp4`;

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-t', duration, // duración en segundos
    '-c:v', 'copy',
    '-c:a', 'aac', // <--- Cambia aquí: convierte el audio a AAC
    filename
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', data => {
      console.log(`[FFmpeg-REC ${camId}]: ${data}`);
    });

    ffmpeg.on('close', code => {
      if (code === 0) {
        console.log(`FFmpeg grabación para ${camId} terminó OK`);
        resolve(filename);
      } else {
        reject(new Error(`FFmpeg terminó con código ${code}`));
      }
    });
  });
}

// // ffmpegRunner.js
// import { spawn } from 'child_process';
// import fs from 'fs';

// export function startStream({ camId, rtspUrl }) {
//   const liveDir = `streams/live/${camId}`;
//   const recDir  = `streams/recordings/${camId}/${Date.now()}`;

//   fs.mkdirSync(liveDir, { recursive: true });
//   fs.mkdirSync(recDir,  { recursive: true });

//   const args = [
//     '-rtsp_transport', 'tcp',
//     '-i', rtspUrl,
//     '-c:v', 'copy',
//     '-f', 'hls',
//     '-hls_time', '4',
//     '-hls_list_size', '6',
//     '-hls_flags', 'delete_segments',
//     `${liveDir}/index.m3u8`,
//     // grabación simultánea
//     '-map', '0',
//     '-c:v', 'copy',
//     '-f', 'segment',
//     '-segment_time', '60',
//     '-reset_timestamps', '1',
//     `${recDir}/%03d.ts`
//   ];

//   const ffmpeg = spawn('ffmpeg', args);
//   ffmpeg.stderr.on('data', d => console.log(`[FFmpeg ${camId}] ${d}`));
//   ffmpeg.on('close', () => console.log(`❌ FFmpeg finalizó para ${camId}`));
// }

// // // ffmpegRunner.js
// // import { spawn } from 'child_process';
// // import fs from 'fs';

// // export function startStream({ rtspUrl, camId }) {
// //   const liveDir = `streams/live/${camId}`;
// //   const recDir = `streams/recordings/${camId}/${new Date().toISOString().replace(/[:.]/g, '-')}`;

// //   fs.mkdirSync(liveDir, { recursive: true });
// //   fs.mkdirSync(recDir, { recursive: true });

// //   const args = [
// //     '-rtsp_transport', 'tcp',
// //     '-i', rtspUrl,
// //     '-c:v', 'copy',
// //     '-f', 'hls',
// //     '-hls_time', '4',
// //     '-hls_list_size', '6',
// //     '-hls_flags', 'delete_segments',
// //     `${liveDir}/index.m3u8`,
// //     // grabación
// //     '-c', 'copy',
// //     '-f', 'segment',
// //     '-segment_time', '60',
// //     '-reset_timestamps', '1',
// //     `${recDir}/%03d.ts`,
// //   ];

// //   const ffmpeg = spawn('ffmpeg', args);
// //   ffmpeg.stderr.on('data', d => console.log(`[FFmpeg ${camId}] ${d.toString()}`));
// //   ffmpeg.on('close', () => console.log(`❌ FFmpeg finalizó para ${camId}`));
// // }

// // import { spawn } from 'child_process';
// // import fs from 'fs';
// // import path from 'path';

// // export function startStream({ rtspUrl, camId }) {
// //   const liveDir = `streams/live/${camId}`;
// //   const recDir = `streams/recordings/${camId}/${new Date().toISOString().replace(/[:.]/g, '-')}`;

// //   fs.mkdirSync(liveDir, { recursive: true });
// //   fs.mkdirSync(recDir, { recursive: true });

// //   const args = [
// //   '-rtsp_transport', 'tcp',
// //   '-i', rtspUrl,
// //   // Salida 1: HLS para streaming en vivo
// //   '-map', '0',
// //   '-c:v', 'copy',
// //   '-f', 'hls',
// //   '-hls_time', '4',
// //   '-hls_list_size', '6',
// //   '-hls_flags', 'delete_segments',
// //   path.join(liveDir, 'index.m3u8'),

// //   // Salida 2: Segmentos para grabación
// //   '-map', '0',
// //   '-c:v', 'copy',
// //   '-f', 'segment',
// //   '-segment_time', '60',
// //   '-reset_timestamps', '1',
// //   path.join(recDir, '%03d.ts'),
// // ];
// //   // const args = [
// //   //   '-rtsp_transport', 'tcp',
// //   //   '-i', rtspUrl,
// //   //   '-c:v', 'copy',
// //   //   '-f', 'hls',
// //   //   '-hls_time', '4',
// //   //   '-hls_list_size', '6',
// //   //   '-hls_flags', 'delete_segments',
// //   //   '-method', 'PUT',
// //   //   `${liveDir}/index.m3u8`,
// //   //   // grabación simultánea
// //   //   '-c', 'copy',
// //   //   '-f', 'segment',
// //   //   '-segment_time', '60',
// //   //   '-reset_timestamps', '1',
// //   //   `${recDir}/%03d.ts`,
// //   // ];

// //   const ffmpeg = spawn('ffmpeg', args);

// //   ffmpeg.stderr.on('data', d => console.log(`[FFmpeg ${camId}] ${d.toString()}`));
// //   ffmpeg.on('close', () => console.log(`❌ FFmpeg finalizó para ${camId}`));

// //   return ffmpeg;
// // }
