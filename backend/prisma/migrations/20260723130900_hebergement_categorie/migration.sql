-- SC7 : catégorie d'hébergement par élève (FILLE | GARCON | AUTRE, NULL = pas
-- encore catégorisé). Nullable, sans default, sans CHECK → rétrocompatible.
ALTER TABLE autorisations_parentales ADD COLUMN hebergement_categorie VARCHAR(10);
