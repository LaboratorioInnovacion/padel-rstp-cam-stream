# 🌐 Cloudflared - Solución de Problemas

## ❌ Error: "no such host" / "dial tcp: lookup api.trycloudflare.com"

Este error indica que tu PC no puede conectarse a los servidores de Cloudflare.

### Causas Comunes:

1. **Problemas de DNS**
2. **Firewall bloqueando conexiones salientes**
3. **Sin conexión a Internet**
4. **Proxy corporativo**
5. **Antivirus bloqueando cloudflared.exe**

---

## ✅ Soluciones:

### 1. Verificar Conectividad a Internet

Abrir PowerShell y ejecutar:
```powershell
# Test básico de conexión
Test-NetConnection -ComputerName 1.1.1.1 -Port 443

# Test específico a Cloudflare
Test-NetConnection -ComputerName api.trycloudflare.com -Port 443
```

### 2. Probar DNS

```powershell
# Ver tu configuración DNS actual
Get-DnsClientServerAddress -AddressFamily IPv4

# Probar resolver Cloudflare
Resolve-DnsName api.trycloudflare.com

# Si falla, cambiar DNS temporalmente a Cloudflare DNS:
# Red > Propiedades > IPv4 > Usar las siguientes direcciones DNS:
# DNS preferido: 1.1.1.1
# DNS alternativo: 1.0.0.1
```

### 3. Verificar Firewall

```powershell
# Verificar si el firewall está bloqueando
Get-NetFirewallProfile | Select-Object Name, Enabled

# Agregar excepción para cloudflared (Ejecutar como Administrador)
$binPath = "E:\vps\camaras\camaras-lab-firstpush\padel-rstp-cam-stream\tunel-electronpc\stream-agent\bin\cloudflared.exe"
New-NetFirewallRule -DisplayName "Cloudflared Tunnel" -Direction Outbound -Program $binPath -Action Allow
```

### 4. Desbloquear Cloudflared.exe

Windows puede bloquear ejecutables descargados:

```powershell
# Ver si está bloqueado
Get-Item bin\cloudflared.exe | Unblock-File

# O manualmente:
# Click derecho en cloudflared.exe > Propiedades > Desbloquear > Aplicar
```

### 5. Verificar Antivirus

- Agregar `cloudflared.exe` a la lista de exclusiones de tu antivirus
- Temporalmente deshabilitar el antivirus para probar

### 6. Probar Cloudflared Manualmente

Abrir PowerShell en la carpeta del proyecto:

```powershell
cd bin
.\cloudflared.exe tunnel --url http://localhost:8888
```

Deberías ver algo como:
```
INF Your quick Tunnel has been created!
INF https://xyz-abc-123.trycloudflare.com
```

Si funciona manualmente pero no desde la app, el problema está en la aplicación Electron.

---

## 🔧 Si Nada Funciona: Alternativa con ngrok

Si Cloudflare sigue fallando, puedes usar **ngrok** como alternativa:

### Instalar ngrok:
```powershell
# Descargar desde https://ngrok.com/download
# O con Chocolatey:
choco install ngrok
```

### Modificar el código (opcional):
En `processManager.js`, reemplazar el comando de cloudflared:

```javascript
// En lugar de:
spawn(bin('cloudflared'), ['tunnel', '--url', 'http://localhost:8888'], ...)

// Usar ngrok:
spawn('ngrok', ['http', '8888'], ...)
```

---

## 📋 Checklist de Diagnóstico:

- [ ] Ping a 1.1.1.1 funciona
- [ ] `Test-NetConnection api.trycloudflare.com` funciona
- [ ] DNS resuelve `api.trycloudflare.com`
- [ ] Firewall permite conexiones salientes en puerto 443
- [ ] Cloudflared.exe no está bloqueado (Unblock-File)
- [ ] Antivirus tiene excepción para cloudflared.exe
- [ ] Cloudflared funciona manualmente desde terminal

---

## 🆘 Última Opción: Usar Túnel con Cuenta Cloudflare

Si nada funciona con quick tunnels, crea una cuenta gratuita en Cloudflare:

```powershell
# Login en Cloudflare
.\cloudflared.exe login

# Crear un túnel persistente
.\cloudflared.exe tunnel create mi-tunnel

# Ejecutar el túnel
.\cloudflared.exe tunnel --url http://localhost:8888 run mi-tunnel
```

Esto te da un túnel permanente con mejor estabilidad.

---

## 📞 Contacto

Si necesitas ayuda adicional, comparte:
1. Output completo del log: `logs/cloudflared-err.log`
2. Resultado de `Test-NetConnection api.trycloudflare.com -Port 443`
3. Resultado de `Resolve-DnsName api.trycloudflare.com`
