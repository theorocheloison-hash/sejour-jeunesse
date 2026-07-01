-- Migration manuelle — à appliquer via pgsql-console avant/pendant le déploiement.
-- Ajoute la colonne contrat_url sur devis (persistance du PDF contrat événement).
-- scalingo --app liavo-backend --region osc-fr1 pgsql-console

ALTER TABLE devis ADD COLUMN contrat_url VARCHAR(500);
