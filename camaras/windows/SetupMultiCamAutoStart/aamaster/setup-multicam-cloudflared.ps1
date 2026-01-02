# ===================================================================
# setup-multicam-cloudflared.ps1 - Version Cloudflare Tunnel
# Automatiza MediaMTX, Cloudflare Tunnel y registro en backend
# Usa HLS en lugar de RTSP para compatibilidad con Cloudflare
# ===================================================================

param(
    [string]$Action = "menu"
)

$ErrorActionPreference = "Continue"

# Variables globales para reconexión
$global:CameraProcesses = @{}
$global:ReconnectionAttempts = @{}
$global:MaxReconnectionAttempts = 999  # Intentos infinitos
$global:ReconnectionInterval = 10  # Segundos entre chequeos
$global:ReconnectionDelay = 5  # Segundos antes de reintentar
$global:StateFile = ".\service-state.json"
$global:RunningInBackground = $false

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

function Start-CameraStream {
    param(
        [string]$CamId,
        [string]$RtspUrl,
        [string]$RtspTarget
    )
    
    if (-not (Test-Path $config.logDirectory)) {
        New-Item -ItemType Directory -Path $config.logDirectory | Out-Null
    }
    
    $ffmpegArgs = @(
        "-rtsp_transport", "tcp",
        "-i", $RtspUrl,
        "-c", "copy",
        "-f", "rtsp",
        $RtspTarget
    )
    
    $process = Start-Process -PassThru -WindowStyle Hidden -FilePath ".\ffmpeg.exe" -ArgumentList $ffmpegArgs `
        -RedirectStandardOutput ".\$($config.logDirectory)\$CamId-out.log" `
        -RedirectStandardError ".\$($config.logDirectory)\$CamId-err.log"
    
    return $process
}

