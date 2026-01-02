# ===================================================================
# setup-multicam.ps1
#
# Automatiza el túnel RTSP para múltiples cámaras usando:
# - MediaMTX
# - ngrok (TCP)
# - FFmpeg
# - Registro en servidor externo
# ===================================================================
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
# A) URL de tu servidor para registrar cámaras
$serverRegisterUrl = "https://camarasserver-camserver-rlwh8e-a02680-31-97-64-187.traefik.me/api/register"

# B) Iniciar MediaMTX
Write-Host "▶ Iniciando MediaMTX (RTSP Simple Server)..."
Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"
Start-Sleep -Seconds 2

# C) Iniciar túnel ngrok TCP en puerto 8554
Write-Host "▶ Abriendo túnel ngrok (tcp 8554)..."
Start-Process -NoNewWindow -FilePath ".\ngrok.exe" -ArgumentList "tcp 8554"
Start-Sleep -Seconds 7

# D) Obtener host y puerto públicos desde la API local de ngrok
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

# Limpiar archivo de URLs anteriores
if (Test-Path ".\urls-publicas.txt") {
    Remove-Item ".\urls-publicas.txt"
}

# E) Leer cámaras desde camaras.txt
try {
    $camarasRaw = Get-Content ".\camaras.txt"
} catch {
    Write-Error "❌ No se pudo leer camaras.txt: $_"
    exit 1
}
if (-not (Test-Path ".\logs")) {
    New-Item -ItemType Directory -Path ".\logs" | Out-Null
}

foreach ($linea in $camarasRaw) {
    if ($linea.Trim() -eq "") { continue }

    $parts = $linea -split "="
    if ($parts.Count -ne 2) {
        Write-Warning "❗ Línea inválida: $linea"
        continue
    }

    $camId = $parts[0].Trim()
    $localRtsp = $parts[1].Trim()

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

    Start-Process -WindowStyle Hidden -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs `
    -RedirectStandardOutput ".\logs\$camId-out.log" `
    -RedirectStandardError ".\logs\$camId-err.log"

    # Esperar a que el stream esté disponible en MediaMTX antes de registrar
    Start-Sleep -Seconds 5

    # Construir RTSP público y registrar
    $publicRtsp = "rtsp://$ngrokHost`:$ngrokPort/$camId"
    Write-Host "▶ Registrando '$camId' → $publicRtsp en el servidor…"

    $payload = @{
        camId     = $camId
        publicUrl = $publicRtsp
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri $serverRegisterUrl -Method POST -Body $payload -ContentType "application/json"
        Write-Host "   ✅ Registrada: $camId"
        "$camId = $publicRtsp" | Out-File -FilePath ".\urls-publicas.txt" -Append
    } catch {
        Write-Warning "Fall registro para $camId"
    }
}

Write-Host ""
Write-Host "▶ Todos los procesos están corriendo. Presiona Ctrl+C para detenerlos."
Write-Host "Las URLs publicas fueron guardadas en: urls-publicas.txt"

# F) Función de limpieza al salir
function Cleanup {
    Write-Host ""
    Write-Host "🧹 Deteniendo MediaMTX, ngrok y FFmpeg…"
    Get-Process -Name mediamtx, ngrok, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    exit
}
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# G) Mantener consola abierta
while ($true) {
    Start-Sleep -Seconds 1
}
