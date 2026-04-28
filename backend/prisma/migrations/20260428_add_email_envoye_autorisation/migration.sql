ALTER TABLE "autorisations_parentales" ADD COLUMN "email_envoye" BOOLEAN NOT NULL DEFAULT false;
UPDATE "autorisations_parentales" SET "email_envoye" = true WHERE "signee_at" IS NOT NULL;
UPDATE "autorisations_parentales" SET "email_envoye" = true WHERE "created_at" < NOW() - INTERVAL '1 hour';
