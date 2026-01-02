@echo off
REM ===================================================================
REM Instalador de Inicio Automatico - Requiere privilegios de administrador
REM ===================================================================

echo ========================================
echo  INSTALAR INICIO AUTOMATICO
echo ========================================
echo.

REM Verificar si se ejecuta como administrador
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERROR] Este script requiere privilegios de Administrador
    echo.
    echo Haz clic derecho en este archivo y selecciona "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo [OK] Ejecutando como administrador
echo.

REM Detectar ruta de PowerShell
set "PS_PATH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_PATH%" (
    set "PS_PATH=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
)

if not exist "%PS_PATH%" (
    echo [ERROR] No se encuentra PowerShell
    pause
    exit /b 1
)

echo Configurando inicio automatico...
echo.

REM Verificar que existe el script de PowerShell
if not exist "%~dp0setup-multicam-cloudflared.ps1" (
    echo [ERROR] No se encuentra setup-multicam-cloudflared.ps1
    echo Asegurate de ejecutar este archivo desde la carpeta aamaster
    echo.
    pause
    exit /b 1
)

REM Crear tarea programada usando un script PowerShell temporal
echo $ErrorActionPreference = 'Stop' > "%TEMP%\install-task.ps1"
echo try { >> "%TEMP%\install-task.ps1"
echo     $taskName = 'CamarasCloudflare' >> "%TEMP%\install-task.ps1"
echo     $scriptPath = '%~dp0setup-multicam-cloudflared.ps1' >> "%TEMP%\install-task.ps1"
echo     $workDir = '%~dp0' >> "%TEMP%\install-task.ps1"
echo. >> "%TEMP%\install-task.ps1"
echo     Write-Host "Eliminando tarea anterior si existe..." >> "%TEMP%\install-task.ps1"
echo     $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue >> "%TEMP%\install-task.ps1"
echo     if ($existingTask) { >> "%TEMP%\install-task.ps1"
echo         Unregister-ScheduledTask -TaskName $taskName -Confirm:$false >> "%TEMP%\install-task.ps1"
echo         Write-Host "Tarea anterior eliminada" >> "%TEMP%\install-task.ps1"
echo     } >> "%TEMP%\install-task.ps1"
echo. >> "%TEMP%\install-task.ps1"
echo     Write-Host "Creando nueva tarea programada..." >> "%TEMP%\install-task.ps1"
echo     $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File `"$scriptPath`" -Action start" -WorkingDirectory $workDir >> "%TEMP%\install-task.ps1"
echo     $trigger = New-ScheduledTaskTrigger -AtLogOn >> "%TEMP%\install-task.ps1"
echo     $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest >> "%TEMP%\install-task.ps1"
echo     $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable >> "%TEMP%\install-task.ps1"
echo. >> "%TEMP%\install-task.ps1"
echo     $result = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Inicia automaticamente el sistema de camaras con Cloudflare Tunnel' >> "%TEMP%\install-task.ps1"
echo. >> "%TEMP%\install-task.ps1"
echo     if ($result) { >> "%TEMP%\install-task.ps1"
echo         Write-Host "[OK] Tarea programada creada exitosamente" -ForegroundColor Green >> "%TEMP%\install-task.ps1"
echo         exit 0 >> "%TEMP%\install-task.ps1"
echo     } >> "%TEMP%\install-task.ps1"
echo } catch { >> "%TEMP%\install-task.ps1"
echo     Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red >> "%TEMP%\install-task.ps1"
echo     exit 1 >> "%TEMP%\install-task.ps1"
echo } >> "%TEMP%\install-task.ps1"

"%PS_PATH%" -ExecutionPolicy Bypass -NoProfile -File "%TEMP%\install-task.ps1"
set ERROR_CODE=%ERRORLEVEL%

REM Limpiar archivo temporal
del "%TEMP%\install-task.ps1" >nul 2>&1

echo.
if %ERROR_CODE% EQU 0 (
    echo.
    echo ========================================
    echo [OK] Inicio automatico configurado!
    echo ========================================
    echo.
    echo El servicio se iniciara automaticamente cuando:
    echo   - Inicies sesion en Windows
    echo   - Reinicies el sistema
    echo.
    echo Puedes verificar la tarea en: Programador de tareas ^> CamarasCloudflare
    echo.
) else (
    echo.
    echo [ERROR] Hubo un problema al configurar el inicio automatico
    echo.
)

pause
