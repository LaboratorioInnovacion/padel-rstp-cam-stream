# Cloudflared Auto-Setup Script
# Este script diagnostica y soluciona automáticamente problemas de conectividad con Cloudflare

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 Cloudflared Auto-Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$binPath = "$PSScriptRoot\bin\cloudflared.exe"
$hasErrors = $false

# Función para verificar si se está ejecutando como administrador
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 1. Verificar si cloudflared.exe existe
Write-Host "📁 Verificando binario..." -ForegroundColor Yellow
if (Test-Path $binPath) {
    Write-Host "   ✅ cloudflared.exe encontrado" -ForegroundColor Green
} else {
    Write-Host "   ❌ cloudflared.exe NO encontrado en: $binPath" -ForegroundColor Red
    Write-Host "   Descarga desde: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Yellow
    exit 1
}

# 2. Desbloquear archivo si está bloqueado
Write-Host ""
Write-Host "🔓 Desbloqueando cloudflared.exe..." -ForegroundColor Yellow
try {
    Unblock-File -Path $binPath -ErrorAction Stop
    Write-Host "   ✅ Archivo desbloqueado" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  No se pudo desbloquear (puede que ya esté desbloqueado)" -ForegroundColor Yellow
}

# 3. Test de conectividad básica
Write-Host ""
Write-Host "🌐 Probando conectividad a Internet..." -ForegroundColor Yellow
try {
    $testInternet = Test-NetConnection -ComputerName 1.1.1.1 -Port 443 -WarningAction SilentlyContinue -ErrorAction Stop
    if ($testInternet.TcpTestSucceeded) {
        Write-Host "   ✅ Conexión a Internet OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ No hay conexión a Internet" -ForegroundColor Red
        $hasErrors = $true
    }
} catch {
    Write-Host "   ❌ Error al probar conectividad: $_" -ForegroundColor Red
    $hasErrors = $true
}

# 4. Test de DNS para api.trycloudflare.com
Write-Host ""
Write-Host "🔍 Probando DNS de Cloudflare..." -ForegroundColor Yellow
try {
    $dnsTest = Resolve-DnsName -Name api.trycloudflare.com -ErrorAction Stop
    if ($dnsTest) {
        Write-Host "   ✅ DNS resuelve correctamente" -ForegroundColor Green
        Write-Host "   IP: $($dnsTest[0].IPAddress)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ DNS no puede resolver api.trycloudflare.com" -ForegroundColor Red
    $hasErrors = $true
    
    # Ofrecer cambiar DNS
    Write-Host ""
    Write-Host "💡 Solución: Cambiar DNS a Cloudflare DNS (1.1.1.1)" -ForegroundColor Yellow
    $changeDNS = Read-Host "   ¿Deseas cambiar el DNS automáticamente? (S/N)"
    
    if ($changeDNS -eq "S" -or $changeDNS -eq "s") {
        if (Test-Administrator) {
            Write-Host "   🔧 Cambiando DNS..." -ForegroundColor Yellow
            
            # Obtener adaptador de red activo
            $adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1
            
            if ($adapter) {
                Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses ("1.1.1.1","1.0.0.1")
                Write-Host "   ✅ DNS cambiado a Cloudflare DNS (1.1.1.1, 1.0.0.1)" -ForegroundColor Green
                Write-Host "   ⚠️  Reinicia la aplicación Electron para aplicar cambios" -ForegroundColor Yellow
            } else {
                Write-Host "   ❌ No se encontró adaptador de red activo" -ForegroundColor Red
            }
        } else {
            Write-Host "   ❌ Se requieren permisos de administrador" -ForegroundColor Red
            Write-Host "   Ejecuta este script como Administrador o cambia DNS manualmente:" -ForegroundColor Yellow
            Write-Host "   1. Panel de Control > Redes > Propiedades > IPv4" -ForegroundColor Cyan
            Write-Host "   2. DNS preferido: 1.1.1.1" -ForegroundColor Cyan
            Write-Host "   3. DNS alternativo: 1.0.0.1" -ForegroundColor Cyan
        }
    }
}

# 5. Test de conectividad a api.trycloudflare.com
Write-Host ""
Write-Host "🌐 Probando conexión a api.trycloudflare.com..." -ForegroundColor Yellow
try {
    $testCloudflare = Test-NetConnection -ComputerName api.trycloudflare.com -Port 443 -WarningAction SilentlyContinue -ErrorAction Stop
    if ($testCloudflare.TcpTestSucceeded) {
        Write-Host "   ✅ Conexión a Cloudflare OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ No se puede conectar a Cloudflare" -ForegroundColor Red
        $hasErrors = $true
    }
} catch {
    Write-Host "   ❌ Error al conectar a Cloudflare: $_" -ForegroundColor Red
    $hasErrors = $true
}

# 6. Crear regla de firewall
Write-Host ""
Write-Host "🔥 Verificando regla de firewall..." -ForegroundColor Yellow
if (Test-Administrator) {
    try {
        $existingRule = Get-NetFirewallRule -DisplayName "Cloudflared Tunnel" -ErrorAction SilentlyContinue
        if ($existingRule) {
            Write-Host "   ✅ Regla de firewall ya existe" -ForegroundColor Green
        } else {
            Write-Host "   🔧 Creando regla de firewall..." -ForegroundColor Yellow
            New-NetFirewallRule -DisplayName "Cloudflared Tunnel" `
                                -Direction Outbound `
                                -Program $binPath `
                                -Action Allow `
                                -Profile Any `
                                -ErrorAction Stop | Out-Null
            Write-Host "   ✅ Regla de firewall creada" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️  No se pudo crear regla de firewall: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Se requieren permisos de administrador para crear regla de firewall" -ForegroundColor Yellow
    Write-Host "   Ejecuta como Administrador para crear la regla automáticamente" -ForegroundColor Cyan
}

# 7. Prueba final - ejecutar cloudflared manualmente
if (-not $hasErrors) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "🧪 Prueba Final: Ejecutando cloudflared" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Presiona Ctrl+C para detener cuando veas la URL del túnel" -ForegroundColor Yellow
    Write-Host ""
    
    Start-Sleep -Seconds 2
    
    & $binPath tunnel --url http://localhost:8888
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Errores Detectados" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor resuelve los errores arriba antes de continuar." -ForegroundColor Yellow
    Write-Host "Si cambiaste el DNS, reinicia la app Electron con: rs" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
