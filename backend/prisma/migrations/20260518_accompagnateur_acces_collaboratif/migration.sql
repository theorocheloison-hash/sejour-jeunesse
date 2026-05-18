ALTER TABLE "accompagnateurs_missions"
  ADD COLUMN "acces_collaboratif" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "role_collaboratif" VARCHAR(20),
  ADD COLUMN "user_id" UUID;

CREATE INDEX "accompagnateurs_missions_user_id_idx"
  ON "accompagnateurs_missions"("user_id");
