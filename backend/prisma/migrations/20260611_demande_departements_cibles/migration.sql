-- Départements cibles d'une demande (appel d'offres réseau multi-département, ex. LMDJ 73/74).
-- Tableau de codes département (ex. {'73','74'}). Quand non vide, prime sur region_cible
-- pour le filtrage des centres (findOpen) et les notifications hébergeurs.
ALTER TABLE "demandes_devis" ADD COLUMN "departements_cibles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
