CREATE TABLE "activites_client" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL,
  "centre_id" UUID NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activites_client_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activites_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  CONSTRAINT "activites_client_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE
);
CREATE INDEX "activites_client_client_id_created_at_idx" ON "activites_client"("client_id", "created_at" DESC);
CREATE INDEX "activites_client_centre_id_idx" ON "activites_client"("centre_id");
