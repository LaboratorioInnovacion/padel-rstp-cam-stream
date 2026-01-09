import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import StatusCard from './components/StatusCard'
import StatisticsPanel from './components/StatisticsPanel'
import PublicURLPanel from './components/PublicURLPanel'
import ErrorBanner from './components/ErrorBanner'
import ControlButtons from './components/ControlButtons'
import CameraList from './components/CameraList'
import ReconnectStatus from './components/ReconnectStatus'
import './styles/globals.css'

export default function App() {
  // Estados principales
  const [status, setStatus] = useState('stopped')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(null)
  
  // Estados de configuración
  const [serverUrl, setServerUrl] = useState('http://localhost:3100')
  const [locationId, setLocationId] = useState('default')
  const [locationName, setLocationName] = useState('Ubicación Principal')
  
  // Estados de túnel
  const [tunnelUrl, setTunnelUrl] = useState(null)
  const [tunnelName, setTunnelName] = useState('')
  const [tunnelId, setTunnelId] = useState(null)
  const [tunnelHostname, setTunnelHostname] = useState('')
  
  // Estados de cámaras
  const [cameras, setCameras] = useState([])
  const [newCamera, setNewCamera] = useState({
    id: '', name: '', rtspUrl: '', enabled: true, quality: 'medium', encoding: 'copy'
  })
  const [editingCamera, setEditingCamera] = useState(null)
  
  // Estados de UI
  const [systemStats, setSystemStats] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showLocationConfig, setShowLocationConfig] = useState(false)
  const [showCameraForm, setShowCameraForm] = useState(false)
  const [showTunnelConfig, setShowTunnelConfig] = useState(false)
  const [tunnelConfigStep, setTunnelConfigStep] = useState('info')
  
  // Estados de auto-reconexión
  const [reconnectStats, setReconnectStats] = useState(null)
  const [showReconnectConfig, setShowReconnectConfig] = useState(false)

  // Inicialización
  useEffect(() => {
    if (!window.api) {
      setError('API no disponible. El preload script no se cargó correctamente.')
      return
    }
    loadCameras()
    loadLocationConfig()
    loadServerUrl()
    loadTunnelConfig()
    loadReconnectStats()
    
    // Suscribirse a eventos push para sincronización en tiempo real
    const unsubStatus = window.api.onStatusChanged?.((data) => {
      setStatus(data.running ? 'running' : 'stopped')
    })
    
    const unsubStats = window.api.onSystemStatsUpdate?.((stats) => {
      if (stats) setSystemStats(stats)
    })
    
    const unsubTunnel = window.api.onTunnelUrlUpdate?.((url) => {
      if (url) setTunnelUrl(url)
    })
    
    const unsubError = window.api.onErrorUpdate?.((error) => {
      if (error) setError(error)
    })
    
    const unsubStarted = window.api.onServicesStarted?.((data) => {
      setMode(data.mode)
      setStatus('running')
    })
    
    // Suscribirse a eventos de reconexión
    const unsubReconnect = window.api.onReconnectEvent?.((data) => {
      console.log('Evento de reconexión:', data)
      loadReconnectStats() // Recargar estadísticas cuando hay un evento
      
      // Mostrar error si hay fallo máximo
      if (data.event === 'max-retries-reached') {
        setError(`${data.process}: ${data.message}`)
      }
    })
    
    // Cleanup al desmontar
    return () => {
      unsubStatus?.()
      unsubStats?.()
      unsubTunnel?.()
      unsubError?.()
      unsubStarted?.()
      unsubReconnect?.()
    }
  }, [])

  // Polling para estadísticas de reconexión
  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(loadReconnectStats, 5000)
      return () => clearInterval(interval)
    }
  }, [status])

  // Polling backup para URL del túnel (por si los eventos fallan)
  useEffect(() => {
    if (mode === 'production' && status === 'running') {
      const interval = setInterval(async () => {
        if (window.api) {
          const url = await window.api.getTunnelUrl()
          if (url) setTunnelUrl(url)
        }
      }, 5000) // Menos frecuente ya que tenemos push
      return () => clearInterval(interval)
    }
  }, [mode, status])

  // Polling backup para estadísticas (solo si está mostrando)
  useEffect(() => {
    if (status === 'running' && showStats) {
      const interval = setInterval(async () => {
        if (window.api) {
          const result = await window.api.getSystemStats()
          if (result.ok) setSystemStats(result.stats)
        }
      }, 5000) // Menos frecuente
      return () => clearInterval(interval)
    }
  }, [status, showStats])

  // Funciones de carga
  async function loadCameras() {
    if (!window.api) return
    try {
      const result = await window.api.getCameras()
      if (result.ok) setCameras(result.cameras)
    } catch (e) {
      console.error('Error loading cameras:', e)
    }
  }

  async function loadReconnectStats() {
    if (!window.api) return
    try {
      const result = await window.api.getReconnectStats()
      if (result.ok) setReconnectStats(result.stats)
    } catch (e) {
      console.error('Error loading reconnect stats:', e)
    }
  }

  async function handleUpdateReconnectConfig(newConfig) {
    if (!window.api) return
    try {
      const result = await window.api.updateReconnectConfig(newConfig)
      if (result.ok) {
        setReconnectStats(prev => prev ? { ...prev, config: result.config } : prev)
      }
    } catch (e) {
      console.error('Error updating reconnect config:', e)
    }
  }

  async function loadLocationConfig() {
    if (!window.api) return
    try {
      const result = await window.api.getLocationConfig()
      if (result.ok) {
        setLocationId(result.locationId)
        setLocationName(result.locationName)
      }
    } catch (e) {
      console.error('Error loading location:', e)
    }
  }

  async function loadServerUrl() {
    if (!window.api) return
    try {
      const config = await window.api.getServerConfig()
      if (config && config.serverUrl) setServerUrl(config.serverUrl)
    } catch (e) {
      console.error('Error loading server URL:', e)
    }
  }

  async function loadTunnelConfig() {
    if (!window.api) return
    try {
      const config = await window.api.getTunnelConfig()
      if (config) {
        if (config.tunnelName) setTunnelName(config.tunnelName)
        if (config.tunnelId) setTunnelId(config.tunnelId)
        if (config.tunnelHostname) setTunnelHostname(config.tunnelHostname)
      }
    } catch (e) {
      console.error('Error loading tunnel config:', e)
    }
  }

  // Funciones de control
  async function start(selectedMode) {
    if (!window.api) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.startServices(selectedMode)
      if (result.ok) {
        setStatus('running')
        setMode(selectedMode)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al iniciar servicios: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function stop() {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.stopServices()
      if (result.ok) {
        setStatus('stopped')
        setMode(null)
        setTunnelUrl(null)
        setSystemStats(null)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al detener servicios: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Funciones de cámaras
  async function handleToggleCamera(id, enabled) {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.updateCamera(id, { enabled })
      if (result.ok) await loadCameras()
      else setError(result.error)
    } catch (e) {
      setError('Error al actualizar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCamera(id) {
    if (!window.api || !confirm(`¿Eliminar cámara ${id}?`)) return
    setLoading(true)
    try {
      const result = await window.api.deleteCamera(id)
      if (result.ok) await loadCameras()
      else setError(result.error)
    } catch (e) {
      setError('Error al eliminar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReconnectCamera(id) {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.reconnectCamera(id)
      if (result.ok) {
        // Recargar estadísticas después de un momento
        setTimeout(loadReconnectStats, 1000)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al reconectar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Funciones de DNS
  async function handleFlushDNS() {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.flushDNSCache()
      if (result.success) alert('✅ Caché DNS limpiada')
      else alert('❌ Error: ' + result.error)
    } catch (err) {
      alert('❌ Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeDNS() {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.changeDNSToCloudflare()
      if (result.success) {
        alert('✅ DNS cambiado a Cloudflare')
        setError(null)
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (err) {
      alert('❌ Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleConfigDNS() {
    setShowTunnelConfig(true)
    setTunnelConfigStep('dns')
  }

  // Funciones de cámaras - agregar y editar
  async function handleAddCamera() {
    if (!window.api) return
    if (!newCamera.id || !newCamera.rtspUrl) {
      setError('ID y URL RTSP son obligatorios')
      return
    }
    setLoading(true)
    try {
      const result = await window.api.addCamera(newCamera)
      if (result.ok) {
        await loadCameras()
        setNewCamera({ id: '', name: '', rtspUrl: '', enabled: true, quality: 'medium', encoding: 'copy' })
        setShowCameraForm(false)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al agregar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateCamera() {
    if (!window.api || !editingCamera) return
    setLoading(true)
    try {
      const result = await window.api.updateCamera(editingCamera.id, editingCamera)
      if (result.ok) {
        await loadCameras()
        setEditingCamera(null)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al actualizar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header locationName={locationName} />
      
      <div className="max-w-7xl mx-auto px-8 py-6">
        <StatusCard 
          status={status} 
          mode={mode} 
          showStats={showStats} 
          setShowStats={setShowStats} 
        />
        
        {showStats && systemStats && (
          <StatisticsPanel systemStats={systemStats} />
        )}
        
        {tunnelUrl && mode === 'production' && (
          <PublicURLPanel
            tunnelUrl={tunnelUrl}
            tunnelName={tunnelName}
            tunnelId={tunnelId}
            loading={loading}
            onFlushDNS={handleFlushDNS}
            onConfigDNS={handleConfigDNS}
          />
        )}
        
        <ErrorBanner 
          error={error} 
          onChangeDNS={handleChangeDNS} 
          loading={loading} 
        />
        
        <ControlButtons
          status={status}
          loading={loading}
          onStart={start}
          onStop={stop}
          onConfigLocation={() => setShowLocationConfig(true)}
          onConfigTunnel={() => setShowTunnelConfig(true)}
          onConfigServer={() => setShowConfig(true)}
        />
        
        {/* Panel de Auto-Reconexión */}
        {status === 'running' && (
          <ReconnectStatus
            reconnectStats={reconnectStats}
            showConfig={showReconnectConfig}
            onToggleConfig={() => setShowReconnectConfig(!showReconnectConfig)}
            onUpdateConfig={handleUpdateReconnectConfig}
            loading={loading}
          />
        )}
        
        <CameraList
          cameras={cameras}
          loading={loading}
          onToggle={handleToggleCamera}
          onEdit={(cam) => setEditingCamera(cam)}
          onDelete={handleDeleteCamera}
          onAddNew={() => setShowCameraForm(true)}
          onReconnect={handleReconnectCamera}
          reconnectStats={reconnectStats}
        />
        
        {/* TODO: Agregar modales de configuración aquí */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">🔧 Configuración del Servidor</h3>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfig(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (window.api) {
                      await window.api.setServerConfig({ serverUrl })
                      setShowConfig(false)
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Ubicación */}
        {showLocationConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">📍 Configuración de Ubicación</h3>
              <p className="text-sm text-gray-600 mb-4">
                Define un identificador único y nombre para esta ubicación. Se usará para registrar las cámaras en el servidor.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID de Ubicación</label>
                  <input
                    type="text"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    placeholder="ej: sucursal-norte"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Ubicación</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="ej: Sucursal Norte"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowLocationConfig(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (window.api && locationId && locationName) {
                      const result = await window.api.setLocationConfig({ locationId, locationName })
                      if (result.ok) {
                        setShowLocationConfig(false)
                        setError(null)
                      } else {
                        setError(result.error)
                      }
                    }
                  }}
                  disabled={!locationId || !locationName}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Túnel */}
        {showTunnelConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">🔒 Configuración del Túnel Cloudflare</h3>
              
              {/* Info del túnel actual */}
              {tunnelName && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-800">✅ Túnel Configurado</div>
                  <div className="text-xs text-green-700 mt-1">
                    <div>Nombre: <strong>{tunnelName}</strong></div>
                    {tunnelId && <div>ID: {tunnelId.substring(0, 8)}...</div>}
                    {tunnelHostname && <div>Hostname: <strong>{tunnelHostname}</strong></div>}
                  </div>
                </div>
              )}

              {/* Pasos de configuración */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Paso 1: Login en Cloudflare</h4>
                  <p className="text-xs text-gray-600 mb-3">Autentícate con tu cuenta de Cloudflare</p>
                  <button
                    onClick={async () => {
                      if (window.api) {
                        setLoading(true)
                        const result = await window.api.cloudflaredLogin()
                        setLoading(false)
                        if (result.ok) {
                          alert('✅ Login exitoso!')
                        } else {
                          setError(result.error)
                        }
                      }
                    }}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    {loading ? '⏳...' : '🔐 Iniciar Login'}
                  </button>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Paso 2: Crear/Usar Túnel</h4>
                  <p className="text-xs text-gray-600 mb-3">Crea un nuevo túnel o usa uno existente</p>
                  <input
                    type="text"
                    value={tunnelName}
                    onChange={(e) => setTunnelName(e.target.value)}
                    placeholder="Nombre del túnel (ej: mi-stream)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2"
                  />
                  <input
                    type="text"
                    value={tunnelHostname}
                    onChange={(e) => setTunnelHostname(e.target.value)}
                    placeholder="Hostname (ej: stream.midominio.com)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3"
                  />
                  <button
                    onClick={async () => {
                      if (window.api && tunnelName) {
                        setLoading(true)
                        const result = await window.api.cloudflaredCreate(tunnelName, tunnelHostname)
                        setLoading(false)
                        if (result.ok) {
                          setTunnelId(result.tunnelId)
                          await loadTunnelConfig()
                          alert(`✅ Túnel "${tunnelName}" creado!\nID: ${result.tunnelId}`)
                        } else {
                          setError(result.error)
                        }
                      }
                    }}
                    disabled={loading || !tunnelName}
                    className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? '⏳...' : '➕ Crear Túnel'}
                  </button>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Paso 3: Configurar DNS</h4>
                  <p className="text-xs text-gray-600 mb-3">Vincula el túnel a tu dominio</p>
                  <button
                    onClick={async () => {
                      if (window.api && tunnelName && tunnelHostname) {
                        setLoading(true)
                        const result = await window.api.cloudflaredRouteDNS(tunnelName, tunnelHostname)
                        setLoading(false)
                        if (result.ok) {
                          alert(`✅ DNS configurado!\nURL: https://${tunnelHostname}`)
                        } else {
                          setError(result.error)
                        }
                      }
                    }}
                    disabled={loading || !tunnelName || !tunnelHostname}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '⏳...' : '🌐 Configurar DNS'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowTunnelConfig(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Agregar Cámara */}
        {showCameraForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">➕ Agregar Cámara</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID *</label>
                  <input
                    type="text"
                    value={newCamera.id}
                    onChange={(e) => setNewCamera({...newCamera, id: e.target.value})}
                    placeholder="cam1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={newCamera.name}
                    onChange={(e) => setNewCamera({...newCamera, name: e.target.value})}
                    placeholder="Cámara Principal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL RTSP *</label>
                  <input
                    type="text"
                    value={newCamera.rtspUrl}
                    onChange={(e) => setNewCamera({...newCamera, rtspUrl: e.target.value})}
                    placeholder="rtsp://usuario:pass@192.168.1.100:554/stream1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calidad</label>
                    <select
                      value={newCamera.quality}
                      onChange={(e) => setNewCamera({...newCamera, quality: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codificación</label>
                    <select
                      value={newCamera.encoding}
                      onChange={(e) => setNewCamera({...newCamera, encoding: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="copy">Copy (más rápido)</option>
                      <option value="h264">H.264</option>
                      <option value="h265">H.265</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={newCamera.enabled}
                    onChange={(e) => setNewCamera({...newCamera, enabled: e.target.checked})}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="enabled" className="text-sm text-gray-700">Habilitar cámara</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => {
                    setShowCameraForm(false)
                    setNewCamera({ id: '', name: '', rtspUrl: '', enabled: true, quality: 'medium', encoding: 'copy' })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddCamera}
                  disabled={loading || !newCamera.id || !newCamera.rtspUrl}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? '⏳ Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Cámara */}
        {editingCamera && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">✏️ Editar Cámara: {editingCamera.id}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editingCamera.name || ''}
                    onChange={(e) => setEditingCamera({...editingCamera, name: e.target.value})}
                    placeholder="Cámara Principal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL RTSP</label>
                  <input
                    type="text"
                    value={editingCamera.rtspUrl || ''}
                    onChange={(e) => setEditingCamera({...editingCamera, rtspUrl: e.target.value})}
                    placeholder="rtsp://usuario:pass@192.168.1.100:554/stream1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calidad</label>
                    <select
                      value={editingCamera.quality || 'medium'}
                      onChange={(e) => setEditingCamera({...editingCamera, quality: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codificación</label>
                    <select
                      value={editingCamera.encoding || 'copy'}
                      onChange={(e) => setEditingCamera({...editingCamera, encoding: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="copy">Copy (más rápido)</option>
                      <option value="h264">H.264</option>
                      <option value="h265">H.265</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editEnabled"
                    checked={editingCamera.enabled !== false}
                    onChange={(e) => setEditingCamera({...editingCamera, enabled: e.target.checked})}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="editEnabled" className="text-sm text-gray-700">Habilitar cámara</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setEditingCamera(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateCamera}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? '⏳ Guardando...' : '💾 Actualizar'}
                </button>
              </div>
            </div>
          </div>
        )}      </div>
    </div>
  )
}