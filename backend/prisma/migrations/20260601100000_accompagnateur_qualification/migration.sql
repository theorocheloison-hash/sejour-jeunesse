-- TAM Phase 1 : qualification encadrant pour déclaration ACM
-- Deux champs : diplome (enum-like VARCHAR) + qualificationAutre (texte libre)
-- Compatibles avec la future intégration TAM automatique (Phase 2)

ALTER TABLE accompagnateurs_missions
  ADD COLUMN IF NOT EXISTS diplome VARCHAR(50),
  ADD COLUMN IF NOT EXISTS qualification_autre VARCHAR(255);

-- Index pour les requêtes futures par type de diplôme (stats TAM, exports)
CREATE INDEX IF NOT EXISTS idx_accompagnateurs_diplome
  ON accompagnateurs_missions (diplome) WHERE diplome IS NOT NULL;
