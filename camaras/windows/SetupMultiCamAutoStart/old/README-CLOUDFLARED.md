# Setup Multi-Cámara con Cloudflare Tunnel 🚀

Sistema para transmitir múltiples cámaras RTSP a través de Cloudflare Tunnel usando HLS.

## 📋 Requisitos

1. **MediaMTX** (ya incluido): `mediamtx.exe`
2. **FFmpeg** (ya incluido): `ffmpeg.exe`
3. **Cloudflare Tunnel**: Descarga `cloudflared.exe`
   - Descarga desde: https://github.com/cloudflare/cloudflared/releases
   - Busca: `cloudflared-windows-amd64.exe`
   - Renombra a: `cloudflared.exe`
   - Coloca en esta carpeta

## 🚀 Inicio Rápido

### 1. Descargar cloudflared.exe

```powershell
# Descargar directamente (PowerShell)
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
```

O descárgalo manualmente desde: https://github.com/cloudflare/cloudflared/releases

### 2. Ejecutar

```batch
# Doble clic en:
iniciar-cloudflared.bat
```

### 3. Menú de opciones

```
1. Iniciar todos los servicios  ← Comenzar aquí
2. Agregar cámara
3. Listar cámaras
4. Detener servicios
5. Ver URL pública del túnel
0. Salir
```

## 📁 Configuración de Cámaras

Las cámaras se configuran en `camaras.txt`:

```
# Formato: ID|HOST|PORT|USUARIO|CONTRASEÑA|PATH
cam1|192.168.1.100|554|admin|password123|/stream1
padel1|192.168.1.181|554|admin|pass123|/Streaming/Channels/101
```

## 🌐 URLs Públicas

Después de iniciar, las URLs públicas serán:

```
https://TUNNEL-ID.trycloudflare.com/cam1/index.m3u8
https://TUNNEL-ID.trycloudflare.com/cam2/index.m3u8
```

**IMPORTANTE**: Con el túnel gratuito de Cloudflare, la URL cambia cada vez que reinicias. Para URL fija, necesitas configurar un túnel con tu dominio.

## 🔧 Arquitectura

```
Cámara RTSP → FFmpeg → MediaMTX (localhost:8554)
                           ↓
                      MediaMTX HLS (localhost:8888)
                           ↓
                   Cloudflare Tunnel
                           ↓
              https://TUNNEL-ID.trycloudflare.com
                           ↓
                    Backend registra URLs
                           ↓
                    Frontend reproduce HLS
```

## 📊 Características

✅ **Sin port forwarding**: No necesitas configurar tu router  
✅ **Múltiples cámaras**: Un solo túnel para todas  
✅ **HLS streaming**: Compatible con navegadores web  
✅ **HTTPS**: Conexión segura automática  
✅ **Gratis**: Cloudflare Tunnel es gratuito  

## 🆚 Diferencias con FRP

| Característica | FRP | Cloudflare Tunnel |
|---|---|---|
| Port forwarding | ✅ Necesario | ❌ No necesario |
| Protocolo | RTSP (TCP) | HLS (HTTP) |
| Latencia | ~2s | ~5-10s |
| URL estable | ✅ Sí | ⚠️ No (gratis) |
| Configuración | Compleja | Simple |
| CDN | ❌ No | ✅ Sí |

## 🔒 Túnel Permanente (Opcional)

Para tener una URL fija como `https://camaras.padel.noaservice.org`:

1. Autenticarse con Cloudflare:
   ```powershell
   .\cloudflared.exe login
   ```

2. Crear túnel:
   ```powershell
   .\cloudflared.exe tunnel create camaras-windows
   ```

3. Configurar túnel (crear `config.yml`):
   ```yaml
   tunnel: TUNNEL-ID-AQUI
   credentials-file: RUTA-AL-JSON
   
   ingress:
     - hostname: camaras.padel.noaservice.org
       service: http://localhost:8888
     - service: http_status:404
   ```

4. Ejecutar con config:
   ```powershell
   .\cloudflared.exe tunnel run camaras-windows
   ```

## 📝 Logs

Los logs de FFmpeg se guardan en:
```
./logs/cam1-out.log
./logs/cam1-err.log
```

## 🐛 Troubleshooting

### Error: "No se encuentra cloudflared.exe"
- Descarga cloudflared.exe y colócalo en esta carpeta
- Verifica que el nombre sea exactamente `cloudflared.exe`

### Error: "No se pudo obtener URL del túnel"
- Espera 10 segundos y selecciona la opción 5 del menú
- Revisa los logs de cloudflared

### Cámara no se ve
- Verifica que MediaMTX esté corriendo: http://localhost:8888
- Revisa los logs en `./logs/`
- Verifica las credenciales en `camaras.txt`

## 📞 Soporte

Para más información sobre Cloudflare Tunnel:
https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
