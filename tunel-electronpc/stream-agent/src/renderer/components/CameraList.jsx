import React from 'react'

function CameraItem({ camera, onToggle, onEdit, onDelete, onReconnect, loading, reconnectStats, tunnelUrl }) {
  // Obtener estado de reconexión para esta cámara
  const processKey = `ffmpeg-${camera.id}`
  const stats = reconnectStats?.processes?.[processKey]
  const isReconnecting = stats?.status === 'reconnecting'
  const hasFailed = stats?.status === 'failed'
  
  // Construir URL pública de la cámara
  const publicUrl = tunnelUrl ? `${tunnelUrl}/${camera.id}/` : null
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Mostrar feedback visual temporal
        const button = event.target
        const originalText = button.textContent
        button.textContent = '✓'
        setTimeout(() => {
          button.textContent = originalText
        }, 1000)
      })
      .catch(err => console.error('Error al copiar:', err))
  }
  
  return (
    <div className={`p-4 bg-white border rounded-lg hover:shadow-md transition-shadow ${
      hasFailed ? 'border-red-300 bg-red-50' : 
      isReconnecting ? 'border-yellow-300 bg-yellow-50' : 
      'border-gray-200'
    }`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">
              {hasFailed ? '🔴' : isReconnecting ? '🟡' : camera.enabled ? '🟢' : '⚪'}
            </span>
            <span className="font-semibold text-gray-800">{camera.name || camera.id}</span>
            {isReconnecting && (
              <span className="px-2 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded-full animate-pulse">
                Reconectando...
              </span>
            )}
            {hasFailed && (
              <span className="px-2 py-0.5 text-xs bg-red-200 text-red-800 rounded-full">
                Error
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 mb-1">ID: {camera.id}</div>
          <div className="text-xs text-gray-500 break-all mb-1">{camera.rtspUrl}</div>
          
          {/* URL Pública */}
          {publicUrl && camera.enabled && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs font-medium text-blue-800 mb-1">🌐 URL Pública:</div>
              <div className="flex items-center gap-1">
                <a 
                  href={publicUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex-1"
                >
                  {publicUrl}
                </a>
                <button
                  onClick={() => copyToClipboard(publicUrl)}
                  title="Copiar URL"
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                >
                  📋
                </button>
              </div>
            </div>
          )}
          
          {stats?.restarts > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              🔄 {stats.restarts} reconexiones
              {stats.consecutiveFailures > 0 && ` • ⚠️ ${stats.consecutiveFailures} fallos`}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {/* Botón de Reconectar */}
            <button
              onClick={() => onReconnect(camera.id)}
              disabled={loading || isReconnecting}
              title="Reconectar cámara"
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                hasFailed 
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              } disabled:opacity-50`}
            >
              🔄
            </button>
            <button
              onClick={() => onToggle(camera.id, !camera.enabled)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                camera.enabled 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              } disabled:opacity-50`}
            >
              {camera.enabled ? '⏸️' : '▶️'}
            </button>
            <button
              onClick={() => onEdit(camera)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(camera.id)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CameraList({ 
  cameras, 
  loading, 
  onToggle, 
  onEdit, 
  onDelete, 
  onAddNew,
  onReconnect,
  reconnectStats,
  tunnelUrl
}) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          📹 Cámaras Configuradas ({cameras.length})
        </h3>
        <button
          onClick={onAddNew}
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➕ Agregar Cámara
        </button>
      </div>
      
      {cameras.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">📹</div>
          <div className="text-gray-600">No hay cámaras configuradas</div>
          <div className="text-sm text-gray-500 mt-1">Haz clic en "Agregar Cámara" para comenzar</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cameras.map((camera) => (
            <CameraItem
              key={camera.id}
              camera={camera}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onReconnect={onReconnect}
              loading={loading}
              reconnectStats={reconnectStats}
              tunnelUrl={tunnelUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}
