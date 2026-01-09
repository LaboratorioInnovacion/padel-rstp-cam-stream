@echo off
echo ========================================
echo    Cloudflared Quick Fix
echo ========================================
echo.

REM Desbloquear archivo
echo Desbloqueando cloudflared.exe...
powershell -Command "Unblock-File -Path '%~dp0bin\cloudflared.exe'"
echo.

REM Probar cloudflared
echo Probando cloudflared manualmente...
echo Presiona Ctrl+C cuando veas la URL del tunel
echo.
cd /d "%~dp0bin"
cloudflared.exe tunnel --url http://localhost:8888

pause
