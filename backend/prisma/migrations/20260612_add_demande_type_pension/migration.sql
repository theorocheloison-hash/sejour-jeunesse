-- Type de pension d'une demande (multi-select) : PENSION_COMPLETE | DEMI_PENSION | GESTION_LIBRE.
-- Tableau vide par défaut → les demandes existantes n'affichent rien (pas d'impact matching).
ALTER TABLE demandes_devis ADD COLUMN type_pension TEXT[] NOT NULL DEFAULT '{}';
