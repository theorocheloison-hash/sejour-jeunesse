-- Source réseau sur User (table "utilisateurs") — fidélité : persiste même si l'enseignant revient en DIRECT
ALTER TABLE "utilisateurs" ADD COLUMN "source_reseau" VARCHAR(50);

-- Source réseau sur DemandeDevis (table "demandes_devis") — traçabilité par demande
ALTER TABLE "demandes_devis" ADD COLUMN "source_reseau" VARCHAR(50);

-- NB : la colonne "telephone" existe déjà sur "utilisateurs" (schema.prisma) → NON ajoutée.
