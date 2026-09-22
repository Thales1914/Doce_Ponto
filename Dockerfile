FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY tests ./tests

USER node
EXPOSE 3000

# O boot da API aplica as migrations pendentes antes de escutar (idempotente).
CMD ["node", "src/server.js"]
