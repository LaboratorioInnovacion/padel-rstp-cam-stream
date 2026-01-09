import React from 'react'

function ProcessStatus({ name, stats }) {
  const statusColors = {
    running: 'bg-green-100 text-green-700 border-green-300',
    reconnecting: 'bg-yellow-100 text-yellow-700 border-yellow-300 animate-pulse',
    stopped: 'bg-gray-100 text-gray-600 border-gray-300',
    failed: 'bg-red-100 text-red-700 border-red-300'
  }
  
  const statusIcons = {
    running: '🟢',
    reconnecting: '🔄',
    stopped: '⚪',
    failed: '🔴'
  }
  
  const statusText = {
    running: 'Activo',
    reconnecting: 'Reconectando...',
    stopped: 'Detenido',
    failed: 'Error'
  }

  return (
    <div className={`p-3 rounded-lg border ${statusColors[stats.status] || statusColors.stopped}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{statusIcons[stats.status] || '⚪'}</span>
          <span className="font-medium text-sm">{name}</span>
        </div>
        <span className="text-xs">{statusText[stats.status] || 'Desconocido'}</span>
      </div>
      
      {stats.restarts > 0 && (
        <div className="mt-2 text-xs opacity-75">
          <span>🔄 {stats.restarts} reconexiones</span>
          {stats.consecutiveFailures > 0 && (
            <span className="ml-2">⚠️ {stats.consecutiveFailures} fallos</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReconnectStatus({ 
  reconnectStats, 
  showConfig,
  onToggleConfig,
  onUpdateConfig,
  loading 
}) {
  if (!reconnectStats) return null
  
  const { config, processes, summary } = reconnectStats
  const hasProcesses = Object.keys(processes).length > 0
  
  return (
    <div className="mb-6">
      {/* Header con resumen */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
          🔄 Auto-Reconexión
          {config.enabled ? (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Activa</span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Desactivada</span>
          )}
        </h3>
        <button
          onClick={onToggleConfig}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          {showConfig ? '▲ Ocultar' : '▼ Configurar'}
        </button>
      </div>
      
      {/* Resumen rápido */}
      {hasProcesses && (
        <div className="flex gap-4 mb-3 text-xs">
          <span className="text-green-600">
            🟢 {summary.activeProcesses} activos
          </span>
          {summary.totalRestarts > 0 && (
            <span className="text-yellow-600">
              🔄 {summary.totalRestarts} reconexiones totales
            </span>
          )}
          {summary.failedProcesses > 0 && (
            <span className="text-red-600">
              🔴 {summary.failedProcesses} con errores
            </span>
          )}
        </div>
      )}
      
      {/* Panel de configuración expandible */}
      {showConfig && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">⚙️ Configuración</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Máx. reintentos</label>
              <input
                type="number"
                value={config.maxRetries}
                onChange={(e) => onUpdateConfig({ maxRetries: parseInt(e.target.value) })}
                min="1"
                max="50"
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Delay base (seg)</label>
              <input
                type="number"
                value={config.retryDelayBase / 1000}
                onChange={(e) => onUpdateConfig({ retryDelayBase: parseInt(e.target.value) * 1000 })}
                min="1"
                max="60"
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Delay máximo (seg)</label>
              <input
                type="number"
                value={config.retryDelayMax / 1000}
                onChange={(e) => onUpdateConfig({ retryDelayMax: parseInt(e.target.value) * 1000 })}
                min="10"
                max="300"
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reconnectEnabled"
                checked={config.enabled}
                onChange={(e) => onUpdateConfig({ enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <label htmlFor="reconnectEnabled" className="text-sm text-gray-700">
                Habilitado
              </label>
            </div>
          </div>
        </div>
      )}
      
      {/* Estado de procesos */}
      {hasProcesses && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(processes).map(([name, stats]) => (
            <ProcessStatus key={name} name={name} stats={stats} />
          ))}
        </div>
      )}
      
      {!hasProcesses && (
        <div className="text-center text-gray-500 text-sm py-4">
          No hay procesos activos
        </div>
      )}
    </div>
  )
}
