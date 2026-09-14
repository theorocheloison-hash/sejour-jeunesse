ALTER TABLE "centres_hebergement" ADD COLUMN "brochure_url_sejour" VARCHAR(500);
ALTER TABLE "centres_hebergement" ADD COLUMN "brochure_url_evenement" VARCHAR(500);

-- Le Sauvageon : sa brochure actuelle est la brochure MARIAGE → slot événement.
UPDATE "centres_hebergement"
SET "brochure_url_evenement" = "brochure_url"
WHERE "brochure_url" IS NOT NULL AND "email" = 'resa@lesauvageon.com';

-- Tous les autres centres : brochures séjour/groupe (confirmé) → slot séjour.
UPDATE "centres_hebergement"
SET "brochure_url_sejour" = "brochure_url"
WHERE "brochure_url" IS NOT NULL AND "email" IS DISTINCT FROM 'resa@lesauvageon.com';

-- brochure_url conservée (non lue) — filet de rollback, droppée dans un lot ultérieur.
