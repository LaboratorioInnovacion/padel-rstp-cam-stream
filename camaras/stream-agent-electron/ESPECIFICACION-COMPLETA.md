# Especificación Completa: Stream Agent - Sistema de Streaming Multi-Cámara

## 1. DESCRIPCIÓN GENERAL

**Stream Agent** es una aplicación de escritorio multiplataforma (Windows) construida con Electron que permite:
- Capturar streams RTSP de múltiples cámaras IP (Tapo, etc.)
- Re-transmitir vía HLS (HTTP Live Streaming) usando MediaMTX
- Exponer streams públicamente mediante túneles Cloudflare
- Registrar cámaras en un servidor centralizado
- Gestionar múltiples ubicaciones físicas con IDs únicos
- Monitorear estado de conexión y rendimiento del sistema
- Auto-reconexión automática ante fallos de red

## 2. ARQUITECTURA TÉCNICA

### 2.1 Stack Tecnológico

**Frontend:**
- Electron 39.2.7 (Node.js + Chromium)
- React 19.2.3 (UI Components)
- Tailwind CSS 3.4.17 (Estilos)
- Webpack (Bundling)
- Electron Forge 7.10.2 (Packaging)

**Backend/Procesos:**
- Node.js (Process Management)
- MediaMTX (RTSP → HLS conversion)
- FFmpeg (Stream transcoding/relay)
- Cloudflared (Tunnel creation)

**Build & Deploy:**
- Squirrel.Windows (Instalador)
- ASAR packaging
- GitHub Actions (CI/CD)

### 2.2 Estructura de Archivos

```
stream-agent/
├── src/
│   ├── main.js              # Proceso principal Electron, IPC handlers
│   ├── preload.js           # Context bridge seguro para IPC
│   ├── processManager.js    # Gestión de procesos (MTX, FFmpeg, Cloudflared)
│   └── renderer/
│       ├── App.jsx          # Componente principal React
│       ├── index.jsx        # Entry point renderer
│       └── components/
│           ├── CameraList.jsx       # Lista de cámaras con URLs públicas
│           ├── ControlButtons.jsx   # Botones Iniciar/Detener
│           ├── ErrorBanner.jsx      # Banner de errores
│           ├── Header.jsx           # Cabecera con info de ubicación
│           ├── PublicURLPanel.jsx   # Panel con URL de servidor
│           ├── ReconnectStatus.jsx  # Estado de reconexión
│           ├── StatisticsPanel.jsx  # Estadísticas del sistema
│           └── StatusCard.jsx       # Tarjeta de estado general
├── bin/                     # Binarios (mediamtx.exe, ffmpeg.exe, cloudflared.exe)
├── cameras.json             # Configuración de cámaras
├── config.json              # Configuración general (servidor, ubicación, túnel)
├── cloudflared-config.yml   # Config del túnel Cloudflare
├── forge.config.js          # Configuración de empaquetado
└── package.json             # Dependencies
```

### 2.3 Rutas de Ejecución

**Desarrollo:**
- Binarios: `{projectRoot}/bin/`
- Config: `{projectRoot}/cameras.json`, `{projectRoot}/config.json`
- Logs: `{projectRoot}/logs/`

**Producción (instalado):**
- Binarios: `{resourcesPath}/bin/` (dentro del ASAR)
- Config: `%AppData%/stream-agent/` (copia automática en primera ejecución)
- Logs: `%AppData%/stream-agent/logs/`
- Credenciales Cloudflare: `~/.cloudflared/{tunnelId}.json`

## 3. FUNCIONALIDADES PRINCIPALES

### 3.1 Gestión de Cámaras

**Configuración de Cámara:**
```json
{
  "id": "cam1",
  "name": "Cámara Cancha 1",
  "rtspUrl": "rtsp://usuario:password@192.168.1.100:554/stream1",
  "enabled": true,
  "encoding": "copy",  // 'copy' o 'transcode'
  "quality": "medium",  // 'low', 'medium', 'high'
  "audioMode": "transcode"  // 'disabled', 'copy', 'transcode'
}
```

