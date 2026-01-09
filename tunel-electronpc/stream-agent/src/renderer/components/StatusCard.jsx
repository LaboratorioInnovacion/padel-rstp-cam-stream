import React from 'react'

export default function StatusCard({ status, mode, showStats, setShowStats }) {
  const isRunning = status === 'running'
  
  return (
    <div className={`p-5 mb-6 rounded-xl bg-white shadow-md border-3 ${
      isRunning ? 'border-green-500' : 'border-red-500'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
            isRunning ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isRunning ? '✅' : '⏸️'}
          </div>
          <div>
            <div className="text-xl font-bold text-gray-800 mb-1">
              {isRunning ? 'Sistema Activo' : 'Sistema Detenido'}
            </div>
            {mode && (
              <div className="text-sm text-gray-600">
                {mode === 'test' 
                  ? '🧪 Modo Prueba - Solo local' 
                  : '🌐 Modo Producción - Transmitiendo'
                }
              </div>
            )}
          </div>
        </div>
        {isRunning && (
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              showStats 
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 {showStats ? 'Ocultar' : 'Ver'} Estadísticas
          </button>
        )}
      </div>
    </div>
  )
}
