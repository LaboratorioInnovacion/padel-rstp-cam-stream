# ===================================================================
# setup-multicam-frp.ps1 - Versión Mejorada
# Automatiza MediaMTX, FRP y registro en backend con CLI interactivo
# ===================================================================

param(
    [string]$Action = "menu",
    [string]$CameraId,
    [string]$RtspUrl
)

# Cargar configuración
$configPath = ".\config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "❌ No se encontró config.json"
    exit 1
}
$config = Get-Content $configPath | ConvertFrom-Json

# ===================================================================
# Funciones auxiliares
# ===================================================================

function Test-Prerequisites {
    Write-Host "🔍 Verificando prerrequisitos..." -ForegroundColor Cyan
    $requiredFiles = @("mediamtx.exe", "frpc.exe", "ffmpeg.exe", "frpc.toml", $config.cameraFile)
    $missing = @()
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            $missing += $file
        }
    }
    if ($missing.Count -gt 0) {
        Write-Error "❌ Faltan archivos: $($missing -join ', ')"
        return $false
    }
    Write-Host "✅ Todos los archivos necesarios están presentes" -ForegroundColor Green
    return $true
}

function Stop-AllProcesses {
    Write-Host "🧹 Deteniendo todos los procesos..." -ForegroundColor Yellow
    Get-Process -Name mediamtx, frpc, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "✅ Procesos detenidos" -ForegroundColor Green
}

function Start-MediaMTX {
    Write-Host "▶ Iniciando MediaMTX..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"
    Start-Sleep -Seconds 3
    if (-not (Get-Process -Name "mediamtx" -ErrorAction SilentlyContinue)) {
        Write-Error "❌ MediaMTX no se inició correctamente"
        return $false
    }
    Write-Host "✅ MediaMTX iniciado en puerto $($config.mediaRtspPort)" -ForegroundColor Green
    return $true
}

function Start-FRPClient {
    Write-Host "▶ Iniciando FRPC (túnel RTSP)..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath ".\frpc.exe" -ArgumentList "-c .\frpc.toml"
    Start-Sleep -Seconds 5
    if (-not (Get-Process -Name "frpc" -ErrorAction SilentlyContinue)) {
        Write-Error "❌ FRPC no se inició correctamente"
        return $false
    }
    Write-Host "✅ FRPC conectado al servidor FRP" -ForegroundColor Green
    return $true
}

function Add-Camera {
    param([string]$Id, [string]$Url)
    
    if (-not $Id) {
        $Id = Read-Host "ID de la cámara (ej: cam1, padel1)"
    }
    if (-not $Url) {
        $Url = Read-Host "URL RTSP (ej: rtsp://usuario:pass@192.168.1.100:554/stream1)"
    }
    
    # Validar que no exista
    $cameras = Get-Content $config.cameraFile -ErrorAction SilentlyContinue
    if ($cameras -match "^$Id\s*=") {
        Write-Warning "⚠️ La cámara '$Id' ya existe. ¿Desea sobrescribirla? (S/N)"
        $response = Read-Host
        if ($response -ne "S") {
            return
        }
        # Eliminar línea existente
        $cameras = $cameras | Where-Object { $_ -notmatch "^$Id\s*=" }
        $cameras | Set-Content $config.cameraFile
    }
    
    # Agregar nueva cámara
    "$Id=$Url" | Add-Content $config.cameraFile
    Write-Host "✅ Cámara '$Id' agregada correctamente" -ForegroundColor Green
}

function Remove-Camera {
    param([string]$Id)
    
    if (-not $Id) {
        List-Cameras
        $Id = Read-Host "`nID de la cámara a eliminar"
    }
    
    $cameras = Get-Content $config.cameraFile -ErrorAction SilentlyContinue
    $filtered = $cameras | Where-Object { $_ -notmatch "^$Id\s*=" }
    
    if ($cameras.Count -eq $filtered.Count) {
        Write-Warning "⚠️ No se encontró la cámara '$Id'"
        return
    }
    
    $filtered | Set-Content $config.cameraFile
    Write-Host "✅ Cámara '$Id' eliminada" -ForegroundColor Green
}

function List-Cameras {
    Write-Host "`n📹 Cámaras registradas:" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    $cameras = Get-Content $config.cameraFile -ErrorAction SilentlyContinue
    if (-not $cameras) {
        Write-Host "No hay cámaras registradas" -ForegroundColor Yellow
        return
    }
    foreach ($cam in $cameras) {
        if ($cam.Trim() -eq "") { continue }
        $parts = $cam -split "="
        if ($parts.Count -eq 2) {
            Write-Host "  • $($parts[0].Trim()) → $($parts[1].Trim())" -ForegroundColor White
        }
    }
    Write-Host "===========================================" -ForegroundColor Cyan
}