**Operaciones:**
- ✅ Agregar cámara (modal con formulario)
- ✅ Editar cámara (todos los parámetros configurables)
- ✅ Eliminar cámara
- ✅ Habilitar/Deshabilitar cámara
- ✅ Reconectar cámara individual (reinicia proceso FFmpeg)
- ✅ Ver estado de conexión en tiempo real
- ✅ Copiar URL pública de cada cámara

**Modos de Codificación:**

1. **COPY Mode** (Recomendado):
   - No recodifica (bajo CPU)
   - Calidad original
   - Mayor ancho de banda
   - Ideal para redes locales rápidas

2. **TRANSCODE Mode**:
   - Recodifica con H.264
   - Alto uso de CPU
   - Menor ancho de banda
   - Calidad configurable (low/medium/high)
   - Ideal para redes lentas o ancho de banda limitado

### 3.2 Sistema de Streaming

**Pipeline de Video:**
```
Cámara RTSP → FFmpeg → MediaMTX → HLS (.m3u8) → Cloudflare Tunnel → Internet
```

**MediaMTX (Servidor RTSP/HLS):**
- Puerto: 8554 (RTSP), 8888 (HLS)
- Configuración: Classic HLS (mpegts)
- Segmentos: 4 segundos, 7 segmentos max
- Path por cámara: `/cam1`, `/cam2`, etc.

**FFmpeg (Por cámara):**
- Proceso individual por cada cámara habilitada
- Auto-reconexión ante fallos
- Sincronización de timestamps con reloj del sistema
- Parámetros optimizados:
  ```bash
  ffmpeg -rtsp_transport tcp -rtsp_flags prefer_tcp \
         -fflags +genpts+discardcorrupt+nobuffer \
         -flags low_delay \
         -use_wallclock_as_timestamps 1 \
         -i rtsp://... \
         -c copy \  # o transcode según config
         -f rtsp rtsp://localhost:8554/cam1
  ```

**Cloudflared (Túnel Público):**
- Dos modos:
  1. **Quick Tunnel**: Sin cuenta, URL temporal `https://xyz-abc.trycloudflare.com`
  2. **Named Tunnel**: Con cuenta Cloudflare, URL fija personalizada
- Expone MediaMTX (puerto 8888) a Internet
- Credenciales en `~/.cloudflared/{tunnelId}.json`
- Configuración en `cloudflared-config.yml`

### 3.3 Arquitectura Multi-Ubicación

**Configuración de Ubicación:**
```json
{
  "locationId": "cancha-central",
  "locationName": "Cancha Central - Buenos Aires",
  "serverUrl": "https://tuneluno.noaservice.org",
  "tunnelName": "tuneluno",
  "tunnelId": "abc123-def456-...",
  "tunnelHostname": "tuneluno.noaservice.org"
}
```

**Sistema de IDs:**
- Cada ubicación tiene `locationId` único
- Cada cámara tiene `id` local (cam1, cam2, etc.)
- ID completo registrado: `{locationId}-{camId}` (ej: `cancha-central-cam1`)
- Permite múltiples ubicaciones con mismas IDs locales

**Registro en Servidor:**
- POST a `{serverUrl}/api/register` por cada cámara
- Payload:
  ```json
  {
    "camId": "cancha-central-cam1",
    "camName": "Cámara Cancha 1",
    "publicUrl": "https://tuneluno.noaservice.org/cam1",
    "locationId": "cancha-central",
    "locationName": "Cancha Central - Buenos Aires",
    "localCamId": "cam1"
  }
  ```

### 3.4 Sistema de Auto-Reconexión

**Procesos Monitoreados:**
- MediaMTX (servidor RTSP/HLS)
- FFmpeg por cámara
- Cloudflared (túnel)

**Configuración de Reintentos:**
```javascript
{
  enabled: true,
  maxRetries: 5,           // Máximo 5 reintentos
  retryDelayMs: 3000,      // 3 segundos entre reintentos
  backoffMultiplier: 1.5   // Incremento exponencial
}
```

**Lógica de Reconexión:**
1. Proceso falla → Espera `retryDelayMs`
2. Intenta reiniciar (intento 1/5)
3. Si falla → Espera `retryDelayMs * backoffMultiplier`
4. Repite hasta `maxRetries`
5. Si se agotan reintentos → Marca como fallido, notifica usuario
6. Usuario puede reintentar manualmente con botón "Reconectar"

