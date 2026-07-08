FROM node:20-alpine

WORKDIR /app

# Dependências nativas para Baileys
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js worker.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
