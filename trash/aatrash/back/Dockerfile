# Dockerfile para el backend Node.js
FROM node:20

WORKDIR /app

# Instalar ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --production || yarn install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.mjs"]
