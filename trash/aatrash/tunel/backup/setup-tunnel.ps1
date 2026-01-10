Write-Host "🟦 Ejecutando cámara con túnel ngrok..."

# Solicitar datos al usuario
$camId = Read-Host "🟦 Ingresa el ID de la cámara (por ejemplo: cam1)"
$authToken = Read-Host "🟦 Ingresa tu token de autenticación ngrok"
$rtspUrl = "rtsp://augustodelcampo97:Nodotecnologico1%2A%40192.168.1.65:554/stream1"

# Guardar token ngrok
ngrok config add-authtoken $authToken

# Iniciar túnel público en segundo plano
Start-Process -NoNewWindow -FilePath "ngrok.exe" -ArgumentList "tcp 8554" 

Start-Sleep -Seconds 3

# Obtener URL pública
$response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
$tunnelUrl = $response.tunnels[0].public_url
Write-Host "✅ Túnel abierto: $tunnelUrl"

# Notificar al servidor
try {
  $body = @{ camId = $camId; publicUrl = "$tunnelUrl/stream1" } | ConvertTo-Json
  Invoke-RestMethod -Uri "http://tuservidor.com:3000/api/register" -Method Post -Body $body -ContentType "application/json"
  Write-Host "📡 Cámara registrada en el servidor con ID $camId"
} catch {
  Write-Warning "⚠️ No se pudo notificar al servidor."
}

# Iniciar FFmpeg
Write-Host "🎥 Iniciando retransmisión RTSP en localhost:8554/stream1 ..."
ffmpeg -rtsp_transport tcp -i $rtspUrl -f rtsp rtsp://localhost:8554/stream1
