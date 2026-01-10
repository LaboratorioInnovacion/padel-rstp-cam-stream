# 📹 Guía Completa: Instalación y Configuración del Sistema de Cámaras

## 📋 Requisitos Previos

- Windows 10/11
- Cuenta de Cloudflare (gratis)
- Cámara IP con RTSP
- Conexión a Internet

---

## 🚀 PASO 1: Descargar Componentes Necesarios

### 1.1 Cloudflared (Túnel de Cloudflare)
```
1. Ir a: https://github.com/cloudflare/cloudflared/releases
2. Descargar: cloudflared-windows-amd64.exe
3. Renombrar a: cloudflared.exe
4. Copiar a la carpeta: aamaster\
```

### 1.2 MediaMTX (Servidor de Streaming)
```
1. Ir a: https://github.com/bluenviron/mediamtx/releases
2. Descargar: mediamtx_vX.X.X_windows_amd64.zip
3. Extraer: mediamtx.exe
4. Copiar a la carpeta: aamaster\
```

### 1.3 FFmpeg (Procesador de Video)
```
1. Ir a: https://ffmpeg.org/download.html
2. Descargar: ffmpeg-release-essentials.zip
3. Extraer: ffmpeg.exe (de la carpeta bin)
4. Copiar a la carpeta: aamaster\
```

---

## ☁️ PASO 2: Configurar Cloudflare Tunnel (Permanente con DNS)

### 2.1 Instalar Cloudflared
```bash
# Abrir PowerShell en la carpeta aamaster\
cd E:\vps\camaras\...\aamaster

# Autenticarse en Cloudflare
.\cloudflared.exe tunnel login
```
- Se abrirá el navegador
- Inicia sesión en Cloudflare
- Selecciona tu dominio (o crea uno gratis en Cloudflare)

### 2.2 Crear el Túnel
```bash
# Crear túnel llamado "camaras-windows"
.\cloudflared.exe tunnel create camaras-windows
```
- Esto genera un archivo .json con credenciales
- Anota el ID del túnel que aparece

### 2.3 Configurar DNS
```bash
# Asociar un subdominio al túnel
.\cloudflared.exe tunnel route dns camaras-windows camaras-windows.TU-DOMINIO.com
```
**Ejemplo:**
```bash
.\cloudflared.exe tunnel route dns camaras-windows camaras-windows.noaservice.org
```

### 2.4 Crear Archivo de Configuración
Crear archivo: `cloudflared-config.yml`

```yaml
tunnel: camaras-windows
credentials-file: C:\Users\TU-USUARIO\.cloudflared\TUNNEL-ID.json

ingress:
  - hostname: camaras-windows.TU-DOMINIO.com
    service: http://localhost:8888
  - service: http_status:404
```

**Reemplaza:**
- `TU-USUARIO`: Tu usuario de Windows
- `TUNNEL-ID`: El ID del túnel generado
- `TU-DOMINIO.com`: Tu dominio en Cloudflare

### 2.5 Probar el Túnel
```bash
.\cloudflared.exe tunnel --config .\cloudflared-config.yml run camaras-windows
```
Si ves "Connection registered", ¡funciona! Presiona Ctrl+C para detener.

---

## 📝 PASO 3: Configurar Archivos del Sistema

### 3.1 Crear/Editar `config.json`
```json
{
  "serverUrl": "https://TU-BACKEND.com",
  "serverPort": "",
  "cameraFile": ".\\camaras.txt",
  "outputFile": ".\\urls-publicas.txt",
  "logDirectory": "logs"
}
```

### 3.2 Crear `camaras.txt`
Formato: `ID|IP|PUERTO|USUARIO|CONTRASEÑA|PATH`

```
cam1|192.168.1.100|554|admin|admin123|/stream1
```

**Ejemplos por marca:**

**Hikvision:**
```
cam1|192.168.1.100|554|admin|pass123|/Streaming/Channels/101
```

**TP-Link Tapo:**
```
cam1|192.168.1.101|554|admin|pass123|/stream1
```

**Xiaomi:**
```
cam1|192.168.1.102|554|admin|pass123|/live/ch00_0
```

