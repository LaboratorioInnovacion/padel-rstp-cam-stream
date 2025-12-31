#!/bin/sh
set -e

# --- 1. Generar configuración dinámica para FRP ---
cat > /app/frps.toml <<EOF
[common]
bind_port = 7000
vhost_http_port = 80
vhost_https_port = 443

[rtsp]
type = tcp
remote_port = ${FRP_RTSP_PORT}
EOF

# --- 2. Configurar permisos ---
chmod +x /app/frps
chown -R node:node /app

# --- 3. Iniciar FRP en modo producción ---
if [ "$NODE_ENV" = "production" ]; then
  echo "▶ Iniciando FRP Server en producción..."
  nohup /app/frps -c /app/frps.toml > /app/logs/frp.log 2>&1 &
fi

# --- 4. Ejecutar aplicación principal ---
exec su-exec node node server.mjs