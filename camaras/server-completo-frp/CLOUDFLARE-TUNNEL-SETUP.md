# 🌐 Configuración de Cloudflare Tunnel

Esta guía te ayudará a configurar un túnel de Cloudflare para exponer tu servidor de cámaras públicamente sin necesidad de abrir puertos en tu firewall.

## 📋 Requisitos Previos

- Cuenta de Cloudflare (gratuita)
- Dominio configurado en Cloudflare (opcional, puedes usar el subdominio gratuito `.trycloudflare.com`)

## 🚀 Pasos de Configuración

### 1. Crear el Túnel en Cloudflare

1. Ve a [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navega a **Networks** > **Tunnels**
3. Click en **Create a tunnel**
4. Selecciona **Cloudflared** como connector  asds
5. Dale un nombre (ej: `camaras-server`)
6. Click en **Save tunnel**

### 2. Configurar el Túnel

En la configuración del túnel:

1. **Public Hostname**:
   - Subdomain: `camaras` (o el que prefieras)
   - Domain: selecciona tu dominio o usa uno gratuito
   - Type: `HTTP`
   - URL: `frp-server:3000` (nombre del servicio en docker-compose)

2. Copia el **Tunnel Token** que aparece en pantalla

### 3. Configurar Variables de Entorno

#### En tu servidor (WSL2):

```bash
cd /ruta/a/tu/proyecto/camaras/server-completo-frp
```

Crea el archivo `.env`:

```bash
echo "CLOUDFLARE_TUNNEL_TOKEN=tu_token_aqui" > .env
echo "PORT=3000" >> .env
echo "NODE_ENV=production" >> .env
```

#### En GitHub (para CI/CD):

1. Ve a tu repositorio en GitHub
2. **Settings** > **Secrets and variables** > **Actions**
3. Click en **New repository secret**
4. Añade los siguientes secrets:

| Secret Name | Valor | Descripción |
|-------------|-------|-------------|
| `VPS_HOST` | `localhost` o IP del servidor | Host SSH para conectarse |
| `VPS_USERNAME` | `tu_usuario_wsl` | Usuario WSL2 |
| `VPS_SSH_KEY` | Tu clave privada SSH | Para autenticación |
| `VPS_PROJECT_PATH` | `/home/usuario/camaras/server-completo-frp` | Ruta del proyecto |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token copiado de Cloudflare | Token del túnel |

### 4. Iniciar el Servidor

```bash
# En WSL2
cd /ruta/a/tu/proyecto/camaras/server-completo-frp

# Iniciar los contenedores
docker compose up -d

# Ver logs
docker compose logs -f

# Verificar estado
docker compose ps
```

### 5. Verificar el Túnel

1. En el dashboard de Cloudflare, deberías ver el túnel como **Healthy** (saludable)
2. Accede a tu aplicación mediante la URL configurada (ej: `https://camaras.tudominio.com`)
3. Verifica el endpoint de salud: `https://camaras.tudominio.com/api/health`

## 🔧 Comandos Útiles

### Ver logs del túnel:
```bash
docker compose logs -f cloudflared
```

### Ver logs del servidor:
```bash
docker compose logs -f frp-server
```

### Reiniciar servicios:
```bash
docker compose restart
```

### Detener todo:
```bash
docker compose down
```

## 🐛 Troubleshooting

### El túnel no se conecta

1. Verifica que el token sea correcto en el archivo `.env`
2. Revisa los logs: `docker compose logs cloudflared`
3. Asegúrate de que el servicio `frp-server` esté running: `docker compose ps`

### Error "service unhealthy"

1. Verifica que el puerto 3000 esté disponible
2. Revisa logs del servidor: `docker compose logs frp-server`
3. Ejecuta el health check manualmente: `curl http://localhost:3000/api/health`

### No puedo acceder desde internet

1. Verifica que el túnel esté activo en el dashboard de Cloudflare
2. Confirma la URL pública en el dashboard
3. Revisa los logs de ambos servicios

## 📚 Referencias

- [Documentación de Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## 🔐 Seguridad

- **Nunca** commitees el archivo `.env` con el token real
- Usa GitHub Secrets para almacenar credenciales sensibles
- Considera habilitar autenticación en Cloudflare Access para proteger tu aplicación
- Revisa regularmente los logs de acceso en Cloudflare
