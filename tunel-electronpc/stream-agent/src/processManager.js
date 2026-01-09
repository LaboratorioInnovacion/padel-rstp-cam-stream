// src/processManager.js
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Detectar si estamos en desarrollo (cuando se ejecuta desde node_modules/electron)
const isDev = process.resourcesPath && process.resourcesPath.includes('node_modules')

// En desarrollo, usar la carpeta del proyecto
let binDir
if (isDev) {
  // Desarrollo: usar bin/ en la raíz del proyecto stream-agent
  binDir = path.join(process.cwd(), 'bin')
} else {
  // Producción: usar resources/bin
  binDir = path.join(process.resourcesPath, 'bin')
}

console.log('🔍 Modo:', isDev ? 'DESARROLLO' : 'PRODUCCIÓN')
console.log('🔍 Buscando binarios en:', binDir)

const camerasFile = path.join(process.cwd(), 'cameras.json')
const configFile = path.join(process.cwd(), 'config.json')
const mediamtxConfigFile = path.join(process.cwd(), 'mediamtx.yml')

let processes = {}
let shouldRestart = {} // Control de auto-reinicio
let useCloudflared = false // Modo: false = prueba (sin cloudflared), true = producción
let tunnelUrl = null // URL pública del túnel de Cloudflared
let serverUrl = 'http://localhost:3100' // URL del servidor receptor
let cameras = [] // Lista de cámaras cargadas desde cameras.json
let locationId = 'default' // ID único de la ubicación
let locationName = 'Ubicación Principal' // Nombre descriptivo de la ubicación
let tunnelName = null // Nombre del túnel con cuenta (null = usar quick tunnel)
let tunnelId = null // ID del túnel con cuenta
let tunnelHostname = null // Hostname personalizado (ej: tuneluno.noaservice.org)
let lastError = null // Último error ocurrido (para mostrar en UI)

// ============ SISTEMA DE AUTO-RECONEXIÓN ============
let reconnectStats = {} // Estadísticas de reconexión por proceso
let reconnectConfig = {
  enabled: true,           // Habilitar auto-reconexión
  maxRetries: 10,          // Máximo de reintentos antes de pausar
  retryDelayBase: 3000,    // Delay base entre reintentos (3 segundos)
  retryDelayMax: 60000,    // Delay máximo (1 minuto)
  resetCounterAfter: 300000, // Resetear contador de fallos después de 5 min de estabilidad
  healthCheckInterval: 30000 // Verificar salud cada 30 segundos
}
let healthCheckTimer = null
let eventCallback = null // Callback para enviar eventos al main process

// Inicializar estadísticas de un proceso
function initReconnectStats(processKey) {
  if (!reconnectStats[processKey]) {
    reconnectStats[processKey] = {
      restarts: 0,
      lastRestart: null,
      lastStableTime: Date.now(),
      consecutiveFailures: 0,
      totalUptime: 0,
      status: 'stopped' // stopped, running, reconnecting, failed
    }
  }
  return reconnectStats[processKey]
}

// Calcular delay con backoff exponencial
function calculateRetryDelay(processKey) {
  const stats = reconnectStats[processKey]
  if (!stats) return reconnectConfig.retryDelayBase
  
  // Backoff exponencial: 3s, 6s, 12s, 24s, 48s... hasta max 60s
  const delay = Math.min(
    reconnectConfig.retryDelayBase * Math.pow(2, stats.consecutiveFailures),
    reconnectConfig.retryDelayMax
  )
  return delay
}

// Emitir evento de reconexión
function emitReconnectEvent(processKey, event, data = {}) {
  const eventData = {
    process: processKey,
    event,
    timestamp: Date.now(),
    stats: reconnectStats[processKey],
    ...data
  }
  
  console.log(`🔄 [${processKey}] ${event}:`, JSON.stringify(data))
  
  if (eventCallback) {
    eventCallback('reconnect-event', eventData)
  }
}

// Configurar callback para eventos
function setEventCallback(callback) {
  eventCallback = callback
}

// Obtener estadísticas de reconexión
function getReconnectStats() {
  return {
    config: reconnectConfig,
    processes: reconnectStats,
    summary: {
      totalRestarts: Object.values(reconnectStats).reduce((sum, s) => sum + s.restarts, 0),
      activeProcesses: Object.values(reconnectStats).filter(s => s.status === 'running').length,
      failedProcesses: Object.values(reconnectStats).filter(s => s.status === 'failed').length
    }
  }
}

// Actualizar configuración de reconexión
function updateReconnectConfig(newConfig) {
  reconnectConfig = { ...reconnectConfig, ...newConfig }
  console.log('⚙️ Configuración de reconexión actualizada:', reconnectConfig)
  return reconnectConfig
}

function bin(name) {
  // cross-platform: en Windows suele necesitar .exe
  const platform = process.platform
  const exe = platform === 'win32' ? `${name}.exe` : name
  return path.join(binDir, exe)
}

// Actualizar archivo cloudflared-config.yml con nuevo hostname
function updateCloudflaredConfig() {
  const configPath = path.join(process.cwd(), 'cloudflared-config.yml')
  
  if (!tunnelId) {
    console.error('❌ No hay tunnel ID configurado')
    return false
  }
  
  // Obtener la ruta del archivo de credenciales
  const homeDir = os.homedir()
  const credentialsPath = path.join(homeDir, '.cloudflared', `${tunnelId}.json`)
  
  // Crear contenido del archivo de configuración
  let configContent = `tunnel: ${tunnelId}\n`
  configContent += `credentials-file: ${credentialsPath.replace(/\\/g, '\\\\')}\n\n`
  configContent += `ingress:\n`
  
  if (tunnelHostname) {
    // Si hay hostname personalizado, usarlo
    configContent += `  - hostname: ${tunnelHostname}\n`
    configContent += `    service: http://localhost:8888\n`
    configContent += `  - service: http_status:404\n`
  } else {
    // Sin hostname, catch-all
    configContent += `  - service: http://localhost:8888\n`
  }
  
  try {
    fs.writeFileSync(configPath, configContent, 'utf8')
    console.log('✅ Archivo cloudflared-config.yml actualizado')
    if (tunnelHostname) {
      console.log('   Hostname:', tunnelHostname)
    }
    return true
  } catch (err) {
    console.error('❌ Error actualizando cloudflared-config.yml:', err.message)
    return false
  }
}

