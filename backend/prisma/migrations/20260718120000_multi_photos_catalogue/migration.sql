-- AlterTable
ALTER TABLE "centres_hebergement"
  ADD COLUMN "images_urls" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill : la photo de présentation existante devient la 1ère photo de la galerie.
-- L'invariant applicatif est : image_url (couverture) = images_urls[1] (SQL est 1-indexé).
UPDATE "centres_hebergement"
  SET "images_urls" = ARRAY["image_url"]
  WHERE "image_url" IS NOT NULL AND "image_url" <> '';
