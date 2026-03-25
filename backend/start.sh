#!/bin/sh
npx prisma migrate resolve --rolled-back 20260323_add_invitation_fields 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260323_add_paiement_partiel 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260323_add_notification_fields 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260323_add_versements_paiement 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260325_add_reset_password_token 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260325_dpa_consentement_rgpd 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260325_mandat_facturation_chorus 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260325_rgpd_tracabilite_consentement 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260325_signature_metadata 2>/dev/null || true
npx prisma migrate deploy
node /app/dist/src/main