// Login en Cloudflare (abre navegador)
function cloudflaredLogin() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Iniciando login en Cloudflare...')
    console.log('   Se abrirá tu navegador para autenticarte')
    
    if (!checkBinary('cloudflared')) {
      return reject(new Error('cloudflared binary not found'))
    }
    
    const p = spawn(bin('cloudflared'), ['tunnel', 'login'], {
      stdio: 'inherit' // Mostrar output directamente
    })
    
    p.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Login exitoso')
        resolve({ ok: true })
      } else {
        console.error('❌ Login fallido')
        reject(new Error(`Login failed with code ${code}`))
      }
    })
    
    p.on('error', (error) => {
      console.error('❌ Error en login:', error.message)
      reject(error)
    })
  })
}

// Configurar ruta DNS para el túnel
function cloudflaredRouteDNS(tunnelName, hostname) {
  return new Promise((resolve, reject) => {
    console.log(`🌐 Configurando ruta DNS: ${hostname} -> ${tunnelName}...`)
    
    if (!checkBinary('cloudflared')) {
      return reject(new Error('cloudflared binary not found'))
    }
    
    const p = spawn(bin('cloudflared'), ['tunnel', 'route', 'dns', tunnelName, hostname], {
      windowsHide: true
    })
    
    let output = ''
    let errorOutput = ''
    
    p.stdout?.on('data', (data) => {
      output += data.toString()
    })
    
    p.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    p.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Ruta DNS configurada exitosamente')
        console.log('   Hostname:', hostname)
        console.log('   Túnel:', tunnelName)
        
        // Guardar hostname en config
        tunnelHostname = hostname
        saveConfig()
        
        // Actualizar archivo de configuración
        updateCloudflaredConfig()
        
        resolve({ ok: true, hostname })
      } else {
        console.error('❌ Error configurando ruta DNS')
        console.error('   Salida:', errorOutput || output)
        reject(new Error(`Route DNS failed: ${errorOutput || output}`))
      }
    })
    
    p.on('error', (error) => {
      console.error('❌ Error en route DNS:', error.message)
      reject(error)
    })
  })
}

// Crear tunnel con nombre
function cloudflaredCreateTunnel(name) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Creando túnel con nombre: ${name}...`)
    
    if (!checkBinary('cloudflared')) {
      return reject(new Error('cloudflared binary not found'))
    }
    
    let output = ''
    
    const p = spawn(bin('cloudflared'), ['tunnel', 'create', name], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    p.stdout?.on('data', (data) => {
      output += data.toString()
      console.log('[Cloudflared]', data.toString().trim())
    })
    
    p.stderr?.on('data', (data) => {
      output += data.toString()
      console.log('[Cloudflared]', data.toString().trim())
    })
    
    p.on('exit', (code) => {
      if (code === 0) {
        // Extraer el tunnel ID del output
        const match = output.match(/Created tunnel .+ with id ([a-f0-9-]+)/)
        if (match) {
          const id = match[1]
          console.log(`✅ Túnel creado exitosamente`)
          console.log(`   ID: ${id}`)
          
          // Guardar en variables globales
          tunnelName = name
          tunnelId = id
          saveConfig()
          
          resolve({ ok: true, name, id })
        } else {
          reject(new Error('No se pudo extraer el tunnel ID del output'))
        }
      } else {
        console.error('❌ Creación de túnel fallida')
        reject(new Error(`Tunnel creation failed with code ${code}`))
      }
    })
    
    p.on('error', (error) => {
      console.error('❌ Error creando túnel:', error.message)
      reject(error)
    })
  })
}

// Listar tunnels existentes
function cloudflaredListTunnels() {
  return new Promise((resolve, reject) => {
    console.log('📜 Listando túneles existentes...')
    
    if (!checkBinary('cloudflared')) {
      return reject(new Error('cloudflared binary not found'))
    }
    
    let output = ''
    
    const p = spawn(bin('cloudflared'), ['tunnel', 'list'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    p.stdout?.on('data', (data) => {
      output += data.toString()
    })
    
    p.stderr?.on('data', (data) => {
      output += data.toString()
    })
    
    p.on('exit', (code) => {
      if (code === 0) {
        console.log(output)
        resolve({ ok: true, output })
      } else {
        reject(new Error(`List tunnels failed with code ${code}`))
      }
    })
    
    p.on('error', (error) => {
      reject(error)
    })
  })
}

function checkBinary(name) {
  const binPath = bin(name)
  if (!fs.existsSync(binPath)) {
    console.warn(`Binary not found: ${binPath}`)
    return false
  }
  return true
}

// Verificar conectividad antes de iniciar Cloudflared
async function checkCloudflareConnectivity() {
  return new Promise((resolve) => {
    const https = require('https')
    
    const options = {
      hostname: 'api.trycloudflare.com',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }
    
    const req = https.request(options, (res) => {
      resolve({ ok: true, status: res.statusCode })
    })
    
    req.on('error', (error) => {
      resolve({ ok: false, error: error.message })
    })
    
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
    
    req.end()
  })
}

function loadConfig() {
  try {
    if (!fs.existsSync(configFile)) {
      console.warn('config.json no encontrado, usando configuración por defecto')
      saveConfig()
      return { serverUrl, locationId, locationName }
    }
    const data = fs.readFileSync(configFile, 'utf-8')
    const config = JSON.parse(data)
    
    // Cargar configuración guardada
    if (config.serverUrl) serverUrl = config.serverUrl
    if (config.locationId) locationId = config.locationId
    if (config.locationName) locationName = config.locationName
    if (config.tunnelName) tunnelName = config.tunnelName
    if (config.tunnelId) tunnelId = config.tunnelId
    if (config.tunnelHostname) tunnelHostname = config.tunnelHostname
    
    console.log(`⚙️  Configuración cargada desde config.json`)
    console.log(`   Servidor: ${serverUrl}`)
    console.log(`   Ubicación: ${locationName} (${locationId})`)
    if (tunnelName) {
      console.log(`   Túnel con cuenta: ${tunnelName} (${tunnelId})`)
      if (tunnelHostname) {
        console.log(`   Hostname: ${tunnelHostname}`)
      }
    }
    return { serverUrl, locationId, locationName, tunnelName, tunnelId, tunnelHostname }
  } catch (error) {
    console.error('Error cargando config.json:', error.message)
    return { serverUrl, locationId, locationName }
  }
}

function saveConfig() {
  try {
    const config = {
      serverUrl,
      locationId,
      locationName,
      tunnelName,
      tunnelId,
      tunnelHostname
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8')
    console.log('💾 Configuración guardada en config.json')
    return true
  } catch (error) {
    console.error('Error guardando config.json:', error.message)
    return false
  }
}

function loadCameras() {
  try {
    if (!fs.existsSync(camerasFile)) {
      console.warn('cameras.json no encontrado, usando configuración por defecto')
      cameras = [{
        id: 'cam1',
        name: 'Cámara Principal',
        rtspUrl: 'rtsp://asd:asd@192.168.1.240:1945',
        enabled: true,
        encoding: 'copy'
      }]
      saveCameras()
      return cameras
    }
    const data = fs.readFileSync(camerasFile, 'utf-8')
    const config = JSON.parse(data)
    cameras = config.cameras || []
    console.log(`📹 Cargadas ${cameras.length} cámaras desde cameras.json`)
    return cameras
  } catch (error) {
    console.error('Error cargando cameras.json:', error.message)
    cameras = []
    return cameras
  }
}

function saveCameras() {
  try {
    const config = { cameras }
    fs.writeFileSync(camerasFile, JSON.stringify(config, null, 2), 'utf-8')
    console.log('💾 Cámaras guardadas en cameras.json')
    return true
  } catch (error) {
    console.error('Error guardando cameras.json:', error.message)
    return false
  }
}

function updateMediaMTXConfig() {
  try {
    // Generar configuración HLS CLÁSICO (sin LL-HLS) para máxima estabilidad
    let config = `# MediaMTX configuration - HLS CLÁSICO para estabilidad
