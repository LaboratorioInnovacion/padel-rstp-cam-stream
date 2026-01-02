# ===================================================================
# verificar-sistema.ps1
# Verifica archivos necesarios antes de ejecutar
# ===================================================================

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verificacion de Sistema - Multi-Camara" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Archivos ejecutables necesarios
$executables = @("mediamtx.exe", "ffmpeg.exe", "frpc.exe")

# Archivos de configuración necesarios
$configFiles = @("config.json", "frpc.toml", "camaras.txt")

Write-Host "Verificando archivos necesarios..." -ForegroundColor Cyan
Write-Host ""

$missing = @()
$allOk = $true

# Verificar ejecutables
Write-Host "EJECUTABLES:" -ForegroundColor Yellow
foreach ($file in $executables) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FALTA] $file" -ForegroundColor Red
        $missing += $file
        $allOk = $false
    }
}

Write-Host ""
Write-Host "CONFIGURACION:" -ForegroundColor Yellow
# Verificar archivos de configuración
foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FALTA] $file" -ForegroundColor Yellow
        if ($file -eq "camaras.txt") {
            Write-Host "    Creando archivo vacio..." -ForegroundColor Gray
            "# Formato: ID=URL_RTSP" | Out-File $file
            "# Ejemplo: cam1=rtsp://admin:pass@192.168.1.100:554/stream1" | Add-Content $file
            Write-Host "    [OK] Archivo creado (debes editarlo)" -ForegroundColor Green
        } else {
            $allOk = $false
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allOk) {
    Write-Host "TODO LISTO" -ForegroundColor Green
    Write-Host "Puedes ejecutar: iniciar.bat" -ForegroundColor Cyan
} else {
    Write-Host "FALTAN ARCHIVOS" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTRUCCIONES DE DESCARGA:" -ForegroundColor Cyan
    Write-Host ""
    
    if ($missing -contains "mediamtx.exe") {
        Write-Host "MediaMTX (Servidor RTSP):" -ForegroundColor White
        Write-Host "  1. https://github.com/bluenviron/mediamtx/releases/latest" -ForegroundColor Gray
        Write-Host "  2. Descargar: mediamtx_*_windows_amd64.zip" -ForegroundColor Gray
        Write-Host "  3. Extraer mediamtx.exe aqui" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($missing -contains "ffmpeg.exe") {
        Write-Host "FFmpeg (Procesador de video):" -ForegroundColor White
        Write-Host "  1. https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -ForegroundColor Gray
        Write-Host "  2. Extraer ffmpeg.exe de bin/ aqui" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($missing -contains "frpc.exe") {
        Write-Host "FRP Client:" -ForegroundColor White
        Write-Host "  1. https://github.com/fatedier/frp/releases/latest" -ForegroundColor Gray
        Write-Host "  2. Descargar: frp_*_windows_amd64.zip" -ForegroundColor Gray
        Write-Host "  3. Extraer frpc.exe aqui" -ForegroundColor Gray
        Write-Host ""
    }
    
    if (-not (Test-Path "config.json")) {
        Write-Host "config.json: Archivo de configuracion faltante" -ForegroundColor White
        Write-Host ""
    }
    
    if (-not (Test-Path "frpc.toml")) {
        Write-Host "frpc.toml: Archivo de configuracion FRP faltante" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host ""
Write-Host "Despues de descargar, ejecuta este script nuevamente" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para salir"
