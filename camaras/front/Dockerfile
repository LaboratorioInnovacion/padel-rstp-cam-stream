# Dockerfile para frontend Vite + React
FROM node:20 AS build
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copiar código fuente
COPY . .

# Configurar variable de entorno para Vite (apunta al servidor cloudflared)
ENV VITE_API_BASE_URL=https://tuneluno.noaservice.org

# Build de producción
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
