@echo off
setlocal enabledelayedexpansion

:: 1. Solicitar ID de la cámara
set /p camId=🟦 Ingresa el ID de la cámara (por ejemplo: cam1): 

:: 2. Ruta RTSP local (de la cámara IP real en tu red local)
set rtspInput=rtsp://augustodelcampo97:Nodotecnologico1*@192.168.1.65/stream1

:: 3. Autenticarse con ngrok si es la primera vez
if not exist "%LOCALAPPDATA%\ngrok\ngrok.yml" (
    echo.
    set /p authtoken=🔑 Ingresa tu token de autenticación ngrok: 
    ngrok config add-authtoken %authtoken%
)

:: 4. Iniciar FFmpeg en otra consola
echo ✅ Iniciando retransmisión con FFmpeg...
start "FFmpeg" cmd /k ffmpeg -rtsp_transport tcp -i "%rtspInput%" -f rtsp rtsp://localhost:8554/stream1

:: 5. Iniciar túnel ngrok TCP al puerto 8554 (en nueva consola separada)
echo ✅ Iniciando túnel ngrok...
start "Ngrok" cmd /k ngrok tcp 8554

:: 6. Esperar a que ngrok esté activo
echo ⏳ Esperando a que ngrok esté disponible...
timeout /t 7 > nul

:: 7. Obtener la URL pública del túnel
for /f "tokens=* delims=" %%A in ('curl -s http://127.0.0.1:4040/api/tunnels') do (
    set "response=%%A"
)

:: 8. Buscar la línea con tcp://
for /f "tokens=1,2 delims=:" %%A in ('echo !response! ^| findstr "tcp://"') do (
    set "tcpurl=%%A:%%B"
)

:: 9. Extraer host y puerto
for /f "tokens=1,2 delims=:" %%A in ("!tcpurl:tcp://=!") do (
    set "host=%%A"
    set "port=%%B"
)

:: 10. Quitar barras y construir URL final
set "port=!port:/=!"
set "rtspUrl=rtsp://!host!!port!/stream1"

echo ✅ URL RTSP pública: !rtspUrl!

:: 11. Enviar al servidor
echo 🔄 Registrando en servidor...
curl -X POST https://servercamcanchas.onrender.com/api/register ^
     -H "Content-Type: application/json" ^
     -d "{\"camId\": \"%camId%\", \"publicUrl\": \"!rtspUrl!\"}"

echo ✅ Cámara %camId% registrada exitosamente.
pause
