ALTER TABLE "centres_hebergement" ADD COLUMN "champs_inscription" JSONB;
ALTER TABLE "autorisations_parentales" ALTER COLUMN "parent_email" DROP NOT NULL;
ALTER TABLE "autorisations_parentales" ADD COLUMN "champs_personnalises" JSONB;
ALTER TABLE "autorisations_parentales" ADD COLUMN "source_inscription" VARCHAR(20);
