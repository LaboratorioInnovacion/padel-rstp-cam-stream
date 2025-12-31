# 🚀 Guía de Deploy - Servidor FRP

## 📋 Tabla de Contenidos
- [Deploy Local (WSL2 Docker)](#deploy-local-wsl2-docker)
- [Deploy con GitHub Actions](#deploy-con-github-actions)
- [Variables de Entorno](#variables-de-entorno)
- [Troubleshooting](#troubleshooting)

---

## 🖥️ Deploy Local (WSL2 Docker)

### 1. Prerequisitos

```bash
# Verificar Docker
docker --version
docker compose version

# Verificar WSL2 (en PowerShell de Windows)
wsl --list --verbose
```

### 2. Deploy Rápido

```bash
# Dar permisos al script
chmod +x deploy-local.sh

# Ejecutar deploy
./deploy-local.sh
```

### 3. Deploy Manual

```bash
# Build y start
docker compose up -d --build

# Ver logs
docker compose logs -f

# Verificar health
curl http://localhost:3000/api/health
```

### 4. Comandos Útiles

```bash
# Ver estado
docker compose ps

# Reiniciar servicio
docker compose restart frp-server

# Ver logs en tiempo real
docker compose logs -f frp-server

# Entrar al contenedor
docker compose exec frp-server bash

# Detener todo
docker compose down

# Rebuild completo
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🔄 Deploy con GitHub Actions

### 1. Configurar Secrets en GitHub

Ve a: `Settings → Secrets and variables → Actions → New repository secret`

```yaml
VPS_HOST: "tu-ip-o-dominio.com"
VPS_USERNAME: "ubuntu"  # o tu usuario SSH
VPS_SSH_KEY: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  tu-clave-privada-aqui
  -----END OPENSSH PRIVATE KEY-----
VPS_SSH_PORT: "22"  # Opcional, default 22
VPS_PROJECT_PATH: "/home/ubuntu/camaras/server-completo-frp"
```

### 2. Generar SSH Key (si no tienes)

```bash
# En tu máquina local
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Copiar al servidor
ssh-copy-id -i ~/.ssh/github_actions.pub usuario@tu-servidor

# Copiar clave privada y pegarla en GitHub Secrets
cat ~/.ssh/github_actions
```

### 3. Preparar VPS

```bash
# Conectar al VPS
ssh usuario@tu-servidor

# Instalar Docker (si no está instalado)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Clonar el repo
git clone https://github.com/belgranomotosdev/camaras.git
cd camaras/server-completo-frp

# Crear archivos de configuración
cp .env.example .env
# Editar .env con tus valores

# Primera ejecución manual
docker compose up -d
```

### 4. Trigger Deploy

El deploy se ejecuta automáticamente cuando:
- ✅ Haces push a `main` o `master`
- ✅ Cambias archivos en `camaras/server-completo-frp/`
- ✅ Ejecutas manualmente desde Actions tab

```bash
# Push para deploy
git add .
git commit -m "Deploy: actualización del servidor"
git push origin main

# Ver progreso en: https://github.com/belgranomotosdev/camaras/actions
```

---

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# .env
NODE_ENV=production
PORT=3000
TZ=America/Argentina/Buenos_Aires

# Google Drive (opcional)
GOOGLE_DRIVE_ENABLED=false
# GOOGLE_CLIENT_ID=tu-client-id
# GOOGLE_CLIENT_SECRET=tu-client-secret

# FRP Server
FRP_BIND_PORT=7000
FRP_DASHBOARD_PORT=7500
FRP_RTSP_PORT=18554
```

---

## 📊 Monitoring

### Health Check

```bash
# Local
curl http://localhost:3000/api/health

# Remoto
curl https://camarasserver-camserver-rlwh8e-a02680-31-97-64-187.traefik.me:3000/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "uptime": 1234,
  "timestamp": "2025-12-31T12:00:00.000Z",
  "memory": {
    "rss": "100 MB",
    "heapUsed": "50 MB"
  },
  "cameras": 3
}
```

### Ver Logs

```bash
# Logs del contenedor
docker compose logs -f

# Logs de aplicación (dentro del contenedor)
docker compose exec frp-server cat logs/frps.log

# Stats de recursos
docker stats camaras-frp-server
```

### FRP Dashboard

```bash
# Abrir en navegador
http://localhost:7500

# Credenciales (cambiar en frps.toml)
Usuario: admin
Contraseña: admin123
```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to Docker daemon"

```bash
# En WSL2
sudo service docker start

# O reiniciar Docker Desktop en Windows
```

### Error: "Port already in use"

```bash
# Ver qué proceso usa el puerto
netstat -tulpn | grep 3000

# Detener contenedor existente
docker compose down

# O cambiar puerto en docker-compose.yml
ports:
  - "3001:3000"  # Cambiar 3001 por otro puerto
```

### Error: "Permission denied" en frps

```bash
# Dar permisos dentro del contenedor
docker compose exec frp-server chmod +x /usr/local/bin/frps
docker compose restart
```

### Rebuild desde cero

```bash
# Detener todo y limpiar
docker compose down -v
docker system prune -af

# Build limpio
docker compose build --no-cache
docker compose up -d
```

### FFmpeg no funciona

```bash
# Verificar FFmpeg en el contenedor
docker compose exec frp-server ffmpeg -version

# Si falta, rebuild
docker compose build --no-cache
```

### Ver logs detallados

```bash
# Logs de la app
docker compose logs frp-server --tail=100 -f

# Logs del sistema
docker compose exec frp-server tail -f logs/frps.log

# Entrar al contenedor para debug
docker compose exec frp-server bash
ps aux | grep node
ps aux | grep frps
netstat -tuln
```

---

## 🔥 Rollback Rápido

Si algo sale mal en producción:

```bash
# En el VPS
cd /ruta/al/proyecto

# Volver a versión anterior
git log --oneline -5  # Ver últimos commits
git checkout <hash-commit-anterior>

# Recrear contenedor
docker compose up -d --force-recreate

# O pull imagen anterior desde registry
docker pull ghcr.io/belgranomotosdev/camaras/frp-server:<tag-anterior>
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs: `docker compose logs -f`
2. Verifica health: `curl http://localhost:3000/api/health`
3. Verifica puertos: `docker compose ps`
4. Revisa firewall: `sudo ufw status`

---

## 🎉 ¡Listo!

Tu servidor debería estar corriendo en:
- 🌐 API: http://localhost:3000
- 📊 Dashboard FRP: http://localhost:7500
- 🎥 Streams: http://localhost:3000/streams/live/{camId}/index.m3u8

**¡Disfruta tu sistema de cámaras!** 🎥🚀
