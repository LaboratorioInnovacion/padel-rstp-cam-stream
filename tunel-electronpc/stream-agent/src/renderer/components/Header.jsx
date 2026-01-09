import React from 'react'

export default function Header({ locationName }) {
  return (
    <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg">
      <div className="px-8 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            🎥 Stream Agent
          </h1>
          <p className="text-sm opacity-90 mt-1">
            Sistema de transmisión de cámaras RTSP
          </p>
        </div>
        <div className="px-5 py-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
          <div className="text-xs opacity-80">📍 Ubicación</div>
          <div className="text-sm font-semibold mt-0.5">{locationName}</div>
        </div>
      </div>
    </div>
  )
}
