// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// src/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Acciones
  startServices: (mode) => ipcRenderer.invoke('start-services', mode),
  stopServices: () => ipcRenderer.invoke('stop-services'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  setServerConfig: (config) => ipcRenderer.invoke('set-server-config', config),
  getServerConfig: () => ipcRenderer.invoke('get-server-config'),
  getTunnelStatus: () => ipcRenderer.invoke('get-tunnel-status'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getTunnelUrl: () => ipcRenderer.invoke('get-tunnel-url'),
  getTunnelConfig: () => ipcRenderer.invoke('get-tunnel-config'),
  setTunnelConfig: (name, id, hostname) => ipcRenderer.invoke('set-tunnel-config', name, id, hostname),
  getCameras: () => ipcRenderer.invoke('get-cameras'),
  addCamera: (camera) => ipcRenderer.invoke('add-camera', camera),
  updateCamera: (id, updates) => ipcRenderer.invoke('update-camera', id, updates),
  deleteCamera: (id) => ipcRenderer.invoke('delete-camera', id),
  reconnectCamera: (id) => ipcRenderer.invoke('reconnect-camera', id),
  setLocationConfig: (config) => ipcRenderer.invoke('set-location-config', config),
  getLocationConfig: () => ipcRenderer.invoke('get-location-config'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  cloudflaredLogin: () => ipcRenderer.invoke('cloudflared-login'),
  cloudflaredCreateTunnel: (name) => ipcRenderer.invoke('cloudflared-create-tunnel', name),
  cloudflaredListTunnels: () => ipcRenderer.invoke('cloudflared-list-tunnels'),
  cloudflaredRouteDNS: (tunnelName, hostname) => ipcRenderer.invoke('cloudflared-route-dns', tunnelName, hostname),
  changeDNSToCloudflare: () => ipcRenderer.invoke('change-dns-to-cloudflare'),
  getLastError: () => ipcRenderer.invoke('get-last-error'),
  flushDNSCache: () => ipcRenderer.invoke('flush-dns-cache'),
  
  // Auto-reconexión
  getReconnectStats: () => ipcRenderer.invoke('get-reconnect-stats'),
  updateReconnectConfig: (config) => ipcRenderer.invoke('update-reconnect-config', config),
  
  // Listeners para eventos push (sincronización en tiempo real)
  onStatusChanged: (callback) => {
    ipcRenderer.on('status-changed', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('status-changed')
  },
  onSystemStatsUpdate: (callback) => {
    ipcRenderer.on('system-stats-update', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('system-stats-update')
  },
  onTunnelUrlUpdate: (callback) => {
    ipcRenderer.on('tunnel-url-update', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('tunnel-url-update')
  },
  onErrorUpdate: (callback) => {
    ipcRenderer.on('error-update', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('error-update')
  },
  onServicesStarted: (callback) => {
    ipcRenderer.on('services-started', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('services-started')
  },
  // Evento de reconexión
  onReconnectEvent: (callback) => {
    ipcRenderer.on('reconnect-event', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('reconnect-event')
  }
})
