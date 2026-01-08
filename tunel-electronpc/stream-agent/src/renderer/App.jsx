import React, { useState, useEffect } from 'react'

export default function App() {
  const [status, setStatus] = useState('stopped')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(null)

  // Verificar si window.api está disponible
  useEffect(() => {
    if (!window.api) {
      setError('API no disponible. El preload script no se cargó correctamente.')
      console.error('window.api is undefined. Check preload configuration.')
    }
  }, [])

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
    <div style={{padding: 20, fontFamily: 'Arial, sans-serif'}}>
      <h1>🎥 Stream Agent</h1>
      
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        borderRadius: '5px',
        backgroundColor: status === 'running' ? '#d4edda' : '#f8d7da',
        border: `1px solid ${status === 'running' ? '#c3e6cb' : '#f5c6cb'}`
      }}>
        <strong>Estado:</strong> {status === 'running' ? '🟢 Ejecutando' : '🔴 Detenido'}
        {mode && <div style={{marginTop: '5px', fontSize: '12px'}}>
          <strong>Modo:</strong> {mode === 'test' ? '🧪 Prueba (sin túnel)' : '🌐 Producción (con túnel)'}
        </div>}
      </div>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '5px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          color: '#856404'
        }}>
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      <div style={{marginBottom: '20px'}}>
        <h3 style={{fontSize: '16px', marginBottom: '10px'}}>Seleccionar modo:</h3>
        <button 
          onClick={() => start('test')} 
          disabled={loading || status === 'running'}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            fontSize: '14px',
            cursor: loading || status === 'running' ? 'not-allowed' : 'pointer',
            opacity: loading || status === 'running' ? 0.6 : 1,
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {loading ? '⏳ Cargando...' : '🧪 Modo Prueba'}
        </button>
        
        <button 
          onClick={() => start('production')} 
          disabled={loading || status === 'running'}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            fontSize: '14px',
            cursor: loading || status === 'running' ? 'not-allowed' : 'pointer',
            opacity: loading || status === 'running' ? 0.6 : 1,
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {loading ? '⏳ Cargando...' : '🌐 Modo Producción'}
        </button>
        
        <button 
          onClick={stop} 
          disabled={loading || status === 'stopped'}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            cursor: loading || status === 'stopped' ? 'not-allowed' : 'pointer',
            opacity: loading || status === 'stopped' ? 0.6 : 1,
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {loading ? '⏳ Cargando...' : '⏹️ Detener servicios'}
        </button>
      </div>

      <div style={{marginTop: '30px', fontSize: '12px', color: '#666'}}>
        <p><strong>Servicios gestionados:</strong></p>
        <ul>
          <li><strong>MediaMTX</strong> - Servidor de streaming RTSP/HLS</li>
          <li><strong>FFmpeg</strong> - Captura y recodificación de video</li>
          <li><strong>Cloudflared</strong> - Túnel público seguro (solo en modo producción)</li>
        </ul>
        <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px'}}>
          <p style={{margin: '0 0 5px 0'}}><strong>💡 Modos:</strong></p>
          <p style={{margin: '5px 0'}}><strong>🧪 Prueba:</strong> Solo MediaMTX + FFmpeg (para desarrollo local)</p>
          <p style={{margin: '5px 0'}}><strong>🌐 Producción:</strong> Todos los servicios + túnel público</p>
        </div>
      </div>
    </div>
  )
}
