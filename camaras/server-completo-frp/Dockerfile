# ================================================================
# Multi-stage Dockerfile para Servidor FRP con FFmpeg
# ================================================================
FROM node:18-slim AS base

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Descargar FRP Server (Linux AMD64)
WORKDIR /tmp
RUN wget https://github.com/fatedier/frp/releases/download/v0.52.0/frp_0.52.0_linux_amd64.tar.gz \
    && tar -xzf frp_0.52.0_linux_amd64.tar.gz \
    && mv frp_0.52.0_linux_amd64/frps /usr/local/bin/frps \
    && chmod +x /usr/local/bin/frps \
    && rm -rf /tmp/*

# ================================================================
# Stage: Dependencies
# ================================================================
FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ================================================================
# Stage: Production
# ================================================================
FROM base AS production
WORKDIR /app

# Copiar dependencias instaladas
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar archivos del proyecto
COPY package*.json ./
COPY server-completo-frp.mjs ./
COPY src/ ./src/
COPY utils/ ./utils/
COPY config/ ./config/
COPY frps.toml ./

# Crear directorios necesarios
RUN mkdir -p streams logs videos

# Variables de entorno
ENV NODE_ENV=production \
    PORT=3000

# Exponer puertos
EXPOSE 3000 7000 7500 18554

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Comando de inicio
CMD ["node", "server-completo-frp.mjs"]