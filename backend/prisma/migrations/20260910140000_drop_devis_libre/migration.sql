-- Purge DevisLibre : tables mortes depuis la migration 20260528_migrate_devis_libres
-- (données recopiées vers sejours DIRECT/EVENEMENT + devis/lignes_devis/versements_paiement).
-- Enfants d'abord (FK vers devis_libres).
DROP TABLE IF EXISTS "lignes_devis_libre";
DROP TABLE IF EXISTS "versements_devis_libre";
DROP TABLE IF EXISTS "devis_libres";
