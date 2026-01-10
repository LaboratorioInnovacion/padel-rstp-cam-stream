# setup-multicam-frp.ps1
# Versión mejorada con manejo de errores, configuración y verificación de estado

param(
    [string]$ConfigPath = ".\config.ini"
)

# === FUNCIONES AUXILIARES ===
function Load-Config {
    param($Path)
    $config = @{}
    Get-Content $Path | ForEach-Object {
        if ($_ -match "^\s*\[(.+)\]") {
            $section = $matches[1].Trim()
        } elseif ($_ -match "^\s*([^=]+?)\s*=\s*(.+?)\s*$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $config[$key] = $value
        }
    }
    return $config
}

function Test-ProcessRunning {
    param($ProcessName, $TimeoutSec = 5)
    $startTime = Get-Date
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSec) {
        if (Get-Process -Name $ProcessName -ErrorAction SilentlyContinue) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# === CONFIGURACIÓN INICIAL ===
Write-Host "▶ Cargando configuración..."
if (-not (Test-Path $ConfigPath)) {
    Write-Error "❌ Archivo de configuración no encontrado: $ConfigPath"
    exit 1
}

$config = Load-Config -Path $ConfigPath
$requiredKeys = @("frp_domain", "frp_rtsp_port", "backend_url", "api_key")
foreach ($key in $requiredKeys) {
    if (-not $config.ContainsKey($key)) {
        Write-Error "❌ Falta clave requerida en config.ini: $key"
        exit 1
    }
}

# === A) INICIAR MEDIAMTX ===
Write-Host "▶ Iniciando MediaMTX..."
$mtxProcess = Start-Process -PassThru -NoNewWindow -FilePath ".\mediamtx.exe"
Start-Sleep -Seconds 2

if (-not (Test-ProcessRunning -ProcessName "mediamtx")) {
    Write-Error "❌ MediaMTX no se inició correctamente"
    exit 1
}

# === B) INICIAR FRPC ===
Write-Host "▶ Iniciando FRPC (túnel RTSP)..."
$frpcProcess = Start-Process -PassThru -NoNewWindow -FilePath ".\frpc.exe" -ArgumentList "-c .\frpc.toml"
Start-Sleep -Seconds 5

if (-not (Test-ProcessRunning -ProcessName "frpc")) {
    Write-Error "❌ FRPC no se inició correctamente"
    exit 1
}

# === C) PROCESAR CÁMARAS ===
$camarasFile = ".\camaras.txt"
if (-not (Test-Path $camarasFile)) {
    Write-Error "❌ Archivo de cámaras no encontrado: $camarasFile"
    exit 1
}

$camarasRaw = Get-Content $camarasFile
if (-not (Test-Path ".\logs")) { New-Item -ItemType Directory -Path ".\logs" | Out-Null }

# Limpiar archivo de URLs públicas
if (Test-Path ".\urls-publicas.txt") { Remove-Item ".\urls-publicas.txt" -Force }

foreach ($linea in $camarasRaw) {
    if ($linea.Trim() -eq "") { continue }
    
    $parts = $linea -split "=", 2
    if ($parts.Count -lt 2) { 
        Write-Warning "❗ Línea inválida: $linea"
        continue 
    }
    
    $camId = $parts[0].Trim()
    $localRtsp = $parts[1].Trim()
    $rtspTargetLocal = "rtsp://localhost:8554/$camId"
    
    Write-Host ""
    Write-Host "▶ Procesando cámara '$camId'"
    Write-Host "   Fuente: $localRtsp"
    Write-Host "   Destino: $rtspTargetLocal"
    
    # Iniciar FFmpeg
    $ffmpegArgs = @(
        "-rtsp_transport", "tcp",
        "-i", "`"$localRtsp`"",
        "-c", "copy",
        "-f", "rtsp",
        "`"$rtspTargetLocal`""
    )
    
    try {
        $ffmpegProcess = Start-Process -PassThru -WindowStyle Hidden `
            -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs `
            -RedirectStandardOutput ".\logs\$camId-out.log" `
            -RedirectStandardError ".\logs\$camId-err.log"
        
        # Verificar si FFmpeg se inició correctamente
        Start-Sleep -Seconds 3
        if ($ffmpegProcess.HasExited -or (-not (Test-ProcessRunning -ProcessName "ffmpeg"))) {
            Write-Warning "   ❌ FFmpeg no se inició para $camId. Verificar logs."
            continue
        }
    }
    catch {
        Write-Warning "   ❌ Error al iniciar FFmpeg: $_"
        continue
    }
    
    # Registrar en backend
    $publicRtsp = "rtsp://$($config.frp_domain):$($config.frp_rtsp_port)/$camId"
    Write-Host "▶ Registrando en backend: $publicRtsp"
    
    $payload = @{
        camId     = $camId
        publicUrl = $publicRtsp
    } | ConvertTo-Json -Compress
    
    $headers = @{
        "X-API-Key" = $config.api_key
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $config.backend_url -Method POST `
            -Headers $headers -Body $payload -ErrorAction Stop
        
        Write-Host "   ✅ $($response.message)"
        "$camId = $publicRtsp" | Out-File -FilePath ".\urls-publicas.txt" -Append
    }
    catch {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorDetails) {
            Write-Warning "   ❌ Error en registro: $($errorDetails.error)"
        }
        else {
            Write-Warning "   ❌ Error en registro: $($_.Exception.Message)"
        }
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "===================================================="
Write-Host "▶ Todos los procesos están en ejecución"
Write-Host "▶ URLs públicas guardadas en: urls-publicas.txt"
Write-Host "▶ Presiona Ctrl+C para detener"
Write-Host "===================================================="

# Mantener consola activa
try {
    while ($true) { Start-Sleep -Seconds 60 }
}
finally {
    Write-Host "▶ Deteniendo procesos..."
    Get-Process -Name "ffmpeg", "mediamtx", "frpc" -ErrorAction SilentlyContinue | Stop-Process -Force
}