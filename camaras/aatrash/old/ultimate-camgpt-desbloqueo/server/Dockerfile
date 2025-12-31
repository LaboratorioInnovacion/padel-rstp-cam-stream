FROM node:18

WORKDIR /app
COPY ./src ./src
COPY package*.json ./
RUN npm install
EXPOSE 3000
CMD ["node", "src/server.mjs"]