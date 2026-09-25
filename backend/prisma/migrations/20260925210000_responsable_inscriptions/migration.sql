-- B4 module inscriptions v2 : « qui tient la main » sur les inscriptions d'un séjour.
-- Additive : NOT NULL + DEFAULT constant (métadonnée seule sous PostgreSQL 17, pas de
-- réécriture de table). Toutes les lignes existantes prennent ORGANISATEUR = comportement actuel.
ALTER TABLE "sejours" ADD COLUMN "responsable_inscriptions" VARCHAR(20) NOT NULL DEFAULT 'ORGANISATEUR';
ALTER TABLE "sejours" ADD CONSTRAINT "sejours_responsable_inscriptions_check"
  CHECK ("responsable_inscriptions" IN ('ORGANISATEUR', 'HEBERGEUR'));
