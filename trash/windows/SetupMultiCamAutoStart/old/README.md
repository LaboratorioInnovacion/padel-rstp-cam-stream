# ================================================================
# GUÍA DE CONFIGURACIÓN - Setup Multi-Cam con FRP
# ================================================================

## 📋 Checklist Pre-Instalación

Antes de ejecutar el script, asegúrate de tener:

### ✅ Archivos Necesarios en Esta Carpeta:
- [ ] mediamtx.exe      - Servidor RTSP local
- [ ] frpc.exe          - Cliente FRP
- [ ] ffmpeg.exe        - Conversor de video
- [ ] camaras.txt       - Lista de cámaras
- [ ] frpc.toml         - Configuración FRP
- [ ] setup-multicam-frp.ps1 - Script principal

### ✅ Configuración de Red:
- [ ] Cámaras IP accesibles desde esta PC
- [ ] Internet funcionando
- [ ] Servidor VPS con FRP corriendo en puerto 7000

### ✅ Archivos de Configuración Editados:
- [ ] frpc.toml - serverAddr con tu dominio/IP
- [ ] camaras.txt - URLs RTSP de tus cámaras
- [ ] setup-multicam-frp.ps1 - URLs del servidor

---

## 🔧 1. Editar frpc.toml

```toml
[common]
serverAddr = "TU-SERVIDOR.com"  # ← CAMBIAR
serverPort = 7000

[[proxies]]
name = "rtsp-tunnel"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8554
remotePort = 18554
```

**¿Qué cambiar?**
- `serverAddr`: Tu dominio o IP del VPS
- `serverPort`: 7000 (puerto de control FRP)
- `remotePort`: 18554 (puerto RTSP público)

---

## 📹 2. Editar camaras.txt

Formato: `NOMBRE=rtsp://usuario:contraseña@ip:puerto/ruta`

```
camara-01=rtsp://admin:Admin123@192.168.1.100:554/stream1
camara-02=rtsp://admin:Admin123@192.168.1.101:554/stream1
oficina=rtsp://root:pass@192.168.1.102:554/Streaming/Channels/101
```

**Cómo encontrar la URL RTSP:**
- Consulta el manual de tu cámara
- Usa ONVIF Device Manager
- URLs comunes:
  - Hikvision: `rtsp://admin:pass@ip:554/Streaming/Channels/101`
  - Dahua: `rtsp://admin:pass@ip:554/cam/realmonitor?channel=1&subtype=0`
  - Tapo: `rtsp://admin:pass@ip:554/stream1`
  - Generic: `rtsp://admin:pass@ip:554/stream`

---

## 🌐 3. Editar setup-multicam-frp.ps1

Busca estas líneas y reemplaza con tu servidor:

```powershell
# Línea ~44: URL RTSP pública
$publicRtsp = "rtsp://TU-SERVIDOR.com:18554/$camId"

# Línea ~51: URL del backend API
Invoke-RestMethod -Uri "https://TU-SERVIDOR.com:3000/api/register"
```

**Reemplaza:**
- `TU-SERVIDOR.com` → Tu dominio o IP pública
- Puerto `:3000` → Puerto de tu API Express
- Puerto `:18554` → Puerto RTSP público (debe coincidir con frpc.toml)

---

## 🚀 4. Ejecutar el Script

```powershell
# Abrir PowerShell como Administrador
# Navegar a la carpeta
cd C:\ruta\a\SetupMultiCamAutoStart

# Permitir ejecución de scripts (primera vez)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Ejecutar
.\setup-multicam-frp.ps1
```

---

## ✅ 5. Verificar que Funciona

Deberías ver:

```
▶ Iniciando MediaMTX...
▶ Iniciando FRPC (túnel RTSP 8554)...

▶ Iniciando FFmpeg para 'camara-01'…
    Local RTSP: rtsp://admin:***@192.168.1.100:554/stream1
    Enviando a: rtsp://localhost:8554/camara-01
▶ Registrando 'camara-01' → rtsp://servidor:18554/camara-01 en el servidor…
   ✅ Registrada: camara-01

▶ Todos los procesos están corriendo.
Las URLs publicas fueron guardadas en: urls-publicas.txt
```

---

## 🔍 6. Verificaciones

### En Windows Cliente:

```powershell
# Ver procesos corriendo
Get-Process mediamtx, frpc, ffmpeg

# Ver logs de FFmpeg
Get-Content .\logs\camara-01-err.log -Tail 20

# Ver URLs públicas generadas
Get-Content .\urls-publicas.txt
```

### En el Servidor VPS:

```bash
# Verificar FRP Server corriendo
ps aux | grep frps

# Ver conexiones FRP activas
netstat -tuln | grep 7000
netstat -tuln | grep 18554

# Verificar cámaras registradas
curl http://localhost:3000/api/streams
```

### Desde Internet (Usuario Final):

```bash
# Probar stream RTSP
ffplay rtsp://tu-servidor.com:18554/camara-01

# Probar stream HLS (en navegador)
http://tu-servidor.com:3000/streams/live/camara-01/index.m3u8
```

---

## 🐛 Troubleshooting

### Error: "No se puede conectar a FRP Server"

**Solución:**
1. Verifica que el servidor FRP esté corriendo: `ps aux | grep frps`
2. Verifica que el puerto 7000 esté abierto en el firewall
3. Prueba conexión: `Test-NetConnection -ComputerName tu-servidor.com -Port 7000`
4. Revisa logs: `.\logs\frpc.log`

---

### Error: "FFmpeg se detiene constantemente"

**Solución:**
1. Verifica que la URL RTSP de la cámara sea correcta
2. Prueba la cámara directamente: `.\ffmpeg.exe -i "rtsp://..." -t 5 test.mp4`
3. Revisa logs: `.\logs\camara-01-err.log`
4. Verifica que la cámara sea accesible: `ping 192.168.1.100`

---

### Error: "Falla el registro en el backend"

**Solución:**
1. Verifica que la URL del backend sea correcta
2. Verifica que el servidor Express esté corriendo en puerto 3000
3. Prueba manualmente:
   ```powershell
   Invoke-RestMethod -Uri "https://tu-servidor.com:3000/api/health"
   ```
4. Revisa el error completo en la salida del script

---

## 📊 Arquitectura del Sistema

```
[Windows Cliente]
  Cámara IP (192.168.1.100:554)
       ↓
  FFmpeg (reenviador)
       ↓
  MediaMTX (localhost:8554)
       ↓
  FRP Client (frpc.exe)
       ↓
  [Internet - Túnel FRP]
       ↓
[VPS Servidor]
  FRP Server (puerto 18554 público)
       ↓
  API Express recibe registro
  POST /api/register
       ↓
  FFmpeg convierte RTSP → HLS
       ↓
  [Usuario Final]
  http://servidor:3000/streams/live/camara-01/index.m3u8
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en la carpeta `logs/`
2. Verifica que todos los ejecutables estén presentes
3. Confirma que las URLs sean correctas
4. Verifica conectividad de red

---

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- Las contraseñas de las cámaras están en texto plano en `camaras.txt`
- Mantén este archivo seguro
- No lo subas a Git (ya está en .gitignore)
- Considera usar variables de entorno para producción

---

## 🎉 ¡Listo!

Si todo está correcto, deberías poder:
1. Ver los streams en el navegador
2. Acceder desde cualquier lugar con internet
3. Grabar videos bajo demanda
4. Monitorear todas las cámaras desde un dashboard

¡Disfruta tu sistema de cámaras! 🎥
