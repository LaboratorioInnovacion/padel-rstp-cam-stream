// src/main.js
const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron')
const path = require('path')
const { startAll, stopAll } = require('./processManager')
const fs = require('fs')

let mainWindow = null
let tray = null
let running = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: true, // Mostrar ventana para desarrollo
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
  })
  
  mainWindow.on('close', (e) => {
    // En desarrollo, permitir cerrar. En producción, solo ocultar
    if (process.env.NODE_ENV === 'production') {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png') // pon un icon en src/
  
  // Verificar si el ícono existe antes de crear el tray
  if (!fs.existsSync(iconPath)) {
    console.warn('Icon not found:', iconPath, '- Tray will not be created')
    return
  }
  
  tray = new Tray(iconPath)
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir panel', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Iniciar servicios', click: () => startAll() },
    { label: 'Detener servicios', click: () => stopAll() },
    { type: 'separator' },
    { label: 'Salir', click: () => { stopAll(); app.exit(0) } }
  ])
  tray.setToolTip('Stream Agent')
  tray.setContextMenu(menu)
}

async function startServices(withCloudflared = false) {
  if (running) return
  running = true
  // start processes
  await startAll(withCloudflared)
}

app.whenReady().then(() => {
  createWindow()
  // createTray() // Comentado temporalmente hasta agregar un ícono

  // auto-start on login
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
  })

  // opcional: iniciar automáticamente
  // startAll()
})

app.on('before-quit', () => {
  stopAll()
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
    running = false
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('get-status', () => {
  return { running }
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
