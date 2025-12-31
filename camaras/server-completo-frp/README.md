# 📹 Server Completo FRP - Sistema de Streaming de Cámaras

## 📋 Descripción General

Este es un servidor completo para la gestión y streaming de cámaras IP utilizando **FRP (Fast Reverse Proxy)** y **FFmpeg**. El sistema permite:

- ✅ Registro dinámico de cámaras
- 🎥 Streaming en vivo (RTSP → HLS)
- 📼 Grabación de video bajo demanda
- ☁️ Subida automática a Google Drive
- 🌐 API REST para gestión de cámaras
- 🔄 Persistencia de configuración

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  SERVER-COMPLETO-FRP                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐         ┌──────────────┐         │
│  │   FRP Server │◄────────┤ Cámaras IP   │         │
│  │   (puerto    │         │ (Clientes    │         │
│  │    7000)     │         │   FRP)       │         │
│  └──────────────┘         └──────────────┘         │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────┐          │
│  │        Express API Server             │          │
│  │          (puerto 3000)                │          │
│  ├──────────────────────────────────────┤          │
│  │  • POST /api/register                │          │
│  │  • GET  /api/streams                 │          │
│  │  • POST /api/record                  │          │
│  └──────────────────────────────────────┘          │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────┐          │
│  │         FFmpeg Processor             │          │
│  │  • Stream HLS (rtsp → m3u8)          │          │
│  │  • Grabación MP4                     │          │
│  └──────────────────────────────────────┘          │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────┐          │
│  │        Google Drive Upload           │          │
│  │  • Subida de grabaciones             │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+
- FFmpeg instalado ([Descargar](https://ffmpeg.org/download.html))
- Ejecutable FRP Server ([Descargar](https://github.com/fatedier/frp/releases))
- Docker (opcional)
- Credenciales de Google Drive API (opcional - solo para grabaciones)

### Instalación

```bash
# 1. Navegar al directorio
cd server-completo-frp

# 2. Instalar dependencias de Node.js
npm install

# 3. Descargar FRP Server
# Ve a https://github.com/fatedier/frp/releases
# Descarga la versión para tu sistema operativo
# Ejemplo para Linux:
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz
tar -xzf frp_0.52.3_linux_amd64.tar.gz
cp frp_0.52.3_linux_amd64/frps ./frps
chmod +x ./frps

# Para Windows, descarga el .zip y copia frps.exe a la raíz del proyecto

# 4. Crear directorios necesarios
mkdir -p streams/live videos

# 5. Copiar archivo de configuración de ejemplo (opcional)
cp .env.example .env

# 6. Iniciar servidor
npm start
```

### Con Docker

```bash
# Construir imagen
docker-compose up -d

# Ver logs
docker logs -f frp-server
```

## 📁 Estructura de Archivos

```
server-completo-frp/
├── server-completo-frp.mjs  # Servidor principal
├── package.json             # Dependencias del proyecto
├── docker-compose.yml       # Configuración Docker
├── Dockerfile              # Imagen Docker
├── .env.example            # Ejemplo de variables de entorno
├── .env                    # Variables de entorno (crear)
├── cameras.json            # Registro de cámaras (auto-generado)
├── frps                    # Ejecutable FRP Server (descargar)
├── frps.toml              # Configuración FRP Server
├── frpc.toml              # Configuración FRP Client (ejemplo)
├── credentials.json        # Credenciales Google Drive (opcional)
├── bin/                   # Configuraciones adicionales FRP
│   ├── frpc.toml
│   ├── frps.ini
│   └── frps.toml
├── streams/               # Streams HLS generados
│   └── live/
│       └── {camId}/
│           ├── index.m3u8
│           └── segment_*.ts
├── videos/               # Videos grabados (temporal)
└── utils/               # Utilidades
    ├── ffmpegRunner.js  # Gestión de FFmpeg
    └── uploadToDrive.js # Subida a Google Drive
```

## 🔌 API Endpoints

### 1. **Registrar Cámara**

Registra una nueva cámara o actualiza una existente.

**Endpoint:** `POST /api/register`

**Body:**
```json
{
  "camId": "camara-01",
  "publicUrl": "rtsp://usuario:pass@192.168.1.100:554/stream"
}
```

**Respuesta:**
- `200 OK`: Cámara registrada exitosamente
- `400 Bad Request`: Parámetros faltantes

**Comportamiento:**
- Si es una cámara nueva o la URL cambió, inicia el streaming automáticamente
- Guarda la configuración en `cameras.json` para persistencia

---

### 2. **Listar Streams Activos**

Obtiene la lista de todas las cámaras activas con sus URLs de streaming.

**Endpoint:** `GET /api/streams`

**Respuesta:**
```json
[
  {
    "id": "camara-01",
    "url": "/streams/live/camara-01/index.m3u8",
    "title": "Stream camara-01",
    "thumbnail": "https://picsum.photos/seed/camara-01/640/360",
    "isLive": true,
    "viewCount": 42
  }
]
```

---

### 3. **Grabar Video**

Graba un video de una cámara específica y lo sube a Google Drive.

**Endpoint:** `POST /api/record`

**Body:**
```json
{
  "camId": "camara-01",
  "duration": 3600
}
```

**Parámetros:**
- `camId` (requerido): ID de la cámara a grabar
- `duration` (opcional): Duración en segundos (default: 3600 = 1 hora)

**Respuesta:**
```json
{
  "success": true,
  "driveId": "1a2b3c4d5e6f7g8h9i0j"
}
```

**Errores:**
- `404 Not Found`: Cámara no encontrada
- `500 Internal Server Error`: Error al grabar o subir

---

### 4. **Acceder a Streams HLS**

**Endpoint:** `GET /streams/live/{camId}/index.m3u8`

**Ejemplo:**
```
http://localhost:3000/streams/live/camara-01/index.m3u8
```

Sirve los archivos `.m3u8` y `.ts` generados por FFmpeg para streaming HLS.

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor Express
PORT=3000

# Puerto del servidor FRP
FRP_PORT=7000

# Google Drive API (para grabaciones)
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REFRESH_TOKEN=tu_refresh_token
GOOGLE_FOLDER_ID=id_carpeta_drive

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
```

### Configuración FRP Server (frps.toml)

```toml
[common]
bind_port = 7000
```

### Configuración FRP Client (frpc.toml - Ejemplo)

```toml
[common]
server_addr = tu-servidor.com
server_port = 7000

[camara-01]
type = tcp
local_ip = 192.168.1.100
local_port = 554
remote_port = 6001
```

## 🔧 Funcionalidades Principales

### 1. **Servidor FRP**

El servidor inicia automáticamente un servidor FRP en el puerto 7000 que permite:
- Recibir conexiones de cámaras remotas
- Crear túneles inversos para acceder a cámaras detrás de NAT
- Proxy de streams RTSP

### 2. **Streaming en Vivo (RTSP → HLS)**

Cuando se registra una cámara:
1. FFmpeg inicia la conversión RTSP → HLS
2. Genera archivos `.m3u8` y `.ts` en `/streams/live/{camId}/`
3. Los archivos se sirven vía Express con `express.static`

**Comando FFmpeg (aproximado):**
```bash
ffmpeg -rtsp_transport tcp \
  -i rtsp://camara-url \
  -c:v copy \
  -c:a aac \
  -f hls \
  -hls_time 2 \
  -hls_list_size 3 \
  -hls_flags delete_segments \
  ./streams/live/{camId}/index.m3u8
```

### 3. **Grabación de Video**

1. FFmpeg graba el stream RTSP a un archivo MP4
2. El video se guarda temporalmente en `/videos/`
3. Se sube automáticamente a Google Drive
4. El archivo local se elimina tras la subida exitosa

### 4. **Persistencia**

- Las cámaras se guardan en `cameras.json`
- Al reiniciar el servidor, se recargan automáticamente
- Los streams se reinician para todas las cámaras registradas

## 🐳 Deployment con Docker

### docker-compose.yml

```yaml
version: "3.9"
services:
  frp-backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: frp-server
    ports:
      - "3000:3000"      # API REST
      - "7000:7000"      # FRP Server
    volumes:
      - ./cameras.json:/app/cameras.json
      - ./streams:/app/streams
      - ./videos:/app/videos
      - ./.env:/app/.env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Comandos Docker

```bash
# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Reiniciar
docker-compose restart

# Detener
docker-compose down

# Reconstruir
docker-compose up -d --build
```

## 📊 Monitoreo y Logs

### Logs del Servidor

```bash
# Logs en tiempo real
npm run dev

# Con Docker
docker logs -f frp-server
```

### Mensajes Comunes

- ✅ `FRP Server corriendo en el puerto 7000` - FRP iniciado correctamente
- ✅ `Servidor Express listo en http://localhost:3000` - API lista
- 📡 `Cámara registrada/actualizada: {camId} -> {url}` - Nueva cámara
- ⚠️ `Cámara {camId} ya estaba registrada con la misma URL` - Sin cambios
- ❌ `Error leyendo cameras.json` - Problema con persistencia

## 🧪 Testing

### Prueba de Registro de Cámara

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "camId": "test-cam",
    "publicUrl": "rtsp://usuario:pass@192.168.1.100:554/stream"
  }'
```

### Prueba de Lista de Streams

```bash
curl http://localhost:3000/api/streams
```

### Prueba de Grabación

```bash
curl -X POST http://localhost:3000/api/record \
  -H "Content-Type: application/json" \
  -d '{
    "camId": "test-cam",
    "duration": 60
  }'
```

### Prueba de Streaming

Abre en tu navegador o reproductor HLS:
```
http://localhost:3000/streams/live/test-cam/index.m3u8
```

Recomendado: VLC Player, Safari, o reproductores web como video.js

## 🔐 Seguridad

### Recomendaciones

1. **No expongas el puerto FRP (7000) públicamente** sin autenticación
2. **Usa HTTPS** en producción
3. **Configura autenticación** en los endpoints sensibles
4. **Limita las IPs** que pueden registrar cámaras
5. **Protege las credenciales** de Google Drive en `.env`
6. **No subas `.env` a Git** (ya está en `.gitignore`)

### Autenticación FRP (Recomendado)

Modifica `frps.toml`:

```toml
[common]
bind_port = 7000
authentication_method = token
token = tu_token_secreto_aqui
```

Y en el cliente (`frpc.toml`):

```toml
[common]
server_addr = tu-servidor.com
server_port = 7000
authentication_method = token
token = tu_token_secreto_aqui
```

## 🛠️ Troubleshooting

### Problema: FFmpeg no se encuentra

**Solución:**
```bash
# Instalar FFmpeg
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Descargar desde https://ffmpeg.org/download.html
```

### Problema: Error de permisos con FRP

**Solución:**
```bash
chmod +x ./frps
```

### Problema: Puerto 3000 o 7000 ya en uso

**Solución:**
```bash
# Encuentra el proceso
lsof -i :3000
lsof -i :7000

# Mata el proceso
kill -9 <PID>

# O cambia el puerto en el código
```

### Problema: Streams no se reproducen

**Verificación:**
1. Comprueba que FFmpeg esté corriendo: `ps aux | grep ffmpeg`
2. Verifica que existan los archivos `.m3u8`: `ls -la streams/live/`
3. Comprueba los logs de FFmpeg
4. Asegúrate de que la URL RTSP sea accesible: `ffmpeg -i rtsp://... -t 5 test.mp4`

### Problema: Error al subir a Google Drive

**Solución:**
1. Verifica las credenciales en `.env`
2. Asegúrate de tener los permisos necesarios en la API de Google
3. Comprueba que el `GOOGLE_FOLDER_ID` exista y sea accesible

## 📚 Dependencias

```json
{
  "express": "API REST framework",
  "cors": "Cross-Origin Resource Sharing",
  "googleapis": "Integración con Google Drive",
  "multer": "Manejo de archivos",
  "ws": "WebSockets (futuras funcionalidades)"
}
```

## 🔗 Integración con Cliente Windows (setup-multicam-frp.ps1)

### Configuración del Servidor (VPS)

**1. Asegúrate de que el servidor esté corriendo:**
```bash
npm start
# o con Docker
docker-compose up -d
```

**2. Verifica que FRP Server esté escuchando en puerto 7000:**
```bash
# Debe mostrar el puerto 7000 abierto
netstat -tuln | grep 7000
```

**3. Configura el firewall para permitir conexiones:**
```bash
# Puerto 7000 - FRP Control
sudo ufw allow 7000/tcp

# Puerto 18554 - RTSP público (configurable según tu setup)
sudo ufw allow 18554/tcp

# Puerto 3000 - API Express
sudo ufw allow 3000/tcp
```

### Configuración del Cliente (Windows)

**1. En la carpeta del cliente, crea `frpc.toml`:**
```toml
[common]
serverAddr = "tu-servidor.com"  # O IP pública de tu VPS
serverPort = 7000
# authentication_method = "token"  # Opcional pero recomendado
# token = "tu_token_secreto"

[rtsp-tunnel]
type = tcp
localIP = "127.0.0.1"
localPort = 8554
remotePort = 18554
```

**2. Edita `setup-multicam-frp.ps1` y actualiza las URLs:**
```powershell
# Línea 36: Actualiza con tu dominio/IP
$publicRtsp = "rtsp://TU-SERVIDOR.com:18554/$camId"

# Línea 40: Actualiza la URL de registro
Invoke-RestMethod -Uri "https://TU-SERVIDOR.com/api/register"
```

**3. Crea `camaras.txt` con tus cámaras:**
```
camara-01=rtsp://admin:pass123@192.168.1.100:554/stream1
camara-02=rtsp://admin:pass123@192.168.1.101:554/stream1
oficina=rtsp://admin:pass123@192.168.1.102:554/Streaming/Channels/101
```

**4. Ejecuta el script:**
```powershell
.\setup-multicam-frp.ps1
```

### Verificación de Conexión

```bash
# En el servidor, verifica conexiones FRP activas:
curl http://localhost:7000/api/proxy/tcp

# Verifica cámaras registradas:
curl http://localhost:3000/api/streams

# Prueba el stream RTSP público:
ffplay rtsp://tu-servidor.com:18554/camara-01

# Prueba el stream HLS convertido:
# En tu navegador o VLC:
http://tu-servidor.com:3000/streams/live/camara-01/index.m3u8
```

### Flujo Completo de Conexión

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
   [Túnel FRP sobre Internet]
         ↓
[VPS Servidor]
   FRP Server (puerto 18554 público)
         ↓
   API Express recibe registro
   POST /api/register
   { camId, publicUrl: "rtsp://servidor:18554/camara-01" }
         ↓
   FFmpeg convierte RTSP → HLS
   rtsp://servidor:18554/camara-01
   → /streams/live/camara-01/index.m3u8
         ↓
   [Usuario Final]
   Accede vía navegador:
   http://servidor:3000/streams/live/camara-01/index.m3u8
```

## 🔄 Flujo de Trabajo

```mermaid
sequenceDiagram
    participant Cliente FRP
    participant Servidor FRP
    participant API Express
    participant FFmpeg
    participant Google Drive

    Cliente FRP->>Servidor FRP: Conecta cámara (puerto 7000)
    Cliente FRP->>API Express: POST /api/register
    API Express->>API Express: Guarda en cameras.json
    API Express->>FFmpeg: Inicia conversión RTSP→HLS
    FFmpeg->>Streams: Genera index.m3u8 + .ts
    
    Usuario->>API Express: GET /api/streams
    API Express->>Usuario: Lista de streams
    
    Usuario->>API Express: GET /streams/live/{camId}/index.m3u8
    API Express->>Usuario: Sirve archivos HLS
    
    Usuario->>API Express: POST /api/record
    API Express->>FFmpeg: Graba video MP4
    FFmpeg->>Videos: Guarda video.mp4
    API Express->>Google Drive: Sube video
    Google Drive->>API Express: driveId
    API Express->>Usuario: {success: true, driveId}
```

## 🚧 Tareas Pendientes / Mejoras Futuras

- [ ] Implementar autenticación con JWT
- [ ] Agregar WebRTC para menor latencia
- [ ] Dashboard web para visualización de cámaras
- [ ] Notificaciones de detección de movimiento
- [ ] Grabación programada
- [ ] Múltiples resoluciones de streaming (ABR)
- [ ] Soporte para múltiples protocolos (RTMP, WebRTC, etc.)
- [ ] Integración con sistemas de almacenamiento en la nube (S3, Azure)
- [ ] Sistema de alertas y notificaciones

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

## 👥 Autores

- Equipo Belgramo Motos Dev

## 📞 Soporte

Para soporte y consultas, contactar al equipo de desarrollo.

---

**Nota:** Este servidor está diseñado para uso en entornos de desarrollo y producción controlados. Asegúrate de implementar las medidas de seguridad necesarias antes de exponerlo a internet.