logLevel: warn

# RTSP server
rtspAddress: :8554
protocols: [tcp]

# HLS server - CLÁSICO (sin Low-Latency para mejor compatibilidad)
hlsAddress: :8888
hlsVariant: mpegts
hlsSegmentCount: 7
hlsSegmentDuration: 4s
hlsPartDuration: 0s
hlsAllowOrigin: '*'

# WebRTC (baja latencia alternativa)
webrtcAddress: :8189

# API
apiAddress: :9997

# Paths de cámaras
paths:
`
    
    // Agregar un path por cada cámara (formato simple)
    cameras.forEach(camera => {
      config += `  ${camera.id}:\n`
    })
    
    // Si no hay cámaras, agregar un path por defecto
    if (cameras.length === 0) {
      config += `  cam1:\n`
    }
    
    fs.writeFileSync(mediamtxConfigFile, config, 'utf-8')
    console.log(`📝 MediaMTX config actualizado con ${cameras.length} cámara(s) - HLS CLÁSICO`)
    return true
  } catch (error) {
    console.error('Error actualizando mediamtx.yml:', error.message)
    return false
  }
}

function getCameras() {
  if (cameras.length === 0) {
    loadCameras()
  }
  return cameras
}

function addCamera(camera) {
  if (!camera.id || !camera.rtspUrl) {
    throw new Error('Camera debe tener id y rtspUrl')
  }
  
  // Verificar si ya existe
  const exists = cameras.find(c => c.id === camera.id)
  if (exists) {
    throw new Error(`Ya existe una cámara con ID: ${camera.id}`)
  }
  
  const newCamera = {
    id: camera.id,
    name: camera.name || camera.id,
    rtspUrl: camera.rtspUrl,
    enabled: camera.enabled !== undefined ? camera.enabled : true,
    quality: camera.quality || 'medium', // low, medium, high
    encoding: camera.encoding || 'copy' // 'copy' o 'transcode'
  }
  
  cameras.push(newCamera)
  saveCameras()
  updateMediaMTXConfig()
  console.log(`✅ Cámara agregada: ${newCamera.id}`)
  return newCamera
}

function updateCamera(id, updates) {
  const index = cameras.findIndex(c => c.id === id)
  if (index === -1) {
    throw new Error(`Cámara no encontrada: ${id}`)
  }
  
  cameras[index] = { ...cameras[index], ...updates, id } // Mantener el ID original
  saveCameras()
  updateMediaMTXConfig()
  console.log(`✅ Cámara actualizada: ${id}`)
  return cameras[index]
}

function deleteCamera(id) {
  const index = cameras.findIndex(c => c.id === id)
  if (index === -1) {
    throw new Error(`Cámara no encontrada: ${id}`)
  }
  
  // Detener proceso FFmpeg si existe
  const processKey = `ffmpeg-${id}`
  if (processes[processKey]) {
    shouldRestart[processKey] = false
    try {
      if (!processes[processKey].killed) {
        processes[processKey].kill('SIGTERM')
      }
    } catch (e) {
      console.error(`Error deteniendo FFmpeg para ${id}:`, e.message)
    }
    delete processes[processKey]
  }
  
  cameras.splice(index, 1)
  saveCameras()
  updateMediaMTXConfig()
  console.log(`🗑️  Cámara eliminada: ${id}`)
  return true
}

// Reconectar una cámara específica manualmente
function reconnectCamera(id) {
  const camera = cameras.find(c => c.id === id)
  if (!camera) {
    throw new Error(`Cámara no encontrada: ${id}`)
  }
  
  const processKey = `ffmpeg-${id}`
  
  console.log(`🔄 Reconectando cámara manualmente: ${camera.name} (${id})`)
  
  // Detener proceso actual si existe
  if (processes[processKey]) {
    shouldRestart[processKey] = false // Temporalmente desactivar auto-restart
    try {
      if (!processes[processKey].killed) {
        processes[processKey].kill('SIGTERM')
      }
    } catch (e) {
      console.error(`Error deteniendo FFmpeg para ${id}:`, e.message)
    }
    delete processes[processKey]
  }
  
  // Resetear estadísticas de reconexión
  if (reconnectStats[processKey]) {
    reconnectStats[processKey].consecutiveFailures = 0
    reconnectStats[processKey].status = 'stopped'
  }
  
  // Esperar un momento y reiniciar
  setTimeout(() => {
    shouldRestart[processKey] = reconnectConfig.enabled
    startSingleCamera(camera)
    emitReconnectEvent(processKey, 'manual-reconnect', { cameraId: id, cameraName: camera.name })
  }, 500)
  
  return { ok: true, message: `Reconectando ${camera.name}...` }
}

// Iniciar una sola cámara (usado por reconnectCamera)
function startSingleCamera(camera) {
  const processKey = `ffmpeg-${camera.id}`
  
  if (processes[processKey]) {
    console.log(`FFmpeg ya en ejecución para ${camera.id}`)
    return processes[processKey]
  }
  
  // Parámetros optimizados para RTSP (compatible con FFmpeg moderno)
  const rtspReconnectArgs = [
    '-rtsp_transport', 'tcp',           // TCP más confiable que UDP
    '-rtsp_flags', 'prefer_tcp',        // Preferir TCP
    '-fflags', '+genpts+discardcorrupt', // Generar timestamps, descartar frames corruptos
    '-analyzeduration', '5000000',      // Tiempo de análisis: 5 segundos
    '-probesize', '5000000',            // Tamaño de sondeo: 5MB
  ]
  
  let args
  
  if (camera.encoding === 'copy') {
    args = [
      ...rtspReconnectArgs,
      '-i', camera.rtspUrl,
      '-c', 'copy',
      '-f', 'rtsp',
      '-rtsp_transport', 'tcp',
      `rtsp://localhost:8554/${camera.id}`
    ]
  } else {
    const qualityPresets = {
      low: { resolution: '640x360', bitrate: '1000k', preset: 'fast', fps: 15, gop: 30 },
      medium: { resolution: '1280x720', bitrate: '2500k', preset: 'medium', fps: 25, gop: 50 },
      high: { resolution: '1920x1080', bitrate: '5000k', preset: 'medium', fps: 30, gop: 60 }
    }
    const quality = qualityPresets[camera.quality] || qualityPresets.medium
    
    args = [
      ...rtspReconnectArgs,
      '-i', camera.rtspUrl,
      '-vf', `scale=${quality.resolution}:force_original_aspect_ratio=decrease,fps=${quality.fps}`,
      '-c:v', 'libx264',
      '-preset', quality.preset,        // 🎯 Mejor compresión = menos ancho de banda
      '-b:v', quality.bitrate,
      '-maxrate', `${parseInt(quality.bitrate) * 1.2}k`,  // 20% margen
      '-bufsize', `${parseInt(quality.bitrate) * 4}k`,    // 🎯 Buffer grande (4x) = streaming estable
      '-g', quality.gop.toString(),
      '-keyint_min', quality.gop.toString(),              // Keyframes regulares
      '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p',            // Compatibilidad máxima
      '-c:a', 'aac',
      '-b:a', '128k',                   // 🎯 Audio de mejor calidad
      '-ar', '44100',
      '-f', 'rtsp',
      '-rtsp_transport', 'tcp',
      `rtsp://localhost:8554/${camera.id}`
    ]
  }
  
  console.log(`▶️  Iniciando FFmpeg para ${camera.name} (${camera.id})`)
  const proc = startProcess('ffmpeg', args, {}, processKey)
  if (proc) processes[processKey] = proc
  return proc
}

