# Limpieza de procesos al cerrar
$ErrorActionPreference = "Stop"

# Función para limpiar ngrok y FFmpeg
function Cleanup {
    Write-Host "`n🧹 Cerrando ngrok y FFmpeg..."
    Get-Process ngrok, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    exit
}

# Registrar cleanup al cerrar consola
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# 1. Pedir ID de cámara
$camId = Read-Host "🟦 Ingresa el ID de la cámara (ej: cam1)"

# 2. Iniciar ngrok en segundo plano
Start-Process ngrok -ArgumentList "tcp 8554" -WindowStyle Hidden
Start-Sleep -Seconds 7

# 3. Obtener host y puerto del túnel
$response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
$tunnel = $response.tunnels | Where-Object { $_.proto -eq "tcp" }
$publicUrl = $tunnel.public_url -replace "tcp://", ""
$parts = $publicUrl -split ":"
$publicHost = $parts[0]
$publicPort = $parts[1]
$rtspUrl = "rtsp://${publicHost}:${publicPort}/stream1"
Write-Host "`n✅ Cámara disponible en $rtspUrl"

# 4. Registrar en el servidor
$body = @{ camId = $camId; publicUrl = $rtspUrl } | ConvertTo-Json -Compress
Invoke-WebRequest -Uri "https://servercamcanchas.onrender.com/api/register" `
    -Method POST -Body $body -ContentType "application/json"

# 5. Iniciar FFmpeg
# ⚠️ Reemplazar con tus datos reales
$localRtsp = "rtsp://augustodelcampo97:Nodotecnologico1%2A@192.168.1.65/stream1"
$ffmpegArgs = "-rtsp_transport tcp -i `"$localRtsp`" -f rtsp rtsp://localhost:8554/stream1"
Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow

Write-Host "`n▶ FFmpeg y ngrok corriendo. Presiona Ctrl+C o cierra la consola para salir."

# 6. Esperar indefinidamente hasta que se cierre la consola
while ($true) {
    Start-Sleep -Seconds 1
}
