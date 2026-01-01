@echo off
REM ===================================================================
REM Iniciar Setup Multi-Camara FRP
REM Este archivo bypasea restricciones de PowerShell
REM ===================================================================

echo ========================================
echo  Setup Multi-Camara FRP
echo ========================================
echo.

REM Detectar ruta de PowerShell
set "PS_PATH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_PATH%" (
    set "PS_PATH=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
)

if not exist "%PS_PATH%" (
    echo ERROR: No se encuentra PowerShell
    echo Por favor instala PowerShell o ejecuta directamente: setup-multicam-frp.ps1
    pause
    exit /b 1
)

REM Ejecutar PowerShell con bypass de politica de ejecucion
"%PS_PATH%" -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup-multicam-frp.ps1"

REM Si hay error, mantener ventana abierta
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: El script termino con errores
    pause
)
