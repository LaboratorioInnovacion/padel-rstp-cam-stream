# Mejoras Recomendadas para el Sistema

## 🔒 Seguridad

### 1. Agregar Autenticación a MediaMTX
```yaml
# mediamtx.yml
paths:
  cam1:
    readUser: usuario
    readPass: contraseña_segura
```

### 2. Rate Limiting en Backend
- Limitar requests por IP
- Prevenir abuso de streaming

### 3. Token de Autenticación para Registro
```powershell
$body = @{
    camId = $camId
    publicUrl = $publicUrl
    token = "tu-token-secreto"  # Nuevo
}
```

## 📊 Optimización

### 4. Transcodificar para Reducir Ancho de Banda
```powershell
# En lugar de -c copy:
"-c:v", "libx264",
"-preset", "ultrafast",
"-b:v", "2M",           # Limitar bitrate
"-maxrate", "2M",
"-bufsize", "4M"
```

### 5. Agregar Health Checks
```powershell
# Antes de registrar, verificar backend
try {
    $health = Invoke-RestMethod -Uri "$($config.serverUrl)/health" -TimeoutSec 5
    if ($health.status -ne "ok") { throw }
} catch {
    Write-Host "[WARN] Backend no disponible, reintentando..."
}
```

### 6. Rotación de Logs
```powershell
# Rotar logs cuando excedan 10MB
if ((Get-Item $logFile).Length -gt 10MB) {
    Move-Item $logFile "$logFile.old" -Force
}
```

## 🚀 Escalabilidad

### 7. Múltiples Túneles
- Si tienes muchas cámaras, usar múltiples túneles
- Balancear carga entre túneles

### 8. CDN Adicional
- Cloudflare es CDN, pero podrías usar:
  - CloudFront (AWS)
  - Azure CDN
  - Como fallback

### 9. Monitoreo Externo
```powershell
# Endpoint de métricas
/api/metrics
{
  "cameras_online": 5,
  "total_bandwidth": "15 Mbps",
  "uptime": "48h"
}
```

## 🔧 Mantenimiento

### 10. Limpieza de Procesos Zombies
```powershell
# Agregar en Monitor-CameraProcesses
$zombies = Get-Process -Name ffmpeg | Where-Object {
    $_.Responding -eq $false
}
$zombies | Stop-Process -Force
```

### 11. Alertas
```powershell
# Enviar notificación si cámara falla > 5 veces
if ($global:ReconnectionAttempts[$camId] -gt 5) {
    Send-Alert -Message "Cámara $camId con problemas"
}
```

### 12. Backup de Configuración
```powershell
# Backup diario de cameras.json y config.json
Copy-Item ".\cameras.json" ".\backups\cameras-$(Get-Date -F yyyyMMdd).json"
```

## 📈 Alternativas al Diseño Actual

### Opción A: ngrok (Más simple)
- URL estática sin DNS
- Plan free más generoso
- Mejor latencia

### Opción B: VPN + Port Forwarding
- Sin límites de ancho de banda
- Menor latencia
- Más complejo de configurar

### Opción C: WebRTC Directo
- Menor latencia (P2P)
- No pasa por servidor intermedio
- Más complejo de implementar

## 🎯 Prioridades

**Alta prioridad:**
1. ✅ Usar siempre túnel permanente (no temporal)
2. ✅ Agregar autenticación a MediaMTX
3. ✅ Health checks del backend

**Media prioridad:**
4. Rotación de logs
5. Transcodificación para reducir bandwidth
6. Limpieza de procesos zombies

**Baja prioridad:**
7. Métricas y monitoreo
8. Alertas automáticas
9. CDN adicional como fallback

## 💰 Consideraciones de Costo

- **Cloudflare Tunnel Free**: OK para 2-3 cámaras
- **5+ cámaras HD**: Considera plan pagado o alternativa
- **Ancho de banda mensual**: Calcula ~1-2 TB/mes por cámara 24/7
