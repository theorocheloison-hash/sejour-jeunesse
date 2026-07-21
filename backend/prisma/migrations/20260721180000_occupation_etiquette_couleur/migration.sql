-- Marquage V1 (D13 option a) : étiquette libre + couleur portées par l'OCCUPATION
-- (« Filles » / « Garçons » / « Accompagnateurs »…) — lecture d'un coup d'œil sur la
-- grille et la rooming list. Colonnes nullables : aucune donnée existante à migrer.
-- Réf : docs/ARCHITECTURE_MODULE_CHAMBRES.md D13, plan : docs/run-chambres-4a.md §1.
ALTER TABLE "occupations_chambre"
  ADD COLUMN "etiquette" VARCHAR(30),
  ADD COLUMN "couleur" VARCHAR(20);
