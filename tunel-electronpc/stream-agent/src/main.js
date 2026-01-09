// src/main.js
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron')
const path = require('path')
const { startAll, stopAll, setServerConfig, getServerUrl, getTunnelUrl, getTunnelConfig, setTunnelConfig, getCameras, addCamera, updateCamera, deleteCamera, reconnectCamera, setLocationConfig, getLocationConfig, getSystemStats, cloudflaredLogin, cloudflaredCreateTunnel, cloudflaredListTunnels, cloudflaredRouteDNS, changeDNSToCloudflare, getLastError, flushDNSCache, getReconnectStats, updateReconnectConfig, setEventCallback } = require('./processManager')
const fs = require('fs')

let mainWindow = null
let tray = null
let running = false
let syncInterval = null // Intervalo de sincronización

// Configurar callback para eventos de reconexión desde processManager
setEventCallback((channel, data) => {
  sendToRenderer(channel, data)
  
  // Filtrar notificaciones: NO mostrar las de MediaMTX (se reconecta solo)
  // Solo notificar cámaras (ffmpeg-*) y cloudflared que son más críticos
  const isMediaMTX = data.process === 'mediamtx'
  const isCriticalProcess = data.process?.startsWith('ffmpeg-') || data.process === 'cloudflared'
  
  // Notificaciones solo para procesos críticos
  if (!isMediaMTX && isCriticalProcess) {
    if (data.event === 'reconnecting') {
      showNotification('🔄 Reconectando', `${data.process}: Intento ${data.attempt}/${data.maxRetries}`)
    } else if (data.event === 'max-retries-reached') {
      showNotification('❌ Error de Conexión', `${data.process} falló múltiples veces`)
    } else if (data.event === 'started' && data.stats?.restarts > 0) {
      showNotification('✅ Reconectado', `${data.process} se reconectó exitosamente`)
    }
  }
})

// Función para enviar eventos al renderer
function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data)
  }
}

// Función para mostrar notificación del sistema
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
}

// Actualizar estado y notificar al renderer
function updateStatus(newRunning, notify = false) {
  const changed = running !== newRunning
  running = newRunning
  sendToRenderer('status-changed', { running })
  
  if (changed && notify) {
    if (running) {
      showNotification('Stream Agent', '✅ Servicios iniciados correctamente')
    } else {
      showNotification('Stream Agent', '⏹️ Servicios detenidos')
    }
  }
  
  updateTrayMenu()
}

// Crear icono para el tray (genera uno programáticamente si no existe archivo)
function createTrayIcon() {
  // Intentar cargar icono existente
  const iconPaths = [
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, 'icon.ico'),
    path.join(process.cwd(), 'icon.png'),
    path.join(process.cwd(), 'icon.ico')
  ]
  
  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath)
    }
  }
  
  // Crear icono programáticamente (16x16 verde/rojo según estado)
  const size = 16
  const canvas = Buffer.alloc(size * size * 4) // RGBA
  const color = running ? [0, 200, 0, 255] : [100, 100, 100, 255] // Verde o Gris
  
  for (let i = 0; i < size * size; i++) {
    // Crear un círculo
    const x = i % size - size / 2
    const y = Math.floor(i / size) - size / 2
    const inCircle = x * x + y * y < (size / 2 - 1) * (size / 2 - 1)
    
    if (inCircle) {
      canvas[i * 4] = color[0]     // R
      canvas[i * 4 + 1] = color[1] // G
      canvas[i * 4 + 2] = color[2] // B
      canvas[i * 4 + 3] = color[3] // A
    }
  }
  
  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false, // No mostrar hasta ready-to-show
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)
  
  // Mostrar cuando esté lista para evitar flash blanco
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Iniciar sincronización periódica
    startSyncInterval()
  })
  
  // Minimizar a la bandeja en vez de cerrar
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      
      // Mostrar notificación solo la primera vez
      if (!global.trayNotificationShown) {
        showNotification('Stream Agent', 'La aplicación sigue ejecutándose en segundo plano')
        global.trayNotificationShown = true
      }
    }
  })
  
  mainWindow.on('minimize', () => {
    // Opcionalmente minimizar a la bandeja
    // mainWindow.hide()
  })
}