function startProcess(name, args = [], options = {}, processKey = null) {
  // Si no se proporciona processKey, usar el nombre del binario
  const key = processKey || name
  
  if (!checkBinary(name)) {
    console.warn(`Skipping ${name} - binary not found`)
    return null // Retornar null si el binario no existe
  }
  
  // Inicializar estadísticas de reconexión
  const stats = initReconnectStats(key)
  
  shouldRestart[key] = reconnectConfig.enabled // Usar config global
  
  const p = spawn(bin(name), args, {
    windowsHide: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  })

  // logs
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)
  const outStream = fs.createWriteStream(path.join(logDir, `${key}-out.log`), { flags: 'a' })
  const errStream = fs.createWriteStream(path.join(logDir, `${key}-err.log`), { flags: 'a' })

  if (p.stdout) p.stdout.pipe(outStream)
  if (p.stderr) p.stderr.pipe(errStream)

  // Marcar como running
  stats.status = 'running'
  stats.lastStableTime = Date.now()
  emitReconnectEvent(key, 'started')

  // watchdog: revivir si muere (con backoff exponencial)
  p.on('exit', (code, signal) => {
    const exitReason = signal ? `signal ${signal}` : `code ${code}`
    console.log(`⚠️ ${key} exited (${exitReason})`)
    
    stats.status = 'stopped'
    
    // Verificar si fue una salida limpia (code 0) o un crash
    const wasCleanExit = code === 0 && !signal
    
    if (shouldRestart[key] && reconnectConfig.enabled) {
      // Incrementar contadores
      stats.restarts++
      stats.lastRestart = Date.now()
      
      // Calcular tiempo que estuvo estable
      const uptimeThisRun = Date.now() - stats.lastStableTime
      stats.totalUptime += uptimeThisRun
      
      // Si estuvo estable por más de resetCounterAfter, resetear fallos consecutivos
      if (uptimeThisRun > reconnectConfig.resetCounterAfter) {
        stats.consecutiveFailures = 0
      } else if (!wasCleanExit) {
        stats.consecutiveFailures++
      }
      
      // Verificar si excedimos el máximo de reintentos
      if (stats.consecutiveFailures >= reconnectConfig.maxRetries) {
        stats.status = 'failed'
        const errorMsg = `${key} falló ${stats.consecutiveFailures} veces consecutivas. Auto-reconexión pausada.`
        lastError = errorMsg
        emitReconnectEvent(key, 'max-retries-reached', { 
          consecutiveFailures: stats.consecutiveFailures,
          message: errorMsg
        })
        console.error(`❌ ${errorMsg}`)
        console.log(`💡 Para reiniciar manualmente, detén y vuelve a iniciar los servicios`)
        return
      }
      
      // Calcular delay con backoff
      const delay = calculateRetryDelay(key)
      stats.status = 'reconnecting'
      
      emitReconnectEvent(key, 'reconnecting', {
        delay,
        attempt: stats.consecutiveFailures + 1,
        maxRetries: reconnectConfig.maxRetries
      })
      
      console.log(`🔄 Reconectando ${key} en ${delay/1000}s (intento ${stats.consecutiveFailures + 1}/${reconnectConfig.maxRetries})...`)
      
      setTimeout(() => {
        if (shouldRestart[key]) {
          processes[key] = startProcess(name, args, options, processKey)
        }
      }, delay)
    } else {
      emitReconnectEvent(key, 'stopped', { reason: 'manual' })
    }
  })
  
  p.on('error', (err) => {
    console.error(`❌ Error en proceso ${key}:`, err.message)
    stats.status = 'failed'
    emitReconnectEvent(key, 'error', { error: err.message })
  })

  return p
}

