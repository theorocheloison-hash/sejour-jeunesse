-- Cron alertes expiration : timestamp du dernier email d'alerte envoyé (anti-spam).
-- Colonne nullable, aucun impact sur les données existantes.

ALTER TABLE "centres_hebergement" ADD COLUMN "dernier_email_alerte_at" TIMESTAMP(3);
