import React, { useState, useEffect } from 'react'

export default function App() {
  const [status, setStatus] = useState('stopped')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(null)
  const [tunnelUrl, setTunnelUrl] = useState(null)
  const [serverUrl, setServerUrl] = useState('http://localhost:3100')
  const [showConfig, setShowConfig] = useState(false)
  const [cameras, setCameras] = useState([])
  const [showCameraForm, setShowCameraForm] = useState(false)
  const [editingCamera, setEditingCamera] = useState(null)
  const [newCamera, setNewCamera] = useState({ id: '', name: '', rtspUrl: '', enabled: true, quality: 'medium', encoding: 'copy' })
  const [locationId, setLocationId] = useState('default')
  const [locationName, setLocationName] = useState('Ubicación Principal')
  const [showLocationConfig, setShowLocationConfig] = useState(false)
  const [systemStats, setSystemStats] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showTunnelConfig, setShowTunnelConfig] = useState(false)
  const [tunnelName, setTunnelName] = useState('')
  const [tunnelId, setTunnelId] = useState(null)
  const [tunnelConfigStep, setTunnelConfigStep] = useState('info')
  const [tunnelHostname, setTunnelHostname] = useState('')
  const [activeTab, setActiveTab] = useState('control')
  const [showTooltip, setShowTooltip] = useState(null)

  // Verificar si window.api está disponible
  useEffect(() => {
    if (!window.api) {
      setError('API no disponible. El preload script no se cargó correctamente.')
      console.error('window.api is undefined. Check preload configuration.')
    } else {
      loadCameras()
      loadLocationConfig()
      loadServerUrl()
      loadTunnelConfig()
    }
  }, [])

  // Polling para obtener URL del túnel en modo producción
  useEffect(() => {
    if (mode === 'production' && status === 'running') {
      const interval = setInterval(async () => {
        if (window.api) {
          const result = await window.api.getTunnelUrl()
          if (result.tunnelUrl) {
            setTunnelUrl(result.tunnelUrl)
          }
          
          const errorResult = await window.api.getLastError()
          if (errorResult.error) {
            setError(errorResult.error)
          }
        }
      }, 2000)
      return () => clearInterval(interval)
    } else {
      setTunnelUrl(null)
    }
  }, [mode, status])

  // Polling para estadísticas del sistema
  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(async () => {
        if (window.api) {
          const result = await window.api.getSystemStats()
          if (result.ok) {
            setSystemStats(result.stats)
          }
        }
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [status])

  async function loadCameras() {
    if (!window.api) return
    try {
      const result = await window.api.getCameras()
      if (result.ok) setCameras(result.cameras)
    } catch (e) {
      console.error('Error cargando cámaras:', e)
    }
  }

  async function loadLocationConfig() {
    if (!window.api) return
    try {
      const result = await window.api.getLocationConfig()
      if (result.ok) {
        setLocationId(result.config.locationId)
        setLocationName(result.config.locationName)
      }
    } catch (e) {
      console.error('Error cargando configuración de ubicación:', e)
    }
  }

  async function loadServerUrl() {
    if (!window.api) return
    try {
      const result = await window.api.getServerUrl()
      if (result.ok && result.serverUrl) {
        setServerUrl(result.serverUrl)
      }
    } catch (e) {
      console.error('Error cargando URL del servidor:', e)
    }
  }

  async function loadTunnelConfig() {
    if (!window.api) return
    try {
      const result = await window.api.getTunnelConfig()
      if (result.ok && result.config) {
        setTunnelName(result.config.tunnelName || '')
        setTunnelId(result.config.tunnelId || null)
      }
    } catch (e) {
      console.error('Error cargando configuración del túnel:', e)
    }
  }

  async function handleCloudflaredLogin() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.cloudflaredLogin()
      if (result.ok) {
        setTunnelConfigStep('create')
      } else {
        setError(result.error || 'Error en login')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTunnel() {
    if (!tunnelName) {
      setError('Debes ingresar un nombre para el túnel')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.cloudflaredCreateTunnel(tunnelName)
      if (result.ok) {
        setTunnelId(result.id)
        
        if (tunnelHostname) {
          const dnsResult = await window.api.cloudflaredRouteDNS(tunnelName, tunnelHostname)
          if (dnsResult.ok) {
            setShowTunnelConfig(false)
            setTunnelConfigStep('info')
            await loadTunnelConfig()
            alert('✅ Túnel configurado exitosamente!\n\n' +
                  `Túnel: ${tunnelName}\n` +
                  `URL: https://${tunnelHostname}\n\n` +
                  'Reinicia los servicios en modo Producción para usar el túnel.')
          } else {
            setTunnelConfigStep('dns')
            setError('Túnel creado pero falló la configuración DNS automática.')
          }
        } else {
          setTunnelConfigStep('dns')
          await loadTunnelConfig()
        }
      } else {
        setError(result.error || 'Error creando túnel')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRouteDNS() {
    if (!tunnelHostname) {
      setError('Debes ingresar un hostname')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.cloudflaredRouteDNS(tunnelName, tunnelHostname)
      if (result.ok) {
        setShowTunnelConfig(false)
        setTunnelConfigStep('info')
        await loadTunnelConfig()
        alert('✅ Ruta DNS configurada exitosamente!')
      } else {
        setError(result.error || 'Error configurando ruta DNS')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveLocationConfig() {
    if (!window.api) return
    if (!locationId || !locationName) {
      setError('ID y Nombre de ubicación son obligatorios')
      return
    }
    
    setLoading(true)
    try {
      const result = await window.api.setLocationConfig({ locationId, locationName })
      if (result.ok) {
        setShowLocationConfig(false)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al guardar configuración de ubicación: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

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

  async function handleDeleteCamera(id) {
    if (!window.api) return
    if (!confirm(`¿Eliminar cámara ${id}?`)) return
    
    setLoading(true)
    try {
      const result = await window.api.deleteCamera(id)
      if (result.ok) {
        await loadCameras()
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error al eliminar cámara: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleCamera(id, enabled) {
    if (!window.api) return
    
    setLoading(true)
    try {
      const result = await window.api.updateCamera(id, { enabled })
      if (result.ok) {
        await loadCameras()
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

  async function saveConfig() {
    if (!window.api) return
    
    setLoading(true)
    try {
      await window.api.setServerConfig({ serverUrl })
      setShowConfig(false)
      setError(null)
    } catch (e) {
      setError('Error al guardar configuración: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function start(selectedMode) {
    if (!window.api) {
      setError('API no disponible')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.startServices(selectedMode)
      if (result.ok) {
        setStatus('running')
        setMode(selectedMode)
      } else {
        setError(result.error || 'Error desconocido')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function stop() {
    if (!window.api) {
      setError('API no disponible')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.stopServices()
      if (result.ok) {
        setStatus('stopped')
        setMode(null)
      } else {
        setError(result.error || 'Error desconocido')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6'}}>
      {/* Header Moderno */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h1 style={{margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px'}}>
              🎥 Stream Agent
            </h1>
            <div style={{fontSize: '13px', opacity: 0.9, marginTop: '5px'}}>
              Sistema de transmisión de cámaras RTSP a la nube
            </div>
          </div>
          <div style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{fontSize: '11px', opacity: 0.8}}>📍 Ubicación</div>
            <div style={{fontSize: '14px', fontWeight: '600', marginTop: '2px'}}>{locationName}</div>
          </div>
        </div>
      </div>

      <div style={{padding: '25px 30px', maxWidth: '1200px', margin: '0 auto'}}>
        {/* Estado del Sistema - Card Destacado */}
        <div style={{
          padding: '20px',
          marginBottom: '25px',
          borderRadius: '12px',
          backgroundColor: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
          border: `3px solid ${status === 'running' ? '#10b981' : '#ef4444'}`
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: status === 'running' ? '#d1fae5' : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                {status === 'running' ? '✅' : '⏸️'}
              </div>
              <div>
                <div style={{fontSize: '20px', fontWeight: '700', color: '#1f2937', marginBottom: '3px'}}>
                  {status === 'running' ? 'Sistema Activo' : 'Sistema Detenido'}
                </div>
                {mode && (
                  <div style={{fontSize: '14px', color: '#6b7280'}}>
                    {mode === 'test' ? '🧪 Modo Prueba - Solo local' : '🌐 Modo Producción - Transmitiendo'}
                  </div>
                )}
              </div>
            </div>
            {status === 'running' && (
              <button
                onClick={() => setShowStats(!showStats)}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: showStats ? '#667eea' : '#f3f4f6',
                  color: showStats ? 'white' : '#4b5563',
                  border: 'none',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  boxShadow: showStats ? '0 2px 4px rgba(102,126,234,0.3)' : 'none'
                }}
              >
                📊 {showStats ? 'Ocultar' : 'Ver'} Estadísticas
              </button>
            )}
          </div>
        </div>

        {/* Estadísticas del Sistema */}
        {showStats && systemStats && (
          <div style={{
            padding: '20px',
            marginBottom: '25px',
            borderRadius: '12px',
            backgroundColor: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#1f2937'}}>
              📊 Monitoreo del Sistema
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
              {/* CPU */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600'}}>
                  🖥️ CPU
                </div>
                <div style={{fontSize: '32px', fontWeight: '700', color: systemStats.cpu.usage > 80 ? '#ef4444' : '#10b981', marginBottom: '5px'}}>
                  {systemStats.cpu.usage}%
                </div>
                <div style={{fontSize: '11px', color: '#9ca3af'}}>
                  {systemStats.cpu.cores} núcleos disponibles
                </div>
                <div style={{
                  marginTop: '10px',
                  height: '6px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${systemStats.cpu.usage}%`,
                    height: '100%',
                    backgroundColor: systemStats.cpu.usage > 80 ? '#ef4444' : '#10b981',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* RAM */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600'}}>
                  💾 Memoria RAM
                </div>
                <div style={{fontSize: '32px', fontWeight: '700', color: systemStats.memory.usagePercent > 85 ? '#ef4444' : '#3b82f6', marginBottom: '5px'}}>
                  {systemStats.memory.usagePercent}%
                </div>
                <div style={{fontSize: '11px', color: '#9ca3af'}}>
                  {systemStats.memory.used} MB / {systemStats.memory.total} MB
                </div>
                <div style={{
                  marginTop: '10px',
                  height: '6px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${systemStats.memory.usagePercent}%`,
                    height: '100%',
                    backgroundColor: systemStats.memory.usagePercent > 85 ? '#ef4444' : '#3b82f6',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Procesos */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600'}}>
                  ⚙️ Procesos
                </div>
                <div style={{fontSize: '13px', marginTop: '10px'}}>
                  <div style={{marginBottom: '6px'}}>
                    {systemStats.processes.mediamtx ? '🟢' : '🔴'} MediaMTX
                  </div>
                  <div style={{marginBottom: '6px'}}>
                    {systemStats.processes.ffmpegCount > 0 ? '🟢' : '🔴'} FFmpeg ({systemStats.processes.ffmpegCount})
                  </div>
                  <div>
                    {systemStats.processes.cloudflared ? '🟢' : '🔴'} Cloudflared
                  </div>
                </div>
              </div>

              {/* Cámaras */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600'}}>
                  📹 Cámaras
                </div>
                <div style={{fontSize: '32px', fontWeight: '700', color: '#8b5cf6', marginBottom: '5px'}}>
                  {systemStats.cameras.enabled}/{systemStats.cameras.total}
                </div>
                <div style={{fontSize: '11px', color: '#9ca3af'}}>
                  activas / totales
                </div>
              </div>
            </div>
            <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '12px', color: '#92400e', textAlign: 'center'}}>
              ⏱️ Tiempo activo: {Math.floor(systemStats.uptime / 60)} minutos
            </div>
          </div>
        )}

        {/* URL Pública */}
        {tunnelUrl && mode === 'production' && (
          <div style={{
            padding: '20px',
            marginBottom: '25px',
            borderRadius: '12px',
            backgroundColor: '#ecfdf5',
            border: '2px solid #10b981',
            boxShadow: '0 4px 6px rgba(16,185,129,0.1)'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '15px'}}>
              <div style={{flex: 1}}>
                <div style={{fontSize: '14px', fontWeight: '700', color: '#065f46', marginBottom: '8px'}}>
                  🌐 URL Pública Activa
                </div>
                <div style={{fontSize: '15px', wordBreak: 'break-all', marginBottom: '8px'}}>
                  <a href={tunnelUrl} target="_blank" rel="noopener noreferrer" style={{color: '#059669', textDecoration: 'none', fontWeight: '600'}}>
                    {tunnelUrl}
                  </a>
                </div>
                {tunnelName && (
                  <div style={{fontSize: '12px', color: '#047857'}}>
                    Túnel: <strong>{tunnelName}</strong> {tunnelId && `(${tunnelId.substring(0, 8)}...)`}
                  </div>
                )}
              </div>
              <div style={{display: 'flex', gap: '8px', flexDirection: 'column'}}>
                <button
                  onClick={async () => {
                    if (!window.api) return
                    setLoading(true)
                    try {
                      const result = await window.api.flushDNSCache()
                      if (result.success) {
                        alert('✅ Caché DNS limpiada')
                      } else {
                        alert('❌ Error: ' + result.error)
                      }
                    } catch (err) {
                      alert('❌ Error: ' + err.message)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  style={{
                    padding: '8px 15px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {loading ? '⏳' : '🔄'} Limpiar DNS
                </button>
                <button
                  onClick={() => {
                    setShowTunnelConfig(true)
                    setTunnelConfigStep('dns')
                  }}
                  disabled={loading || !tunnelName}
                  style={{
                    padding: '8px 15px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: loading || !tunnelName ? 'not-allowed' : 'pointer',
                    opacity: loading || !tunnelName ? 0.6 : 1,
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ⚙️ Config DNS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '15px 20px',
            marginBottom: '25px',
            borderRadius: '12px',
            backgroundColor: '#fef2f2',
            border: '2px solid #fca5a5',
            color: '#991b1b'
          }}>
            <div style={{fontWeight: '700', marginBottom: '5px'}}>⚠️ Error</div>
            <div style={{fontSize: '13px'}}>{error}</div>
            {error.includes('ENOTFOUND') && error.includes('cloudflare') && (
              <button
                onClick={async () => {
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
                }}
                disabled={loading}
                style={{
                  marginTop: '10px',
                  padding: '8px 15px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px'
                }}
              >
                {loading ? '⏳ Cambiando...' : '🔧 Cambiar DNS a Cloudflare'}
              </button>
            )}
          </div>
        )}

       {/* CONTINÚA EN EL SIGUIENTE MENSAJE POR LÍMITE DE CARACTERES */}
      </div>
    </div>
  )
}
