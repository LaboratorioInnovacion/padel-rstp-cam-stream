# Script PowerShell para instalar servicio con NSSM
# Instalación como servicio con NSSM
$nssm = "C:\tools\nssm.exe"
$svcName = "MultiCamClient"

# Configura servicio para start-all.ps1
& $nssm install $svcName "PowerShell" "-File `"$(Split-Path -Parent $MyInvocation.MyCommand.Definition)\start-all.ps1`""
& $nssm set $svcName Start SERVICE_AUTO_START
& $nssm start $svcName
Write-Host "Servicio $svcName instalado y arrancado."