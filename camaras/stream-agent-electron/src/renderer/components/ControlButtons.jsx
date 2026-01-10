import React from 'react'

export default function ControlButtons({ 
  status, 
  loading, 
  onStart, 
  onStop, 
  onConfigLocation, 
  onConfigTunnel, 
  onConfigServer 
}) {
  return (
    <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
      {status !== 'running' ? (
        <>
          <button
            onClick={() => onStart('test')}
            disabled={loading}
            className="px-4 py-3 text-sm font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🧪 Iniciar Prueba
          </button>
          <button
            onClick={() => onStart('production')}
            disabled={loading}
            className="px-4 py-3 text-sm font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🌐 Iniciar Producción
          </button>
        </>
      ) : (
        <button
          onClick={onStop}
          disabled={loading}
          className="px-4 py-3 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🛑 Detener
        </button>
      )}
      
      <button
        onClick={onConfigLocation}
        disabled={loading}
        className="px-4 py-3 text-sm font-semibold bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        📍 Ubicación
      </button>
      <button
        onClick={onConfigTunnel}
        disabled={loading}
        className="px-4 py-3 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        🔒 Túnel
      </button>
      <button
        onClick={onConfigServer}
        disabled={loading}
        className="px-4 py-3 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        🔧 Servidor
      </button>
    </div>
  )
}
