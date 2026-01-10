// server.mjs (o server.js si no usas "type": "module")
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { startStream, recordStream } from './ffmpegRunner.js';
import { uploadToDrive } from './uploadToDrive.js';

const app = express();
const PORT = 3000;
const CAM_FILE = './cameras.json';

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
      if (data.length === 0) return; // Si el archivo está vacío, no hacer nada
      Object.assign(cameras, JSON.parse(data));
      // Reanudar streams
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
    // Si la URL es RTSP pública, genera la URL HLS para el frontend
    let url;
    if (publicUrl.startsWith('rtsp://')) {
      // Siempre devuelve la ruta HLS para el frontend
      url = `/streams/live/${id}/index.m3u8`;
    } else {
      url = publicUrl;
    }
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
  if (!rtspUrl) {
    return res.status(404).json({ error: 'Cámara no encontrada' });
  }
  try {
    const filePath = await recordStream({ camId, rtspUrl, duration: duration || 3600 });
    const fileName = `${camId}_${Date.now()}.mp4`;
    const driveId = await uploadToDrive(filePath, fileName);
    res.json({ success: true, driveId });
  } catch (err) {
    console.error('❌ Error detallado:', err); // <--- Agrega esto
    res.status(500).json({ error: 'Error al grabar o subir el video', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor listo en http://localhost:${PORT}`);
});

//codigo funcional perfecto
// // server.js
// import express from 'express';
// import cors from 'cors';
// import { startStream } from './ffmpegRunner.js';

// const app = express();
// const PORT = 3000;
// app.use(express.json());
// app.use(cors());
// app.use('/streams', express.static('streams'));

// const cameras = {};

// app.post('/api/register', (req, res) => {
//   const { camId, publicUrl } = req.body;
//   if (camId && publicUrl) {
//     if (!cameras[camId]) {
//       cameras[camId] = publicUrl;
//       console.log(`📡 Cámara registrada: ${camId} -> ${publicUrl}`);
//       startStream({ camId, rtspUrl: publicUrl });
//     } else {
//       console.log(`⚠️ Cámara ${camId} ya estaba registrada`);
//     }
//     return res.sendStatus(200);
//   }
//   res.status(400).send('camId y publicUrl son requeridos');
// });

// app.get('/api/streams', (req, res) => {
//   const liveStreams = Object.keys(cameras).map(id => ({
//     id,
//     url: `/streams/live/${id}/index.m3u8`
//   }));
//   res.json(liveStreams);
// });

// app.listen(PORT, () => console.log(`✅ Servidor listo en http://localhost:${PORT}`));