### 3.3 Verificar Estructura de Archivos
```
aamaster\
├── cloudflared.exe
├── cloudflared-config.yml
├── mediamtx.exe
├── ffmpeg.exe
├── setup-multicam-cloudflared.ps1
├── iniciar-cloudflared.bat
├── config.json
├── camaras.txt
└── logs\ (se crea automáticamente)
```

---

## ▶️ PASO 4: Iniciar el Sistema

### 4.1 Primera Ejecución
```bash
# Doble clic en:
iniciar-cloudflared.bat
```

### 4.2 Menú Principal
```
========================================
  SETUP MULTI-CAMARA CLOUDFLARE
========================================

[ESTADO] Servicio detenido

1. Iniciar servicios (primer plano)
2. Iniciar servicios (segundo plano)
3. Ver estado y monitoreo
4. Agregar camara
5. Listar camaras
6. Ver URL publica del tunel
7. Detener servicios

8. Configurar inicio automatico
9. Desinstalar inicio automatico

0. Salir
```

### 4.3 Iniciar por Primera Vez
```
Opción: 1 (primer plano para ver errores)
```

Deberías ver:
```
✓ MediaMTX iniciado
✓ Cloudflare Tunnel conectado
✓ Iniciando camara: cam1
✓ Registrada: cam1
========================================
TODO INICIADO CON RECONEXION AUTOMATICA
URL del Tunel: https://camaras-windows.noaservice.org
Monitoreando camaras cada 10 segundos...
```

---

## 🖥️ PASO 5: Verificar que Funciona

### 5.1 Verificar MediaMTX
Abrir navegador:
```
http://localhost:8888/cam1
```
Deberías ver el player de video con tu cámara.

### 5.2 Verificar Túnel Público
Abrir navegador:
```
https://camaras-windows.TU-DOMINIO.com/cam1
```
¡Deberías ver tu cámara desde Internet!

### 5.3 Obtener URL HLS
La URL completa para el frontend es:
```
https://camaras-windows.TU-DOMINIO.com/cam1/index.m3u8
```

Esta URL se guarda en: `urls-publicas.txt`

---

## 🌐 PASO 6: Configurar el Frontend

### 6.1 Backend: Verificar Registro
Tu backend debe recibir POST en `/api/register`:
```json
{
  "camId": "cam1",
  "publicUrl": "https://camaras-windows.noaservice.org/cam1/index.m3u8"
}
```

### 6.2 Frontend: Agregar Player HLS

**Opción A: Video.js (Recomendado)**
```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet">
</head>
<body>
  <video id="my-video" class="video-js" controls preload="auto" width="640" height="360">
    <source src="https://camaras-windows.TU-DOMINIO.com/cam1/index.m3u8" type="application/x-mpegURL">
  </video>

  <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
  <script>
    var player = videojs('my-video');
  </script>
</body>
</html>
```

**Opción B: HLS.js (Más control)**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <video id="video" controls width="640" height="360"></video>
  
  <script>
    var video = document.getElementById('video');
    var videoSrc = 'https://camaras-windows.TU-DOMINIO.com/cam1/index.m3u8';
    
    if (Hls.isSupported()) {
      var hls = new Hls();
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
    }
    // Safari tiene soporte nativo
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoSrc;
    }
  </script>
</body>
</html>
```

**Opción C: React (Con tu frontend actual)**
```tsx
import ReactHlsPlayer from 'react-hls-player';

function CameraStream() {
  return (
    <ReactHlsPlayer
      src="https://camaras-windows.TU-DOMINIO.com/cam1/index.m3u8"
      autoPlay={true}
      controls={true}
      width="100%"
      height="auto"
    />
  );
}
```

---

## 🔧 PASO 7: Configurar Inicio Automático

### 7.1 Desde el Menú
```
Opción: 8 (Configurar inicio automático)
```

### 7.2 Verificar
```
1. Abrir: Programador de tareas (Windows)
2. Buscar: CamarasCloudflare
3. Verificar que esté "Listo"
```

### 7.3 Probar
```
1. Reiniciar Windows
2. Esperar 30 segundos
3. Verificar: http://localhost:8888/cam1
```

---

## 🔍 PASO 8: Troubleshooting

### ❌ Error: "MediaMTX no se inició"
```bash
# Verificar que el puerto 8554 y 8888 estén libres
netstat -ano | findstr "8554"
netstat -ano | findstr "8888"