async function startMTX() {
  // Actualizar configuración de MediaMTX con todas las cámaras
  updateMediaMTXConfig()
  
  if (processes['mediamtx']) return processes['mediamtx']
  
  // MediaMTX con configuración específica para estabilidad
  const args = ['mediamtx.yml']
  const proc = startProcess('mediamtx', args)
  if (proc) processes['mediamtx'] = proc
  return proc
}

async function startFFmpeg() {
  // Cargar cámaras si no están cargadas
  if (cameras.length === 0) {
    loadCameras()
  }
  
  // Iniciar un proceso FFmpeg por cada cámara habilitada
  const enabledCameras = cameras.filter(c => c.enabled)
  console.log(`🎥 Iniciando FFmpeg para ${enabledCameras.length} cámaras habilitadas`)
  
  for (const camera of enabledCameras) {
    const processKey = `ffmpeg-${camera.id}`
    if (processes[processKey]) {
      console.log(`FFmpeg ya en ejecución para ${camera.id}`)
      continue
    }
    
    let args
    
    // Parámetros optimizados para RTSP con SINCRONIZACIÓN de timestamps
    const rtspReconnectArgs = [
      '-rtsp_transport', 'tcp',           // TCP más confiable que UDP
      '-rtsp_flags', 'prefer_tcp',        // Preferir TCP
      '-fflags', '+genpts+discardcorrupt+nobuffer', // Generar timestamps, descartar corruptos
      '-flags', 'low_delay',              // Baja latencia
      '-use_wallclock_as_timestamps', '1', // 🎯 Usar reloj del sistema para timestamps
      '-analyzeduration', '3000000',      // Tiempo de análisis: 3 segundos
      '-probesize', '3000000',            // Tamaño de sondeo: 3MB
    ]
    
    // Modo COPY: Sin recodificar (bajo CPU, alto ancho de banda, calidad original)
    if (camera.encoding === 'copy') {
      args = [
        ...rtspReconnectArgs,
        '-i', camera.rtspUrl,
        '-c', 'copy', // Copiar sin recodificar
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        `rtsp://localhost:8554/${camera.id}`
      ]
      console.log(`▶️  Iniciando FFmpeg para ${camera.name} (${camera.id})`)
      console.log(`   Modo: COPY DIRECTO (sin recodificar)`)
      console.log(`   🔄 Auto-reconexión RTSP habilitada`)
    } 
    // Modo TRANSCODE: Recodificar con calidad ajustable (alto CPU, bajo ancho de banda)
    else {
      // Configurar parámetros según calidad
      const qualityPresets = {
        low: {
          resolution: '640x360',
          bitrate: '1000k',
          preset: 'fast',
          fps: 15,
          gop: 30
        },
        medium: {
          resolution: '1280x720',
          bitrate: '2500k',
          preset: 'medium',
          fps: 25,
          gop: 50
        },
        high: {
          resolution: '1920x1080',
          bitrate: '5000k',
          preset: 'medium',
          fps: 30,
          gop: 60
        }
      }
      
      const quality = qualityPresets[camera.quality] || qualityPresets.medium
      
      // Determinar configuración de audio
      // Si audioMode es 'disabled' o hay problemas conocidos, no incluir audio
      const audioMode = camera.audioMode || 'transcode' // 'transcode', 'copy', 'disabled'
      
      let audioArgs = []
      if (audioMode === 'disabled') {
        audioArgs = ['-an'] // Sin audio
        console.log(`   🔇 Audio: DESHABILITADO`)
      } else if (audioMode === 'copy') {
        audioArgs = ['-c:a', 'copy'] // Copiar audio sin recodificar
        console.log(`   🔊 Audio: COPY`)
      } else {
        // Transcode audio con SINCRONIZACIÓN AGRESIVA
        audioArgs = [
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',                     // Forzar 2 canales (estéreo)
          '-af', 'aresample=async=1:min_hard_comp=0.100000:first_pts=0',  // 🎯 Sincronización agresiva
        ]
        console.log(`   🔊 Audio: TRANSCODE AAC (sync agresivo)`)
      }
      
      args = [
        ...rtspReconnectArgs,
        '-i', camera.rtspUrl,
        // Video: recodificar y escalar
        '-vf', `scale=${quality.resolution}:force_original_aspect_ratio=decrease,fps=${quality.fps}`,
        '-c:v', 'libx264',
        '-preset', quality.preset,        // 🎯 Mejor compresión
        '-b:v', quality.bitrate,
        '-maxrate', `${parseInt(quality.bitrate) * 1.2}k`,
        '-bufsize', `${parseInt(quality.bitrate) * 4}k`,  // 🎯 Buffer grande = sin trabas
        '-g', quality.gop.toString(),
        '-keyint_min', quality.gop.toString(),
        '-sc_threshold', '0',
        '-pix_fmt', 'yuv420p',
        // Audio según modo configurado
        ...audioArgs,
        // Formato de salida
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        `rtsp://localhost:8554/${camera.id}`
      ]
      
      console.log(`▶️  Iniciando FFmpeg para ${camera.name} (${camera.id})`)
      console.log(`   Modo: RECODIFICAR`)
      console.log(`   Calidad: ${camera.quality} (${quality.resolution} @ ${quality.bitrate})`)
      console.log(`   🎯 Optimizado para streaming estable (buffer 4x, preset ${quality.preset})`)
      console.log(`   🔄 Auto-reconexión RTSP habilitada`)
    }
    
    const proc = startProcess('ffmpeg', args, {}, processKey)
    if (proc) processes[processKey] = proc
  }
  
  return true
}

