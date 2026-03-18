#!/bin/sh
npx prisma migrate deploy
node /app/dist/src/main