**Notificaciones:**
- 🔄 Reconectando: `{proceso}: Intento {n}/{max}`
- ❌ Error crítico: `{proceso} falló múltiples veces`
- ✅ Reconectado: `{proceso} se reconectó exitosamente`

**Estadísticas:**
- Total de reinicios por proceso
- Último reinicio (timestamp)
- Estado actual (running/stopped/failed)

### 3.5 Configuración del Túnel Cloudflare

**Modal de Configuración (3 pasos):**

**Paso 1: Login en Cloudflare**
```bash
cloudflared login
# Abre navegador → Login Cloudflare → Selecciona dominio → Descarga certificado
# Certificado guardado en: ~/.cloudflared/cert.pem
```

**Paso 2: Crear/Usar Túnel**
```bash
# Crear nuevo túnel
cloudflared tunnel create tuneluno
# → Genera tunnelId y credenciales en ~/.cloudflared/{tunnelId}.json

# O listar túneles existentes
cloudflared tunnel list
```

**Paso 3: Configurar DNS**
```bash
# Asociar subdominios al túnel
cloudflared tunnel route dns {tunnelId} tuneluno.noaservice.org
cloudflared tunnel route dns {tunnelId} *.tuneluno.noaservice.org
```

**Archivo de Configuración Generado:**
```yaml
# cloudflared-config.yml
tunnel: {tunnelId}
credentials-file: C:/Users/{user}/.cloudflared/{tunnelId}.json

ingress:
  - hostname: tuneluno.noaservice.org
    service: http://localhost:8888
  - hostname: "*.tuneluno.noaservice.org"
    service: http://localhost:8888
  - service: http_status:404
```

**Estado de Sincronización (Modal):**
El modal muestra en tiempo real:
- ✅ Túnel Configurado (tiene tunnelName + tunnelId)
- ✅ Credenciales OK (existe `~/.cloudflared/{tunnelId}.json`)
- ✅ Configuración OK (existe `cloudflared-config.yml`)
- 🟢 Túnel Conectado (proceso cloudflared activo)
- ⚠️ Errores de conexión (si los hay)

### 3.6 Monitoreo del Sistema

**Estadísticas en Tiempo Real:**
- 📊 CPU: Uso total del sistema (%)
- 💾 RAM: Memoria usada / total (GB)
- 💽 Disco: Espacio libre / total (GB)
- 🌐 Túnel: Estado de conexión
- ⏱️ Uptime: Tiempo de ejecución

**Actualización:**
- Polling cada 3 segundos cuando servicios están activos
- Push de eventos en tiempo real vía IPC

### 3.7 Modos de Operación

**Modo Prueba (sin túnel):**
- Solo MediaMTX + FFmpeg
- Acceso local: `http://localhost:8888/{camId}/index.m3u8`
- Para testing en red local

**Modo Producción (con túnel):**
- MediaMTX + FFmpeg + Cloudflared
- Acceso público: `https://{tunnel-hostname}/{camId}/index.m3u8`
- Registro automático en servidor centralizado

## 4. INTERFAZ DE USUARIO (React Components)

### 4.1 Componente Principal: App.jsx

**Estados:**
```javascript
const [status, setStatus] = useState('stopped') // 'stopped' | 'running'
const [mode, setMode] = useState(null) // 'test' | 'production'
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
const [cameras, setCameras] = useState([])
const [tunnelUrl, setTunnelUrl] = useState(null)
const [systemStats, setSystemStats] = useState(null)
const [reconnectStats, setReconnectStats] = useState(null)
const [tunnelStatus, setTunnelStatus] = useState(null)

// Config
const [serverUrl, setServerUrl] = useState('')
const [locationId, setLocationId] = useState('')
const [locationName, setLocationName] = useState('')
const [tunnelName, setTunnelName] = useState('')
const [tunnelId, setTunnelId] = useState('')
const [tunnelHostname, setTunnelHostname] = useState('')
```

