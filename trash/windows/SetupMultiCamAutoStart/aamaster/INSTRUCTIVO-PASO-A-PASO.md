# 🚀 Guía Paso a Paso: Instalación Completa Cloudflare Tunnel

## 📑 Índice
1. [Preparación del Entorno](#paso-1-preparación-del-entorno)
2. [Instalación de Componentes](#paso-2-instalación-de-componentes)
3. [Configuración de Cloudflare](#paso-3-configuración-de-cloudflare)
4. [Creación del Túnel](#paso-4-creación-del-túnel)
5. [Configuración del Sistema](#paso-5-configuración-del-sistema)
6. [Primera Ejecución](#paso-6-primera-ejecución)
7. [Casos de Uso](#casos-de-uso)
8. [Troubleshooting](#troubleshooting)

---

## 📦 PASO 1: Preparación del Entorno

### 1.1 Verificar Requisitos
- [ ] Windows 10/11
- [ ] PowerShell 5.1 o superior
- [ ] Permisos de Administrador
- [ ] Conexión a Internet
- [ ] Cámara IP con RTSP habilitado

### 1.2 Crear Estructura de Carpetas
```
E:\camaras\
└── aamaster\
    ├── (aquí irán todos los archivos)
    └── logs\ (se creará automáticamente)
```

### 1.3 Verificar Conectividad de Cámara
**Probar RTSP con VLC:**
```
1. Abrir VLC Media Player
2. Media → Abrir ubicación de red
3. URL: rtsp://admin:password@192.168.1.100:554/stream1
4. Si se ve video = ✅ RTSP funciona
```

---

## 🔧 PASO 2: Instalación de Componentes

### 2.1 Descargar Cloudflared

**Método A: Descarga Manual**
```
1. Abrir: https://github.com/cloudflare/cloudflared/releases/latest
2. Buscar: cloudflared-windows-amd64.exe
3. Descargar a: E:\camaras\aamaster\
4. Renombrar a: cloudflared.exe
```

**Método B: PowerShell**
```powershell
cd E:\camaras\aamaster
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
```

**Verificar instalación:**
```powershell
.\cloudflared.exe --version
# Debe mostrar: cloudflared version X.X.X
```

### 2.2 Descargar MediaMTX

```
1. Ir a: https://github.com/bluenviron/mediamtx/releases/latest
2. Buscar: mediamtx_vX.X.X_windows_amd64.zip
3. Descargar y extraer
4. Copiar mediamtx.exe a: E:\camaras\aamaster\
```

**Verificar instalación:**
```powershell
.\mediamtx.exe --version
```

### 2.3 Descargar FFmpeg

```
1. Ir a: https://www.gyan.dev/ffmpeg/builds/
2. Descargar: ffmpeg-release-essentials.zip
3. Extraer y navegar a: bin\ffmpeg.exe
4. Copiar ffmpeg.exe a: E:\camaras\aamaster\
```

**Verificar instalación:**
```powershell
.\ffmpeg.exe -version
```

### 2.4 Verificar Archivos
```powershell
cd E:\camaras\aamaster
dir
```

Deberías ver:
```
cloudflared.exe
mediamtx.exe
ffmpeg.exe
setup-multicam-cloudflared.ps1
iniciar-cloudflared.bat
config.json
```

---

## ☁️ PASO 3: Configuración de Cloudflare

### 3.1 Crear Cuenta en Cloudflare (si no tienes)

```
1. Ir a: https://dash.cloudflare.com/sign-up
2. Registrarse con email
3. Verificar email
4. Iniciar sesión
```

### 3.2 Agregar Dominio a Cloudflare

**Opción A: Si tienes dominio propio**
```
1. En Cloudflare Dashboard
2. Clic en "Add a Site"
3. Ingresar tu dominio: ejemplo.com
4. Seleccionar plan Free
5. Cambiar nameservers en tu registrador de dominios
6. Esperar propagación (15 min - 48 hrs)
```

**Opción B: Usar subdominio gratuito**
```
Cloudflare no ofrece dominios gratis directamente.
Opciones:
- Freenom.com (dominios .tk, .ml, .ga gratis)
- No-IP.com (DNS dinámico)
- DuckDNS.org (subdominios gratis)

Luego agregar a Cloudflare como en Opción A
```

### 3.3 Verificar Dominio Activo
```
1. En Cloudflare Dashboard
2. Seleccionar tu dominio
3. Verificar que muestre "Status: Active"
```

---

## 🔐 PASO 4: Creación del Túnel

### 4.1 Autenticar Cloudflared

**Abrir PowerShell como Administrador en aamaster:**
```powershell
cd E:\camaras\aamaster
.\cloudflared.exe tunnel login
```

**Lo que verás:**
```
Por favor abra la siguiente URL y seleccione cualquier zona raíz que desee:
https://dash.cloudflare.com/argotunnel?callback=http://...
```

**Pasos:**
```
1. Se abre automáticamente el navegador
2. Iniciar sesión en Cloudflare (si no estás)
3. Seleccionar tu dominio de la lista
4. Clic en "Authorize"
5. Verás: "You have successfully authorized Cloudflare Tunnel"
```

**En PowerShell verás:**
```
Successfully authorized with cert.pem
```

**Se crea archivo:**
```
C:\Users\TU-USUARIO\.cloudflared\cert.pem
```

### 4.2 Crear el Túnel

```powershell
.\cloudflared.exe tunnel create camaras-windows
```

**Lo que verás:**
```
Tunnel credentials written to C:\Users\TU-USUARIO\.cloudflared\TUNNEL-ID.json
Created tunnel camaras-windows with id TUNNEL-ID
```

**IMPORTANTE: Anota el TUNNEL-ID** (ejemplo: `4b8c6d2a-f3e1-4567-89ab-cdef01234567`)

### 4.3 Configurar DNS

**Sintaxis:**
```powershell
.\cloudflared.exe tunnel route dns NOMBRE-TUNEL SUBDOMINIO.TU-DOMINIO.COM
```

**Ejemplo real:**
```powershell
.\cloudflared.exe tunnel route dns camaras-windows camaras.ejemplo.com
```

**Lo que verás:**
```
2026-01-02T05:00:00Z INF Added CNAME camaras.ejemplo.com which will route to this tunnel
```

**Verificar en Cloudflare:**
```
1. Dashboard → Tu dominio → DNS → Records
2. Deberías ver:
   Type: CNAME
   Name: camaras
   Target: TUNNEL-ID.cfargotunnel.com
   Proxy: Orange Cloud (activado)
```

### 4.4 Crear Archivo de Configuración

**Crear:** `E:\camaras\aamaster\cloudflared-config.yml`

```yaml
tunnel: camaras-windows
credentials-file: C:\Users\TU-USUARIO\.cloudflared\TUNNEL-ID.json

ingress:
  - hostname: camaras.ejemplo.com
    service: http://localhost:8888
  - service: http_status:404
```

**Reemplazar:**
- `TU-USUARIO`: Tu usuario de Windows (ejemplo: `Juan`)
- `TUNNEL-ID`: El ID que anotaste en 4.2
- `camaras.ejemplo.com`: Tu subdominio configurado en 4.3

**Ejemplo completo:**
```yaml
tunnel: camaras-windows
credentials-file: C:\Users\Juan\.cloudflared\4b8c6d2a-f3e1-4567-89ab-cdef01234567.json

ingress:
  - hostname: camaras.ejemplo.com
    service: http://localhost:8888
  - service: http_status:404
```

### 4.5 Probar Túnel

```powershell
.\cloudflared.exe tunnel --config .\cloudflared-config.yml run camaras-windows
```

**Salida exitosa:**
```
2026-01-02T05:00:00Z INF Starting tunnel tunnelID=TUNNEL-ID
2026-01-02T05:00:01Z INF Connection registered connIndex=0
2026-01-02T05:00:01Z INF Connection registered connIndex=1
2026-01-02T05:00:01Z INF Connection registered connIndex=2
2026-01-02T05:00:01Z INF Connection registered connIndex=3
```

**Si ves esto = ✅ TÚNEL FUNCIONA**

Presiona `Ctrl+C` para detener.

---

## 📝 PASO 5: Configuración del Sistema

### 5.1 Crear config.json

**Archivo:** `E:\camaras\aamaster\config.json`

```json
{
  "serverUrl": "http://localhost:3000",
  "serverPort": "",
  "cameraFile": ".\\camaras.txt",
  "outputFile": ".\\urls-publicas.txt",
  "logDirectory": "logs"
}
```

**Ajustar según tu backend:**
```json
{
  "serverUrl": "https://tu-backend.com",
  "serverPort": "",
  "cameraFile": ".\\camaras.txt",
  "outputFile": ".\\urls-publicas.txt",
  "logDirectory": "logs"
}
```

### 5.2 Obtener Información de tu Cámara

**Necesitas:**
- IP de la cámara
- Puerto RTSP (usualmente 554)
- Usuario
- Contraseña
- Path del stream

**Cómo encontrar el path según marca:**

**Hikvision:**
```
IP: 192.168.1.100
Puerto: 554
Path principal: /Streaming/Channels/101
Path secundario: /Streaming/Channels/102
```

**Dahua:**
```
IP: 192.168.1.101
Puerto: 554
Path principal: /cam/realmonitor?channel=1&subtype=0
Path secundario: /cam/realmonitor?channel=1&subtype=1
```

**TP-Link Tapo:**
```
IP: 192.168.1.102
Puerto: 554
Path: /stream1 o /stream2
```

**Xiaomi:**
```
IP: 192.168.1.103
Puerto: 554
Path: /live/ch00_0
```

**Genérica (ONVIF):**
```
IP: 192.168.1.104
Puerto: 554
Path: /stream1 o /h264 o /live
```

### 5.3 Crear camaras.txt

**Formato:**
```
ID|IP|PUERTO|USUARIO|CONTRASEÑA|PATH
```

**Ejemplo 1: Una cámara Hikvision**
```
cam1|192.168.1.100|554|admin|Admin123|/Streaming/Channels/101
```

**Ejemplo 2: Múltiples cámaras**
```
cam1|192.168.1.100|554|admin|Admin123|/Streaming/Channels/101
cam2|192.168.1.101|554|admin|Dahua456|/cam/realmonitor?channel=1&subtype=0
cam3|192.168.1.102|554|admin|Tapo789|/stream1
patio|192.168.1.103|554|admin|Xiaomi000|/live/ch00_0
```

**Archivo:** `E:\camaras\aamaster\camaras.txt`

### 5.4 Verificar Estructura Final

```
E:\camaras\aamaster\
├── cloudflared.exe                      ✅
├── cloudflared-config.yml              ✅
├── mediamtx.exe                        ✅
├── ffmpeg.exe                          ✅
├── setup-multicam-cloudflared.ps1      ✅
├── iniciar-cloudflared.bat             ✅
├── config.json                         ✅
├── camaras.txt                         ✅
└── C:\Users\TU-USUARIO\.cloudflared\
    ├── cert.pem                        ✅
    └── TUNNEL-ID.json                  ✅
```

---

## ▶️ PASO 6: Primera Ejecución

### 6.1 Iniciar el Sistema

**Doble clic en:**
```
iniciar-cloudflared.bat
```

### 6.2 Menú Interactivo

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

Opcion:
```

### 6.3 Primera Vez: Iniciar en Primer Plano

**Escribir:** `1` + Enter

**Lo que verás:**
```
Deteniendo procesos previos...
Iniciando MediaMTX...
[OK] MediaMTX iniciado
    - RTSP: localhost:8554
    - HLS:  localhost:8888

Iniciando Cloudflare Tunnel...
Usando tunel permanente con DNS...
[OK] Cloudflare Tunnel conectado
    URL Fija: https://camaras.ejemplo.com

Iniciando camara: cam1
[OK] Registrada: cam1

========================================
TODO INICIADO CON RECONEXION AUTOMATICA
URL del Tunel: https://camaras.ejemplo.com
URLs publicas en: .\urls-publicas.txt
Monitoreando camaras cada 10 segundos...
PID del proceso: 12345
Presiona Ctrl+C para detener
```

**Si ves esto = ✅ SISTEMA FUNCIONANDO**

### 6.4 Verificar Funcionamiento Local

**Abrir navegador:**
```
http://localhost:8888/cam1
```

**Deberías ver:**
- Player de video HTML5
- Stream de tu cámara reproduciéndose

**Si no funciona:**
```
1. Revisar logs: E:\camaras\aamaster\logs\cam1-err.log
2. Verificar IP/usuario/contraseña de cámara en camaras.txt
3. Probar URL RTSP en VLC primero
```

### 6.5 Verificar Túnel Público

**Abrir navegador:**
```
https://camaras.ejemplo.com/cam1
```

**Deberías ver:**
- El mismo stream pero accesible desde Internet
- Funciona en cualquier dispositivo con Internet

### 6.6 Obtener URL HLS

**Abrir archivo:**
```
E:\camaras\aamaster\urls-publicas.txt
```

**Contenido:**
```
cam1 = https://camaras.ejemplo.com/cam1/index.m3u8
```

**Esta es la URL para usar en tu frontend** ✅

---

## 🎯 CASOS DE USO

### CASO 1: Vigilancia Residencial

**Escenario:**
- 3 cámaras en casa (entrada, patio, garaje)
- Quieres verlas desde tu teléfono en el trabajo

**Configuración:**
```
# camaras.txt
entrada|192.168.1.100|554|admin|Pass123|/stream1
patio|192.168.1.101|554|admin|Pass123|/stream1
garaje|192.168.1.102|554|admin|Pass123|/stream1
```

**URLs generadas:**
```
https://micasa.ejemplo.com/entrada/index.m3u8
https://micasa.ejemplo.com/patio/index.m3u8
https://micasa.ejemplo.com/garaje/index.m3u8
```

**Frontend simple (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Vigilancia Casa</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    video { width: 100%; background: #000; }
  </style>
</head>
<body>
  <h1>🏠 Mi Casa</h1>
  <div class="grid">
    <div><h3>Entrada</h3><video id="entrada" controls></video></div>
    <div><h3>Patio</h3><video id="patio" controls></video></div>
    <div><h3>Garaje</h3><video id="garaje" controls></video></div>
  </div>

  <script>
    const cameras = {
      entrada: 'https://micasa.ejemplo.com/entrada/index.m3u8',
      patio: 'https://micasa.ejemplo.com/patio/index.m3u8',
      garaje: 'https://micasa.ejemplo.com/garaje/index.m3u8'
    };

    Object.keys(cameras).forEach(id => {
      const video = document.getElementById(id);
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(cameras[id]);
        hls.attachMedia(video);
      }
    });
  </script>
</body>
</html>
```

### CASO 2: Negocio/Tienda

**Escenario:**
- Tienda con 5 cámaras
- Empleados deben monitorear desde diferentes lugares
- Necesitas grabación de eventos

**Configuración:**
```
# camaras.txt
caja|192.168.1.100|554|admin|Pass1|/Streaming/Channels/101
almacen|192.168.1.101|554|admin|Pass2|/Streaming/Channels/101
entrada|192.168.1.102|554|admin|Pass3|/Streaming/Channels/101
trasera|192.168.1.103|554|admin|Pass4|/Streaming/Channels/101
estacionamiento|192.168.1.104|554|admin|Pass5|/Streaming/Channels/101
```

**Backend para grabación (Node.js):**
```javascript
// server.js
import express from 'express';
import fs from 'fs';

const app = express();
const cameras = {};

// Registrar cámaras
app.post('/api/register', (req, res) => {
  const { camId, publicUrl } = req.body;
  cameras[camId] = { publicUrl, registeredAt: new Date() };
  console.log(`📹 Cámara registrada: ${camId}`);
  res.json({ success: true });
});

// Listar cámaras
app.get('/api/cameras', (req, res) => {
  res.json(cameras);
});

app.listen(3000, () => console.log('Backend corriendo en :3000'));
```

### CASO 3: Evento Deportivo (Padel)

**Escenario:**
- Transmitir partidos de padel en vivo
- 2 cámaras por cancha
- Usuarios pagan suscripción para ver

**Configuración:**
```
# camaras.txt
cancha1-cam1|192.168.1.100|554|admin|Pass1|/stream1
cancha1-cam2|192.168.1.101|554|admin|Pass2|/stream1
cancha2-cam1|192.168.1.102|554|admin|Pass3|/stream1
cancha2-cam2|192.168.1.103|554|admin|Pass4|/stream1
```

**Frontend con autenticación:**
```javascript
// React Component
import React, { useState, useEffect } from 'react';
import ReactHlsPlayer from 'react-hls-player';

function PadelStream({ userId }) {
  const [cameras, setCameras] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar suscripción
    fetch(`/api/verify-subscription/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.active) {
          setAuthenticated(true);
          loadCameras();
        }
      });
  }, [userId]);

  const loadCameras = async () => {
    const res = await fetch('/api/cameras');
    const data = await res.json();
    setCameras(data);
  };

  if (!authenticated) {
    return <div>⚠️ Suscripción requerida</div>;
  }

  return (
    <div>
      <h1>🎾 Padel en Vivo</h1>
      <div className="grid">
        {cameras.map(cam => (
          <div key={cam.id}>
            <h3>{cam.name}</h3>
            <ReactHlsPlayer
              src={cam.publicUrl}
              autoPlay={true}
              controls={true}
              width="100%"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### CASO 4: Monitoreo de Construcción

**Escenario:**
- Cámara en obra en construcción
- Cliente revisa progreso desde su casa
- Timelapses automáticos

**Configuración:**
```
# camaras.txt
obra-principal|192.168.1.100|554|admin|Pass123|/stream1
```

**Script de captura de snapshots:**
```powershell
# capture-snapshots.ps1
while ($true) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $url = "https://obra.ejemplo.com/obra-principal"
    
    # Capturar frame cada 10 minutos
    .\ffmpeg.exe -i $url -frames:v 1 "snapshots\obra_$timestamp.jpg"
    
    Start-Sleep -Seconds 600  # 10 minutos
}
```

### CASO 5: Dashboard de Seguridad Múltiple

**Escenario:**
- 10+ cámaras en diferentes ubicaciones
- Dashboard central con mosaico
- Alerts automáticas

**Frontend avanzado:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Centro de Control</title>
  <style>
    .mosaic {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      background: #000;
    }
    .camera {
      position: relative;
      background: #111;
    }
    .camera video {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .camera-label {
      position: absolute;
      top: 5px;
      left: 5px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 12px;
    }
    .status {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #0f0;
    }
    .status.offline { background: #f00; }
  </style>
</head>
<body>
  <h1>🎥 Centro de Control - 12 Cámaras Activas</h1>
  <div class="mosaic" id="mosaic"></div>

  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script>
    const cameras = [
      { id: 'cam1', name: 'Entrada Principal', url: 'https://seg.ejemplo.com/cam1/index.m3u8' },
      { id: 'cam2', name: 'Recepción', url: 'https://seg.ejemplo.com/cam2/index.m3u8' },
      { id: 'cam3', name: 'Pasillo A', url: 'https://seg.ejemplo.com/cam3/index.m3u8' },
      { id: 'cam4', name: 'Estacionamiento', url: 'https://seg.ejemplo.com/cam4/index.m3u8' },
      // ... más cámaras
    ];

    const mosaic = document.getElementById('mosaic');

    cameras.forEach(cam => {
      const div = document.createElement('div');
      div.className = 'camera';
      div.innerHTML = `
        <div class="camera-label">${cam.name}</div>
        <div class="status" id="status-${cam.id}"></div>
        <video id="${cam.id}" muted></video>
      `;
      mosaic.appendChild(div);

      const video = document.getElementById(cam.id);
      const hls = new Hls();
      
      hls.on(Hls.Events.ERROR, () => {
        document.getElementById(`status-${cam.id}`).classList.add('offline');
      });
      
      hls.loadSource(cam.url);
      hls.attachMedia(video);
      video.play();
    });
  </script>
</body>
</html>
```

---

## 🔧 TROUBLESHOOTING

### ❌ Error: "MediaMTX no se inició"

**Causa:** Puerto ocupado

**Solución:**
```powershell
# Ver qué está usando el puerto 8554
netstat -ano | findstr "8554"

# Matar proceso (reemplazar PID)
taskkill /PID 1234 /F

# Ver qué está usando el puerto 8888
netstat -ano | findstr "8888"
taskkill /PID 5678 /F
```

### ❌ Error: "Cloudflare Tunnel no conecta"

**Causa 1:** Firewall bloqueando

**Solución:**
```
1. Panel de Control → Sistema y Seguridad → Firewall de Windows
2. Configuración avanzada
3. Reglas de salida → Nueva regla
4. Permitir cloudflared.exe
```

**Causa 2:** Configuración incorrecta

**Solución:**
```powershell
# Listar túneles
.\cloudflared.exe tunnel list

# Ver información del túnel
.\cloudflared.exe tunnel info camaras-windows

# Eliminar y recrear
.\cloudflared.exe tunnel delete camaras-windows
.\cloudflared.exe tunnel create camaras-windows
```

### ❌ Error: "No se puede registrar en backend"

**Verificar backend está corriendo:**
```powershell
# Probar endpoint
Invoke-WebRequest -Uri "http://localhost:3000/api/register" -Method POST -Body '{"test":"test"}' -ContentType "application/json"
```

**Ver logs de error:**
```powershell
type logs\cam1-err.log
```

### ❌ Video no se reproduce en navegador

**Problema: CORS**

**Solución en MediaMTX:**
Crear `mediamtx.yml`:
```yaml
paths:
  all:
    readUser:
    readPass:
    publishUser:
    publishPass:

hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsSegmentMaxSize: 50M
hlsAllowOrigin: '*'
```

### ❌ Alta latencia (>10 segundos)

**Optimizar MediaMTX:**
```yaml
hlsVariant: lowLatency
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
```

**Optimizar ffmpeg:**
```powershell
# En Start-CameraStream, agregar:
"-preset", "ultrafast",
"-tune", "zerolatency",
"-fflags", "nobuffer"
```

### ❌ Video se corta constantemente

**Ver reconexiones:**
```powershell
type logs\reconexiones.log
```

**Causas comunes:**
1. Red inestable → Usar cable en lugar de WiFi
2. Cámara de baja calidad → Actualizar firmware
3. Sobrecarga de CPU → Reducir resolución

---

## 📊 Monitoreo Continuo

### Ver estado desde el menú
```
Opción 3: Ver estado y monitoreo
```

### Ver logs en tiempo real
```powershell
# PowerShell
Get-Content logs\cam1-err.log -Wait -Tail 20

# CMD
tail -f logs\cam1-err.log
```

### Verificar carga del sistema
```powershell
# Ver uso de CPU/RAM
Get-Process ffmpeg, mediamtx, cloudflared | Select ProcessName, CPU, WorkingSet
```

---

## 🎓 Siguientes Pasos

1. ✅ **Agregar autenticación** (ver MEJORAS-RECOMENDADAS.md)
2. ✅ **Configurar inicio automático** (Opción 8 del menú)
3. ✅ **Montar en segundo plano** (Opción 2 del menú)
4. ✅ **Backup de configuración**
5. ✅ **Integrar con tu aplicación frontend**

---

## 🆘 Soporte

**Si algo no funciona:**

1. Revisar logs: `logs\cam1-err.log`
2. Probar localmente primero: `http://localhost:8888/cam1`
3. Verificar túnel: `.\cloudflared.exe tunnel info camaras-windows`
4. Reiniciar todo: Opción 7 → Opción 1

---

## ✅ CHECKLIST FINAL

- [ ] Cloudflared descargado y funcionando
- [ ] Cuenta de Cloudflare creada
- [ ] Dominio agregado a Cloudflare (activo)
- [ ] Túnel creado con `tunnel create`
- [ ] DNS configurado con `tunnel route dns`
- [ ] cloudflared-config.yml creado
- [ ] MediaMTX y FFmpeg instalados
- [ ] config.json configurado
- [ ] camaras.txt con al menos 1 cámara
- [ ] Sistema iniciado sin errores
- [ ] Video visible localmente: http://localhost:8888/cam1
- [ ] Video visible públicamente: https://camaras.TU-DOMINIO.com/cam1
- [ ] URL HLS generada correctamente
- [ ] Backend registrando cámaras (si aplica)
- [ ] Frontend mostrando video
- [ ] Reconexión automática funcionando
- [ ] Inicio automático configurado (opcional)

---

## 🎉 ¡Completado!

Tu sistema de streaming de cámaras está listo para producción.

**Recursos adicionales:**
- Documentación Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Documentación MediaMTX: https://github.com/bluenviron/mediamtx
- HLS.js Documentation: https://github.com/video-dev/hls.js/
