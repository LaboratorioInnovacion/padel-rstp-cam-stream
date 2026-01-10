
# 📡 Multi-Cam FRP Streaming System

Este sistema permite transmitir en vivo y grabar cámaras RTSP desde múltiples ubicaciones, usando FRP, FFmpeg y una app central en Express.

---

## 🧠 ¿Cómo funciona?

1. **Cliente Windows** (canchas, cámaras locales):  
   - Reenvía el RTSP local a `localhost:8554` usando FFmpeg.
   - Usa FRPC para tunelizar el puerto 8554 al servidor público.
   - Registra la cámara en el backend vía HTTP POST.

2. **Servidor Ubuntu** (central):  
   - FRPS recibe las conexiones.
   - Express App escucha registros y lanza FFmpeg para hacer HLS.
   - Sirve `/streams/camX/index.m3u8`.
   - Puede grabar y subir clips a Google Drive.

---

## 📦 Contenido del proyecto

multi-cam-frp-system/
├── server/                  # Código del servidor Ubuntu
│   ├── config/              # Archivos frps.toml
│   ├── services/            # systemd: frps.service, app.service
│   └── src/                 # server.mjs y utilidades FFmpeg/Drive
├── client/                  # Scripts para Windows
│   ├── config/              # cameras.json y frpc-template.toml
│   ├── scripts/             # PowerShell: start-all, install-service
│   └── (binarios frpc, ffmpeg, mediamtx)
└── bin/                     # Carpeta para colocar binarios .exe
```

---

## 🖥️ Configurar el servidor (Ubuntu)

1. **Instalar dependencias**:
   ```bash
   sudo apt install nodejs npm ffmpeg
   sudo cp server/services/*.service /etc/systemd/system/
   sudo systemctl daemon-reload
   ```

2. **Copiar frps** a `/usr/local/bin/` y dar permisos:
   ```bash
   sudo cp frps /usr/local/bin/
   sudo chmod +x /usr/local/bin/frps
   ```

3. **Habilitar servicios**:
   ```bash
   sudo systemctl enable frps
   sudo systemctl enable multi-cam-frp-app
   sudo systemctl start frps
   sudo systemctl start multi-cam-frp-app
   ```

---

## 🖼️ Configurar clientes (Windows con cámaras)

1. Copiar carpeta `client/` al nodo Windows.
2. Editar `client/config/cameras.json`:
   ```json
   {
     "cam1": {
       "localUrl": "rtsp://192.168.0.10:554/stream",
       "remotePort": 18554
     }
   }
   ```
3. Editar `frpc-template.toml` con tu IP pública:
   ```toml
   [common]
   server_addr = "TU.IP.PUBLICA"
   server_port = 7000
   ```

4. Ejecutar como administrador:
   ```powershell
   .\client\scripts\install-service.ps1
   ```

Esto instalará y lanzará el cliente como servicio automático.

---

## 🔗 Acceder a los streams

- Ingresar en: `http://TU.IP:3000/api/streams`
- Ver stream HLS: `http://TU.IP:3000/streams/cam1/index.m3u8`

---

## 📼 Grabación y Google Drive

Lanzar una grabación vía curl o frontend:
```bash
curl -X POST http://TU.IP:3000/api/record -H "Content-Type: application/json" -d '{ "camId": "cam1", "duration": 600 }'
```

---

## ✅ Listo para usar

Con esto podés conectar múltiples canchas o sedes, centralizar la grabación y streaming en un servidor, y automatizar todo el proceso.