**Funciones Principales:**
- `start(mode)` - Iniciar servicios (test/production)
- `stop()` - Detener todos los servicios
- `loadCameras()` - Cargar configuración de cámaras
- `loadTunnelStatus()` - Cargar estado de túnel
- `handleAddCamera()` - Agregar nueva cámara
- `handleUpdateCamera()` - Actualizar cámara existente
- `handleDeleteCamera()` - Eliminar cámara
- `handleReconnectCamera()` - Reconectar cámara específica

### 4.2 Header.jsx

**Muestra:**
- Logo/Título de la aplicación
- Ubicación actual (locationName)
- Botón de configuración de ubicación

### 4.3 StatusCard.jsx

**Indicador Visual:**
- 🔴 Detenido (rojo)
- 🟢 En ejecución (verde)
- 🟡 Cargando (amarillo)

**Información:**
- Estado actual
- Modo de operación
- URL del túnel (si aplica)

### 4.4 ControlButtons.jsx

**Botones:**
- 🧪 **Iniciar Modo Prueba**: Sin túnel, solo local
- 🚀 **Iniciar con Túnel**: Producción completa
- ⏹️ **Detener Servicios**: Para todos los procesos
- ⚙️ **Configurar Servidor**: Modal de servidor URL
- 📍 **Configurar Ubicación**: Modal de locationId/Name
- 🔒 **Configurar Túnel**: Modal de túnel (3 pasos)

### 4.5 CameraList.jsx

**Por cada cámara muestra:**
- Estado: 🟢 Habilitada / 🔴 Deshabilitada
- Nombre y ID
- URL RTSP (oculta por defecto)
- Modo: COPY/TRANSCODE
- Calidad: Low/Medium/High
- Audio: Enabled/Disabled/Copy
- **URL Pública HLS**: `https://{tunnel}/{camId}/index.m3u8`
- Botones: ✏️ Editar, 🗑️ Eliminar, 🔄 Reconectar, 📋 Copiar URL

### 4.6 PublicURLPanel.jsx

**Panel con:**
- URL del servidor: `https://tuneluno.noaservice.org`
- Botón para copiar
- Indicador de "Copiado" temporal

### 4.7 StatisticsPanel.jsx

**Métricas del Sistema:**
- CPU: Barra de progreso + porcentaje
- RAM: Barra de progreso + GB usado/total
- Disco: Barra de progreso + GB libre/total
- Uptime: Tiempo formateado (HH:MM:SS)

### 4.8 ReconnectStatus.jsx

**Panel de Reconexión:**
- Estado de cada proceso monitoreado
- Total de reinicios
- Último reinicio (timestamp)
- Botón para configurar política de reconexión

### 4.9 ErrorBanner.jsx

**Banner Rojo Superior:**
- Muestra errores críticos
- Botón X para cerrar
- Auto-oculta cuando se resuelve

## 5. COMUNICACIÓN IPC (Inter-Process Communication)

### 5.1 Canal Main → Renderer (Push Events)

```javascript
// Eventos push desde processManager a UI
window.api.onStatusChanged((data) => {
  // { running: boolean }
})

window.api.onSystemStatsUpdate((stats) => {
  // { cpu, mem, disk, uptime }
})

window.api.onTunnelUrlUpdate((url) => {
  // string: URL del túnel
})

window.api.onErrorUpdate((error) => {
  // string: mensaje de error
})

window.api.onServicesStarted((data) => {
  // { mode: 'test' | 'production' }
})

window.api.onServicesStopped(() => {
  // Sin payload
})

window.api.onReconnectEvent((data) => {
  // { event, process, attempt, maxRetries, stats }
})
```

### 5.2 Canal Renderer → Main (IPC Handlers)

**Control de Servicios:**
```javascript
await window.api.startServices(mode) // 'test' | 'production'
await window.api.stopServices()
await window.api.getStatus() // { running, mode, tunnelUrl }
```

**Configuración:**
```javascript
await window.api.setServerConfig({ serverUrl })
await window.api.getServerConfig() // { serverUrl, locationId, tunnelName, ... }
await window.api.setLocationConfig({ locationId, locationName })
await window.api.getLocationConfig()
await window.api.setTunnelConfig(name, id, hostname)
await window.api.getTunnelConfig()
await window.api.getTunnelStatus() // { isConfigured, isRunning, hasCredentials, ... }
```

