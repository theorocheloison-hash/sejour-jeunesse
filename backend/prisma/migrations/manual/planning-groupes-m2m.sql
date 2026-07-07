BEGIN;

CREATE TABLE planning_activite_groupes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_activite_id  uuid NOT NULL REFERENCES planning_activites(id) ON DELETE CASCADE,
  groupe_id             uuid NOT NULL REFERENCES groupes_sejour(id) ON DELETE CASCADE,
  created_at            timestamp NOT NULL DEFAULT NOW(),
  UNIQUE (planning_activite_id, groupe_id)
);

CREATE INDEX idx_pag_groupe ON planning_activite_groupes(groupe_id);

INSERT INTO planning_activite_groupes (planning_activite_id, groupe_id)
  SELECT id, groupe_id FROM planning_activites WHERE groupe_id IS NOT NULL;

ALTER TABLE planning_activites DROP COLUMN groupe_id;

COMMIT;
