@echo off
setlocal

REM Configuración
set CAMERA_IP=192.168.1.65
set CAMERA_USER=augustodelcampo97
set CAMERA_PASS=Nodotecnologico1*
set STREAM_PATH=stream1
set CAMERA_ID=camCasa1
set SERVER_URL=https://servercamcanchas.onrender.com/api/register-camera

REM Ejecutar PowerShell
powershell -ExecutionPolicy Bypass -File setup-tunnel.ps1 ^
    -CameraLocalIp %CAMERA_IP% ^
    -CameraUser %CAMERA_USER% ^
    -CameraPass %CAMERA_PASS% ^
    -StreamPath %STREAM_PATH% ^
    -CameraId %CAMERA_ID% ^
    -ServerUrl %SERVER_URL%

pause