**Cámaras:**
```javascript
await window.api.getCameras() // Array de cámaras
await window.api.addCamera(camera) // Agregar
await window.api.updateCamera(id, updates) // Actualizar
await window.api.deleteCamera(id) // Eliminar
await window.api.reconnectCamera(id) // Reconectar proceso FFmpeg
```

**Cloudflare:**
```javascript
await window.api.cloudflaredLogin() // Ejecuta cloudflared login
await window.api.cloudflaredCreateTunnel(name) // Crea túnel nuevo
await window.api.cloudflaredListTunnels() // Lista túneles existentes
await window.api.cloudflaredRouteDNS(tunnelId, hostname) // Configura DNS
```

**Utilidades:**
```javascript
await window.api.changeDNSToCloudflare() // Cambia DNS a 1.1.1.1
await window.api.flushDNSCache() // Limpia caché DNS
await window.api.getSystemStats() // Obtiene métricas
await window.api.getReconnectStats() // Estadísticas de reconexión
await window.api.updateReconnectConfig(config) // Actualiza config
```

## 6. GESTIÓN DE PROCESOS (processManager.js)

### 6.1 Detección de Entorno

```javascript
const { app } = require('electron')
const isDev = !app.isPackaged

const binDir = isDev
  ? path.join(process.cwd(), 'bin')
  : path.join(process.resourcesPath, 'bin')

const dataDir = isDev
  ? process.cwd()
  : app.getPath('userData')
```

### 6.2 Funciones de Proceso

**startMTX():**
- Genera `mediamtx.yml` en `dataDir`
- Spawn `mediamtx.exe` con config absolute path
- Working directory: `dataDir`
- Auto-reconexión habilitada

**startFFmpeg():**
- Carga `cameras.json`
- Filtra cámaras habilitadas
- Spawn un proceso FFmpeg por cámara
- Key en dict: `ffmpeg-{camId}`
- Args según modo (copy/transcode)
- Auto-reconexión habilitada

**startCloudflared():**
- Si tiene `tunnelName` + `tunnelId` → `startNamedTunnel()`
- Si no → Quick tunnel temporal
- Verifica credenciales en `~/.cloudflared/{tunnelId}.json`
- Verifica config en `dataDir/cloudflared-config.yml`
- Captura logs para detectar:
  - ✅ "Registered tunnel connection" → Conectado
  - ❌ "unable to find credentials" → Credenciales faltantes
  - ❌ "context deadline exceeded" → Error de red

**startAll(withCloudflared):**
- Secuencia: MediaMTX → FFmpeg → Cloudflared (opcional)
- Registra cámaras en servidor al final

**stopAll():**
- Desactiva auto-reinicio primero
- Envía SIGTERM a todos los procesos
- Limpia diccionario de procesos

### 6.3 Auto-Reconexión

**Configuración Global:**
```javascript
const reconnectConfig = {
  enabled: true,
  maxRetries: 5,
  retryDelayMs: 3000,
  backoffMultiplier: 1.5
}
```

**Listener en cada proceso:**
```javascript
process.on('exit', (code, signal) => {
  if (shouldRestart[processKey]) {
    const stats = reconnectStats[processKey]
    if (stats.restarts < maxRetries) {
      const delay = retryDelayMs * Math.pow(backoffMultiplier, stats.restarts)
      setTimeout(() => startProcess(args), delay)
      stats.restarts++
      eventCallback('reconnect-event', { event: 'reconnecting', ... })
    } else {
      eventCallback('reconnect-event', { event: 'max-retries-reached', ... })
    }
  }
})
```

### 6.4 Registro de Cámaras en Servidor

```javascript
async function registerCameraOnServer() {
  const enabledCameras = cameras.filter(c => c.enabled)
  
  for (const camera of enabledCameras) {
    const fullCamId = `${locationId}-${camera.id}`
    const publicUrl = `${tunnelUrl}/${camera.id}`
    
    // POST a serverUrl/api/register
    const postData = {
      camId: fullCamId,
      camName: camera.name,
      publicUrl: publicUrl,
      locationId: locationId,
      locationName: locationName,
      localCamId: camera.id
    }
    
    // Envía request HTTP/HTTPS
  }
}
```