function Monitor-CameraProcesses {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    foreach ($camId in $global:CameraProcesses.Keys) {
        $camInfo = $global:CameraProcesses[$camId]
        
        # Verificar si el proceso sigue activo
        $processAlive = $false
        if ($camInfo.Process -and $camInfo.Process.Id) {
            try {
                $processAlive = -not (Get-Process -Id $camInfo.Process.Id -ErrorAction SilentlyContinue).HasExited
            } catch {
                $processAlive = $false
            }
        }
        
        if (-not $processAlive) {
            # Incrementar contador de intentos
            if (-not $global:ReconnectionAttempts.ContainsKey($camId)) {
                $global:ReconnectionAttempts[$camId] = 0
            }
            $global:ReconnectionAttempts[$camId]++
            
            Write-Host "[$timestamp] [RECONEXION] Camara $camId caida - Intento #$($global:ReconnectionAttempts[$camId])" -ForegroundColor Yellow
            
            # Esperar antes de reintentar
            Start-Sleep -Seconds $global:ReconnectionDelay
            
            # Reiniciar el stream
            try {
                $newProcess = Start-CameraStream -CamId $camId -RtspUrl $camInfo.RtspUrl -RtspTarget $camInfo.RtspTarget
                $global:CameraProcesses[$camId].Process = $newProcess
                
                Write-Host "[$timestamp] [OK] Camara $camId reiniciada exitosamente" -ForegroundColor Green
                
                # Registrar reconexión en log
                "$timestamp - Camara $camId reconectada (Intento #$($global:ReconnectionAttempts[$camId]))" | `
                    Out-File -FilePath ".\$($config.logDirectory)\reconexiones.log" -Append
            } catch {
                Write-Host "[$timestamp] [ERROR] Fallo al reiniciar camara $camId : $_" -ForegroundColor Red
            }
        }
    }
}

function Save-ServiceState {
    $state = @{
        PID = $PID
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        Cameras = @($global:CameraProcesses.Keys)
        TunnelUrl = $global:TunnelPublicUrl
    }
    $state | ConvertTo-Json | Out-File -FilePath $global:StateFile
}

function Get-ServiceStatus {
    if (-not (Test-Path $global:StateFile)) {
        return @{ IsRunning = $false }
    }
    
    try {
        $state = Get-Content $global:StateFile | ConvertFrom-Json
        $processRunning = Get-Process -Id $state.PID -ErrorAction SilentlyContinue
        
        if ($processRunning) {
            return @{
                IsRunning = $true
                PID = $state.PID
                CameraCount = $state.Cameras.Count
                TunnelUrl = $state.TunnelUrl
                Timestamp = $state.Timestamp
            }
        } else {
            Remove-Item $global:StateFile -ErrorAction SilentlyContinue
            return @{ IsRunning = $false }
        }
    } catch {
        return @{ IsRunning = $false }
    }
}

function Show-ServiceStatus {
    Write-Host ""
    Write-Host "ESTADO DEL SERVICIO:" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan
    Write-Host ""
    
    $status = Get-ServiceStatus
    
    if ($status.IsRunning) {
        Write-Host "Estado: ACTIVO" -ForegroundColor Green
        Write-Host "PID: $($status.PID)" -ForegroundColor White
        Write-Host "Iniciado: $($status.Timestamp)" -ForegroundColor White
        Write-Host "Camaras: $($status.CameraCount)" -ForegroundColor White
        
        if ($status.TunnelUrl) {
            Write-Host "Tunel: $($status.TunnelUrl)" -ForegroundColor Cyan
        }
        
        # Mostrar log reciente de reconexiones
        $logFile = ".\$($config.logDirectory)\reconexiones.log"
        if (Test-Path $logFile) {
            Write-Host ""
            Write-Host "Ultimas reconexiones:" -ForegroundColor Yellow
            Get-Content $logFile -Tail 5 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "Estado: DETENIDO" -ForegroundColor Red
        Write-Host "No hay servicios ejecutandose" -ForegroundColor Gray
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Start-ServicesBackground {
    Write-Host ""
    Write-Host "Iniciando servicios en segundo plano..." -ForegroundColor Cyan
    Write-Host ""
    
    # Crear script temporal que ejecuta el inicio
    $scriptContent = @"
# Script de inicio en segundo plano
Set-Location '$PWD'
& '$PSCommandPath' -Action start
"@
    
    $tempScript = ".\temp-background-start.ps1"
    $scriptContent | Out-File -FilePath $tempScript
    
    # Iniciar en ventana oculta
    $process = Start-Process -PassThru -WindowStyle Hidden -FilePath "powershell.exe" `
        -ArgumentList "-ExecutionPolicy Bypass -NoProfile -File `"$tempScript`""
    
    Start-Sleep -Seconds 3
    
    # Verificar que se haya iniciado
    $status = Get-ServiceStatus
    if ($status.IsRunning) {
        Write-Host "[OK] Servicios iniciados en segundo plano" -ForegroundColor Green
        Write-Host "    PID: $($status.PID)" -ForegroundColor Gray
        Write-Host "    Usa la opcion 3 del menu para ver el estado" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] No se pudo iniciar el servicio" -ForegroundColor Red
        Write-Host "Intenta iniciar en primer plano para ver errores" -ForegroundColor Yellow
    }
    
    # Limpiar script temporal
    Start-Sleep -Seconds 2
    Remove-Item $tempScript -ErrorAction SilentlyContinue
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SETUP MULTI-CAMARA CLOUDFLARE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Mostrar estado del servicio
    $status = Get-ServiceStatus
    if ($status.IsRunning) {
        Write-Host "[ESTADO] Servicio ACTIVO en segundo plano" -ForegroundColor Green
        Write-Host "         PID: $($status.PID) | Camaras: $($status.CameraCount)" -ForegroundColor Gray
    } else {
        Write-Host "[ESTADO] Servicio detenido" -ForegroundColor Gray
    }
    Write-Host ""
    
    Write-Host "1. Iniciar servicios (primer plano)" -ForegroundColor White
    Write-Host "2. Iniciar servicios (segundo plano)" -ForegroundColor Cyan
    Write-Host "3. Ver estado y monitoreo" -ForegroundColor Yellow
    Write-Host "4. Agregar camara" -ForegroundColor White
    Write-Host "5. Listar camaras" -ForegroundColor White
    Write-Host "6. Ver URL publica del tunel" -ForegroundColor Yellow
    Write-Host "7. Detener servicios" -ForegroundColor White
    Write-Host "" 
    Write-Host "8. Configurar inicio automatico" -ForegroundColor Green
    Write-Host "9. Desinstalar inicio automatico" -ForegroundColor Red
    Write-Host "" 
    Write-Host "10. Configurar tunel Cloudflare (permanente)" -ForegroundColor Magenta
    Write-Host "11. Ver info del tunel" -ForegroundColor Magenta
    Write-Host "" 
    Write-Host "0. Salir" -ForegroundColor White
    Write-Host ""
}

function Start-Services {
    Write-Host ""
    Write-Host "Deteniendo procesos previos..." -ForegroundColor Yellow
    Get-Process -Name mediamtx, cloudflared, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    Write-Host "Iniciando MediaMTX..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath ".\mediamtx.exe"
    Start-Sleep -Seconds 3
    
    if (Get-Process -Name "mediamtx" -ErrorAction SilentlyContinue) {
        Write-Host "[OK] MediaMTX iniciado" -ForegroundColor Green
        Write-Host "    - RTSP: localhost:8554" -ForegroundColor Gray
        Write-Host "    - HLS:  localhost:8888" -ForegroundColor Gray
    } else {
        Write-Host "[ERROR] MediaMTX no se inicio" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    Write-Host "Iniciando Cloudflare Tunnel..." -ForegroundColor Cyan
    
    # Verificar si cloudflared.exe existe
    if (-not (Test-Path ".\cloudflared.exe")) {
        Write-Host "[ERROR] No se encuentra cloudflared.exe" -ForegroundColor Red
        Write-Host "Descargalo desde: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Yellow
        Read-Host "Presiona Enter"
        return
    }
    
    # Verificar si existe configuración permanente
    $hasConfig = Test-Path ".\cloudflared-config.yml"
    
    if ($hasConfig) {
        Write-Host "Usando tunel permanente con DNS..." -ForegroundColor Cyan
        # Iniciar cloudflared con config permanente
        Start-Process -NoNewWindow -FilePath ".\cloudflared.exe" -ArgumentList "tunnel --config .\cloudflared-config.yml run camaras-windows"
        Start-Sleep -Seconds 8
        
        # URL fija configurada
        $global:TunnelPublicUrl = "https://camaras-windows.noaservice.org"
        Write-Host "[OK] Cloudflare Tunnel conectado" -ForegroundColor Green
        Write-Host "    URL Fija: $global:TunnelPublicUrl" -ForegroundColor Green
    } else {
        Write-Host "Usando tunel temporal (Quick Tunnel)..." -ForegroundColor Yellow
        # Iniciar cloudflared tunnel temporal
        Start-Process -NoNewWindow -FilePath ".\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:8888"
        Start-Sleep -Seconds 8
        
        if (-not (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue)) {
            Write-Host "[ERROR] Cloudflare Tunnel no se inicio" -ForegroundColor Red
            Read-Host "Presiona Enter"
            return
        }
        
        Write-Host "[OK] Cloudflare Tunnel conectado" -ForegroundColor Green
        
        # Intentar obtener la URL pública del túnel temporal
        try {
            $metricsUrl = "http://127.0.0.1:51234/metrics"
            $response = Invoke-WebRequest -Uri $metricsUrl -UseBasicParsing -TimeoutSec 5
            $tunnelUrl = ($response.Content -split "`n" | Select-String -Pattern "https://.*\.trycloudflare\.com" | Select-Object -First 1).ToString().Trim()
            
            if ($tunnelUrl -match "(https://[^\s]+\.trycloudflare\.com)") {
                $global:TunnelPublicUrl = $matches[1]
                Write-Host "    URL Publica: $global:TunnelPublicUrl" -ForegroundColor Green
            } else {
                Write-Host "    [WARN] No se pudo obtener URL publica automaticamente" -ForegroundColor Yellow
                Write-Host "    Revisa los logs de cloudflared para ver la URL" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "    [WARN] No se pudo obtener URL del tunel" -ForegroundColor Yellow
        }
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
        
        $rtspTarget = "rtsp://localhost:8554/$camId"
        
        # Iniciar stream y guardar información del proceso
        $process = Start-CameraStream -CamId $camId -RtspUrl $rtspUrl -RtspTarget $rtspTarget
        
        # Guardar información para monitoreo
        $global:CameraProcesses[$camId] = @{
            Process = $process
            RtspUrl = $rtspUrl
            RtspTarget = $rtspTarget
            PublicUrl = ""
        }
        
        # Inicializar contador de reconexiones
        $global:ReconnectionAttempts[$camId] = 0
        
        Start-Sleep -Seconds 5
        
        # Construir URL publica HLS
        if ($global:TunnelPublicUrl) {
            $publicUrl = "$global:TunnelPublicUrl/$camId/index.m3u8"
        } else {
            $publicUrl = "https://camaras-windows.noaservice.org/$camId/index.m3u8"
        }
        
        # Registrar en backend
        $registerUrl = "$($config.serverUrl):$($config.serverPort)/api/register"
        if (-not $config.serverPort) {
            $registerUrl = "$($config.serverUrl)/api/register"
        }
        
        Write-Host "Registrando en backend..." -ForegroundColor Gray
        
        $body = @{
            camId = $camId
            publicUrl = $publicUrl
        } | ConvertTo-Json
        
        try {
            Invoke-RestMethod -Uri $registerUrl -Method POST -Body $body -ContentType "application/json" | Out-Null
            Write-Host "[OK] Registrada: $camId" -ForegroundColor Green
            "$camId = $publicUrl" | Out-File -FilePath $config.outputFile -Append
            
            # Guardar URL pública para referencia
            $global:CameraProcesses[$camId].PublicUrl = $publicUrl
        } catch {
            Write-Host "[WARN] No se pudo registrar: $camId" -ForegroundColor Yellow
        }
    }
    
    # Guardar estado del servicio
    Save-ServiceState
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TODO INICIADO CON RECONEXION AUTOMATICA" -ForegroundColor Green
    if ($global:TunnelPublicUrl) {
        Write-Host "URL del Tunel: $global:TunnelPublicUrl" -ForegroundColor Cyan
    }
    Write-Host "URLs publicas en: $($config.outputFile)" -ForegroundColor Cyan
    Write-Host "Monitoreando camaras cada $global:ReconnectionInterval segundos..." -ForegroundColor Cyan
    Write-Host "PID del proceso: $PID" -ForegroundColor Gray
    Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
    Write-Host ""
    
    # Bucle de monitoreo con reconexión automática
    try {
        while ($true) {
            Start-Sleep -Seconds $global:ReconnectionInterval
            Monitor-CameraProcesses
            Save-ServiceState  # Actualizar estado periódicamente
        }
    } finally {
        # Limpiar estado al salir
        Remove-Item $global:StateFile -ErrorAction SilentlyContinue
    }
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

function Show-TunnelUrl {
    Write-Host ""
    Write-Host "URL PUBLICA DEL TUNEL:" -ForegroundColor Cyan
    Write-Host "======================" -ForegroundColor Cyan
    
    if ($global:TunnelPublicUrl) {
        Write-Host $global:TunnelPublicUrl -ForegroundColor Green
    } else {
        Write-Host "[WARN] No hay tunel activo o no se pudo obtener la URL" -ForegroundColor Yellow
        Write-Host "Inicia los servicios primero (opcion 1)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Install-AutoStart {
    Write-Host ""
    Write-Host "CONFIGURAR INICIO AUTOMATICO" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host ""
    
    $taskName = "CamarasCloudflare"
    $scriptPath = $PSCommandPath
    
    # Verificar si ya existe la tarea
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    
    if ($existingTask) {
        Write-Host "[WARN] Ya existe una tarea de inicio automatico" -ForegroundColor Yellow
        $overwrite = Read-Host "Deseas reemplazarla? (S/N)"
        if ($overwrite -ne "S" -and $overwrite -ne "s") {
            Write-Host "Cancelado" -ForegroundColor Gray
            Read-Host "Presiona Enter"
            return
        }
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
    
    try {
        # Crear accion: ejecutar el script en modo start con ventana oculta
        $action = New-ScheduledTaskAction -Execute "powershell.exe" `
            -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File `"$scriptPath`" -Action start" `
            -WorkingDirectory (Split-Path $scriptPath)
        
        # Crear trigger: al iniciar sesion del usuario
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        
        # Configurar para que se ejecute con mayores privilegios
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
        
        # Configuracion adicional
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        
        # Registrar la tarea
        $result = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Inicia automaticamente el sistema de camaras con Cloudflare Tunnel" -ErrorAction Stop
        
        if ($result) {
            Write-Host "[OK] Inicio automatico configurado exitosamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "El servicio se iniciara automaticamente cuando:" -ForegroundColor White
            Write-Host "  - Inicies sesion en Windows" -ForegroundColor Gray
            Write-Host "  - Reinicies el sistema" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Puedes ver la tarea en: Programador de tareas > $taskName" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "[ERROR] No se pudo configurar el inicio automatico" -ForegroundColor Red
        Write-Host ""
        
        if ($_.Exception.Message -match "Acceso denegado|Access is denied") {
            Write-Host "NECESITAS PERMISOS DE ADMINISTRADOR" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Soluciones:" -ForegroundColor White
            Write-Host ""
            Write-Host "Opcion 1 (RECOMENDADA):" -ForegroundColor Cyan
            Write-Host "  1. Cierra este programa" -ForegroundColor Gray
            Write-Host "  2. Haz clic derecho en: instalar-inicio-automatico.bat" -ForegroundColor Gray
            Write-Host "  3. Selecciona: 'Ejecutar como administrador'" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Opcion 2 (Manual):" -ForegroundColor Cyan
            Write-Host "  1. Presiona Win+R" -ForegroundColor Gray
            Write-Host "  2. Escribe: shell:startup" -ForegroundColor Gray
            Write-Host "  3. Copia este archivo a esa carpeta:" -ForegroundColor Gray
            Write-Host "     $PSScriptRoot\iniciar-cloudflared.bat" -ForegroundColor Yellow
        } else {
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Show-TunnelInfo {
    Write-Host ""
    Write-Host "INFORMACION DEL TUNEL CLOUDFLARE" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Verificar si existe configuración
    if (Test-Path ".\cloudflared-config.yml") {
        Write-Host "[CONFIG] Tunel permanente configurado" -ForegroundColor Green
        Write-Host ""
        
        $config = Get-Content ".\cloudflared-config.yml" -Raw
        Write-Host "Archivo cloudflared-config.yml:" -ForegroundColor Yellow
        Write-Host $config -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "Listando tuneles en tu cuenta:" -ForegroundColor Yellow
        if (Test-Path ".\cloudflared.exe") {
            & ".\cloudflared.exe" tunnel list
        }
    } else {
        Write-Host "[WARN] No hay configuracion permanente" -ForegroundColor Yellow
        Write-Host "El sistema usa tunel temporal (URL cambia en cada reinicio)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Para crear un tunel permanente, ve a la opcion 10" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Setup-CloudflareTunnel {
    Write-Host ""
    Write-Host "CONFIGURAR TUNEL CLOUDFLARE PERMANENTE" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-Path ".\cloudflared.exe")) {
        Write-Host "[ERROR] No se encuentra cloudflared.exe" -ForegroundColor Red
        Write-Host "Descargalo desde: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Presiona Enter"
        return
    }
    
    Write-Host "Esta utilidad te ayudara a configurar un tunel permanente con DNS" -ForegroundColor White
    Write-Host ""
    Write-Host "Pasos que realizaremos:" -ForegroundColor Yellow
    Write-Host "  1. Autenticar con Cloudflare" -ForegroundColor Gray
    Write-Host "  2. Crear el tunel" -ForegroundColor Gray
    Write-Host "  3. Configurar DNS" -ForegroundColor Gray
    Write-Host "  4. Crear archivo de configuracion" -ForegroundColor Gray
    Write-Host ""
    
    $continue = Read-Host "Continuar? (S/N)"
    if ($continue -ne "S" -and $continue -ne "s") {
        return
    }
    
    # Paso 1: Login
    Write-Host ""
    Write-Host "[PASO 1/4] Autenticando con Cloudflare..." -ForegroundColor Cyan
    Write-Host "Se abrira tu navegador. Inicia sesion y selecciona tu dominio" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
    
    & ".\cloudflared.exe" tunnel login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo la autenticacion" -ForegroundColor Red
        Read-Host "Presiona Enter"
        return
    }
    
    Write-Host "[OK] Autenticado correctamente" -ForegroundColor Green
    
    # Paso 2: Crear túnel
    Write-Host ""
    Write-Host "[PASO 2/4] Crear tunel" -ForegroundColor Cyan
    $tunnelName = Read-Host "Nombre del tunel (ej: camaras-windows)"
    if (-not $tunnelName) { $tunnelName = "camaras-windows" }
    
    Write-Host "Creando tunel '$tunnelName'..." -ForegroundColor Gray
    $tunnelOutput = & ".\cloudflared.exe" tunnel create $tunnelName 2>&1 | Out-String
    Write-Host $tunnelOutput
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo la creacion del tunel" -ForegroundColor Red
        Write-Host "Verifica que el nombre no exista ya" -ForegroundColor Yellow
        Read-Host "Presiona Enter"
        return
    }
    
    # Extraer tunnel ID
    if ($tunnelOutput -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
        $tunnelId = $matches[1]
        Write-Host "[OK] Tunel creado con ID: $tunnelId" -ForegroundColor Green
    } else {
        Write-Host "[WARN] No se pudo extraer el ID automaticamente" -ForegroundColor Yellow
        $tunnelId = Read-Host "Ingresa el Tunnel ID manualmente"
    }
    
    # Paso 3: Configurar DNS
    Write-Host ""
    Write-Host "[PASO 3/4] Configurar DNS" -ForegroundColor Cyan
    $domain = Read-Host "Ingresa tu dominio completo (ej: camaras.ejemplo.com)"
    
    if ($domain) {
        Write-Host "Configurando DNS para $domain..." -ForegroundColor Gray
        & ".\cloudflared.exe" tunnel route dns $tunnelName $domain
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] DNS configurado correctamente" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Verifica la configuracion DNS manualmente" -ForegroundColor Yellow
        }
    }
    
    # Paso 4: Crear archivo de configuración
    Write-Host ""
    Write-Host "[PASO 4/4] Crear archivo de configuracion" -ForegroundColor Cyan
    
    $userProfile = $env:USERPROFILE
    $credentialsFile = "$userProfile\.cloudflared\$tunnelId.json"
    
    if (-not (Test-Path $credentialsFile)) {
        Write-Host "[WARN] No se encuentra el archivo de credenciales" -ForegroundColor Yellow
        Write-Host "Esperado en: $credentialsFile" -ForegroundColor Gray
        $credentialsFile = Read-Host "Ingresa la ruta completa del archivo .json"
    }
    
    $configContent = @"
tunnel: $tunnelName
credentials-file: $credentialsFile

ingress:
  - hostname: $domain
    service: http://localhost:8888
  - service: http_status:404
"@
    
    $configContent | Out-File -FilePath ".\cloudflared-config.yml" -Encoding UTF8
    
    Write-Host "[OK] Archivo cloudflared-config.yml creado" -ForegroundColor Green
    Write-Host ""
    Write-Host "Contenido:" -ForegroundColor Yellow
    Write-Host $configContent -ForegroundColor Gray
    
    # Probar el túnel
    Write-Host ""
    Write-Host "Deseas probar el tunel ahora? (S/N)" -ForegroundColor Yellow
    $test = Read-Host
    
    if ($test -eq "S" -or $test -eq "s") {
        Write-Host "Iniciando tunel de prueba..." -ForegroundColor Cyan
        Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
        Write-Host ""
        & ".\cloudflared.exe" tunnel --config ".\cloudflared-config.yml" run $tunnelName
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "CONFIGURACION COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Tu URL publica es: https://$domain" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora puedes usar la opcion 1 o 2 para iniciar el sistema completo" -ForegroundColor White
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Uninstall-AutoStart {
    Write-Host ""
    Write-Host "DESINSTALAR INICIO AUTOMATICO" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host ""
    
    $taskName = "CamarasCloudflare"
    
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    
    if (-not $existingTask) {
        Write-Host "[INFO] No hay tarea de inicio automatico configurada" -ForegroundColor Gray
        Read-Host "Presiona Enter"
        return
    }
    
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "[OK] Inicio automatico desinstalado" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] No se pudo desinstalar" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Read-Host "Presiona Enter"
}

function Stop-Services {
    Write-Host ""
    Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
    
    # Detener proceso principal si está en background
    $status = Get-ServiceStatus
    if ($status.IsRunning) {
        try {
            Stop-Process -Id $status.PID -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Proceso principal detenido (PID: $($status.PID))" -ForegroundColor Green
        } catch {
            Write-Host "[WARN] No se pudo detener proceso principal" -ForegroundColor Yellow
        }
    }
    
    # Detener todos los procesos relacionados
    Get-Process -Name mediamtx, cloudflared, ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Limpiar archivo de estado
    Remove-Item $global:StateFile -ErrorAction SilentlyContinue
    
    Write-Host "[OK] Todos los servicios detenidos" -ForegroundColor Green
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
            "2" { Start-ServicesBackground }
            "3" { Show-ServiceStatus }
            "4" { Add-Camera }
            "5" { List-Cameras }
            "6" { Show-TunnelUrl }
            "7" { Stop-Services }
            "8" { Install-AutoStart }
            "9" { Uninstall-AutoStart }
            "10" { Setup-CloudflareTunnel }
            "11" { Show-TunnelInfo }
            "0" { exit }
            default { Write-Host "Opcion invalida" -ForegroundColor Red; Start-Sleep -Seconds 1 }
        }
    }
} else {
    Write-Host "Uso: .\setup-multicam-cloudflared.ps1" -ForegroundColor Cyan
    Write-Host "     .\setup-multicam-cloudflared.ps1 -Action start" -ForegroundColor Cyan
    Write-Host "     .\setup-multicam-cloudflared.ps1 -Action menu" -ForegroundColor Cyan
}
