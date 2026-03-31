#!/bin/sh
set -e

# Débloquer la migration failed du 31 mars (one-shot, inoffensif si déjà resolved)
npx prisma migrate resolve --rolled-back 20260331_add_apidae_source_nullable_user 2>/dev/null || true

# Appliquer les migrations Prisma en attente (idempotent — safe à rejouer)
npx prisma migrate deploy

# Démarrer le serveur
node /app/dist/src/main
