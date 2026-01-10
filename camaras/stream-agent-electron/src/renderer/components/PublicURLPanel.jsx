import React from 'react'

export default function PublicURLPanel({ 
  tunnelUrl, 
  tunnelName, 
  tunnelId, 
  loading,
  onFlushDNS,
  onConfigDNS 
}) {
  if (!tunnelUrl) return null

  return (
    <div className="p-5 mb-6 rounded-xl bg-green-50 border-2 border-green-500 shadow-sm shadow-green-500/10">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="text-sm font-bold text-green-800 mb-2">
            🌐 URL Pública Activa
          </div>
          <div className="text-base break-all mb-2">
            <a 
              href={tunnelUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-green-600 hover:text-green-700 font-semibold no-underline hover:underline"
            >
              {tunnelUrl}
            </a>
          </div>
          {tunnelName && (
            <div className="text-xs text-green-700">
              Túnel: <strong>{tunnelName}</strong> {tunnelId && `(${tunnelId.substring(0, 8)}...)`}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={onFlushDNS}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? '⏳' : '🔄'} Limpiar DNS
          </button>
          <button
            onClick={onConfigDNS}
            disabled={loading || !tunnelName}
            className="px-4 py-2 text-xs font-semibold bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            ⚙️ Config DNS
          </button>
        </div>
      </div>
    </div>
  )
}
