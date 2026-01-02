# ===================================================================
# setup-multicam-frp.ps1 - Version Simplificada
# Automatiza MediaMTX, FRP y registro en backend
# ===================================================================

param(
    [string]$Action = "menu"
)

$ErrorActionPreference = "Continue"

# Cargar configuración
if (-not (Test-Path ".\config.json")) {
    Write-Host "Error: No se encontro config.json" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$config = Get-Content ".\config.json" | ConvertFrom-Json

# ===================================================================
# FUNCIONES
# ===================================================================

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SETUP MULTI-CAMARA FRP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Iniciar todos los servicios" -ForegroundColor White
    Write-Host "2. Agregar camara" -ForegroundColor White
    Write-Host "3. Listar camaras" -ForegroundColor White
    Write-Host "4. Detener servicios" -ForegroundColor White
    Write-Host "0. Salir" -ForegroundColor White
    Write-Host ""
}

function Start-Services {
    Write-Host ""
    Write-Host "Deteniendo procesos previos..." -ForegroundColor Yellow
    Get-Process -Name mediamtx, frpc, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    Write-Host "Iniciando MediaMTX..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"
    Start-Sleep -Seconds 3
    
    if (Get-Process -Name "mediamtx" -ErrorAction SilentlyContinue) {
        Write-Host "[OK] MediaMTX iniciado" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] MediaMTX no se inicio" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    Write-Host "Iniciando FRPC..." -ForegroundColor Cyan
    
    # Crear directorio de logs si no existe
    if (-not (Test-Path ".\logs")) {
        New-Item -ItemType Directory -Path ".\logs" | Out-Null
    }
    
    # Verificar que frpc.toml existe
    if (-not (Test-Path ".\frpc.toml")) {
        Write-Host "[ERROR] No se encuentra frpc.toml" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    # Iniciar FRPC con ruta absoluta al archivo de configuración
    $configPath = Resolve-Path ".\frpc.toml"
    Write-Host "Usando configuracion: $configPath" -ForegroundColor Gray
    Start-Process -NoNewWindow -FilePath ".\frpc.exe" -ArgumentList "-c `"$configPath`""
    Start-Sleep -Seconds 5
    
    if (Get-Process -Name "frpc" -ErrorAction SilentlyContinue) {
        Write-Host "[OK] FRPC conectado" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] FRPC no se inicio" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    # Limpiar archivo de URLs
    if (Test-Path $config.outputFile) {
        Remove-Item $config.outputFile
    }
    
    # Leer camaras
    if (-not (Test-Path $config.cameraFile)) {
        Write-Host "[ERROR] No existe $($config.cameraFile)" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    $cameras = Get-Content $config.cameraFile
    
    foreach ($line in $cameras) {
        if ($line.Trim() -eq "" -or $line.StartsWith("#")) { continue }
        
        # Formato: ID|HOST|PORT|USER|PASS|PATH
        # Ejemplo: cam1|192.168.1.100|554|admin|password123|/stream1
        $parts = $line -split "\|"
        if ($parts.Count -lt 6) {
            # Formato antiguo: ID=rtsp://...
            $oldParts = $line -split "="
            if ($oldParts.Count -eq 2) {
                $camId = $oldParts[0].Trim()
                $rtspUrl = $oldParts[1].Trim()
            } else {
                continue
            }
        } else {
            # Formato nuevo
            $camId = $parts[0].Trim()
            $cameraHost = $parts[1].Trim()
            $port = $parts[2].Trim()
            $user = $parts[3].Trim()
            $pass = $parts[4].Trim()
            $path = $parts[5].Trim()
            $rtspUrl = "rtsp://${user}:${pass}@${cameraHost}:${port}${path}"
        }
        
        Write-Host ""
        Write-Host "Iniciando camara: $camId" -ForegroundColor Cyan
        
        $rtspTarget = "rtsp://localhost:$($config.mediaRtspPort)/$camId"
        
        if (-not (Test-Path $config.logDirectory)) {
            New-Item -ItemType Directory -Path $config.logDirectory | Out-Null
        }
        
        $ffmpegArgs = @(
            "-rtsp_transport", "tcp",
            "-i", $rtspUrl,
            "-c", "copy",
            "-f", "rtsp",
            $rtspTarget
        )
        
        Start-Process -WindowStyle Hidden -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs `
            -RedirectStandardOutput ".\$($config.logDirectory)\$camId-out.log" `
            -RedirectStandardError ".\$($config.logDirectory)\$camId-err.log"
        
        Start-Sleep -Seconds 5
        
        # Registrar en backend
        $publicUrl = "rtsp://$($config.rtspPublicHost):$($config.rtspPublicPort)/$camId"
        $registerUrl = "$($config.serverUrl):$($config.serverPort)/api/register"
        
        Write-Host "Registrando en backend..." -ForegroundColor Gray
        
        $body = @{
            camId = $camId
            publicUrl = $publicUrl
        } | ConvertTo-Json
        
        try {
            Invoke-RestMethod -Uri $registerUrl -Method POST -Body $body -ContentType "application/json" | Out-Null
            Write-Host "[OK] Registrada: $camId" -ForegroundColor Green
            "$camId = $publicUrl" | Out-File -FilePath $config.outputFile -Append
        } catch {
            Write-Host "[WARN] No se pudo registrar: $camId" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TODO INICIADO" -ForegroundColor Green
    Write-Host "URLs publicas en: $($config.outputFile)" -ForegroundColor Cyan
    Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
    Write-Host ""
    
    while ($true) { Start-Sleep -Seconds 1 }
}

function Add-Camera {
    Write-Host ""
    $camId = Read-Host "ID de la camara (ej: cam1)"
    $cameraHost = Read-Host "IP o host de la camara (ej: 192.168.1.100)"
    $port = Read-Host "Puerto RTSP (ej: 554)"
    $user = Read-Host "Usuario (ej: admin)"
    $pass = Read-Host "Contrasena"
    $path = Read-Host "Path del stream (ej: /stream1 o /Streaming/Channels/101)"
    
    if (-not $camId -or -not $cameraHost) {
        Write-Host "[ERROR] Datos invalidos" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    # Valores por defecto
    if (-not $port) { $port = "554" }
    if (-not $user) { $user = "admin" }
    if (-not $pass) { $pass = "admin" }
    if (-not $path) { $path = "/stream1" }
    
    # Formato: ID|HOST|PORT|USER|PASS|PATH
    "$camId|$cameraHost|$port|$user|$pass|$path" | Add-Content $config.cameraFile
    Write-Host "[OK] Camara agregada" -ForegroundColor Green
    Read-Host "Presiona Enter"
}

function List-Cameras {
    Write-Host ""
    Write-Host "CAMARAS REGISTRADAS:" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan
    
    if (-not (Test-Path $config.cameraFile)) {
        Write-Host "[ERROR] No existe $($config.cameraFile)" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    $cameras = Get-Content $config.cameraFile
    
    foreach ($line in $cameras) {
        if ($line.Trim() -eq "" -or $line.StartsWith("#")) { continue }
        
        # Formato: ID|HOST|PORT|USER|PASS|PATH
        $parts = $line -split "\|"
        if ($parts.Count -ge 6) {
            $camId = $parts[0].Trim()
            $cameraHost = $parts[1].Trim()
            $port = $parts[2].Trim()
            $user = $parts[3].Trim()
            $path = $parts[5].Trim()
            $displayUrl = "rtsp://${user}:****@${cameraHost}:${port}${path}"
            Write-Host "  $camId -> $displayUrl" -ForegroundColor White
        } else {
            # Formato antiguo
            $oldParts = $line -split "="
            if ($oldParts.Count -eq 2) {
                Write-Host "  $($oldParts[0]) -> $($oldParts[1])" -ForegroundColor White
            }
        }
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Stop-Services {
    Write-Host ""
    Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
    Get-Process -Name mediamtx, frpc, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "[OK] Servicios detenidos" -ForegroundColor Green
    Read-Host "Presiona Enter"
}

# ===================================================================
# LOGICA PRINCIPAL
# ===================================================================

if ($Action -eq "start") {
    Start-Services
} elseif ($Action -eq "menu") {
    while ($true) {
        Show-Menu
        $opcion = Read-Host "Opcion"
        
        switch ($opcion) {
            "1" { Start-Services }
            "2" { Add-Camera }
            "3" { List-Cameras }
            "4" { Stop-Services }
            "0" { exit }
            default { Write-Host "Opcion invalida" -ForegroundColor Red; Start-Sleep -Seconds 1 }
        }
    }
} else {
    Write-Host "Uso: .\setup-multicam-frp.ps1" -ForegroundColor Cyan
    Write-Host "     .\setup-multicam-frp.ps1 -Action start" -ForegroundColor Cyan
}