async function registerCameraOnServer() {
  if (!tunnelUrl) {
    console.error('❌ No se puede registrar: túnel no disponible')
    return
  }
  
  // Validar que serverUrl tenga protocolo
  let validServerUrl = serverUrl
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    validServerUrl = `https://${serverUrl}`
    console.log(`⚠️  Añadiendo protocolo HTTPS a URL del servidor: ${validServerUrl}`)
  }

  // Cargar cámaras si no están cargadas
  if (cameras.length === 0) {
    loadCameras()
  }

  // Registrar todas las cámaras habilitadas
  const enabledCameras = cameras.filter(c => c.enabled)
  console.log(`📡 Registrando ${enabledCameras.length} cámaras en servidor: ${validServerUrl}/api/register`)
  
  const https = require('https')
  const http = require('http')

  for (const camera of enabledCameras) {
    const publicUrl = `${tunnelUrl}/${camera.id}`
    // Crear ID completo con ubicación: locationId-camId
    const fullCamId = `${locationId}-${camera.id}`
    
    try {
      console.log(`   📹 ${camera.name} (${fullCamId}): ${publicUrl}`)
      
      const url = new URL(`${validServerUrl}/api/register`)
      const client = url.protocol === 'https:' ? https : http
      
      const postData = JSON.stringify({
        camId: fullCamId,
        camName: camera.name,
        publicUrl: publicUrl,
        locationId: locationId,
        locationName: locationName,
        localCamId: camera.id
      })

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000 // 10 segundos de timeout
      }

      const req = client.request(options, (res) => {
        let responseData = ''
        
        res.on('data', (chunk) => {
          responseData += chunk
        })
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`   ✅ ${camera.id} registrada exitosamente`)
          } else {
            console.error(`   ❌ Error al registrar ${camera.id}: HTTP ${res.statusCode}`)
            console.error(`   Respuesta: ${responseData}`)
          }
        })
      })

      req.on('timeout', () => {
        console.error(`   ❌ Timeout al registrar ${camera.id}`)
        req.destroy()
      })

      req.on('error', (error) => {
        console.error(`   ❌ Error conectando al servidor para ${camera.id}:`, error.message)
        console.error(`   URL intentada: ${validServerUrl}/api/register`)
      })

      req.write(postData)
      req.end()
    } catch (error) {
      console.error(`   ❌ Error al registrar ${camera.id}:`, error.message)
    }
  }
}

