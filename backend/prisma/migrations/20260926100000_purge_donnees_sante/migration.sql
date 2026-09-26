-- Point 6b : trace de la purge automatique des données de santé (J+30 après la fin du séjour).
-- Additive, nullable : aucune ligne existante modifiée.
ALTER TABLE "autorisations_parentales" ADD COLUMN "donnees_sante_purgees_at" TIMESTAMP(3);
