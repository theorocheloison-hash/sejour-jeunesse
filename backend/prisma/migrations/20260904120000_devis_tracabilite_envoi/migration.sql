-- Traçabilité d'envoi manuel du devis (additif, aucun backfill nécessaire) :
-- dernier destinataire + compteur d'envois (repère « 2ᵉ envoi » côté hébergeur).
ALTER TABLE "devis" ADD COLUMN "dernier_destinataire_envoi" TEXT;
ALTER TABLE "devis" ADD COLUMN "nombre_envois" INTEGER NOT NULL DEFAULT 0;
