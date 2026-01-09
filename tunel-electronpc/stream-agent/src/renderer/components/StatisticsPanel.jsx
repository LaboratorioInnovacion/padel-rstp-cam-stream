import React from 'react'

function StatCard({ icon, label, value, subtitle, color = 'blue' }) {
  const colorClasses = {
    green: 'text-green-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500'
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-2">
        {icon} {label}
      </div>
      <div className={`text-3xl font-bold ${colorClasses[color]} mb-1`}>
        {value}
      </div>
      <div className="text-xs text-gray-500">
        {subtitle}
      </div>
    </div>
  )
}

function ProcessStatus({ label, active }) {
  return (
    <div className="mb-1.5">
      {active ? '🟢' : '🔴'} {label}
    </div>
  )
}

export default function StatisticsPanel({ systemStats }) {
  if (!systemStats) return null

  return (
    <div className="p-5 mb-6 rounded-xl bg-white shadow-md">
      <h3 className="text-base font-bold text-gray-800 mb-5">
        📊 Monitoreo del Sistema
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="🖥️"
          label="CPU"
          value={`${systemStats.cpu.usage}%`}
          subtitle={`${systemStats.cpu.cores} núcleos disponibles`}
          color={systemStats.cpu.usage > 80 ? 'red' : 'green'}
        />
        
        <StatCard
          icon="💾"
          label="Memoria RAM"
          value={`${systemStats.memory.usagePercent}%`}
          subtitle={`${systemStats.memory.used} MB / ${systemStats.memory.total} MB`}
          color={systemStats.memory.usagePercent > 85 ? 'red' : 'blue'}
        />
        
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-600 mb-2">
            ⚙️ Procesos
          </div>
          <div className="text-sm mt-2.5">
            <ProcessStatus label="MediaMTX" active={systemStats.processes.mediamtx} />
            <ProcessStatus 
              label={`FFmpeg (${systemStats.processes.ffmpegCount})`} 
              active={systemStats.processes.ffmpegCount > 0} 
            />
            <ProcessStatus label="Cloudflared" active={systemStats.processes.cloudflared} />
          </div>
        </div>
        
        <StatCard
          icon="📹"
          label="Cámaras"
          value={`${systemStats.cameras.enabled}/${systemStats.cameras.total}`}
          subtitle="activas / totales"
          color="purple"
        />
      </div>
      
      <div className="mt-4 p-2.5 bg-yellow-100 rounded-md text-xs text-yellow-900 text-center">
        ⏱️ Tiempo activo: {Math.floor(systemStats.uptime / 60)} minutos
      </div>
    </div>
  )
}
