-- Point 6a : traçabilité de « autorisation papier reçue » (qui a cliqué).
-- Additive, nullable : aucune ligne existante modifiée (historique = NULL).
ALTER TABLE "autorisations_parentales" ADD COLUMN "signee_manuellement_par_id" UUID;
ALTER TABLE "autorisations_parentales" ADD CONSTRAINT "autorisations_parentales_signee_manuellement_par_id_fkey"
  FOREIGN KEY ("signee_manuellement_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
