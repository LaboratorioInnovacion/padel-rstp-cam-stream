# 🚀 Guía de Setup Completo: Server + Cliente FRP

## ✅ Checklist Rápido

### Servidor (VPS)
- [ ] Node.js 18+ instalado
- [ ] FFmpeg instalado
- [ ] Ejecutable `frps` descargado y con permisos
- [ ] Puerto 7000 abierto (FRP control)
- [ ] Puerto 18554 abierto (RTSP público)
- [ ] Puerto 3000 abierto (API)
- [ ] Servidor corriendo con `npm start`

### Cliente (Windows)
- [ ] MediaMTX.exe descargado
- [ ] frpc.exe descargado
- [ ] ffmpeg.exe descargado
- [ ] `frpc.toml` configurado con IP del servidor
- [ ] `camaras.txt` con lista de cámaras
- [ ] `setup-multicam-frp.ps1` actualizado con URLs correctas

---

## 📝 Paso a Paso Detallado

### PARTE 1: Configuración del Servidor (VPS)

#### 1.1 Descargar FRP Server

```bash
# Navegar al directorio del proyecto
cd /ruta/a/server-completo-frp

# Descargar última versión de FRP (ajusta la versión)
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz

# Extraer
tar -xzf frp_0.52.3_linux_amd64.tar.gz

# Copiar ejecutable
cp frp_0.52.3_linux_amd64/frps ./frps

# Dar permisos de ejecución
chmod +x ./frps

# Limpiar
rm -rf frp_0.52.3_linux_amd64*
```

#### 1.2 Crear Directorios Necesarios

```bash
mkdir -p streams/live
mkdir -p videos
mkdir -p utils
```

#### 1.3 Configurar Firewall

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 7000/tcp comment "FRP Control Port"
sudo ufw allow 18554/tcp comment "FRP RTSP Public"
sudo ufw allow 3000/tcp comment "Express API"
sudo ufw reload

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=7000/tcp
sudo firewall-cmd --permanent --add-port=18554/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# iptables (manual)
sudo iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 18554 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

#### 1.4 Instalar Dependencias

```bash
npm install
```

#### 1.5 Iniciar Servidor

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start

# Con PM2 (recomendado para producción)
npm install -g pm2
pm2 start server-completo-frp.mjs --name "camera-server"
pm2 save
pm2 startup
```

#### 1.6 Verificar que Todo Funciona

```bash
# Verificar que el servidor Express responde
curl http://localhost:3000/api/streams

# Verificar que FRP Server está corriendo
ps aux | grep frps