// Actualizar menú del tray según estado
function updateTrayMenu() {
  if (!tray) return
  
  const menu = Menu.buildFromTemplate([
    { 
      label: running ? '🟢 Ejecutando' : '⚪ Detenido', 
      enabled: false 
    },
    { type: 'separator' },
    { 
      label: '📺 Abrir Panel', 
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    { 
      label: '▶️ Iniciar (Prueba)', 
      enabled: !running,
      click: async () => {
        await startServices(false)
      }
    },
    { 
      label: '🚀 Iniciar (Producción)', 
      enabled: !running,
      click: async () => {
        await startServices(true)
      }
    },
    { 
      label: '⏹️ Detener', 
      enabled: running,
      click: () => {
        stopAll()
        updateStatus(false, true)
      }
    },
    { type: 'separator' },
    { 
      label: '❌ Salir', 
      click: () => {
        app.isQuitting = true
        stopAll()
        if (syncInterval) clearInterval(syncInterval)
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(menu)
  tray.setToolTip(running ? 'Stream Agent - Ejecutando' : 'Stream Agent - Detenido')
}

function createTray() {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
  
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
  
  updateTrayMenu()
}

// Sincronización periódica de estado
function startSyncInterval() {
  if (syncInterval) clearInterval(syncInterval)
  
  syncInterval = setInterval(async () => {
    if (!mainWindow || !mainWindow.webContents) return
    
    try {
      // Sincronizar stats del sistema
      const stats = getSystemStats()
      sendToRenderer('system-stats-update', stats)
      
      // Sincronizar URL del túnel
      const tunnelUrl = getTunnelUrl()
      sendToRenderer('tunnel-url-update', tunnelUrl)
      
      // Sincronizar último error
      const lastError = getLastError()
      if (lastError) {
        sendToRenderer('error-update', lastError)
      }
    } catch (err) {
      console.error('Error en sincronización:', err)
    }
  }, 3000) // Cada 3 segundos
}

async function startServices(withCloudflared = false) {
  if (running) return
  try {
    await startAll(withCloudflared)
    updateStatus(true, true)
    sendToRenderer('services-started', { mode: withCloudflared ? 'production' : 'test' })
  } catch (err) {
    sendToRenderer('error-update', err.message)
    showNotification('Stream Agent - Error', err.message)
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Auto-inicio en login (configurable)
  if (process.env.NODE_ENV === 'production') {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true // Iniciar minimizado
    })
  }

  // Manejar activación en macOS
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (syncInterval) clearInterval(syncInterval)
  stopAll()
})

app.on('window-all-closed', () => {
  // No salir cuando se cierran todas las ventanas (seguir en tray)
  if (process.platform !== 'darwin') {
    // En Windows/Linux, mantener en la bandeja
  }
})

// IPC desde renderer
ipcMain.handle('start-services', async (event, mode) => {
  try {
    const withCloudflared = mode === 'production'
    await startServices(withCloudflared)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('stop-services', async () => {
  try {
    stopAll()
    updateStatus(false, true)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('get-status', () => {
  return { running }
})

ipcMain.handle('set-server-config', (event, { serverUrl }) => {
  try {
    const result = setServerConfig(serverUrl)
    return { ok: true, ...result }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('get-server-url', () => {
  try {
    return { ok: true, serverUrl: getServerUrl() }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('get-tunnel-url', () => {
  return getTunnelUrl()
})

ipcMain.handle('get-cameras', async () => {
  try {
    const cameras = getCameras()
    return { ok: true, cameras }
  } catch (err) {
    console.error('Error obteniendo cámaras:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('add-camera', async (event, camera) => {
  try {
    const newCamera = addCamera(camera)
    return { ok: true, camera: newCamera }
  } catch (err) {
    console.error('Error agregando cámara:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('update-camera', async (event, id, updates) => {
  try {
    const updatedCamera = updateCamera(id, updates)
    return { ok: true, camera: updatedCamera }
  } catch (err) {
    console.error('Error actualizando cámara:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('delete-camera', async (event, id) => {
  try {
    deleteCamera(id)
    return { ok: true }
  } catch (err) {
    console.error('Error eliminando cámara:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('reconnect-camera', async (event, id) => {
  try {
    const result = reconnectCamera(id)
    return result
  } catch (err) {
    console.error('Error reconectando cámara:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('set-location-config', async (event, config) => {
  try {
    setLocationConfig(config.locationId, config.locationName)
    return { ok: true }
  } catch (err) {
    console.error('Error configurando ubicación:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('get-location-config', async () => {
  try {
    const config = getLocationConfig()
    return { ok: true, config }
  } catch (err) {
    console.error('Error obteniendo configuración de ubicación:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('get-system-stats', async () => {
  try {
    const stats = getSystemStats()
    return { ok: true, stats }
  } catch (err) {
    console.error('Error obteniendo estadísticas del sistema:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('get-tunnel-config', async () => {
  try {
    const config = getTunnelConfig()
    return { ok: true, config }
  } catch (err) {
    console.error('Error obteniendo configuración del túnel:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('set-tunnel-config', async (event, name, id, hostname) => {
  try {
    const config = setTunnelConfig(name, id, hostname)
    return { ok: true, config }
  } catch (err) {
    console.error('Error actualizando configuración del túnel:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared-login', async () => {
  try {
    const result = await cloudflaredLogin()
    return result
  } catch (err) {
    console.error('Error en login de Cloudflare:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared-create-tunnel', async (event, name) => {
  try {
    const result = await cloudflaredCreateTunnel(name)
    return result
  } catch (err) {
    console.error('Error creando túnel:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared-list-tunnels', async () => {
  try {
    const result = await cloudflaredListTunnels()
    return result
  } catch (err) {
    console.error('Error listando túneles:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared-route-dns', async (event, tunnelName, hostname) => {
  try {
    const result = await cloudflaredRouteDNS(tunnelName, hostname)
    return result
  } catch (err) {
    console.error('Error configurando ruta DNS:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('change-dns-to-cloudflare', async () => {
  try {
    const result = await changeDNSToCloudflare()
    return result
  } catch (err) {
    console.error('Error cambiando DNS:', err)
    return { success: false, error: err.error || err.message }
  }
})

ipcMain.handle('get-last-error', () => {
  return { error: getLastError() }
})

ipcMain.handle('flush-dns-cache', async () => {
  try {
    const result = await flushDNSCache()
    return result
  } catch (err) {
    console.error('Error limpiando caché DNS:', err)
    return { success: false, error: err.error || err.message }
  }
})

// ============ IPC Handlers para Auto-Reconexión ============
ipcMain.handle('get-reconnect-stats', () => {
  try {
    const stats = getReconnectStats()
    return { ok: true, stats }
  } catch (err) {
    console.error('Error obteniendo estadísticas de reconexión:', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('update-reconnect-config', (event, config) => {
  try {
    const newConfig = updateReconnectConfig(config)
    return { ok: true, config: newConfig }
  } catch (err) {
    console.error('Error actualizando configuración de reconexión:', err)
    return { ok: false, error: err.message }
  }
})

// const { app, BrowserWindow } = require('electron');
// const path = require('node:path');

// // Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

// const createWindow = () => {
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 800,
//     height: 600,
//     webPreferences: {
//       preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
//     },
//   });

//   // and load the index.html of the app.
//   mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

//   // Open the DevTools.
//   mainWindow.webContents.openDevTools();
// };

// // This method will be called when Electron has finished
// // initialization and is ready to create browser windows.
// // Some APIs can only be used after this event occurs.
// app.whenReady().then(() => {
//   createWindow();

//   // On OS X it's common to re-create a window in the app when the
//   // dock icon is clicked and there are no other windows open.
//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {
//       createWindow();
//     }
//   });
// });

// // Quit when all windows are closed, except on macOS. There, it's common
// // for applications and their menu bar to stay active until the user quits
// // explicitly with Cmd + Q.
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });

// // In this file you can include the rest of your app's specific main process
// // code. You can also put them in separate files and import them here.
