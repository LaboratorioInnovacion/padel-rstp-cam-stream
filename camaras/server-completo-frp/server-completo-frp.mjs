// server-completo-frp.mjs
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { startStream, recordStream } from './utils/ffmpegRunner.js';
import { uploadToDrive } from './utils/uploadToDrive.js';


const app = express();
const PORT = 3100;
const CAM_FILE = './cameras.json';

// === 0. CONFIGURACIÓN INICIAL ===
// Determinar ruta del binario frps (Docker usa /usr/local/bin, local usa ./)
const FRPS_PATH = process.env.NODE_ENV === 'production' ? 'frps' : './frps';
const FRPS_CONFIG = './frps.toml';

// Otorgar permisos de ejecución al archivo frps (solo si es local)
if (FRPS_PATH === './frps') {
  try {
    execSync('chmod +x ./frps');
    console.log('✅ Permisos otorgados al archivo frps.');
  } catch (err) {
    console.error('❌ Error otorgando permisos:', err.message);
  }
}

// === 1. INICIAR SERVIDOR FRP ===
console.log('▶ Iniciando FRP Server...');
const frpsProcess = exec(`${FRPS_PATH} -c ${FRPS_CONFIG}`);
frpsProcess.stdout?.on('data', data => process.stdout.write(data));
frpsProcess.stderr?.on('data', data => process.stderr.write(data));
frpsProcess.on('error', err => console.error('❌ Error iniciando FRP Server:', err));
console.log('✅ FRP Server corriendo en el puerto 7000.');
console.log('📊 Dashboard disponible en http://localhost:7500 (admin/admin123)');

// === 2. EXPRESS APP PARA MANEJO DE CÁMARAS ===
app.use(express.json());
app.use(cors());
app.use('/streams', express.static('streamsss'));

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

app.delete('/api/camera/:id', (req, res) => {
  const camId = req.params.id;
  if (cameras[camId]) {
    delete cameras[camId];
    saveCamerasToDisk();
    console.log(`🗑️ Cámara eliminada: ${camId}`);
    return res.json({ success: true, message: `Cámara ${camId} eliminada` });
  }
  res.status(404).json({ error: 'Cámara no encontrada' });
});

app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
    },
    cameras: Object.keys(cameras).length
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalCameras: Object.keys(cameras).length,
    cameras: Object.entries(cameras).map(([id, url]) => ({ id, url })),
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform
  });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Express listo en http://localhost:${PORT}`);
});