# Si están ocupados, matar el proceso
taskkill /PID NUMERO_PID /F
```

### ❌ Error: "Cloudflare Tunnel no conecta"
```bash
# Verificar configuración
.\cloudflared.exe tunnel list

# Verificar rutas DNS
.\cloudflared.exe tunnel route ip show

# Ver logs detallados
.\cloudflared.exe --loglevel debug tunnel --config .\cloudflared-config.yml run camaras-windows
```

### ❌ Error: "No se puede registrar en backend"
```
1. Verificar que el backend esté corriendo
2. Verificar URL en config.json
3. Verificar que acepte POST en /api/register
4. Ver logs en: logs\cam1-err.log
```

### ❌ No se ve video en el navegador
```
1. Verificar MediaMTX: http://localhost:8888/cam1
2. Verificar túnel público: https://camaras-windows.TU-DOMINIO.com/cam1
3. Abrir consola del navegador (F12) para ver errores
4. Verificar que el dominio tenga proxy naranja en Cloudflare
```

### ❌ Video se corta constantemente
```
1. Ver logs de reconexión: logs\reconexiones.log
2. Verificar conexión de la cámara IP
3. Verificar que ffmpeg no esté crasheando: logs\cam1-err.log
4. Probar con otra cámara para descartar problemas de hardware
```

---

## 📊 PASO 9: Monitoreo y Mantenimiento

### 9.1 Ver Estado del Servicio
```
Opción 3: Ver estado y monitoreo
```
Muestra:
- PID del proceso
- Número de cámaras activas
- URL del túnel
- Últimas 5 reconexiones

### 9.2 Ver Logs
```bash
# Logs de salida de cámara
type logs\cam1-out.log

# Logs de errores de cámara
type logs\cam1-err.log

# Logs de reconexiones
type logs\reconexiones.log
```

### 9.3 URLs Públicas
```bash
# Ver todas las URLs generadas
type urls-publicas.txt
```

---

## 🎯 PASO 10: Múltiples Cámaras

### 10.1 Agregar Cámara desde el Menú
```
Opción 4: Agregar cámara
```

### 10.2 O Editar Manualmente `camaras.txt`
```
cam1|192.168.1.100|554|admin|pass1|/stream1
cam2|192.168.1.101|554|admin|pass2|/stream1
cam3|192.168.1.102|554|admin|pass3|/Streaming/Channels/101
```

### 10.3 Reiniciar Servicios
```
Opción 7: Detener servicios
Opción 2: Iniciar servicios (segundo plano)
```

### 10.4 URLs Generadas
```
cam1 = https://camaras-windows.TU-DOMINIO.com/cam1/index.m3u8
cam2 = https://camaras-windows.TU-DOMINIO.com/cam2/index.m3u8
cam3 = https://camaras-windows.TU-DOMINIO.com/cam3/index.m3u8
```

---

## ✅ CHECKLIST FINAL

- [ ] Cloudflared instalado y configurado
- [ ] Túnel permanente creado con DNS
- [ ] MediaMTX funcionando localmente
- [ ] FFmpeg instalado
- [ ] config.json configurado
- [ ] camaras.txt con al menos 1 cámara
- [ ] Sistema iniciado sin errores
- [ ] Video visible en http://localhost:8888/cam1
- [ ] Video visible en https://camaras-windows.TU-DOMINIO.com/cam1
- [ ] Backend registrando URLs correctamente
- [ ] Frontend mostrando video
- [ ] Inicio automático configurado (opcional)
- [ ] Reconexión automática funcionando

---

## 🆘 Soporte

Si algo no funciona:

1. **Ver logs**: `logs\cam1-err.log`
2. **Verificar puertos**: `netstat -ano | findstr "8554"`
3. **Reiniciar todo**: Opción 7 → Opción 1
4. **Probar localmente primero**: http://localhost:8888/cam1
5. **Probar túnel después**: https://camaras-windows.TU-DOMINIO.com/cam1

---

## 🎉 ¡Listo!

Ahora tienes:
- ✅ Streaming de cámaras por Internet
- ✅ Reconexión automática
- ✅ Inicio automático en Windows
- ✅ Monitoreo en tiempo real
- ✅ URLs públicas para tu frontend
