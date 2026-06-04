# LIAVO — État session dev
> Dernière mise à jour : 03/06/2026 — Session claim flow + demo Yves + bugs devis

## COMMITS POUSSÉS CETTE SESSION
- **42b36cc** : fix varchar(10) département organisations (overflow Haute-Savoie)
- **a5ecc87** : dédup org multi-centre par membership VALIDE dans claimFromCatalogue
- **977ae82** : fix CRM création client + autocomplétion planning
- **(claim flow)** : login 3 gates, endpoint unifié, forceNoKbis supprimé, verifyEmail retourne role+compteValide, validerClaim set emailVerifie
- **(messages/journal DIRECT)** : lots 1-2-3 — CTA inviter, anti-spam invitations, auto-bascule DIRECT→COLLAB
- **(bugs devis)** : label "Demande" pour devis directs, annulation devis (flow 2 étapes avoir+annuler), guard suppression séjour, cascade delete devis EN_ATTENTE/NON_RETENU
- **(aperçu PDF)** : ajout aperçu PDF devis en mode DIRECT + bouton télécharger PDF sur page signature publique
- **fd6a067** : claim centres justificatif par centre — revert auto-activate, migration claimDocumentUrl sur CentreHebergement, admin 2 sections, texte justificatif adapté, bandeau dashboard, fix global PENDING

## DONNÉES PROD MODIFIÉES (SQL)
- Organisation Pôle Montagne : nom corrigé "Pôle Montagne" + SIREN 440246106
- Yves Massard (info@pole-montagne.com) : compteValide=true, emailVerifie=true
- Membership Yves : VALIDE, isPrimary=true
- Centres Florimont + YAKA : ACTIVE, plan COMPLET, abonnement jusqu'au 01/12/2026
- Chalet des Nants : PENDING (retiré, Yves n'opère plus ce centre)
- Devis test orphelin (DEV-2026-0001) supprimé + séjour test supprimé

## PROCHAINS CHANTIERS (ordre)
1. Dashboard réseau KPIs Marie Charvolin (LMDJ) — prio stratégique
2. Rentabilité / P&L par séjour (demande Yves)
3. Accès collaborateurs multi-user hébergeur (demande Yves)
4. Stripe Checkout sur page abonnement (deadline novembre 2026)
5. Bug "Modifier le devis" redirige vers /nouveau au lieu de /[id]/modifier
6. Flux direction — TESTÉ ET FONCTIONNEL, pas de dev nécessaire
7. Invitations parents 2/enfant
8. Page restreinte upload Kbis post-inscription
9. Chatbot aide contextuel
10. Menus drag & drop espace collab
11. Plans de chambres drag & drop (liés inscrits)
12. Import inscrits via Excel côté hébergeur

## BUGS CONNUS RESTANTS
- Onglet "Signé direction" → renommer "Signé" pour séjours directs
- Import mariages : signature_directeur/nom à nettoyer en base
- regenererPdf peut écraser (risque mineur conformité)
- Bouton "Modifier le devis" redirige vers /devis/nouveau au lieu de /devis/[id]/modifier

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma | Table PostgreSQL réelle |
|---|---|
| User | utilisateurs |
| Organisation | organisations |
| Membership | memberships |
| CentreHebergement | centres_hebergement |
| InvitationHebergement | invitations_hebergement |
| ProduitCatalogue | produits_catalogue |
| Disponibilite | disponibilites |
| Document | documents |
| Devis | devis |
| LigneDevis | lignes_devis |
| DemandeDevis | demandes_devis |
| Sejour | sejours |
| Facture | factures |
| SequenceNumero | sequence_numero |
| Message | messages |
| PlanningActivite | planning_activites |
| GroupeSejour | groupes_sejour |
| EleveGroupe | eleves_groupes |
| DocumentSejour | documents_sejour |
| AutorisationParentale | autorisations_parentales |
| AccompagnateurMission | accompagnateurs_missions |
| Client | clients |
| ContactClient | contacts_clients |
| Rappel | rappels |
| ActiviteClient | activites_client |
| SejourClient | sejours_clients |
| InvitationCollaboration | invitations_collaboration |
