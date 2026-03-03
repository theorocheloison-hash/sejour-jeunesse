FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Génère le client Prisma typé à partir du schéma
RUN npx prisma generate

# Port configuré via main.ts : process.env.PORT ?? 3000
ENV PORT=4000
# Polling nécessaire pour détecter les changements de fichiers sur Windows/Docker
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 4000

CMD ["npm", "run", "start:dev"]
