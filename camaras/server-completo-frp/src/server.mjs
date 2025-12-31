import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { startStream, recordStream } from '../utils/ffmpegRunner.js';
import { uploadToDrive } from '../utils/uploadToDrive.js';

const app = express();
const PORT = process.env.PORT || 3000;
const CAMERA_DB = './cameras.json';

app.use(cors());
app.use(express.json());
app.use('/streams', express.static('streams'));

// Asegura directorios necesarios
for (const dir of ['streams/live', 'videos', 'logs']) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Bootstrap FRP server (solo si NO corre en otro host)
try {
  execSync('chmod +x ./frps 2>/dev/null || exit 0');
  console.log('✅ Permisos otorgados a frps');
} catch (err) {
  console.log('⚠️ No se pudo cambiar permisos (puede ser normal en Windows)');
}

console.log('▶ Iniciando FRP Server...');
const frpsProcess = spawn('./frps', ['-c', './config/frps.toml'], { stdio: 'inherit' });

frpsProcess.on('error', (err) => {
  console.error('❌ Error iniciando FRP Server:', err.message);
  console.log('ℹ️ Asegúrate de que el ejecutable ./frps existe y tiene permisos');
});

frpsProcess.on('exit', (code) => {
  console.log(`⚠️ FRP Server terminó con código ${code}`);
});

console.log('✅ FRP Server iniciado en puerto 7000');

// 2. Carga y arranque de streams registrados
let cameras = {};
if (fs.existsSync(CAMERA_DB)) {
  try {
    const data = fs.readFileSync(CAMERA_DB, 'utf8');
    if (data.trim()) {
      cameras = JSON.parse(data);
      console.log(`📡 Cargadas ${Object.keys(cameras).length} cámaras desde ${CAMERA_DB}`);
      
      // Reiniciar streams para cámaras existentes
      for (const [id, url] of Object.entries(cameras)) {
        console.log(`▶ Reiniciando stream: ${id}`);
        startStream({ camId: id, rtspUrl: url });
      }
    }
  } catch (err) {
    console.error('❌ Error cargando cameras.json:', err.message);
    cameras = {};
  }
} else {
  console.log('ℹ️ No se encontró cameras.json, iniciando con lista vacía');
}

// Función para guardar cambios en disco
function save() {
  try {
    fs.writeFileSync(CAMERA_DB, JSON.stringify(cameras, null, 2));
    console.log('💾 Cámaras guardadas en disco');
  } catch (err) {
    console.error('❌ Error guardando cameras.json:', err.message);
  }
}

// === RUTAS DE LA API ===

/**
 * POST /api/register
 * Registra una nueva cámara o actualiza una existente
 */
app.post('/api/register', (req, res) => {
  const { camId, publicUrl } = req.body;
  
  if (!camId || !publicUrl) {
    return res.status(400).json({ 
      error: 'camId y publicUrl son requeridos' 
    });
  }

  const isNew = !cameras[camId];
  const isChanged = cameras[camId] !== publicUrl;
  
  cameras[camId] = publicUrl;
  save();

  if (isNew) {
    console.log(`📡 Nueva cámara registrada: ${camId} -> ${publicUrl}`);
    startStream({ camId, rtspUrl: publicUrl });
  } else if (isChanged) {
    console.log(`🔄 Cámara actualizada: ${camId} -> ${publicUrl}`);
    startStream({ camId, rtspUrl: publicUrl });
  } else {
    console.log(`⚠️ Cámara ${camId} ya registrada con la misma URL`);
  }

  return res.status(200).json({ 
    success: true, 
    message: isNew ? 'Cámara registrada' : 'Cámara actualizada' 
  });
});

/**
 * GET /api/streams
 * Lista todas las cámaras activas con sus URLs de streaming
 */
app.get('/api/streams', (req, res) => {
  const streams = Object.keys(cameras).map(id => ({
    id,
    url: `/streams/live/${id}/index.m3u8`,
    rtspUrl: cameras[id],
    title: `Stream ${id}`,
    thumbnail: `https://picsum.photos/seed/${id}/640/360`,
    isLive: true,
    viewCount: Math.floor(Math.random() * 100) + 1
  }));

  res.json(streams);
});

/**
 * DELETE /api/camera/:camId
 * Elimina una cámara del registro
 */
app.delete('/api/camera/:camId', (req, res) => {
  const { camId } = req.params;
  
  if (!cameras[camId]) {
    return res.status(404).json({ error: 'Cámara no encontrada' });
  }

  delete cameras[camId];
  save();
  
  console.log(`🗑️ Cámara eliminada: ${camId}`);
  
  res.json({ success: true, message: 'Cámara eliminada' });
});

/**
 * POST /api/record
 * Graba un video de una cámara y lo sube a Google Drive
 */
app.post('/api/record', async (req, res) => {
  try {
    const { camId, duration = 3600 } = req.body;
    
    if (!cameras[camId]) {
      return res.status(404).json({ error: 'Cámara no encontrada' });
    }

    console.log(`📼 Iniciando grabación de ${camId} por ${duration} segundos`);
    
    const filePath = await recordStream({ 
      camId, 
      rtspUrl: cameras[camId], 
      duration 
    });
    
    const fileName = `${camId}_${Date.now()}.mp4`;
    const driveId = await uploadToDrive(filePath, fileName);
    
    res.json({ 
      success: true, 
      driveId,
      fileName,
      duration
    });
  } catch (err) {
    console.error('❌ Error en grabación:', err);
    res.status(500).json({ 
      error: 'Error al grabar o subir el video', 
      details: err.message 
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    cameras: Object.keys(cameras).length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/stats
 * Estadísticas del servidor
 */
app.get('/api/stats', (req, res) => {
  const stats = {
    totalCameras: Object.keys(cameras).length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cameras: Object.keys(cameras),
    timestamp: new Date().toISOString()
  };
  
  res.json(stats);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🎥 Camera Streaming Server - FRP Edition');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ Server listening on http://localhost:${PORT}`);
  console.log(`  📡 FRP Server running on port 7000`);
  console.log(`  🎬 ${Object.keys(cameras).length} cameras loaded`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('API Endpoints:');
  console.log(`  POST   /api/register       - Register camera`);
  console.log(`  GET    /api/streams        - List streams`);
  console.log(`  DELETE /api/camera/:id     - Remove camera`);
  console.log(`  POST   /api/record         - Record video`);
  console.log(`  GET    /api/health         - Health check`);
  console.log(`  GET    /api/stats          - Server stats`);
  console.log('');
});

// Manejo de señales de terminación
process.on('SIGINT', () => {
  console.log('\n⚠️ Recibida señal SIGINT, cerrando...');
  frpsProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Recibida señal SIGTERM, cerrando...');
  frpsProcess.kill();
  process.exit(0);
});
