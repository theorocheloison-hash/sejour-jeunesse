-- Lot 1 (échafaudage inerte) : colonne d'ordre sur les 3 familles de lignes.
-- Backfill = ordre physique courant via ctid (ces tables n'ont aucune colonne
-- triable : pas de created_at, id = uuid v4 aléatoire). Aucun index (Lot 2).

ALTER TABLE "lignes_devis" ADD COLUMN "ordre" INTEGER NOT NULL DEFAULT 0;
UPDATE "lignes_devis" ld SET "ordre" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY devis_id ORDER BY ctid) - 1 AS rn
      FROM "lignes_devis") sub
WHERE ld.id = sub.id;

ALTER TABLE "lignes_facture" ADD COLUMN "ordre" INTEGER NOT NULL DEFAULT 0;
UPDATE "lignes_facture" lf SET "ordre" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY facture_id ORDER BY ctid) - 1 AS rn
      FROM "lignes_facture") sub
WHERE lf.id = sub.id;

ALTER TABLE "lignes_devis_libre" ADD COLUMN "ordre" INTEGER NOT NULL DEFAULT 0;
UPDATE "lignes_devis_libre" ldl SET "ordre" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY devis_libre_id ORDER BY ctid) - 1 AS rn
      FROM "lignes_devis_libre") sub
WHERE ldl.id = sub.id;
