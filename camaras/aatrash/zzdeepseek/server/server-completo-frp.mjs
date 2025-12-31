import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { startStream, stopStream, recordStream } from './utils/ffmpegRunner.js';
import { uploadToDrive } from './utils/uploadToDrive.js';
import dotenv from 'dotenv';

// Configuración de entorno
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const CAM_FILE = './cameras.json';

// Validar variables de entorno requeridas
const ENV_REQUIRED = ['API_KEY', 'FRP_DOMAIN', 'FRP_RTSP_PORT'];
ENV_REQUIRED.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Variable de entorno requerida faltante: ${key}`);
    process.exit(1);
  }
});

// === 1. INICIAR SERVIDOR FRP (solo en desarrollo) ===
if (process.env.NODE_ENV !== 'production') {
  try {
    // Configuración dinámica de FRPS
    const frpsConfig = `
[common]
bind_port = 7000
vhost_http_port = 80
vhost_https_port = 443

[rtsp]
type = tcp
remote_port = ${process.env.FRP_RTSP_PORT}
`;
    fs.writeFileSync('./frps.toml', frpsConfig);
    
    // Iniciar FRPS
    execSync('chmod +x ./frps');
    const frpsProcess = spawn('./frps', ['-c', './frps.toml'], {
      detached: true,
      stdio: 'ignore'
    });
    frpsProcess.unref();
    
    console.log('✅ FRP Server iniciado');
  } catch (err) {
    console.error('❌ Error iniciando FRP:', err);
  }
}

// === 2. CONFIGURACIÓN EXPRESS ===
app.use(express.json());
app.use(cors());
app.use('/streams', express.static('streams'));

// Crear directorios necesarios
['streams', 'records', 'logs'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware de autenticación
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    console.warn(`⚠️ Intento de acceso no autorizado desde ${req.ip}`);
    res.status(401).json({ error: 'API key inválida' });
  }
};

// Cargar cámaras desde disco
const cameras = {};
function loadCameras() {
  try {
    if (fs.existsSync(CAM_FILE)) {
      const data = fs.readFileSync(CAM_FILE);
      if (data.length > 0) {
        Object.assign(cameras, JSON.parse(data));
        console.log(`📋 Cargadas ${Object.keys(cameras).length} cámaras desde disco`);
      }
    }
  } catch (err) {
    console.error('❌ Error cargando cámaras:', err);
  }
}

// Iniciar streams para cámaras cargadas
function startCameraStreams() {
  Object.entries(cameras).forEach(([camId, publicUrl]) => {
    try {
      startStream({ camId, rtspUrl: publicUrl });
      console.log(`▶ Stream iniciado para ${camId}`);
    } catch (err) {
      console.error(`❌ Error iniciando stream para ${camId}:`, err);
    }
  });
}

// Guardar cámaras en disco
function saveCameras() {
  try {
    fs.writeFileSync(CAM_FILE, JSON.stringify(cameras, null, 2));
    console.log('💾 Estado de cámaras guardado');
  } catch (err) {
    console.error('❌ Error guardando cámaras:', err);
  }
}

// Inicialización
loadCameras();
startCameraStreams();

// === 3. ENDPOINTS ===

// Health Check
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    cameras: Object.keys(cameras).length,
    version: '1.1.0',
    frpDomain: process.env.FRP_DOMAIN
  });
});

// Registrar nueva cámara
app.post('/api/register', apiKeyAuth, (req, res) => {
  const { camId, publicUrl } = req.body;
  
  // Validar entrada
  if (!camId || !publicUrl) {
    return res.status(400).json({ error: 'camId y publicUrl son requeridos' });
  }
  
  // Manejar cámara existente
  if (cameras[camId]) {
    if (cameras[camId] === publicUrl) {
      return res.status(200).json({ 
        message: 'Cámara ya registrada',
        action: 'none'
      });
    }
    
    // Actualizar URL existente
    console.log(`🔄 Actualizando URL para ${camId}: ${cameras[camId]} → ${publicUrl}`);
    stopStream(camId);
  } else {
    console.log(`📡 Nueva cámara registrada: ${camId} → ${publicUrl}`);
  }
  
  // Registrar/actualizar cámara
  cameras[camId] = publicUrl;
  startStream({ camId, rtspUrl: publicUrl });
  saveCameras();
  
  res.status(200).json({ 
    message: `Cámara ${camId} ${cameras[camId] ? 'actualizada' : 'registrada'}`,
    action: cameras[camId] ? 'restarted' : 'started'
  });
});

// Listar streams disponibles
app.get('/api/streams', (_, res) => {
  const liveStreams = Object.keys(cameras).map(id => ({
    id,
    url: `/streams/live/${id}/index.m3u8`,
    publicUrl: cameras[id],
    isLive: true,
    lastSeen: new Date().toISOString()
  }));
  
  res.json(liveStreams);
});

// Grabar stream
app.post('/api/record', apiKeyAuth, async (req, res) => {
  const { camId, duration = 30 } = req.body;  // Default 30 segundos
  
  // Validar cámara
  if (!cameras[camId]) {
    return res.status(404).json({ error: 'Cámara no encontrada' });
  }
  
  try {
    // Grabar y subir a Drive
    const filePath = await recordStream({ 
      camId, 
      rtspUrl: cameras[camId], 
      duration: Math.min(duration, 600) // Máximo 10 minutos
    });
    
    const fileName = `${camId}_${Date.now()}.mp4`;
    const driveId = await uploadToDrive(filePath, fileName);
    
    // Limpiar archivo local después de subir
    fs.unlinkSync(filePath);
    
    res.json({ 
      success: true, 
      driveId,
      downloadUrl: `https://drive.google.com/file/d/${driveId}/view`
    });
  } catch (err) {
    console.error('❌ Error en grabación:', err);
    res.status(500).json({ 
      error: 'Error al grabar o subir el video',
      details: err.message
    });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('🔥 Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en http://localhost:${PORT}`);
  console.log(`▶ Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`▶ FRP Domain: ${process.env.FRP_DOMAIN}`);
});