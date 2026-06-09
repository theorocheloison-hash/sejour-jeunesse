-- Index pour la Source 3 du dashboard signataire :
-- séjours DIRECT filtrés par client_organisation_id (getAllSejoursSignataire).
-- Index partiel : la grande majorité des séjours (COLLABORATIF) ont client_organisation_id NULL.
CREATE INDEX IF NOT EXISTS "idx_sejours_client_org"
  ON "sejours" ("client_organisation_id")
  WHERE "client_organisation_id" IS NOT NULL;
