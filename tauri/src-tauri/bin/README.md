# Instrucciones de Uso

## Binarios Requeridos

Esta carpeta debe contener los siguientes archivos ejecutables:

### 1. mediamtx.exe
- **Propósito**: Servidor RTSP/HLS para recibir y distribuir streams
- **Descarga**: https://github.com/bluenviron/mediamtx/releases
- **Versión recomendada**: v1.9.0 o superior
- **Archivo**: `mediamtx_vX.X.X_windows_amd64.zip`
- **Extraer**: Solo `mediamtx.exe`

### 2. ffmpeg.exe
- **Propósito**: Procesamiento de video (transcode/relay RTSP)
- **Descarga**: https://ffmpeg.org/download.html
- **Fuente recomendada**: https://github.com/BtbN/FFmpeg-Builds/releases
- **Versión**: 6.0 o superior
- **Archivo**: `ffmpeg-master-latest-win64-gpl.zip`
- **Extraer**: `bin/ffmpeg.exe`

### 3. cloudflared.exe (Opcional)
- **Propósito**: Túnel Cloudflare para acceso público
- **Descarga**: https://github.com/cloudflare/cloudflared/releases
- **Archivo**: `cloudflared-windows-amd64.exe`
- **Renombrar**: A `cloudflared.exe`

## Verificación

Después de colocar los archivos, esta carpeta debe contener:

```
bin/
├── mediamtx.exe     (15-20 MB)
├── ffmpeg.exe       (90-100 MB)
└── cloudflared.exe  (30-40 MB) [opcional]
```

## Notas

- En desarrollo, Tauri buscará los binarios en esta carpeta
- En producción, se empaquetan automáticamente con la aplicación
- Los binarios NO están incluidos en el repositorio por su tamaño
- Asegúrate de usar versiones de 64-bit para Windows