function Start-CameraStreaming {
    param([string]$CamId, [string]$LocalRtsp)
    
    $rtspTargetLocal = "rtsp://localhost:$($config.mediaRtspPort)/$CamId"
    
    Write-Host ""
    Write-Host "▶ Iniciando FFmpeg para '$CamId'…" -ForegroundColor Cyan
    Write-Host "    Local RTSP: $LocalRtsp" -ForegroundColor Gray
    Write-Host "    Enviando a: $rtspTargetLocal" -ForegroundColor Gray
    
    $ffmpegArgs = @(
        "-rtsp_transport", "tcp"
        "-i", "`"$LocalRtsp`""
        "-c", "copy"
        "-f", "rtsp"
        "`"$rtspTargetLocal`""
    )
    
    $logDir = $config.logDirectory
    if (-not (Test-Path $logDir)) { 
        New-Item -ItemType Directory -Path $logDir | Out-Null 
    }
    
    Start-Process -WindowStyle Hidden -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs `
        -RedirectStandardOutput ".\$logDir\$CamId-out.log" `
        -RedirectStandardError ".\$logDir\$CamId-err.log"
    
    Start-Sleep -Seconds 5
    
    # Registrar en backend
    $publicRtsp = "rtsp://$($config.rtspPublicHost):$($config.rtspPublicPort)/$CamId"
    $registerUrl = "$($config.serverUrl):$($config.serverPort)/api/register"
    
    Write-Host "▶ Registrando '$CamId' en el servidor..." -ForegroundColor Cyan
    
    $payload = @{
        camId     = $CamId
        publicUrl = $publicRtsp
    } | ConvertTo-Json -Compress
    
    try {
        Invoke-RestMethod -Uri $registerUrl -Method POST -Body $payload -ContentType "application/json"
        Write-Host "   ✅ Registrada: $CamId → $publicRtsp" -ForegroundColor Green
        "$CamId = $publicRtsp" | Out-File -FilePath ".\$($config.outputFile)" -Append
    } catch {
        Write-Warning "❌ Falló registro para $CamId : $_"
    }
}

function Start-AllCameras {
    if (-not (Test-Prerequisites)) { return }
    
    if (-not (Start-MediaMTX)) { return }
    if (-not (Start-FRPClient)) { 
        Stop-AllProcesses
        return 
    }
    
    # Limpiar archivo de URLs
    if (Test-Path $config.outputFile) {
        Remove-Item $config.outputFile
    }
    
    # Leer y procesar cámaras
    $camarasRaw = Get-Content $config.cameraFile -ErrorAction SilentlyContinue
    if (-not $camarasRaw) {
        Write-Warning "⚠️ No hay cámaras en $($config.cameraFile)"
        return
    }
    
    foreach ($linea in $camarasRaw) {
        if ($linea.Trim() -eq "" -or $linea.StartsWith("#")) { continue }
        $parts = $linea -split "="
        if ($parts.Count -ne 2) { 
            Write-Warning "❗ Línea inválida: $linea"
            continue 
        }
        $camId = $parts[0].Trim()
        $localRtsp = $parts[1].Trim()
        Start-CameraStreaming -CamId $camId -LocalRtsp $localRtsp
    }
    
    Write-Host ""
    Write-Host "✅ Todos los procesos están corriendo" -ForegroundColor Green
    Write-Host "📄 URLs públicas guardadas en: $($config.outputFile)" -ForegroundColor Cyan
    Write-Host "⚠️  Presiona Ctrl+C para detenerlos" -ForegroundColor Yellow
    
    # Mantener consola abierta
    while ($true) { Start-Sleep -Seconds 1 }
}

function Show-Menu {
    Clear-Host
    Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║    SETUP MULTI-CÁMARA FRP - Menú Principal   ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. ▶️  Iniciar todos los servicios y cámaras" -ForegroundColor White
    Write-Host "2. ➕ Agregar nueva cámara" -ForegroundColor White
    Write-Host "3. ➖ Eliminar cámara" -ForegroundColor White
    Write-Host "4. 📋 Listar cámaras" -ForegroundColor White
    Write-Host "5. 🧹 Detener todos los servicios" -ForegroundColor White
    Write-Host "6. 📝 Ver logs de una cámara" -ForegroundColor White
    Write-Host "0. ❌ Salir" -ForegroundColor White
    Write-Host ""
}

function Show-Logs {
    List-Cameras
    $camId = Read-Host "`nID de la cámara para ver logs"
    $logFile = ".\$($config.logDirectory)\$camId-err.log"
    
    if (Test-Path $logFile) {
        Write-Host "`n📝 Últimas 30 líneas de logs:" -ForegroundColor Cyan
        Get-Content $logFile -Tail 30
    } else {
        Write-Warning "⚠️ No se encontró archivo de log para '$camId'"
    }
    Read-Host "`nPresiona Enter para continuar"
}

# ===================================================================
# Lógica principal
# ===================================================================

if ($Action -eq "start") {
    Start-AllCameras
}
elseif ($Action -eq "add" -and $CameraId -and $RtspUrl) {
    Add-Camera -Id $CameraId -Url $RtspUrl
}
elseif ($Action -eq "menu") {
    while ($true) {
        Show-Menu
        $opcion = Read-Host "Selecciona una opción"
        
        switch ($opcion) {
            "1" { Start-AllCameras }
            "2" { Add-Camera }
            "3" { Remove-Camera }
            "4" { List-Cameras; Read-Host "`nPresiona Enter para continuar" }
            "5" { Stop-AllProcesses; Read-Host "`nPresiona Enter para continuar" }
            "6" { Show-Logs }
            "0" { exit }
            default { Write-Warning "Opción inválida" }
        }
    }
}
else {
    Write-Host "Uso:" -ForegroundColor Cyan
    Write-Host "  .\setup-multicam-frp.ps1                                    # Menú interactivo" -ForegroundColor White
    Write-Host "  .\setup-multicam-frp.ps1 -Action start                      # Iniciar todo" -ForegroundColor White
    Write-Host "  .\setup-multicam-frp.ps1 -Action add -CameraId cam1 -RtspUrl rtsp://..." -ForegroundColor White
}
