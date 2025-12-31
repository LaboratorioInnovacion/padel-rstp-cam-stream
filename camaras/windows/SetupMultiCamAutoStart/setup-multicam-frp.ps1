# setup-multicam-frp.ps1
# Automatiza MediaMTX, FRP y registro en backend

# A) Iniciar MediaMTX
Write-Host "▶ Iniciando MediaMTX..."
Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"
Start-Sleep -Seconds 2

# B) Iniciar FRPC (túnel RTSP)
Write-Host "▶ Iniciando FRPC (túnel RTSP 8554)..."
Start-Process -NoNewWindow -FilePath ".\frpc.exe" -ArgumentList "-c .\frpc.toml"
Start-Sleep -Seconds 5

# C) Leer cámaras y lanzar ffmpeg
$camarasRaw = Get-Content ".\camaras.txt"
if (-not (Test-Path ".\logs")) { New-Item -ItemType Directory -Path ".\logs" | Out-Null }

foreach ($linea in $camarasRaw) {
    if ($linea.Trim() -eq "") { continue }
    $parts = $linea -split "="
    if ($parts.Count -ne 2) { Write-Warning "❗ Línea inválida: $linea"; continue }
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
    Start-Sleep -Seconds 5
    # D) Registrar en backend usando la IP pública y puerto del servidor FRP
    $publicRtsp = "rtsp://camarasserver-camserver-rlwh8e-a02680-31-97-64-187.traefik.me:18554/$camId"
    Write-Host "▶ Registrando '$camId' → $publicRtsp en el servidor…"
    $payload = @{
        camId     = $camId
        publicUrl = $publicRtsp
    } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri "https://camarasserver-camserver-rlwh8e-a02680-31-97-64-187.traefik.me:3000/api/register" -Method POST -Body $payload -ContentType "application/json"
        Write-Host "   ✅ Registrada: $camId"
        "$camId = $publicRtsp" | Out-File -FilePath ".\urls-publicas.txt" -Append
    } catch {
        Write-Warning "❌ Falló registro para $camId : $_"
    }
}

Write-Host ""
Write-Host "▶ Todos los procesos están corriendo. Presiona Ctrl+C para detenerlos."
Write-Host "Las URLs publicas fueron guardadas en: urls-publicas.txt"

# Mantener consola abierta
while ($true) { Start-Sleep -Seconds 1 }
