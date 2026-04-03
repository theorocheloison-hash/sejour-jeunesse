ALTER TABLE "planning_activites" ADD COLUMN IF NOT EXISTS "est_manuelle" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "planning_activites" ADD COLUMN IF NOT EXISTS "est_collective" BOOLEAN NOT NULL DEFAULT false;
DROP TABLE IF EXISTS "contraintes_sejour" CASCADE;
DROP TABLE IF EXISTS "contraintes_centre" CASCADE;
