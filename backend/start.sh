#!/bin/sh
set -e

# Appliquer les migrations Prisma en attente (idempotent — safe à rejouer)
npx prisma migrate deploy

# Démarrer le serveur
node /app/dist/src/main
