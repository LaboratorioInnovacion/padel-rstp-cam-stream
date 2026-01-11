# Stream Agent - Multi-Camera Streaming Application

Aplicación de escritorio en Tauri 2.1 (Rust backend + React frontend) para gestionar streaming de múltiples cámaras RTSP.

## Características

- **Backend Rust**: Agente headless que funciona en segundo plano
- **Supervisor de procesos**: Gestiona MediaMTX, FFmpeg (por cámara), y Cloudflared
- **Auto-reconexión**: Política de reintentos con backoff exponencial
- **System Tray**: La aplicación puede minimizarse y seguir operando
- **Frontend React**: Panel de control simple para gestionar el agente
- **Persistencia**: Configuración guardada en JSON

## Arquitectura

```
RTSP Cámara → FFmpeg (transcode/copy) → MediaMTX (RTSP:8554) 
  → MediaMTX HLS (HTTP:8888/camId/index.m3u8)
  → Cloudflare Tunnel (https://tunnel.url/camId)
```

## Requisitos

### Desarrollo

1. **Rust** (1.70+)
   ```bash
   # Windows: Instalar desde https://rustup.rs/
   ```

2. **Node.js** (18+)
   ```bash
   node --version
   ```

3. **Binarios externos** (colocar en `src-tauri/bin/`):
   - `mediamtx.exe` - [Descargar](https://github.com/bluenviron/mediamtx/releases)
   - `ffmpeg.exe` - [Descargar](https://ffmpeg.org/download.html)
   - `cloudflared.exe` - [Descargar](https://github.com/cloudflare/cloudflared/releases)

## Instalación

```bash
cd tauri
npm install
```

## Configuración

Los archivos de configuración están en `src-tauri/config/`:

### 1. `cameras.json`

```json
{
  "cameras": [
    {
      "id": "cam1",
      "name": "Cámara Principal",
      "rtspUrl": "rtsp://user:pass@192.168.1.240:554/stream",
      "enabled": true,
      "encoding": "copy",
      "quality": "medium",
      "audioMode": "copy"
    }
  ]
}
```

**Opciones**:
- `encoding`: `"copy"` (sin recodificar) o `"transcode"` (recodificar)
- `quality`: `"low"` (640x360), `"medium"` (1280x720), `"high"` (1920x1080)
- `audioMode`: `"disabled"`, `"copy"`, `"transcode"`

### 2. `config.json`

```json
{
  "serverUrl": "https://padel.noaservice.org",
  "locationId": "1",
  "locationName": "Ubicación Principal",
  "tunnelName": "stream-agent"
}
```

### 3. `mediamtx.yml`

Configuración de MediaMTX (servidor RTSP/HLS).

### 4. `cloudflared-config.yml`

Configuración del túnel Cloudflare (opcional).

## Desarrollo

```bash
npm run tauri dev
```

## Build Producción

```bash
npm run tauri build
```

Genera instalador Windows en `src-tauri/target/release/bundle/`.

## Comandos Disponibles

### Control del Agente

- `start_agent()` - Inicia MediaMTX, Cloudflared, y cámaras
- `stop_agent()` - Detiene todos los procesos
- `get_agent_status()` - Estado general

### Gestión de Cámaras

- `list_cameras()` - Lista cámaras
- `add_camera(camera)` - Agrega cámara
- `update_camera(id, updates)` - Actualiza
- `remove_camera(id)` - Elimina
- `start_camera(id)` - Inicia FFmpeg
- `stop_camera(id)` - Detiene FFmpeg
- `reconnect_camera(id)` - Reinicia

### Logs

- `get_logs(component, lines?)` - Obtiene logs

## Estructura del Proyecto

```
tauri/
├── src/                      # Frontend React
│   ├── App.tsx              # Componente principal
│   └── App.css              # Estilos
├── src-tauri/               # Backend Rust
│   ├── src/
│   │   ├── app_state.rs     # Structs de dominio
│   │   ├── supervisor/      # Gestión de procesos
│   │   ├── cameras/         # Gestión de cámaras
│   │   └── commands/        # Comandos Tauri
│   ├── bin/                 # Binarios externos
│   ├── config/              # Configs ejemplo
│   └── Cargo.toml
```

## IMPORTANTE: Binarios Requeridos

Antes de ejecutar, descargar y colocar en `src-tauri/bin/`:

1. **MediaMTX** (v1.9+): https://github.com/bluenviron/mediamtx/releases
   - Descargar `mediamtx_vX.X.X_windows_amd64.zip`
   - Extraer `mediamtx.exe` a `src-tauri/bin/`

2. **FFmpeg** (6.0+): https://ffmpeg.org/download.html
   - Descargar build estático de Windows
   - Extraer `ffmpeg.exe` a `src-tauri/bin/`

3. **Cloudflared** (opcional): https://github.com/cloudflare/cloudflared/releases
   - Descargar `cloudflared-windows-amd64.exe`
   - Renombrar a `cloudflared.exe` y colocar en `src-tauri/bin/`

## Troubleshooting

### Error: "Binary not found"

Verificar que los archivos existen:
- `src-tauri/bin/mediamtx.exe`
- `src-tauri/bin/ffmpeg.exe`
- `src-tauri/bin/cloudflared.exe`

### Cámara no conecta

1. Verificar URL RTSP correcta
2. Comprobar acceso de red a la cámara
3. Revisar logs con `get_logs("ffmpeg-cam1")`

## Licencia

MIT