## 7. EMPAQUETADO Y DISTRIBUCIÓN

### 7.1 Electron Forge Config

```javascript
// forge.config.js
{
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    executableName: 'StreamAgent',
    extraResource: ['bin', 'cameras.json', 'config.json']
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'stream_agent',
        setupExe: 'stream-agent-setup.exe',
        setupIcon: './assets/icon.ico'
      }
    }
  ]
}
```

### 7.2 Salida del Build

```
out/
├── make/
│   └── squirrel.windows/
│       └── x64/
│           ├── stream-agent-1.0.0 Setup.exe  ← Instalador
│           └── RELEASES
└── stream-agent-win32-x64/  ← Portable
```

### 7.3 Primera Ejecución (Auto-Setup)

```javascript
// Al iniciar en producción por primera vez:
if (!isDev) {
  // Copiar cameras.json si no existe
  if (!fs.existsSync(path.join(dataDir, 'cameras.json'))) {
    fs.copyFileSync(
      path.join(process.resourcesPath, 'cameras.json'),
      path.join(dataDir, 'cameras.json')
    )
  }
  
  // Copiar config.json si no existe
  if (!fs.existsSync(path.join(dataDir, 'config.json'))) {
    fs.copyFileSync(
      path.join(process.resourcesPath, 'config.json'),
      path.join(dataDir, 'config.json')
    )
  }
}
```

## 8. INTEGRACIÓN CON SERVIDOR CENTRALIZADO

### 8.1 Servidor (server-completo-frp.mjs)

**Endpoints:**

```javascript
// Registrar cámara
POST /api/register
Body: {
  camId: string,        // "cancha-central-cam1"
  camName: string,      // "Cámara Cancha 1"
  publicUrl: string,    // "https://tuneluno.noaservice.org/cam1"
  locationId: string,   // "cancha-central"
  locationName: string, // "Cancha Central - Buenos Aires"
  localCamId: string    // "cam1"
}
Response: { success: true }

// Obtener todas las cámaras registradas
GET /api/cameras
Response: {
  cameras: [
    {
      id: "cancha-central-cam1",
      name: "Cámara Cancha 1",
      publicUrl: "https://tuneluno.noaservice.org/cam1",
      location: {
        id: "cancha-central",
        name: "Cancha Central - Buenos Aires"
      },
      localId: "cam1",
      lastUpdate: "2026-01-10T15:30:00Z"
    }
  ]
}

// Obtener cámaras por ubicación
GET /api/cameras/{locationId}
Response: { cameras: [...] }
```

### 8.2 Frontend Centralizado (Vite + React)

**Consume API del servidor:**
- Lista todas las cámaras registradas
- Agrupa por ubicación
- Reproduce streams HLS con HLS.js
- Muestra estado en tiempo real

## 9. FLUJO DE TRABAJO COMPLETO

### 9.1 Setup Inicial (Primera Vez)

1. **Instalar Aplicación**
   - Ejecutar `stream-agent-1.0.0 Setup.exe`
   - Instala en `C:\Program Files\stream-agent\`
   - Crea acceso directo en Escritorio/Menú Inicio

2. **Primera Ejecución**
   - Auto-copia configs a `%AppData%\stream-agent\`
   - Carga configuración por defecto

3. **Configurar Ubicación**
   - Click en "📍 Configurar Ubicación"
   - Ingresar `locationId`: `cancha-central`
   - Ingresar `locationName`: `Cancha Central - Buenos Aires`
   - Guardar

4. **Configurar Servidor**
   - Click en "⚙️ Configurar Servidor"
   - Ingresar URL: `https://tuneluno.noaservice.org`
   - Guardar

5. **Configurar Túnel Cloudflare**
   - Click en "🔒 Configurar Túnel"
   - **Paso 1**: Click "Login Cloudflare"
     - Abre navegador → Login → Selecciona dominio
     - Descarga certificado automáticamente
   - **Paso 2**: Click "Crear Túnel"
     - Ingresa nombre: `tuneluno`
     - Genera tunnel ID y credenciales
   - **Paso 3**: Click "Configurar DNS"
     - Ingresa hostname: `tuneluno.noaservice.org`
     - Crea registros DNS automáticamente
   - Verificar estado de sincronización (verde = OK)

