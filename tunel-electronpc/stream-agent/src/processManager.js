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

let processes = {}
let shouldRestart = {} // Control de auto-reinicio
let useCloudflared = false // Modo: false = prueba (sin cloudflared), true = producción

function bin(name) {
  // cross-platform: en Windows suele necesitar .exe
  const platform = process.platform
  const exe = platform === 'win32' ? `${name}.exe` : name
  return path.join(binDir, exe)
}

function checkBinary(name) {
  const binPath = bin(name)
  if (!fs.existsSync(binPath)) {
    console.warn(`Binary not found: ${binPath}`)
    return false
  }
  return true
}

function startProcess(name, args = [], options = {}) {
  if (!checkBinary(name)) {
    console.warn(`Skipping ${name} - binary not found`)
    return null // Retornar null si el binario no existe
  }
  
  shouldRestart[name] = true // Activar auto-reinicio
  
  const p = spawn(bin(name), args, {
    windowsHide: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  })

  // logs
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)
  const outStream = fs.createWriteStream(path.join(logDir, `${name}-out.log`), { flags: 'a' })
  const errStream = fs.createWriteStream(path.join(logDir, `${name}-err.log`), { flags: 'a' })

  if (p.stdout) p.stdout.pipe(outStream)
  if (p.stderr) p.stderr.pipe(errStream)

  // watchdog: revivir si muere (solo si shouldRestart está activo)
  p.on('exit', (code, signal) => {
    console.log(`${name} exited (${code}, ${signal})`)
    
    if (shouldRestart[name]) {
      console.log(`Reiniciando ${name} en 3s...`)
      setTimeout(() => {
        if (shouldRestart[name]) { // Verificar nuevamente antes de reiniciar
          processes[name] = startProcess(name, args, options)
        }
      }, 3000)
    }
  })

  return p
}

async function startMTX() {
  // mediamtx sin args (asume config en config/mediamtx.yml)
  if (processes['mediamtx']) return processes['mediamtx']
  const proc = startProcess('mediamtx', [])
  if (proc) processes['mediamtx'] = proc
  return proc
}

async function startFFmpeg() {
  if (processes['ffmpeg']) return processes['ffmpeg']
  // Ejemplo: RTSP ingest desde cámara local a mediamtx
  const args = [
    '-rtsp_transport', 'tcp',
    // '-i', 'rtsp://user:pass@192.168.1.100:554/stream',
    '-i', 'rtsp://asd:asd@192.168.1.240:1945',
    '-c', 'copy',
    '-f', 'rtsp',
    'rtsp://localhost:8554/cam1'
  ]
  const proc = startProcess('ffmpeg', args)
  if (proc) processes['ffmpeg'] = proc
  return proc
}

async function startCloudflared() {
  if (processes['cloudflared']) return processes['cloudflared']
  // Quick tunnel to local HLS server (puerto 8888) por ejemplo:
  const args = ['tunnel', '--url', 'http://localhost:8888']
  const proc = startProcess('cloudflared', args)
  if (proc) processes['cloudflared'] = proc
  return proc
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

module.exports = { startMTX, startFFmpeg, startCloudflared, startAll, stopAll }
