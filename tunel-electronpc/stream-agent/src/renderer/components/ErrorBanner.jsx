import React from 'react'

export default function ErrorBanner({ error, onChangeDNS, loading }) {
  if (!error) return null

  const isDNSError = error.includes('ENOTFOUND') && error.includes('cloudflare')

  return (
    <div className="p-4 mb-6 rounded-xl bg-red-50 border-2 border-red-300 text-red-900">
      <div className="font-bold mb-1">⚠️ Error</div>
      <div className="text-sm">{error}</div>
      
      {isDNSError && (
        <button
          onClick={onChangeDNS}
          disabled={loading}
          className="mt-3 px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Cambiando...' : '🔧 Cambiar DNS a Cloudflare'}
        </button>
      )}
    </div>
  )
}
