-- Suppression des valeurs APPROVED et REJECTED de l'enum StatutSejour
-- Vérifié en prod : 0 ligne avec ces valeurs (SELECT statut, COUNT(*) FROM sejours GROUP BY statut)
-- Résultat : DRAFT(2), OPTION(2), SUBMITTED(1), CONVENTION(7)

-- PostgreSQL ne permet pas DROP VALUE sur un enum existant.
-- On recrée l'enum sans ces deux valeurs.

-- 1. Renommer l'ancien enum
ALTER TYPE "StatutSejour" RENAME TO "StatutSejour_old";

-- 2. Créer le nouvel enum sans APPROVED et REJECTED
CREATE TYPE "StatutSejour" AS ENUM (
  'DRAFT',
  'OPTION',
  'SUBMITTED',
  'CONVENTION',
  'SOUMIS_RECTORAT',
  'SIGNE_DIRECTION',
  'DECLARE_TAM'
);

-- 3. Migrer la colonne
--    Le DEFAULT (DRAFT) référence l'ancien type → le retirer avant le changement de type, puis le re-poser.
ALTER TABLE sejours ALTER COLUMN statut DROP DEFAULT;
ALTER TABLE sejours
  ALTER COLUMN statut TYPE "StatutSejour"
  USING statut::text::"StatutSejour";
ALTER TABLE sejours ALTER COLUMN statut SET DEFAULT 'DRAFT';

-- 4. Supprimer l'ancien enum
DROP TYPE "StatutSejour_old";
