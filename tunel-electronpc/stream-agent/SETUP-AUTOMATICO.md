# 🚀 Setup Automático de Cloudflared

## ⚡ Método Rápido (Recomendado)

### Opción 1: Script Automático Completo
```powershell
# Click derecho > Ejecutar con PowerShell como Administrador
.\setup-cloudflared.ps1
```

Este script:
- ✅ Verifica binarios
- ✅ Desbloquea cloudflared.exe
- ✅ Prueba conectividad
- ✅ Resuelve DNS
- ✅ Ofrece cambiar DNS automáticamente
- ✅ Crea regla de firewall
- ✅ Ejecuta prueba final

### Opción 2: Prueba Rápida
```cmd
# Doble click en:
test-cloudflared.bat
```

Esto desbloquea el exe y lo ejecuta manualmente.

---

## 🔧 La Aplicación Ahora Detecta Problemas Automáticamente

Al iniciar **Modo Producción**, la app:

1. **Verifica conectividad** a `api.trycloudflare.com`
2. Si hay problemas, **muestra soluciones** en consola
3. **No intenta crear túnel** si no hay conexión

### Mensajes en Consola:

```
🔍 Verificando conectividad a Cloudflare...
❌ No se puede conectar a Cloudflare API
   Error: getaddrinfo ENOTFOUND api.trycloudflare.com

💡 Soluciones posibles:
   1. Ejecuta: setup-cloudflared.ps1 (diagnóstico automático)
   2. Ejecuta: test-cloudflared.bat (prueba rápida)
   3. Revisa: CLOUDFLARED-TROUBLESHOOTING.md

🔧 Pasos manuales:
   • Cambiar DNS a 1.1.1.1 (Cloudflare DNS)
   • Desbloquear: Unblock-File bin\cloudflared.exe
   • Desactivar antivirus temporalmente
```

---

## 📋 Problemas Comunes (Automáticamente Detectados)

### ❌ "no such host"
**Causa**: DNS no puede resolver `api.trycloudflare.com`  
**Solución Automática**: Ejecuta `setup-cloudflared.ps1` y acepta cambiar DNS

### ❌ "dial tcp: connection refused"
**Causa**: Firewall bloqueando  
**Solución Automática**: El script crea la regla automáticamente

### ❌ Túnel se cierra inmediatamente
**Causa**: Archivo bloqueado por Windows  
**Solución Automática**: Ambos scripts desbloquean el archivo

---

## 🎯 Flujo Automatizado Completo

```
1. Ejecutar setup-cloudflared.ps1 (como Admin)
   └─> Detecta problemas
   └─> Ofrece soluciones
   └─> Aplica cambios
   └─> Prueba túnel

2. Si funciona manualmente:
   └─> Cerrar con Ctrl+C
   └─> Ejecutar app Electron
   └─> Click "🌐 Modo Producción"
   └─> App detecta que ahora sí hay conexión
   └─> Túnel se crea exitosamente

3. Si no funciona:
   └─> Revisar CLOUDFLARED-TROUBLESHOOTING.md
   └─> Buscar soluciones avanzadas
```

---

## ✅ Confirmación de Éxito

Cuando todo funciona, verás:

```
🔍 Verificando conectividad a Cloudflare...
✅ Conectividad OK, creando túnel...
[Cloudflared] 2026-01-08T20:00:00Z INF Your quick Tunnel has been created!
✅ Túnel público creado: https://xyz-abc-123.trycloudflare.com
   Esperando 2 segundos antes de registrar...
📡 Registrando 1 cámaras en servidor: https://padel.noaservice.org/api/register
   📹 Cámara Principal (default-cam1): https://xyz-abc-123.trycloudflare.com/cam1
   ✅ cam1 registrada exitosamente
```

---

## 🆘 Si Nada Funciona

1. **Cambiar DNS manualmente**:
   - Panel de Control → Redes → Propiedades → IPv4
   - DNS preferido: `1.1.1.1`
   - DNS alternativo: `1.0.0.1`

2. **Probar con VPN/Proxy diferente**

3. **Usar túnel con cuenta Cloudflare** (más estable):
   ```powershell
   .\bin\cloudflared.exe login
   .\bin\cloudflared.exe tunnel create mi-tunnel
   # Modificar código para usar tunnel con nombre
   ```

---

## 📞 Scripts Disponibles

| Archivo | Propósito | Requiere Admin |
|---------|-----------|----------------|
| `setup-cloudflared.ps1` | Setup completo con diagnóstico | ✅ Recomendado |
| `test-cloudflared.bat` | Prueba rápida manual | ❌ No |
| `CLOUDFLARED-TROUBLESHOOTING.md` | Documentación detallada | - |

---

**Nota**: Después de ejecutar cualquier script, reinicia la app Electron con `rs` en la terminal.
