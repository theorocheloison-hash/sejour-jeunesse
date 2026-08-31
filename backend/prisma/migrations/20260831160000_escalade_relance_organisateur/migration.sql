-- Escalade hébergeur du cron de relance organisateur (relancerDevisEnAttente) :
-- tampon "escalade déjà envoyée" (posé une seule fois, à 6 mois).
ALTER TABLE "devis" ADD COLUMN "escalade_hebergeur_at" TIMESTAMP(3);

-- Anti-rafale : neutralise la relance CLIENT sur tout le stock EN_ATTENTE déjà
-- au-delà du seuil de 30 j (collab ET direct) → aucune relance au déploiement,
-- le cycle mensuel redémarre à J+30. On NE touche PAS escalade_hebergeur_at :
-- les devis déjà > 6 mois escaladeront au 1er passage (décision produit).
UPDATE "devis" SET "relance_envoyee_at" = NOW()
  WHERE "statut" = 'EN_ATTENTE' AND "date_envoi" <= NOW() - INTERVAL '30 days';