# Ver logs en tiempo real
tail -f /ruta/logs/*.log
# o con PM2:
pm2 logs camera-server
```

---

### PARTE 2: Configuración del Cliente (Windows)

#### 2.1 Descargar Herramientas

**MediaMTX:**
- Ir a: https://github.com/bluenviron/mediamtx/releases
- Descargar: `mediamtx_v1.x.x_windows_amd64.zip`
- Extraer `mediamtx.exe`

**FRP Client:**
- Ir a: https://github.com/fatedier/frp/releases
- Descargar: `frp_0.52.3_windows_amd64.zip`
- Extraer `frpc.exe`

**FFmpeg:**
- Ir a: https://www.gyan.dev/ffmpeg/builds/
- Descargar: `ffmpeg-release-essentials.zip`
- Extraer `ffmpeg.exe` desde la carpeta `bin/`

#### 2.2 Estructura de Carpeta del Cliente

```
SetupMultiCamAutoStart/
├── mediamtx.exe
├── frpc.exe
├── ffmpeg.exe
├── frpc.toml          ← Crear
├── mediamtx.yml       ← Crear (opcional)
├── camaras.txt        ← Crear
├── setup-multicam-frp.ps1
└── logs/              ← Se crea automáticamente
```

#### 2.3 Crear frpc.toml

```toml
[common]
# IP o dominio de tu VPS
serverAddr = "31.97.64.187"
serverPort = 7000

# Seguridad (opcional pero recomendado)
# authentication_method = "token"
# token = "tu_token_super_secreto_aqui"

[rtsp-tunnel]
type = tcp
localIP = "127.0.0.1"
localPort = 8554
remotePort = 18554
```

#### 2.4 Crear camaras.txt

```
# Formato: NOMBRE=rtsp://usuario:contraseña@ip:puerto/ruta
camara-01=rtsp://admin:Admin123@192.168.1.100:554/stream1
camara-02=rtsp://admin:Admin123@192.168.1.101:554/stream1
oficina=rtsp://root:pass@192.168.1.102:554/Streaming/Channels/101
```

**Nota:** Para encontrar la URL RTSP de tu cámara:
- Consulta el manual del fabricante
- Usa herramientas como ONVIF Device Manager
- URLs comunes:
  - Hikvision: `rtsp://admin:pass@ip:554/Streaming/Channels/101`
  - Dahua: `rtsp://admin:pass@ip:554/cam/realmonitor?channel=1&subtype=0`
  - Tapo: `rtsp://admin:pass@ip:554/stream1`
  - Generic: `rtsp://admin:pass@ip:554/stream` o `/stream1`

#### 2.5 Editar setup-multicam-frp.ps1

Abre el archivo y modifica estas líneas:

```powershell
# Línea 36: Actualiza con tu servidor
$publicRtsp = "rtsp://TU-SERVIDOR-O-IP:18554/$camId"

# Línea 40: Actualiza la URL de registro
Invoke-RestMethod -Uri "http://TU-SERVIDOR-O-IP:3000/api/register" ...
```

Reemplaza `TU-SERVIDOR-O-IP` con:
- Tu dominio: `camaras.miservidor.com`
- O tu IP pública: `31.97.64.187`

#### 2.6 Ejecutar el Script

```powershell
# Abrir PowerShell como Administrador
# Navegar a la carpeta
cd C:\ruta\a\SetupMultiCamAutoStart

# Si es la primera vez, permitir ejecución de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Ejecutar
.\setup-multicam-frp.ps1
```

#### 2.7 Verificar Conexión

Deberías ver salidas como:
```
▶ Iniciando MediaMTX...
▶ Iniciando FRPC (túnel RTSP 8554)...
▶ Iniciando FFmpeg para 'camara-01'…
    Local RTSP: rtsp://admin:***@192.168.1.100:554/stream1
    Enviando a: rtsp://localhost:8554/camara-01
▶ Registrando 'camara-01' → rtsp://servidor:18554/camara-01 en el servidor…
   ✅ Registrada: camara-01
```

---

### PARTE 3: Verificación y Testing

#### 3.1 En el Cliente Windows

```powershell
# Ver procesos corriendo
Get-Process mediamtx, frpc, ffmpeg

# Ver logs de una cámara específica
Get-Content .\logs\camara-01-err.log -Tail 20 -Wait

# Ver URLs públicas generadas
Get-Content .\urls-publicas.txt
```

#### 3.2 En el Servidor VPS

```bash
# Ver streams registrados
curl http://localhost:3000/api/streams | jq

# Ver procesos FFmpeg activos
ps aux | grep ffmpeg

# Ver streams HLS generados
ls -lh streams/live/camara-01/

# Probar stream RTSP directamente
ffplay rtsp://localhost:18554/camara-01

# Ver logs del servidor
tail -f /var/log/camera-server.log
# o con PM2:
pm2 logs camera-server --lines 50
```

#### 3.3 Desde Internet (Usuario Final)

```bash
# Probar stream RTSP (requiere VLC o ffplay)
ffplay rtsp://tu-servidor.com:18554/camara-01

# Probar stream HLS (navegador o VLC)
# Firefox/Chrome/Safari:
http://tu-servidor.com:3000/streams/live/camara-01/index.m3u8

# Con curl (solo para verificar que existe):
curl -I http://tu-servidor.com:3000/streams/live/camara-01/index.m3u8
```

---

## 🐛 Troubleshooting Común

### Problema: "No se puede conectar al servidor FRP"

**Síntomas:**
```
Error: dial tcp xxx.xxx.xxx.xxx:7000: i/o timeout
```

**Soluciones:**
1. Verifica que el puerto 7000 esté abierto en el firewall del servidor
2. Comprueba que `frps` esté corriendo: `ps aux | grep frps`
3. Verifica la IP/dominio en `frpc.toml`
4. Prueba conexión: `telnet servidor 7000`

---

### Problema: "Stream no se genera"

**Síntomas:**
- No aparecen archivos en `streams/live/camara-01/`
- Error 404 al intentar acceder al `.m3u8`

**Soluciones:**
1. Verifica logs de FFmpeg: `tail -f logs/camara-01-err.log`
2. Comprueba que la URL RTSP sea correcta:
   ```bash
   ffmpeg -i "rtsp://url-de-tu-camara" -t 5 test.mp4
   ```
3. Verifica permisos de la carpeta `streams/`:
   ```bash
   chmod -R 755 streams/
   ```
4. Reinicia el servidor

---

### Problema: "FFmpeg se detiene constantemente"

**Síntomas:**
- El proceso FFmpeg aparece y desaparece
- Streams intermitentes

**Soluciones:**
1. Verifica que la cámara sea accesible desde el servidor
2. Aumenta el timeout en FFmpeg (edita `ffmpegRunner.js`)
3. Cambia el transporte a UDP: `-rtsp_transport udp`
4. Verifica ancho de banda

---

### Problema: "Alta latencia en streams"

**Soluciones:**
1. Reduce `hls_time` en `ffmpegRunner.js` (de 2 a 1 segundo)
2. Usa `-tune zerolatency` en FFmpeg
3. Considera usar WebRTC en lugar de HLS
4. Verifica conexión de red

---

## 🔒 Seguridad Recomendada

### 1. Autenticación en FRP

**Servidor (frps.toml):**
```toml
[common]
bind_port = 7000
authentication_method = "token"
token = "tu_token_muy_secreto_y_largo_12345"
```

**Cliente (frpc.toml):**
```toml
[common]
serverAddr = "tu-servidor.com"
serverPort = 7000
authentication_method = "token"
token = "tu_token_muy_secreto_y_largo_12345"
```

### 2. HTTPS en la API

Usa un reverse proxy como Nginx o Traefik:

```nginx
server {
    listen 443 ssl;
    server_name camaras.tudominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Autenticación en API Express

Agrega JWT o autenticación básica a los endpoints sensibles.

---

## 📊 Monitoreo en Producción

```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start server-completo-frp.mjs --name camera-server

# Ver status
pm2 status

# Ver logs en vivo
pm2 logs camera-server

# Monitoreo en tiempo real
pm2 monit

# Auto-restart en boot
pm2 startup
pm2 save
```

---

## 🎉 ¡Listo!

Si seguiste todos los pasos correctamente, deberías tener:

✅ Servidor FRP corriendo y aceptando conexiones
✅ Cliente Windows conectado vía túnel FRP
✅ Streams RTSP llegando al servidor
✅ FFmpeg convirtiendo a HLS
✅ Streams accesibles desde internet

**Prueba final:**
Abre en tu navegador (desde cualquier lugar):
```
http://tu-servidor.com:3000/api/streams
```

Deberías ver un JSON con todas tus cámaras activas.

---

## 📞 Soporte

Para problemas o consultas, revisa:
- [README.md](./README.md) - Documentación completa
- Logs del servidor: `pm2 logs` o `tail -f logs/*.log`
- Logs del cliente: `.\logs\*.log`
