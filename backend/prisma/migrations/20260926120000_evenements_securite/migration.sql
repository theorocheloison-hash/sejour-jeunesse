-- Alertes maison : journal de sécurité. Table neuve, additive : aucune donnée existante touchée.
CREATE TABLE "evenements_securite" (
    "id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "user_id" UUID,
    "email" VARCHAR(255),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evenements_securite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evenements_securite_type_created_at_idx" ON "evenements_securite"("type", "created_at");
CREATE INDEX "evenements_securite_user_id_created_at_idx" ON "evenements_securite"("user_id", "created_at");
CREATE INDEX "evenements_securite_email_created_at_idx" ON "evenements_securite"("email", "created_at");
CREATE INDEX "evenements_securite_ip_created_at_idx" ON "evenements_securite"("ip", "created_at");

ALTER TABLE "evenements_securite" ADD CONSTRAINT "evenements_securite_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
