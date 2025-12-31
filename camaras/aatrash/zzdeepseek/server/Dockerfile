# Dockerfile para servidor de streaming multicámara
FROM node:18-alpine

# --- 1. Instalar dependencias del sistema ---
RUN apk add --no-cache \
    ffmpeg \
    tini \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# --- 2. Configurar entorno ---
WORKDIR /app

# Copiar binario FRP
COPY frps /app/frps
RUN chmod +x /app/frps

# Copiar aplicación y utilidades
COPY package*.json ./
COPY server.mjs ./
COPY utils ./utils

# --- 3. Instalar dependencias de Node ---
RUN npm install --production

# --- 4. Crear estructura de directorios ---
RUN mkdir -p \
    /app/streams \
    /app/records \
    /app/logs

# --- 5. Variables de entorno predeterminadas ---
ENV PORT=3000 \
    NODE_ENV=production \
    API_KEY=default_secret_key \
    FRP_DOMAIN=localhost \
    FRP_RTSP_PORT=18554

# --- 6. Exponer puertos ---
# - 3000: Servidor web
# - 7000: FRP bind port
# - 18554: RTSP tunneling
EXPOSE 3000 7000 18554

# --- 7. Punto de entrada ---
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.mjs"]