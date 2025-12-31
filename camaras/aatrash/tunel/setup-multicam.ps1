# ===================================================================
# setup-multicam.ps1
#
# 1. Arranca mediamtx.exe (MediaMTX) en localhost:8554
# 2. Abre un túnel ngrok TCP en el mismo puerto (8554)
# 3. Lee cameras.json y, para cada cámara:
#    a. Arranca FFmpeg para hacer push del RTSP LAN a rtsp://localhost:8554/<camId>
#    b. Registra rtsp://<ngrok-host>:<ngrok-port>/<camId> en el servidor Node.js
# 4. Al cerrar la consola (Ctrl+C), detiene mediamtx, ngrok y FFmpeg.
# ===================================================================

# ------------------------------------------------------------
#  A) Ajusta esta URL a tu servidor Node.js
# ------------------------------------------------------------
# $serverRegisterUrl = "https://servercamcanchas.onrender.com/api/register"
$serverRegisterUrl = "http://31.97.64.187:3000/api/deploy/0l-lwH7Dvu1PbX2HJL7YP/api/register"

# ------------------------------------------------------------
#  B) 1) Iniciar MediaMTX (antes rtsp-simple-server) en segundo plano
# ------------------------------------------------------------
Write-Host "▶ Iniciando MediaMTX (RTSP Simple Server)..."
Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"

# Esperar unos segundos para que MediaMTX arranque y escuche en localhost:8554
Start-Sleep -Seconds 2

# ------------------------------------------------------------
#  C) 2) Abrir túnel ngrok TCP en el puerto 8554
# ------------------------------------------------------------
Write-Host "▶ Abriendo túnel ngrok (tcp 8554)..."
Start-Process -NoNewWindow -FilePath ".\ngrok.exe" -ArgumentList "tcp 8554"

# Esperar a que ngrok inicie el túnel
Start-Sleep -Seconds 7

# ------------------------------------------------------------
#  D) 3) Obtener host y puerto del túnel ngrok vía su API local
# ------------------------------------------------------------
try {
    $apiResult = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
    $tunnel = $apiResult.tunnels | Where-Object { $_.proto -eq "tcp" }
    if (-not $tunnel) { throw "No se encontró túnel TCP ngrok" }
    $publicTcp = $tunnel.public_url -replace "tcp://", ""
    $parts = $publicTcp -split ":"
    $ngrokHost = $parts[0]
    $ngrokPort = $parts[1]
    Write-Host "✅ Ngrok expone RTSP en rtsp://$($ngrokHost):$($ngrokPort)"
} catch {
    Write-Error "❌ Error obteniendo túnel ngrok: $_"
    exit 1
}

# ------------------------------------------------------------
#  E) 4) Leer la lista de cámaras desde cameras.json
# ------------------------------------------------------------
try {
    $camerasConfig = Get-Content -Raw -Path ".\cameras.json" | ConvertFrom-Json
} catch {
    Write-Error "❌ No se pudo leer cameras.json: $_"
    exit 1
}

# ------------------------------------------------------------
#  F) 5) Para cada cámara definida en cameras.json:
# ------------------------------------------------------------
foreach ($cam in $camerasConfig) {
    $camId      = $cam.camId
    $localRtsp  = $cam.localRtsp.Trim()

    # F.a) Iniciar FFmpeg para enviar la cámara local a MediaMTX
    #     Destino local: rtsp://localhost:8554/<camId>
    $rtspTargetLocal = "rtsp://localhost:8554/$camId"
    Write-Host ""
    Write-Host "▶ Iniciando FFmpeg para '$camId'…"
    Write-Host "    Local RTSP: $localRtsp"
    Write-Host "    Enviando a: $rtspTargetLocal"

    $ffmpegArgs = @(
        "-rtsp_transport", "tcp"
        "-i", "`"$localRtsp`""
        "-c", "copy"
        "-f", "rtsp"
        "`"$rtspTargetLocal`""
    )
    Start-Process -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs -NoNewWindow

    # F.b) Registrar la URL pública en el servidor
    $publicRtsp = "rtsp://$($ngrokHost):$($ngrokPort)/$camId"
    Write-Host "▶ Registrando '$camId' → $publicRtsp en el servidor…"

    $payload = @{
        camId     = $camId
        publicUrl = $publicRtsp
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri $serverRegisterUrl -Method POST -Body $payload -ContentType "application/json"
        Write-Host "   ✅ Registrada: $camId"
    } catch {
        Write-Warning "   ⚠️ Falló registro para $camId"
    }
}

Write-Host ""
Write-Host "▶ Todos los procesos están corriendo. Presiona Ctrl+C para detenerlos."

# ------------------------------------------------------------
#  G) 6) Función de limpieza al cerrar la consola (Ctrl+C)
# ------------------------------------------------------------
function Cleanup {
    Write-Host ""
    Write-Host "🧹 Deteniendo MediaMTX, ngrok y FFmpeg…"
    Get-Process -Name mediamtx, ngrok, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    exit
}
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# ------------------------------------------------------------
#  H) 7) Mantener la consola abierta
# ------------------------------------------------------------
while ($true) {
    Start-Sleep -Seconds 1
}
