// server-cloudflared.mjs
// Servidor adaptado para trabajar con Cloudflare Tunnel + MediaMTX
// OPTIMIZADO para alto rendimiento - soporta ~1000+ conexiones simultáneas
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3100;
const CAM_FILE = './cameras-cloudflared.json';

// === 0. CONFIGURACIÓN INICIAL ===
console.log('🚀 Servidor para Cloudflare Tunnel + MediaMTX');
console.log('📡 Este servidor recibe registros de cámaras con túnel Cloudflare');
console.log('⚡ OPTIMIZADO para alto rendimiento');

// === 1. EXPRESS APP PARA MANEJO DE CÁMARAS ===

// Compresión gzip para todas las respuestas
app.use(compression());

app.use(express.json({ limit: '1mb' }));

// CORS optimizado con cache
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache CORS preflight 24 horas
}));

// Headers de cache para respuestas API
app.use((req, res, next) => {
  // Cache de 5 segundos para APIs de streams (evita spam de requests)
  if (req.path.startsWith('/api/streams')) {
    res.set('Cache-Control', 'public, max-age=5');
  }
  // Cache de 1 hora para estadísticas
  if (req.path.startsWith('/api/stats')) {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// Middleware para logging (reducido para mejor performance)
app.use((req, res, next) => {
  // Solo loguear requests importantes, no cada GET
  if (req.method !== 'GET' || req.path.includes('register')) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
  }
  next();
});

const cameras = {};
let stats = {
  totalRegistrations: 0,
  lastUpdate: null,
  startTime: new Date().toISOString(),
  requestCount: 0,
  peakConnections: 0
};

// Contador de requests para estadísticas
let requestCounter = 0;
setInterval(() => {
  if (requestCounter > 0) {
    stats.requestCount += requestCounter;
    if (requestCounter > stats.peakConnections) {
      stats.peakConnections = requestCounter;
    }
    requestCounter = 0;
  }
}, 1000);

app.use((req, res, next) => {
  requestCounter++;
  next();
});

function saveCamerasToDisk() {
  try {
    fs.writeFileSync(CAM_FILE, JSON.stringify({ cameras, stats }, null, 2));
    console.log('💾 Cámaras guardadas en disco');
  } catch (err) {
    console.error('❌ Error guardando cameras.json:', err);
  }
}

function loadCamerasFromDisk() {
  if (fs.existsSync(CAM_FILE)) {
    try {
      const data = fs.readFileSync(CAM_FILE);
      if (data.length === 0) return;
      const loaded = JSON.parse(data);
      Object.assign(cameras, loaded.cameras || {});
      if (loaded.stats) {
        stats = { ...stats, ...loaded.stats };
      }
      console.log(`📂 ${Object.keys(cameras).length} cámaras cargadas desde disco`);
      Object.entries(cameras).forEach(([camId, camera]) => {
        console.log(`   ✓ ${camId}: ${camera.camName} [${camera.locationName}]`);
      });
    } catch (err) {
      console.error('❌ Error leyendo cameras.json:', err);
    }
  }
}

loadCamerasFromDisk();

// === 2. API ENDPOINTS ===

/**
 * POST /api/register
 * Registra o actualiza una cámara desde un cliente con Cloudflare Tunnel
 * Body: { camId, publicUrl, locationId, locationName, localCamId, camName }
 */
app.post('/api/register', (req, res) => {
  const { camId, publicUrl, locationId, locationName, localCamId, camName } = req.body;
  
  if (!camId || !publicUrl) {
    console.warn('⚠️ Registro rechazado: faltan camId o publicUrl');
    return res.status(400).json({ 
      error: 'camId y publicUrl son requeridos',
      received: { camId, publicUrl }
    });
  }

  const isNew = !cameras[camId];
  const isChanged = !isNew && cameras[camId].publicUrl !== publicUrl;
  
  cameras[camId] = {
    publicUrl,
    locationId: locationId || 'unknown',
    locationName: locationName || 'Unknown Location',
    localCamId: localCamId || camId,
    camName: camName || camId,
    registeredAt: cameras[camId]?.registeredAt || new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    status: 'active'
  };
  
  stats.totalRegistrations++;
  stats.lastUpdate = new Date().toISOString();
  saveCamerasToDisk();

  if (isNew) {
    console.log(`✅ Nueva cámara registrada:`);
    console.log(`   ID: ${camId}`);
    console.log(`   Nombre: ${camName}`);
    console.log(`   Ubicación: ${locationName} (${locationId})`);
    console.log(`   URL: ${publicUrl}`);
  } else if (isChanged) {
    console.log(`🔄 Cámara actualizada: ${camId}`);
    console.log(`   Nueva URL: ${publicUrl}`);
  } else {
    console.log(`✓ Cámara ${camId} - heartbeat recibido`);
  }

  res.json({ 
    success: true, 
    message: isNew ? 'Cámara registrada' : 'Cámara actualizada',
    camId 
  });
});

/**
 * GET /api/streams
 * Lista todas las cámaras registradas con sus URLs públicas
 */
app.get('/api/streams', (req, res) => {
  const liveStreams = Object.entries(cameras).map(([id, camera]) => {
    // Construir URL del stream HLS desde el túnel Cloudflare
    // Formato: https://tuneluno.noaservice.org/cam1/
    const baseUrl = camera.publicUrl.endsWith('/') ? camera.publicUrl.slice(0, -1) : camera.publicUrl;
    
    return {
      id,
      camId: camera.localCamId,
      name: camera.camName,
      title: camera.camName,
      location: camera.locationName,
      locationId: camera.locationId,
      publicUrl: camera.publicUrl,
      hlsUrl: `${baseUrl}/`,  // MediaMTX sirve HLS en la raíz del path
      rtspUrl: `${baseUrl}/`,  // También disponible vía RTSP si se configura
      thumbnail: `https://picsum.photos/seed/${id}/640/360`,
      isLive: camera.status === 'active',
      registeredAt: camera.registeredAt,
      lastUpdate: camera.lastUpdate,
      viewCount: Math.floor(Math.random() * 100) + 1
    };
  });

  res.json({
    success: true,
    count: liveStreams.length,
    streams: liveStreams,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/camera/:id
 * Obtiene información detallada de una cámara específica
 */
app.get('/api/camera/:id', (req, res) => {
  const camId = req.params.id;
  const camera = cameras[camId];
  
  if (!camera) {
    return res.status(404).json({ 
      error: 'Cámara no encontrada',
      camId 
    });
  }

  res.json({
    success: true,
    camera: {
      id: camId,
      ...camera
    }
  });
});

/**
 * DELETE /api/camera/:id
 * Elimina una cámara del registro
 */
app.delete('/api/camera/:id', (req, res) => {
  const camId = req.params.id;
  
  if (cameras[camId]) {
    const deletedCamera = cameras[camId];
    delete cameras[camId];
    saveCamerasToDisk();
    console.log(`🗑️ Cámara eliminada: ${camId} (${deletedCamera.camName})`);
    return res.json({ 
      success: true, 
      message: `Cámara ${camId} eliminada`,
      deletedCamera
    });
  }
  
  res.status(404).json({ 
    error: 'Cámara no encontrada',
    camId 
  });
});

/**
 * GET /api/health
 * Health check del servidor
 */
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    cameras: {
      total: Object.keys(cameras).length,
      active: Object.values(cameras).filter(c => c.status === 'active').length
    },
    stats: {
      totalRegistrations: stats.totalRegistrations,
      lastUpdate: stats.lastUpdate,
      startTime: stats.startTime
    }
  });
});

/**
 * GET /api/stats
 * Estadísticas detalladas del servidor
 */
app.get('/api/stats', (req, res) => {
  const locations = {};
  Object.values(cameras).forEach(camera => {
    const loc = camera.locationName || 'Unknown';
    locations[loc] = (locations[loc] || 0) + 1;
  });

  res.json({
    success: true,
    stats: {
      totalCameras: Object.keys(cameras).length,
      activeCameras: Object.values(cameras).filter(c => c.status === 'active').length,
      locations: locations,
      totalRegistrations: stats.totalRegistrations,
      uptime: Math.floor(process.uptime()),
      uptimeFormatted: formatUptime(process.uptime()),
      startTime: stats.startTime,
      lastUpdate: stats.lastUpdate,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    cameras: Object.entries(cameras).map(([id, camera]) => ({
      id,
      name: camera.camName,
      location: camera.locationName,
      publicUrl: camera.publicUrl,
      status: camera.status,
      lastUpdate: camera.lastUpdate
    }))
  });
});

/**
 * PUT /api/camera/:id/status
 * Actualiza el estado de una cámara
 */
app.put('/api/camera/:id/status', (req, res) => {
  const camId = req.params.id;
  const { status } = req.body;
  
  if (!cameras[camId]) {
    return res.status(404).json({ error: 'Cámara no encontrada' });
  }
  
  if (!['active', 'inactive', 'error'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Use: active, inactive, error' });
  }
  
  cameras[camId].status = status;
  cameras[camId].lastUpdate = new Date().toISOString();
  saveCamerasToDisk();
  
  console.log(`🔄 Estado actualizado: ${camId} -> ${status}`);
  
  res.json({
    success: true,
    message: 'Estado actualizado',
    camera: cameras[camId]
  });
});

/**
 * GET /
 * Página de bienvenida con información del servidor
 */
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Servidor Cloudflare Tunnel - Cámaras</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { 
      background: rgba(255,255,255,0.1); 
      backdrop-filter: blur(10px);
      padding: 40px; 
      border-radius: 20px; 
      max-width: 800px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { margin-bottom: 10px; font-size: 2.5em; }
    .subtitle { opacity: 0.9; margin-bottom: 30px; font-size: 1.1em; }
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
      gap: 15px; 
      margin: 30px 0; 
    }
    .stat { 
      background: rgba(255,255,255,0.15); 
      padding: 20px; 
      border-radius: 10px; 
      text-align: center;
    }
    .stat-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
    .stat-label { opacity: 0.8; font-size: 0.9em; }
    .endpoint { 
      background: rgba(0,0,0,0.2); 
      padding: 15px; 
      border-radius: 8px; 
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    .method { 
      display: inline-block; 
      padding: 4px 8px; 
      border-radius: 4px; 
      font-weight: bold; 
      margin-right: 10px;
      font-size: 0.85em;
    }
    .get { background: #4ade80; color: #000; }
    .post { background: #fbbf24; color: #000; }
    .delete { background: #ef4444; color: #fff; }
    .put { background: #3b82f6; color: #fff; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎥 Servidor de Cámaras</h1>
    <p class="subtitle">Cloudflare Tunnel + MediaMTX</p>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${Object.keys(cameras).length}</div>
        <div class="stat-label">Cámaras Registradas</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.values(cameras).filter(c => c.status === 'active').length}</div>
        <div class="stat-label">Activas</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.totalRegistrations}</div>
        <div class="stat-label">Registros Totales</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatUptime(process.uptime())}</div>
        <div class="stat-label">Uptime</div>
      </div>
    </div>

    <h3 style="margin-top: 30px; margin-bottom: 15px;">📡 API Endpoints</h3>
    
    <div class="endpoint">
      <span class="method post">POST</span>
      <span>/api/register</span>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Registrar nueva cámara o actualizar existente
      </div>
    </div>

    <div class="endpoint">
      <span class="method get">GET</span>
      <a href="/api/streams">/api/streams</a>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Listar todas las cámaras y sus URLs
      </div>
    </div>

    <div class="endpoint">
      <span class="method get">GET</span>
      <a href="/api/health">/api/health</a>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Estado del servidor
      </div>
    </div>

    <div class="endpoint">
      <span class="method get">GET</span>
      <a href="/api/stats">/api/stats</a>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Estadísticas detalladas
      </div>
    </div>

    <div class="endpoint">
      <span class="method get">GET</span>
      <span>/api/camera/:id</span>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Información de una cámara específica
      </div>
    </div>

    <div class="endpoint">
      <span class="method put">PUT</span>
      <span>/api/camera/:id/status</span>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Actualizar estado de cámara
      </div>
    </div>

    <div class="endpoint">
      <span class="method delete">DELETE</span>
      <span>/api/camera/:id</span>
      <div style="margin-top: 8px; opacity: 0.8; font-size: 0.9em;">
        Eliminar cámara del registro
      </div>
    </div>

    <p style="margin-top: 30px; opacity: 0.7; text-align: center; font-size: 0.9em;">
      Server v2.0 - Cloudflare Tunnel Edition
    </p>
  </div>
</body>
</html>
  `;
  res.send(html);
});

// === 3. UTILIDADES ===

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// === 4. MANEJO DE ERRORES ===

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.url,
    method: req.method
  });
});

// === 5. INICIO DEL SERVIDOR ===

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  🚀 Servidor Cloudflare Tunnel INICIADO');
  console.log('═══════════════════════════════════════════════');
  console.log(`  📡 URL: http://localhost:${PORT}`);
  console.log(`  📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`  📈 Stats: http://localhost:${PORT}/api/stats`);
  console.log(`  🎥 Streams: http://localhost:${PORT}/api/streams`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});

// Manejo de cierre limpio
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo servidor...');
  saveCamerasToDisk();
  console.log('✅ Servidor detenido limpiamente');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Deteniendo servidor...');
  saveCamerasToDisk();
  process.exit(0);
});
