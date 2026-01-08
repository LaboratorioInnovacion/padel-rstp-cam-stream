// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// src/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  startServices: (mode) => ipcRenderer.invoke('start-services', mode),
  stopServices: () => ipcRenderer.invoke('stop-services'),
  getStatus: () => ipcRenderer.invoke('get-status')
})
