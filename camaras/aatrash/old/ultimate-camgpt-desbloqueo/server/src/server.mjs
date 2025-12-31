// Express server aquí
// server-completo-frp.mjs
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { startStream, recordStream } from './utils/ffmpegRunner.mjs';
import { uploadToDrive } from './utils/uploadToDrive.mjs';


const app = express();
const PORT = 3000;
const CAM_FILE = './cameras.json';
// === 0. CONFIGURACIÓN INICIAL ===
// Otorgar permisos de ejecución al archivo frps (solo en Linux)
if (process.platform !== 'win32') {
  try {
    execSync('chmod +x ./frps');
    console.log('✅ Permisos otorgados al archivo frps.');
  } catch (err) {
    console.error('❌ Error otorgando permisos:', err.message);
  }
}

// === 1. INICIAR SERVIDOR FRP ===
const FRPS_CONFIG = `[common]\nbind_port = 7000`;
fs.writeFileSync('./frps.toml', FRPS_CONFIG);
console.log('▶ Archivo frps.toml generado.');
const frpsProcess = exec('./frps -c ./frps.toml');
frpsProcess.stdout?.on('data', data => process.stdout.write(data));
frpsProcess.stderr?.on('data', data => process.stderr.write(data));
console.log('✅ FRP Server corriendo en el puerto 7000.');

// === 2. EXPRESS APP PARA MANEJO DE CÁMARAS ===
app.use(express.json());
app.use(cors());
app.use('/streams', express.static('streams'));

const cameras = {};

function saveCamerasToDisk() {
  fs.writeFileSync(CAM_FILE, JSON.stringify(cameras, null, 2));
}

function loadCamerasFromDisk() {
  if (fs.existsSync(CAM_FILE)) {
    try {
      const data = fs.readFileSync(CAM_FILE);
      if (data.length === 0) return;
      Object.assign(cameras, JSON.parse(data));
      Object.entries(cameras).forEach(([camId, publicUrl]) => {
        startStream({ camId, rtspUrl: publicUrl });
      });
    } catch (err) {
      console.error('❌ Error leyendo cameras.json:', err);
    }
  }
}

loadCamerasFromDisk();

app.post('/api/register', (req, res) => {
  const { camId, publicUrl } = req.body;
  if (camId && publicUrl) {
    const isNewOrChanged = !cameras[camId] || cameras[camId] !== publicUrl;
    cameras[camId] = publicUrl;
    saveCamerasToDisk();
    if (isNewOrChanged) {
      console.log(`📡 Cámara registrada/actualizada: ${camId} -> ${publicUrl}`);
      startStream({ camId, rtspUrl: publicUrl });
    } else {
      console.log(`⚠️ Cámara ${camId} ya estaba registrada con la misma URL`);
    }
    return res.sendStatus(200);
  }
  res.status(400).send('camId y publicUrl son requeridos');
});

app.get('/api/streams', (req, res) => {
  const liveStreams = Object.entries(cameras).map(([id, publicUrl]) => {
    const url = publicUrl.startsWith('rtsp://')
      ? `/streams/live/${id}/index.m3u8`
      : publicUrl;
    return {
      id,
      url,
      title: `Stream ${id}`,
      thumbnail: `https://picsum.photos/seed/${id}/640/360`,
      isLive: true,
      viewCount: Math.floor(Math.random() * 100) + 1
    };
  });
  res.json(liveStreams);
});

app.post('/api/record', async (req, res) => {
  const { camId, duration } = req.body;
  const rtspUrl = cameras[camId];
  if (!rtspUrl) return res.status(404).json({ error: 'Cámara no encontrada' });
  try {
    const filePath = await recordStream({ camId, rtspUrl, duration: duration || 3600 });
    const fileName = `${camId}_${Date.now()}.mp4`;
    const driveId = await uploadToDrive(filePath, fileName);
    res.json({ success: true, driveId });
  } catch (err) {
    console.error('❌ Error detallado:', err);
    res.status(500).json({ error: 'Error al grabar o subir el video', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Express listo en http://localhost:${PORT}`);
});