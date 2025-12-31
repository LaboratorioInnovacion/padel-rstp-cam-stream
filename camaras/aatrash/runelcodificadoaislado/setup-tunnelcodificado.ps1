# setup-tunnel.ps1 - Script para configurar túnel ngrok, notificar al servidor y ejecutar el BAT

# --- CONFIGURACIÓN ---
$serverUrl = "https://servercamcanchas.onrender.com/api/register"  # URL del servidor
$port = 8554                                                       # Puerto local RTSP
$batFile = ".\iniciar-camara-tapo.bat"                             # Archivo BAT a ejecutar
$ngrokExe = ".\ngrok.exe"                                          # Ejecutable de ngrok

# --- FUNCIONES ---

# Descargar ngrok si no existe
function Download-Ngrok {
    Write-Output "[Downloading ngrok...]"
    Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-stable-windows-amd64.zip" -OutFile "ngrok.zip"
    Expand-Archive -Path "ngrok.zip" -DestinationPath .
    Remove-Item "ngrok.zip"
}

# Verificar si ngrok está disponible y autenticado
function Validate-Ngrok {
    if (-not (Test-Path $ngrokExe)) {
        Download-Ngrok
    }
    
    $ngrokAuthPath = "$env:USERPROFILE\.ngrok2\ngrok.yml"
    if (-not (Test-Path $ngrokAuthPath)) {
        $token = Read-Host "[Enter your ngrok authentication token]"
        & $ngrokExe config add-authtoken $token
    } else {
        Write-Output "[ngrok is already authenticated]"
    }
}

# Obtener la URL pública de ngrok
function Get-NgrokPublicUrl {
    Start-Sleep -Seconds 6  # Esperar unos segundos para que ngrok levante el túnel

    try {
        $apiResult = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
        $publicUrl = $apiResult.tunnels[0].public_url -replace 'tcp://', ''
        Write-Output "[Public RTSP URL: $publicUrl]"
        return $publicUrl
    } catch {
        Write-Error "[ERROR: Could not obtain the public URL from ngrok. Ensure that ngrok is running.]"
        exit 1
    }
}

# Notificar al servidor central
function Notify-Server ($camId, $publicUrl) {
    try {
        $body = @{ camId = $camId; publicUrl = $publicUrl }
        $jsonBody = $body | ConvertTo-Json -Depth 3
        Invoke-RestMethod -Uri $serverUrl -Method Post -Body $jsonBody -ContentType "application/json"
        Write-Output "[Public URL successfully sent to the server]"
    } catch {
        Write-Warning "[WARNING: Could not notify the server]"
    }
}

# Ejecutar el archivo BAT
function Execute-Bat {
    if (Test-Path $batFile) {
        Write-Output "[Executing $batFile]"
        Start-Process -NoNewWindow -FilePath $batFile
    } else {
        Write-Warning "[WARNING: $batFile not found, skipping BAT execution]"
    }
}

# --- EJECUCIÓN DEL SCRIPT ---

# Validar que el servicio RTSP está activo antes de iniciar el túnel
if (-not (Test-NetConnection -ComputerName "localhost" -Port $port).TcpTestSucceeded) {
    Write-Warning "[WARNING: Port $port is not responding locally]"
    exit 1
}

Validate-Ngrok

$camId = Read-Host "[Enter camera ID (e.g., cam1)]"
Write-Output "[Starting TCP tunnel on port $port...]"
Start-Process -NoNewWindow -FilePath $ngrokExe -ArgumentList "tcp $port"

$publicUrl = Get-NgrokPublicUrl
Notify-Server $camId $publicUrl
Execute-Bat
