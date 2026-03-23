-- AlterTable
ALTER TABLE "rappels" ADD COLUMN "notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "devis" ADD COLUMN "relance_envoyee_at" TIMESTAMP(3);