async function startCloudflared() {
  if (processes['cloudflared']) return processes['cloudflared']
  
  console.log('🌐 Iniciando túnel Cloudflared...')
  
  // Si hay tunnel con nombre configurado, usarlo
  if (tunnelName && tunnelId) {
    console.log(`🎯 Usando túnel con cuenta: ${tunnelName}`)
    return startNamedTunnel()
  }
  
  // Si no, usar quick tunnel (sin cuenta)
  console.log('⚡ Usando quick tunnel (sin cuenta)')
  console.log('💡 Los tunnels con cuenta requieren configuración DNS adicional')
  
  // Verificar conectividad primero
  console.log('🔍 Verificando conectividad a Cloudflare...')
  const connectivity = await checkCloudflareConnectivity()
  
  if (!connectivity.ok) {
    const errorMsg = `No se puede conectar a Cloudflare: ${connectivity.error}`
    lastError = errorMsg // Guardar para la UI
    
    console.error('❌ No se puede conectar a Cloudflare API')
    console.error(`   Error: ${connectivity.error}`)
    console.error('')
    console.error('💡 Soluciones posibles:')
    console.error('   1. Ejecuta: setup-cloudflared.ps1 (diagnóstico automático)')
    console.error('   2. Ejecuta: test-cloudflared.bat (prueba rápida)')
    console.error('   3. Revisa: CLOUDFLARED-TROUBLESHOOTING.md')
    console.error('   4. Usa túnel con cuenta (más estable): Configurar Túnel')
    console.error('')
    console.error('🔧 Pasos manuales:')
    console.error('   • Cambiar DNS a 1.1.1.1 (Cloudflare DNS)')
    console.error('   • Desbloquear: Unblock-File bin\\cloudflared.exe')
    console.error('   • Desactivar antivirus temporalmente')
    return null
  }
  
  lastError = null // Limpiar error anterior si la conectividad está OK
  console.log('✅ Conectividad OK, creando túnel...')
  
  // Iniciar cloudflared sin usar startProcess para capturar output
  if (!checkBinary('cloudflared')) {
    console.warn('Cloudflared binary not found')
    return null
  }
  
  shouldRestart['cloudflared'] = true
  
  const p = spawn(bin('cloudflared'), ['tunnel', '--url', 'http://localhost:8888'], {
    windowsHide: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Capturar la URL del túnel desde stderr (cloudflared imprime ahí)
  p.stderr?.on('data', (data) => {
    const output = data.toString()
    
    // Mostrar TODO el output para debugging
    console.log('[Cloudflared]', output.trim())
    
    // Detectar errores PRIMERO antes de buscar URLs
    if (output.includes('no such host') || output.includes('dial tcp')) {
      console.error('❌ Error de red: No se puede conectar a Cloudflare')
      console.error('   Verifica tu conexión a Internet y DNS')
      console.error('   Revisa CLOUDFLARED-TROUBLESHOOTING.md para soluciones')
      return // No continuar procesando
    }
    if (output.includes('failed to request')) {
      console.error('❌ Cloudflared no pudo crear el túnel')
      return // No continuar procesando
    }
    
    // Buscar la URL del túnel con regex específica
    // URLs válidas: https://xyz-abc-123.trycloudflare.com (con múltiples guiones)
    // Excluir: https://api.trycloudflare.com (solo "api", no es un túnel)
    const urlMatch = output.match(/https:\/\/(?!api\.)([a-z0-9]+-[a-z0-9]+-[a-z0-9]+)\.trycloudflare\.com/i)
    
    if (urlMatch && !tunnelUrl) {
      tunnelUrl = urlMatch[0]
      console.log('✅ Túnel público creado:', tunnelUrl)
      console.log('   Esperando 2 segundos antes de registrar...')
      
      // Dar tiempo a que MediaMTX esté listo antes de registrar
      setTimeout(() => {
        registerCameraOnServer()
      }, 2000)
    }
  })

  // Logs a archivo
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)
  const outStream = fs.createWriteStream(path.join(logDir, 'cloudflared-out.log'), { flags: 'a' })
  const errStream = fs.createWriteStream(path.join(logDir, 'cloudflared-err.log'), { flags: 'a' })
  
  if (p.stdout) p.stdout.pipe(outStream)
  if (p.stderr) p.stderr.pipe(errStream)

  p.on('exit', (code, signal) => {
    console.log(`cloudflared exited (${code}, ${signal})`)
    tunnelUrl = null // Reset URL al cerrar
    
    if (shouldRestart['cloudflared']) {
      console.log('Reiniciando cloudflared en 3s...')
      setTimeout(() => {
        if (shouldRestart['cloudflared']) {
          processes['cloudflared'] = startCloudflared()
        }
      }, 3000)
    }
  })

  processes['cloudflared'] = p
  return p
}

// Iniciar tunnel con nombre (requiere cuenta)
function startNamedTunnel() {
  if (processes['cloudflared']) return processes['cloudflared']
  
  if (!tunnelName || !tunnelId) {
    console.error('❌ No hay túnel configurado')
    return null
  }
  
  console.log(`🚀 Iniciando túnel con nombre: ${tunnelName}...`)
  
  if (!checkBinary('cloudflared')) {
    console.warn('Cloudflared binary not found')
    return null
  }
  
  shouldRestart['cloudflared'] = true
  
  // Con named tunnels, usar archivo de configuración
  const configPath = path.join(process.cwd(), 'cloudflared-config.yml')
  
  // Verificar que existe el archivo de configuración
  if (!fs.existsSync(configPath)) {
    console.error('❌ No se encuentra cloudflared-config.yml')
    console.error('   Crea el archivo o reconfigura el túnel')
    return null
  }
  
  // Generar URL fija usando hostname personalizado o tunnel ID
  if (tunnelHostname) {
    tunnelUrl = `https://${tunnelHostname}`
    console.log('🌐 URL del túnel (hostname personalizado):', tunnelUrl)
  } else {
    tunnelUrl = `https://${tunnelId}.cfargotunnel.com`
    console.log('🌐 URL del túnel (ID por defecto):', tunnelUrl)
    console.log('   💡 Configura un hostname personalizado para mejor accesibilidad')
  }
  
  // Comando: cloudflared tunnel --config <config-file> run
  const p = spawn(bin('cloudflared'), ['tunnel', '--config', configPath, 'run'], {
    windowsHide: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Capturar logs y detectar conexión exitosa
  let connected = false
  p.stderr?.on('data', (data) => {
    const output = data.toString()
    console.log('[Cloudflared]', output.trim())
    
    // Detectar cuando se registra la primera conexión
    if (!connected && output.includes('Registered tunnel connection')) {
      connected = true
      console.log('✅ Túnel conectado exitosamente')
      console.log('   URL pública (fija):', tunnelUrl)
      console.log('   Esperando 3 segundos antes de registrar...')
      
      // Dar tiempo a que todas las conexiones se establezcan
      setTimeout(() => {
        registerCameraOnServer()
      }, 3000)
    }
    
    // Detectar errores
    if (output.includes('not found') || output.includes('does not exist')) {
      console.error('❌ Túnel no encontrado en tu cuenta Cloudflare')
      console.error('   El túnel puede haber sido eliminado')
      console.error('   Crea uno nuevo desde la UI: Configurar Túnel')
    }
    if (output.includes('failed to authenticate')) {
      console.error('❌ Error de autenticación')
      console.error('   Vuelve a hacer login desde la UI')
    }
  })

  // Logs a archivo
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)
  const outStream = fs.createWriteStream(path.join(logDir, 'cloudflared-out.log'), { flags: 'a' })
  const errStream = fs.createWriteStream(path.join(logDir, 'cloudflared-err.log'), { flags: 'a' })
  
  if (p.stdout) p.stdout.pipe(outStream)
  if (p.stderr) p.stderr.pipe(errStream)

  p.on('exit', (code, signal) => {
    console.log(`cloudflared exited (${code}, ${signal})`)
    tunnelUrl = null
    
    if (shouldRestart['cloudflared']) {
      console.log('Reiniciando cloudflared en 3s...')
      setTimeout(() => {
        if (shouldRestart['cloudflared']) {
          processes['cloudflared'] = startNamedTunnel()
        }
      }, 3000)
    }
  })

  processes['cloudflared'] = p
  return p
}

async function startAll(withCloudflared = false) {
  console.log('🚀 Iniciando servicios en modo:', withCloudflared ? 'PRODUCCIÓN (con túnel)' : 'PRUEBA (sin túnel)')
  useCloudflared = withCloudflared
  
  await startMTX()
  await startFFmpeg()
  
  if (withCloudflared) {
    await startCloudflared()
  } else {
    console.log('⏭️  Cloudflared omitido (modo prueba)')
  }
}

function stopAll() {
  // Desactivar auto-reinicio primero
  for (const k of Object.keys(shouldRestart)) {
    shouldRestart[k] = false
  }
  
  // Luego matar procesos
  for (const k of Object.keys(processes)) {
    try {
      if (processes[k] && !processes[k].killed) {
        processes[k].kill('SIGTERM')
      }
    } catch (e) {
      console.error(`Error stopping ${k}:`, e.message)
    }
    delete processes[k]
  }
}

function setServerConfig(url) {
  if (url) serverUrl = url
  saveConfig()
  console.log(`⚙️  Configuración actualizada: servidor=${serverUrl}`)
  return { serverUrl }
}

function setLocationConfig(locId, locName) {
  if (locId) locationId = locId
  if (locName) locationName = locName
  saveConfig()
  console.log(`📍 Ubicación actualizada: ${locationName} (${locationId})`)
  return { locationId, locationName }
}

function setTunnelConfig(name, id, hostname) {
  if (name) tunnelName = name
  if (id) tunnelId = id
  if (hostname !== undefined) tunnelHostname = hostname
  
  // Actualizar archivo de configuración de cloudflared
  if (tunnelId) {
    updateCloudflaredConfig()
  }
  
  saveConfig()
  console.log(`🔧 Configuración del túnel actualizada:`)
  console.log(`   Nombre: ${tunnelName}`)
  console.log(`   ID: ${tunnelId}`)
  console.log(`   Hostname: ${tunnelHostname || '(no configurado)'}`)
  
  return { tunnelName, tunnelId, tunnelHostname }
}

function getLocationConfig() {
  return { locationId, locationName }
}

function getSystemStats() {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  
  // Calcular uso de CPU (promedio de todos los núcleos)
  let totalIdle = 0
  let totalTick = 0
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  })
  const idle = totalIdle / cpus.length
  const total = totalTick / cpus.length
  const usage = 100 - ~~(100 * idle / total)
  
  // Contar procesos activos
  const activeProcesses = Object.keys(processes).filter(k => processes[k] && !processes[k].killed).length
  
  return {
    cpu: {
      usage: usage,
      cores: cpus.length,
      model: cpus[0].model
    },
    memory: {
      total: Math.round(totalMem / 1024 / 1024),
      used: Math.round(usedMem / 1024 / 1024),
      free: Math.round(freeMem / 1024 / 1024),
      usagePercent: Math.round((usedMem / totalMem) * 100)
    },
    processes: {
      active: activeProcesses,
      mediamtx: processes['mediamtx'] && !processes['mediamtx'].killed,
      cloudflared: processes['cloudflared'] && !processes['cloudflared'].killed,
      ffmpegCount: Object.keys(processes).filter(k => k.startsWith('ffmpeg-')).length
    },
    cameras: {
      total: cameras.length,
      enabled: cameras.filter(c => c.enabled).length
    },
    uptime: Math.floor(process.uptime())
  }
}

