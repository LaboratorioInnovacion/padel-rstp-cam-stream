# Setup Multi-Cámara FRP - Guía de Uso

Sistema automatizado para gestionar múltiples cámaras RTSP con túnel FRP.

## � Instalación Rápida (Primera vez)

### 1. Verificar sistema
Ejecuta primero para ver qué archivos faltan:
```
verificar.bat
```

### 2. Descargar archivos faltantes
El script te dirá qué descargar y desde dónde.

### 3. Ejecutar
```
iniciar.bat
```

**¡Listo!** El archivo `.bat` se encarga de todos los permisos automáticamente.

## �📋 Características

- ✅ Menú interactivo CLI
- ✅ Agregar/eliminar cámaras fácilmente
- ✅ Validación de prerrequisitos
- ✅ Logs por cámara
- ✅ Configuración centralizada
- ✅ Registro automático en backend

## 🚀 Uso Rápido

### Método 1: Doble clic (Recomendado)
```
1. Doble clic en: iniciar.bat
2. Selecciona opción del menú
3. ¡Listo!
```

### Método 2: PowerShell (Alternativo)
```powershell
# Solo si prefieres usar PowerShell directamente
.\setup-multicam-frp.ps1
```

### Método 3: Línea de Comandos
```powershell
# Iniciar todo sin menú
.\setup-multicam-frp.ps1 -Action start

# Agregar cámara por CLI
.\setup-multicam-frp.ps1 -Action add -CameraId cam1 -RtspUrl "rtsp://..."
```

## 📁 Archivos Necesarios

```
SetupMultiCamAutoStart/
├── setup-multicam-frp.ps1  ← Script principal
├── config.json             ← Configuración
├── camaras.txt            ← Lista de cámaras
├── frpc.toml              ← Config FRP client
├── mediamtx.exe           ← Servidor RTSP
├── frpc.exe               ← Cliente FRP
├── ffmpeg.exe             ← Procesador de video
└── logs/                  ← Logs por cámara (auto-creado)
```

## ⚙️ Configuración (config.json)

```json
{
  "serverUrl": "https://tu-servidor.com",
  "serverPort": 3100,
  "rtspPublicHost": "tu-servidor.com",
  "rtspPublicPort": 18554,
  "mediaRtspPort": 8554,
  "logDirectory": "logs",
  "cameraFile": "camaras.txt",
  "outputFile": "urls-publicas.txt"
}
```

## 📹 Formato de camaras.txt

```
# Formato: ID=URL_RTSP
cam1=rtsp://admin:password@192.168.1.100:554/stream1
cam2=rtsp://admin:password@192.168.1.101:554/stream1
padel1=rtsp://admin:password@192.168.1.102:554/stream1
```

## 🎯 Menú Interactivo

```
╔═══════════════════════════════════════════════╗
║    SETUP MULTI-CÁMARA FRP - Menú Principal   ║
╚═══════════════════════════════════════════════╝

1. ▶️  Iniciar todos los servicios y cámaras
2. ➕ Agregar nueva cámara
3. ➖ Eliminar cámara
4. 📋 Listar cámaras
5. 🧹 Detener todos los servicios
6. 📝 Ver logs de una cámara
0. ❌ Salir
```

## 🔧 Solución de Problemas

### Error: "Falta archivo X"
- Verifica que todos los ejecutables estén en la carpeta
- Descarga lo que falte desde sus respectivos sitios oficiales

### Una cámara no se registra
1. Menú → Opción 6 → Ver logs de la cámara
2. Verifica que la URL RTSP sea correcta
3. Verifica que la cámara sea accesible desde tu PC

### No se conecta el túnel FRP
- Verifica que frpc.toml tenga la configuración correcta del servidor
- Verifica que tu servidor FRP esté corriendo

## 📊 Puertos

- **8554**: MediaMTX (RTSP local)
- **18554**: RTSP público (vía túnel FRP)
- **3100**: API del backend (registro de cámaras)

## 🎬 Ejemplo de Uso Completo

```powershell
# 1. Ejecutar script
.\setup-multicam-frp.ps1

# 2. Seleccionar opción 2 (Agregar cámara)
# 3. Ingresar:
#    ID: padel1
#    URL: rtsp://admin:12345@192.168.1.100:554/stream1

# 4. Seleccionar opción 1 (Iniciar servicios)
# ✅ Todo funcionando!

# 5. Ver cámaras en: https://tu-servidor.com:3110
```

## 📝 Notas

- Las URLs públicas se guardan en `urls-publicas.txt`
- Los logs de cada cámara están en `logs/CAMID-err.log`
- Presiona `Ctrl+C` para detener todos los servicios
- Puedes editar `config.json` para cambiar configuraciones
