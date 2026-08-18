-- Expiration des invitations hébergeur (D1). Backfill : les invitations
-- existantes héritent de la fenêtre annoncée dans leurs emails (30 jours
-- après création), puis la colonne devient NOT NULL.
ALTER TABLE "invitations_hebergement" ADD COLUMN "expires_at" TIMESTAMP(3);
UPDATE "invitations_hebergement" SET "expires_at" = "created_at" + interval '30 days' WHERE "expires_at" IS NULL;
ALTER TABLE "invitations_hebergement" ALTER COLUMN "expires_at" SET NOT NULL;
