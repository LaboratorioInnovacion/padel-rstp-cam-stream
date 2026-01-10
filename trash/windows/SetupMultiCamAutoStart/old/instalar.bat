
@echo off
REM Crea una tarea programada para ejecutar el script PowerShell al inicio
set SCRIPT_PATH=%~dp0setup-multicam.ps1
schtasks /create /tn "SetupMultiCam" /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_PATH%\"" /sc onstart /ru SYSTEM /f
echo Tarea programada creada con éxito.
pause
