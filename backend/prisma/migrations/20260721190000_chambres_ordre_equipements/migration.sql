-- Run 5.1 (retours de recette Sauvageon) — DDL d'abord, backfill ensuite.
-- Plan validé : docs/run-chambres-5-1.md.

-- C. Équipements par chambre — pattern CentreHebergement.equipements (String[] @default([])).
ALTER TABLE "chambres" ADD COLUMN "equipements" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A. Backfill D13 : les chambres nées ordre=0 se triaient par nom (« Chambre 10 »
-- avant « Chambre 2 »). Renumérotation séquentielle par centre dans l'ordre de
-- création, UNIQUEMENT pour les centres où TOUTES les chambres sont à ordre=0
-- (bool_and) — un ordre déjà réarrangé aux flèches n'est jamais écrasé.
-- Idempotente : ORDER BY (created_at, id) déterministe ; après passage, un centre
-- multi-chambres sort du filtre bool_and, un centre mono-chambre recalcule 0 → stable.
WITH centres_intacts AS (
  SELECT centre_id
  FROM chambres
  GROUP BY centre_id
  HAVING bool_and(ordre = 0)
),
renumerotees AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY centre_id ORDER BY created_at, id) - 1 AS nouvel_ordre
  FROM chambres
  WHERE centre_id IN (SELECT centre_id FROM centres_intacts)
)
UPDATE chambres c
SET ordre = r.nouvel_ordre
FROM renumerotees r
WHERE c.id = r.id;
