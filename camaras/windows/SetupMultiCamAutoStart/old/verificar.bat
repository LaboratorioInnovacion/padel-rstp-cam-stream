@echo off
REM ===================================================================
REM Verificar Sistema
REM Verifica que todos los archivos necesarios esten presentes
REM ===================================================================

echo Verificando sistema...
echo.

REM Detectar ruta de PowerShell
set "PS_PATH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_PATH%" (
    set "PS_PATH=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
)

if not exist "%PS_PATH%" (
    echo ERROR: No se encuentra PowerShell
    pause
    exit /b 1
)

"%PS_PATH%" -ExecutionPolicy Bypass -NoProfile -File "%~dp0verificar-sistema.ps1"
pause
