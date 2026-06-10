-- Logo de l'hébergeur (table "centres_hebergement") — affiché en en-tête des devis (PDF frontend) et factures (PDF backend).
-- JPG/PNG uniquement (react-pdf ne supporte pas le webp). Stocké sur OVH (folder logos/).
ALTER TABLE "centres_hebergement" ADD COLUMN "logo_url" VARCHAR(500);
