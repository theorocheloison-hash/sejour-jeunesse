-- Flag "template de convention legacy" : réserve le template Sauvageon hardcodé
-- au seul Sauvageon ; les autres centres sans conventionPdfUrl recevront la
-- couverture générique seule.
ALTER TABLE "centres_hebergement" ADD COLUMN "convention_template_legacy" BOOLEAN NOT NULL DEFAULT false;
UPDATE "centres_hebergement" SET "convention_template_legacy" = true WHERE "email" = 'resa@lesauvageon.com';
