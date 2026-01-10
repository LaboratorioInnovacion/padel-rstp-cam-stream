const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const STREAM_DIR = path.join(__dirname, "streams");
const VIDEO_DIR = path.join(__dirname, "videos");

if (!fs.existsSync(STREAM_DIR)) fs.mkdirSync(STREAM_DIR);
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR);

function startStream(cameraId, rtspUrl) {
  const output = path.join(STREAM_DIR, cameraId + ".m3u8");

  // ffmpeg proceso HLS (para video en vivo)
  return spawn("ffmpeg", [
    "-i", rtspUrl,
    "-an",  // sin audio por ahora, puedes remover si quieres audio
    "-c:v", "copy",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "3",
    "-hls_flags", "delete_segments",
    output
  ]);
}

function recordStream(cameraId, rtspUrl, duration = 60) {
  const timestamp = Date.now();
  const filename = `video_${cameraId}_${timestamp}.mp4`;
  const output = path.join(VIDEO_DIR, filename);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", rtspUrl,
      "-t", duration,
      "-c:v", "copy",
      "-c:a", "aac",
      output
    ]);

    ffmpeg.on("exit", (code) => {
      if (code === 0) resolve({ file: filename });
      else reject(new Error("Error al grabar el video"));
    });
  });
}

module.exports = { startStream, recordStream, STREAM_DIR, VIDEO_DIR };