6. **Agregar Cámaras**
   - Click en "➕ Agregar Cámara"
   - Completar formulario:
     - ID: `cam1`
     - Nombre: `Cámara Cancha 1`
     - URL RTSP: `rtsp://user:pass@192.168.1.100:554/stream1`
     - Modo: COPY (recomendado)
     - Audio: TRANSCODE
   - Guardar
   - Repetir para cada cámara

7. **Iniciar Servicios**
   - Click en "🚀 Iniciar con Túnel"
   - Esperar a que todos los servicios inicien
   - Verificar estado: 🟢 En Ejecución

8. **Verificar Funcionamiento**
   - Copiar URL pública de una cámara
   - Abrir en navegador o VLC
   - Debería reproducir stream HLS

### 9.2 Operación Normal

**Al iniciar la PC:**
- Abrir Stream Agent
- Click "🚀 Iniciar con Túnel"
- Las cámaras se registran automáticamente

**Si hay problemas:**
- Ver banner de error (rojo superior)
- Revisar panel de reconexión
- Click "🔄 Reconectar" en cámara específica
- O "⏹️ Detener" y reiniciar

**Al cerrar:**
- Click "⏹️ Detener Servicios"
- Cerrar aplicación (se minimiza a tray)

### 9.3 Setup Multi-Ubicación

**Para agregar segunda ubicación:**

1. **En otra PC**, instalar Stream Agent
2. Configurar nueva ubicación:
   - `locationId`: `cancha-norte`
   - `locationName`: `Cancha Norte - Buenos Aires`
3. Configurar **mismo servidor**: `https://tuneluno.noaservice.org`
4. Configurar **nuevo túnel**:
   - Nombre: `tuneldos`
   - Hostname: `tuneldos.noaservice.org`
5. Agregar cámaras con IDs locales (cam1, cam2, etc.)
6. Iniciar servicios

**Resultado:**
- Servidor centralizado tiene cámaras de ambas ubicaciones
- IDs completos distinguen origen:
  - `cancha-central-cam1` (Primera ubicación)
  - `cancha-norte-cam1` (Segunda ubicación)

## 10. TROUBLESHOOTING

### 10.1 Problemas Comunes

**"Cloudflared no se conecta":**
- Verificar Internet
- Cambiar DNS a 1.1.1.1 (botón en app)
- Limpiar caché DNS (botón en app)
- Revisar firewall/antivirus
- Ejecutar: `Unblock-File bin\cloudflared.exe` en PowerShell

**"Credenciales del túnel no encontradas":**
- Abrir modal de túnel
- Verificar estado: ❌ Credenciales Faltantes
- Re-ejecutar "Login Cloudflare"
- O copiar manualmente `~/.cloudflared/{tunnelId}.json`

**"Cámara no transmite":**
- Verificar URL RTSP correcta
- Verificar red (ping a cámara)
- Click "🔄 Reconectar" en esa cámara
- Revisar logs en `%AppData%\stream-agent\logs\ffmpeg-{camId}.log`

**"CPU al 100%":**
- Cambiar a modo COPY (no transcode)
- Reducir número de cámaras
- Bajar calidad a "low"
- Desactivar audio en cámaras innecesarias

### 10.2 Logs de Diagnóstico

