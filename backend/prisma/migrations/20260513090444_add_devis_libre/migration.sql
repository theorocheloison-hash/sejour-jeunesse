-- DevisLibre
CREATE TABLE "devis_libres" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "centre_id" UUID NOT NULL REFERENCES "centres_hebergement"("id") ON DELETE CASCADE,
  "client_id" UUID REFERENCES "clients"("id") ON DELETE SET NULL,
  "nom_client" VARCHAR(255) NOT NULL,
  "prenom_client" VARCHAR(255),
  "email_client" VARCHAR(255),
  "tel_client" VARCHAR(30),
  "adresse_client" VARCHAR(500),
  "type_evenement" VARCHAR(100),
  "date_debut" DATE NOT NULL,
  "date_fin" DATE NOT NULL,
  "description" TEXT,
  "conditions_annulation" TEXT,
  "notes_internes" TEXT,
  "statut" VARCHAR(30) NOT NULL DEFAULT 'BROUILLON',
  "numero_devis" VARCHAR(50),
  "montant_ht" FLOAT,
  "montant_tva" FLOAT,
  "montant_ttc" FLOAT,
  "taux_tva" FLOAT DEFAULT 0,
  "pourcentage_acompte" FLOAT DEFAULT 30,
  "montant_acompte" FLOAT,
  "montant_verse_total" FLOAT DEFAULT 0,
  "document_url" VARCHAR(500),
  "contrat_url" VARCHAR(500),
  "token_signature" UUID UNIQUE DEFAULT gen_random_uuid(),
  "signature_client" TEXT,
  "date_signature_client" TIMESTAMPTZ,
  "signature_ip" VARCHAR(45),
  "signature_user_agent" VARCHAR(500),
  "signature_hash" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "lignes_devis_libre" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "devis_libre_id" UUID NOT NULL REFERENCES "devis_libres"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "quantite" FLOAT NOT NULL,
  "prix_unitaire" FLOAT NOT NULL,
  "tva" FLOAT NOT NULL DEFAULT 0,
  "total_ht" FLOAT NOT NULL,
  "total_ttc" FLOAT NOT NULL
);

CREATE TABLE "versements_devis_libre" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "devis_libre_id" UUID NOT NULL REFERENCES "devis_libres"("id") ON DELETE CASCADE,
  "montant" FLOAT NOT NULL,
  "date_paiement" DATE NOT NULL,
  "reference" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON "devis_libres"("centre_id");
CREATE INDEX ON "devis_libres"("client_id");
CREATE INDEX ON "devis_libres"("token_signature");
CREATE INDEX ON "lignes_devis_libre"("devis_libre_id");