function getTunnelUrl() {
  return tunnelUrl
}

function getServerUrl() {
  return serverUrl
}

function getTunnelConfig() {
  return { tunnelName, tunnelId, tunnelHostname }
}

// Cargar configuración al iniciar el módulo
loadConfig()
loadCameras()

// Cambiar DNS a Cloudflare automáticamente
async function changeDNSToCloudflare() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Cambiando DNS a Cloudflare (1.1.1.1)...')
    
    // Crear script temporal
    const scriptPath = path.join(process.cwd(), 'temp-change-dns.ps1')
    const scriptContent = `
# Obtener adaptador activo
$adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1

if (-not $adapter) {
    Write-Host "ERROR: No se encontro adaptador de red activo"
    exit 1
}

Write-Host "Adaptador encontrado: $($adapter.Name)"

# Cambiar DNS a Cloudflare
try {
    Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses "1.1.1.1","1.0.0.1"
    Write-Host "DNS configurado: 1.1.1.1, 1.0.0.1"
    
    # Limpiar cache DNS
    ipconfig /flushdns | Out-Null
    Write-Host "Cache DNS limpiada"
    Write-Host "SUCCESS"
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}
`
    
    try {
      fs.writeFileSync(scriptPath, scriptContent, 'utf8')
      console.log('📝 Script temporal creado:', scriptPath)
    } catch (err) {
      console.error('❌ Error al crear script:', err.message)
      reject({ success: false, error: 'No se pudo crear script temporal' })
      return
    }
    
    // Ejecutar script con privilegios elevados
    const powershellPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    
    const psProcess = spawn(powershellPath, [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `Start-Process -FilePath '${powershellPath}' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}' -Verb RunAs -Wait`
    ], {
      windowsHide: false,
      shell: false
    })
    
    let output = ''
    let errorOutput = ''
    
    psProcess.stdout?.on('data', (data) => {
      const text = data.toString()
      output += text
      console.log('[DNS]', text.trim())
    })
    
    psProcess.stderr?.on('data', (data) => {
      const text = data.toString()
      errorOutput += text
      console.error('[DNS Error]', text.trim())
    })
    
    psProcess.on('exit', (code) => {
      // Limpiar script temporal
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath)
          console.log('🗑️ Script temporal eliminado')
        }
      } catch (err) {
        console.warn('⚠️ No se pudo eliminar script temporal')
      }
      
      if (code === 0) {
        console.log('✅ DNS cambiado exitosamente a Cloudflare')
        resolve({ success: true, message: 'DNS cambiado a 1.1.1.1 (Cloudflare). Reinicia la aplicación.' })
      } else {
        console.error('❌ Error al cambiar DNS (código:', code, ')')
        reject({ success: false, error: 'Error al ejecutar el script. ¿Aceptaste los permisos de administrador?' })
      }
    })
    
    psProcess.on('error', (err) => {
      console.error('❌ Error al ejecutar PowerShell:', err.message)
      // Limpiar script temporal
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath)
        }
      } catch {}
      reject({ success: false, error: err.message })
    })
  })
}

// Obtener último error
function getLastError() {
  return lastError
}

// Limpiar caché DNS
async function flushDNSCache() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Limpiando caché DNS...')
    
    // Crear script temporal
    const scriptPath = path.join(process.cwd(), 'temp-flush-dns.ps1')
    const scriptContent = `
# Limpiar cache DNS
ipconfig /flushdns | Out-Null
Write-Host "Cache DNS limpiada con ipconfig"

# Reiniciar servicio DNS (requiere admin)
try {
    Restart-Service -Name Dnscache -Force
    Write-Host "Servicio DNS reiniciado"
    Write-Host "SUCCESS"
    exit 0
} catch {
    Write-Host "PARTIAL: Cache limpiada pero no se pudo reiniciar servicio (requiere admin)"
    Write-Host "SUCCESS"
    exit 0
}
`
    
    try {
      fs.writeFileSync(scriptPath, scriptContent, 'utf8')
    } catch (err) {
      console.error('❌ Error al crear script:', err.message)
      reject({ success: false, error: 'No se pudo crear script temporal' })
      return
    }
    
    // Ejecutar script con privilegios elevados
    const powershellPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    
    const psProcess = spawn(powershellPath, [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `Start-Process -FilePath '${powershellPath}' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}' -Verb RunAs -Wait`
    ], {
      windowsHide: false,
      shell: false
    })
    
    psProcess.on('exit', (code) => {
      // Limpiar script temporal
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath)
          console.log('🗑️ Script temporal eliminado')
        }
      } catch (err) {
        console.warn('⚠️ No se pudo eliminar script temporal')
      }
      
      if (code === 0) {
        console.log('✅ Caché DNS limpiada exitosamente')
        resolve({ success: true, message: 'Caché DNS limpiada. Prueba nuevamente la URL del túnel.' })
      } else {
        console.error('❌ Error al limpiar caché DNS (código:', code, ')')
        reject({ success: false, error: 'Error al ejecutar el script. ¿Aceptaste los permisos de administrador?' })
      }
    })
    
    psProcess.on('error', (err) => {
      console.error('❌ Error al ejecutar PowerShell:', err.message)
      // Limpiar script temporal
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath)
        }
      } catch {}
      reject({ success: false, error: err.message })
    })
  })
}

module.exports = { 
  startMTX, 
  startFFmpeg, 
  startCloudflared, 
  startAll, 
  stopAll,
  setServerConfig,
  getServerUrl,
  getTunnelUrl,
  getTunnelConfig,
  setTunnelConfig,
  getCameras,
  addCamera,
  updateCamera,
  deleteCamera,
  reconnectCamera,
  setLocationConfig,
  getLocationConfig,
  getSystemStats,
  cloudflaredLogin,
  cloudflaredCreateTunnel,
  cloudflaredListTunnels,
  cloudflaredRouteDNS,
  changeDNSToCloudflare,
  getLastError,
  flushDNSCache,
  // Auto-reconexión
  getReconnectStats,
  updateReconnectConfig,
  setEventCallback
}
