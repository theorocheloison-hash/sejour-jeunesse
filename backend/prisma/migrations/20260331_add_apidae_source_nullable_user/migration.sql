-- AlterTable: rendre user_id nullable
ALTER TABLE "centres_hebergement" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable: changer onDelete de Cascade à SetNull
ALTER TABLE "centres_hebergement" DROP CONSTRAINT IF EXISTS "centres_hebergement_user_id_fkey";
ALTER TABLE "centres_hebergement"
  ADD CONSTRAINT "centres_hebergement_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: ajouter apidae_id et source
ALTER TABLE "centres_hebergement" ADD COLUMN "apidae_id" VARCHAR(20);
ALTER TABLE "centres_hebergement" ADD COLUMN "source" VARCHAR(20);
