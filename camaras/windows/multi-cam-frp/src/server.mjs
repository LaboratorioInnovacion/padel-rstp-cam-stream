import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { startStream, recordStream } from './utils/ffmpegRunner.js';
import { uploadToDrive } from './utils/uploadToDrive.js';

const app = express();
const PORT = process.env.PORT || 3000;
const CAMERA_DB = './cameras.json';

app.use(cors());
app.use(express.json());
app.use('/streams', express.static('streams'));

// Asegura directorios
for (const dir of ['streams', 'records']) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Bootstrap FRP server (solo si NO corre en otro host)
execSync('chmod +x ./frps');
spawn('./frps', ['-c', './config/frps.toml'], { stdio: 'inherit' });

// 2. Carga y arranque de streams registrados
let cameras = {};
if (fs.existsSync(CAMERA_DB)) {
  cameras = JSON.parse(fs.readFileSync(CAMERA_DB));
  for (const [id, url] of Object.entries(cameras)) {
    startStream({ camId: id, rtspUrl: url });
  }
}

// Guardado
function save() {
  fs.writeFileSync(CAMERA_DB, JSON.stringify(cameras, null, 2));
}

app.post('/api/register', (req, res) => {
  const { camId, publicUrl } = req.body;
  if (!camId || !publicUrl) return res.status(400).json({ error: 'camId y publicUrl son requeridos' });
  const isNew = !cameras[camId];
  cameras[camId] = publicUrl;
  save();
  if (isNew) startStream({ camId, rtspUrl: publicUrl });
  return res.sendStatus(200);
});

app.get('/api/streams', (_, res) => {
  res.json(Object.keys(cameras).map(id => ({
    id,
    url: `/streams/${id}/index.m3u8`,
    isLive: true
  })));
});

app.post('/api/record', async (req, res) => {
  try {
    const { camId, duration } = req.body;
    if (!cameras[camId]) return res.status(404).json({ error: 'Cámara no encontrada' });
    const file = await recordStream({ camId, rtspUrl: cameras[camId], duration });
    const driveId = await uploadToDrive(file, `${camId}-${Date.now()}.mp4`);
    res.json({ success: true, driveId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));