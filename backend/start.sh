#!/bin/sh
npx prisma migrate resolve --rolled-back 20260323_add_invitation_fields
npx prisma migrate deploy
node /app/dist/src/main