**Ubicación:**
- Dev: `{projectRoot}/logs/`
- Prod: `%AppData%\stream-agent\logs\`

**Archivos:**
- `mediamtx-out.log` / `mediamtx-err.log`
- `ffmpeg-cam1-out.log` / `ffmpeg-cam1-err.log`
- `cloudflared-out.log` / `cloudflared-err.log`

## 11. DEPENDENCIAS CLAVE

### 11.1 NPM Packages

```json
{
  "dependencies": {
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.10.2",
    "@electron-forge/maker-squirrel": "^7.10.2",
    "@electron-forge/plugin-webpack": "^7.10.2",
    "@babel/core": "^7.26.0",
    "@babel/preset-react": "^7.26.3",
    "electron": "39.2.7",
    "webpack": "^5.98.0",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.1"
  }
}
```

### 11.2 Binarios Externos

- **MediaMTX**: `bin/mediamtx.exe` (v1.10.0+)
- **FFmpeg**: `bin/ffmpeg.exe` (última versión estable)
- **Cloudflared**: `bin/cloudflared.exe` (última versión)

## 12. SEGURIDAD

### 12.1 Context Isolation

```javascript
// preload.js - Context bridge seguro
contextBridge.exposeInMainWorld('api', {
  startServices: (mode) => ipcRenderer.invoke('start-services', mode),
  // ... solo funciones específicas expuestas
})
```

### 12.2 Credenciales

- Nunca hardcodear passwords en código
- URLs RTSP con credenciales solo en `cameras.json` (no versionado)
- Credenciales de Cloudflare en `~/.cloudflared/` (fuera de app)

### 12.3 Validación

```javascript
// Validar inputs antes de spawn
if (!camera.id || !camera.rtspUrl) {
  throw new Error('ID y URL RTSP requeridos')
}

// Sanitizar paths
const safePath = path.resolve(dataDir, userInput)
if (!safePath.startsWith(dataDir)) {
  throw new Error('Path inválido')
}
```

## 13. OPTIMIZACIONES

### 13.1 Rendimiento

- Usar modo COPY siempre que sea posible
- Pooling de stats cada 3s (no 1s)
- Lazy loading de componentes React
- Webpack code splitting

### 13.2 Ancho de Banda

**Por cámara en modo COPY:**
- ~2-5 Mbps (depende de cámara)
- 8 cámaras = ~40 Mbps subida requerida

**Por cámara en modo TRANSCODE (medium):**
- ~2.5 Mbps (fijo)
- 8 cámaras = ~20 Mbps subida requerida

### 13.3 Capacidad

**Por PC (típico):**
- CPU: i5/i7 moderno
- RAM: 8GB mínimo
- **Modo COPY**: 8-10 cámaras
- **Modo TRANSCODE**: 4-6 cámaras

**Por Cloudflare Tunnel:**
- Sin límite de ancho de banda (plan Free)
- Recomendado: max 100 Mbps por túnel

## 14. COMANDOS NPM

```bash
# Desarrollo
npm start              # Inicia en modo dev

# Build
npm run package        # Solo empaqueta (no installer)
npm run make           # Genera installer completo

# Limpieza
rm -rf out/ .webpack/  # Limpiar build anterior
```

## 15. EXTENSIONES FUTURAS

### Posibles Mejoras:

1. **Grabación Local**
   - Botón para grabar segmentos HLS
   - Subir a Google Drive/AWS S3

2. **Detección de Movimiento**
   - Integrar OpenCV
   - Alertas push

3. **Snapshots**
   - Capturar imagen actual de cámara
   - Enviar por email/WhatsApp

4. **Acceso Remoto**
   - Control remoto de la app
   - API REST para control externo

5. **Multi-Plataforma**
   - Soporte Linux
   - Soporte macOS

6. **Dashboard Avanzado**
   - Gráficos históricos
   - Alertas configurables
   - Mapas de calor

---

## 📝 RESUMEN EJECUTIVO

**Stream Agent** es una solución completa para:
- ✅ Capturar RTSP de múltiples cámaras IP
- ✅ Convertir a HLS para web
- ✅ Exponer públicamente vía Cloudflare
- ✅ Gestionar múltiples ubicaciones
- ✅ Auto-reconexión ante fallos
- ✅ Monitoreo en tiempo real
- ✅ UI amigable con React + Tailwind

**Ideal para:**
- Canchas deportivas (padel, fútbol, etc.)
- Gimnasios
- Locales comerciales
- Eventos en vivo
- Vigilancia distribuida

**Ventajas:**
- 🚀 Setup en minutos
- 💰 Costo $0 (Cloudflare Free)
- 📱 Acceso desde cualquier navegador
- 🔄 Auto-recuperación ante fallos
- 🌍 Multi-ubicación nativa
- ⚡ Alta performance (modo COPY)

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2026  
**Licencia:** MIT  
**Autor:** LaboratorioInnovacion
