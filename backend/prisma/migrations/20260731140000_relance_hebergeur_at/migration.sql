-- Tampon anti-répétition de la relance hébergeur (cron relancerHerbergeurDevisIgnore).
-- Backfill : les devis EN_ATTENTE déjà au-delà du seuil de 30 j sont tamponnés à NOW()
-- pour éviter une rafale de relances au déploiement (prochaine relance dans 30 j).
ALTER TABLE "devis" ADD COLUMN "relance_hebergeur_at" TIMESTAMP(3);

UPDATE "devis" SET "relance_hebergeur_at" = NOW()
  WHERE "statut" = 'EN_ATTENTE' AND "created_at" <= NOW() - INTERVAL '30 days';
