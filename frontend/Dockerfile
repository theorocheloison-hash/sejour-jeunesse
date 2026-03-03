FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Polling nécessaire pour détecter les changements de fichiers sur Windows/Docker
ENV WATCHPACK_POLLING=true

EXPOSE 3000

# -H 0.0.0.0 pour que le serveur soit accessible depuis l'extérieur du conteneur
CMD ["npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]
