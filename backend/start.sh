#!/bin/sh
set -e

# Marquer toutes les migrations existantes comme appliquées sans les rejouer
npx prisma migrate resolve --applied 20260303170904_init 2>/dev/null || true
npx prisma migrate resolve --applied 20260304075509_add_createur_sejour 2>/dev/null || true
npx prisma migrate resolve --applied 20260304092619_add_autorisation_parentale 2>/dev/null || true
npx prisma migrate resolve --applied 20260304095100_add_hebergement_catalogue_fields 2>/dev/null || true
npx prisma migrate resolve --applied 20260304104418_add_hebergement_interface 2>/dev/null || true
npx prisma migrate resolve --applied 20260304112135_add_abonnement_demandes_devis 2>/dev/null || true
npx prisma migrate resolve --applied 20260304114939_add_appel_offres_thematiques 2>/dev/null || true
npx prisma migrate resolve --applied 20260304120000_update_statut_sejour_enum 2>/dev/null || true
npx prisma migrate resolve --applied 20260305150000_devis_selectionne_workflow 2>/dev/null || true
npx prisma migrate resolve --applied 20260305160000_collaboration 2>/dev/null || true
npx prisma migrate resolve --applied 20260305170000_devis_professionnel 2>/dev/null || true
npx prisma migrate resolve --applied 20260305180000_email_verification 2>/dev/null || true
npx prisma migrate resolve --applied 20260305190000_user_etablissement 2>/dev/null || true
npx prisma migrate resolve --applied 20260305200000_email_verifie_test_accounts 2>/dev/null || true
npx prisma migrate resolve --applied 20260305210000_autorisation_infos_pratiques 2>/dev/null || true
npx prisma migrate resolve --applied 20260306120000_add_centre_fields 2>/dev/null || true
npx prisma migrate resolve --applied 20260306150000_devis_type_document 2>/dev/null || true
npx prisma migrate resolve --applied 20260306160000_devis_acompte_verse 2>/dev/null || true
npx prisma migrate resolve --applied 20260306170000_autorisation_paiement_rgpd_document 2>/dev/null || true
npx prisma migrate resolve --applied 20260306180000_sejour_date_limite_inscription 2>/dev/null || true
npx prisma migrate resolve --applied 20260306190000_accompagnateurs_mission 2>/dev/null || true
npx prisma migrate resolve --applied 20260306200000_accompagnateur_transport 2>/dev/null || true
npx prisma migrate resolve --applied 20260307100000_admin_role_compte_valide 2>/dev/null || true
npx prisma migrate resolve --applied 20260317120000_add_image_url_centre 2>/dev/null || true
npx prisma migrate resolve --applied 20260319120000_add_parent_fields_autorisation 2>/dev/null || true
npx prisma migrate resolve --applied 20260319140000_add_eleve_date_naissance 2>/dev/null || true
npx prisma migrate resolve --applied 20260319160000_add_soumis_rectorat_statut 2>/dev/null || true
npx prisma migrate resolve --applied 20260319180000_add_email_rectorat_directeur 2>/dev/null || true
npx prisma migrate resolve --applied 20260320120000_add_budget_lignes_recettes 2>/dev/null || true
npx prisma migrate resolve --applied 20260320_add_demandes_ignorees 2>/dev/null || true
npx prisma migrate resolve --applied 20260320_add_demande_champs_optionnels 2>/dev/null || true
npx prisma migrate resolve --applied 20260320_add_produits_catalogue 2>/dev/null || true
npx prisma migrate resolve --applied 20260323_add_invitation_fields 2>/dev/null || true
npx prisma migrate resolve --applied 20260323_add_notification_fields 2>/dev/null || true
npx prisma migrate resolve --applied 20260323_add_paiement_partiel 2>/dev/null || true
npx prisma migrate resolve --applied 20260323_add_versements_paiement 2>/dev/null || true

# Appliquer uniquement les nouvelles migrations (25 mars)
npx prisma migrate deploy

node /app/dist/src/main
