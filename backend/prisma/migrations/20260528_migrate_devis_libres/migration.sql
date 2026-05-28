-- =============================================================
-- Migration DevisLibres → Séjours DIRECT + Devis standard
-- Exécution : Scalingo via prisma migrate deploy
-- =============================================================

-- Étape 1 : Créer une table temporaire de mapping
CREATE TEMP TABLE IF NOT EXISTS _dl_mapping (
  devis_libre_id UUID PRIMARY KEY,
  sejour_id UUID NOT NULL,
  devis_id UUID NOT NULL
);

-- Étape 2 : Pour chaque DevisLibre, créer un Séjour DIRECT
DO $$
DECLARE
  dl RECORD;
  new_sejour_id UUID;
  new_devis_id UUID;
  sejour_statut "StatutSejour";
  devis_statut "StatutDevis";
BEGIN
  FOR dl IN SELECT * FROM devis_libres LOOP
    -- Mapper statut DevisLibre → StatutSejour
    CASE dl.statut
      WHEN 'BROUILLON' THEN sejour_statut := 'OPTION';
      WHEN 'ENVOYE' THEN sejour_statut := 'OPTION';
      WHEN 'ACCEPTE' THEN sejour_statut := 'CONVENTION';
      WHEN 'PAYE' THEN sejour_statut := 'CONVENTION';
      WHEN 'REFUSE' THEN sejour_statut := 'OPTION';
      ELSE sejour_statut := 'OPTION';
    END CASE;

    -- Mapper statut DevisLibre → StatutDevis
    CASE dl.statut
      WHEN 'BROUILLON' THEN devis_statut := 'EN_ATTENTE';
      WHEN 'ENVOYE' THEN devis_statut := 'EN_ATTENTE';
      WHEN 'ACCEPTE' THEN devis_statut := 'SELECTIONNE';
      WHEN 'PAYE' THEN devis_statut := 'FACTURE_SOLDE';
      WHEN 'REFUSE' THEN devis_statut := 'NON_RETENU';
      ELSE devis_statut := 'EN_ATTENTE';
    END CASE;

    new_sejour_id := gen_random_uuid();
    new_devis_id := gen_random_uuid();

    -- Créer le Séjour
    INSERT INTO sejours (
      id, titre, description, lieu, date_debut, date_fin,
      places_totales, places_restantes, statut,
      mode_gestion, nature_sejour, type_sejour,
      hebergement_selectionne_id,
      client_nom, client_prenom, client_email, client_telephone, client_organisation,
      type_contexte,
      created_at, updated_at
    )
    SELECT
      new_sejour_id,
      COALESCE(dl.type_evenement, 'Événement'),
      dl.description,
      c.ville,
      dl.date_debut,
      dl.date_fin,
      0, 0,
      sejour_statut,
      'DIRECT',
      'EVENEMENT',
      CASE
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%mariage%' THEN 'MARIAGE'
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%séminaire%' OR LOWER(COALESCE(dl.type_evenement, '')) LIKE '%seminaire%' THEN 'SEMINAIRE'
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%anniversaire%' THEN 'ANNIVERSAIRE'
        ELSE 'AUTRE_EVENEMENT'
      END,
      dl.centre_id,
      dl.nom_client,
      dl.prenom_client,
      dl.email_client,
      dl.tel_client,
      NULL,
      'HORS_SCOLAIRE',
      dl.created_at,
      dl.updated_at
    FROM centres_hebergement c WHERE c.id = dl.centre_id;

    -- Créer le Devis
    INSERT INTO devis (
      id, sejour_direct_id, centre_id,
      montant_total, montant_par_eleve,
      montant_ht, montant_tva, montant_ttc,
      taux_tva, pourcentage_acompte, montant_acompte,
      montant_verse_total, numero_devis, statut,
      conditions_annulation, description,
      token_signature,
      nom_entreprise, adresse_entreprise, siret_entreprise, email_entreprise, tel_entreprise,
      created_at, updated_at
    )
    VALUES (
      new_devis_id,
      new_sejour_id,
      dl.centre_id,
      COALESCE(dl.montant_ttc, 0),
      0,
      dl.montant_ht,
      dl.montant_tva,
      dl.montant_ttc,
      dl.taux_tva,
      dl.pourcentage_acompte,
      dl.montant_acompte,
      dl.montant_verse_total,
      dl.numero_devis,
      devis_statut,
      dl.conditions_annulation,
      dl.description,
      dl.token_signature,
      NULL, NULL, NULL, NULL, NULL,
      dl.created_at,
      dl.updated_at
    );

    -- Stocker le mapping
    INSERT INTO _dl_mapping (devis_libre_id, sejour_id, devis_id)
    VALUES (dl.id, new_sejour_id, new_devis_id);
  END LOOP;
END $$;

-- Étape 3 : Migrer les lignes de devis
INSERT INTO lignes_devis (id, devis_id, description, quantite, prix_unitaire, tva, total_ht, total_ttc)
SELECT gen_random_uuid(), m.devis_id, ldl.description, ldl.quantite, ldl.prix_unitaire, ldl.tva, ldl.total_ht, ldl.total_ttc
FROM lignes_devis_libre ldl
JOIN _dl_mapping m ON m.devis_libre_id = ldl.devis_libre_id;

-- Étape 4 : Migrer les versements
INSERT INTO versements_paiement (id, devis_id, montant, date_paiement, reference, created_at)
SELECT gen_random_uuid(), m.devis_id, v.montant, v.date_paiement, v.reference, v.created_at
FROM versements_devis_libre v
JOIN _dl_mapping m ON m.devis_libre_id = v.devis_libre_id;

-- Étape 5 : Migrer les liens SejourClient
INSERT INTO sejours_clients (id, client_id, sejour_id, created_at)
SELECT gen_random_uuid(), dl.client_id, m.sejour_id, NOW()
FROM devis_libres dl
JOIN _dl_mapping m ON m.devis_libre_id = dl.id
WHERE dl.client_id IS NOT NULL
ON CONFLICT (client_id, sejour_id) DO NOTHING;

-- Étape 6 : Nettoyage (on ne DROP PAS les tables maintenant — on le fera manuellement après vérification)
-- Les tables devis_libres, lignes_devis_libre, versements_devis_libre restent en base
-- mais le code ne les utilise plus.

DROP TABLE IF EXISTS _dl_mapping;
