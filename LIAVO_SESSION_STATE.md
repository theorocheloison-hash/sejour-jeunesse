# LIAVO — État session dev
> Dernière mise à jour : 05/06/2026 (soir) — Import 81 centres LMDJ + sync endpoint + fixes Organisation

---

## COMMITS SESSION 05/06 SOIR

| Commit | Description |
|---|---|
| `45cf532` | feat(admin): import LMDJ centres from web scraping + sync endpoint |
| `fe644d5` | fix: increase JSON body limit to 5mb |
| `6b45e6d` | fix(admin): truncate fields before Organisation creation in syncLmdj |
| `762f6e8` | fix(admin): widen Organisation.departement + attach org on LMDJ update |

---

## TRAVAUX RÉALISÉS SESSION 05/06 SOIR

### 1. Import 81 centres LMDJ en production

- Source : scraping du site public savoie-haute-savoie-juniors.com (2 pages listing + 81 fiches détail)
- Script standalone : `scripts/scrape-lmdj.ts` (cheerio, rate-limited 500ms, retry)
- Endpoint admin : `POST /admin/sync-lmdj` (body = tableau JSON centres)
- Dedup 3 niveaux : apidaeId → nom+ville normalisés (sans accents) → email
- Protection : centres avec `userId` (Sauvageon, Florimont, YAKA, Nants) enrichis seulement (`reseau='LMDJ'` + champs null), jamais écrasés
- Résultat final : 0 créés (déjà fait au 1er run), 80 mis à jour, 1 enrichi (Sauvageon), 0 erreurs
- Organisations rattachées via `findOrCreateOrganisation` (`source: 'RESEAU_IMPORT'`)

### 2. Fix Organisation.departement VarChar(10→100)

Migration SQL manuelle : `20260606_widen_organisation_departement`. "Haute-Savoie" (12 chars) dépassait l'ancien VarChar(10). Suppression du tronquage `departement` à 10 dans `syncLmdj` ; rattachement Organisation ajouté aussi sur la branche update (centres orphelins du 1er run).

### 3. Fix body limit Express 5mb

`main.ts` : `app.use(json({ limit: '5mb' }))` — le JSON des 81 centres dépassait la limite par défaut de 100KB.

### 4. Demande APIDAE Connect envoyée

Formulaire « contactez-nous » apidae-tourisme.com le 05/06. Objectif : accès API consultation + SSO OAuth2 pour LIAVO. Relance téléphonique prévue lundi 09/06 au 04 51 42 01 57.

---

## DONNÉES PROD MODIFIÉES (session 05/06 soir)

- 81 centres `CentreHebergement` avec `reseau='LMDJ'`, `source='LMDJ_WEB'` (ou enrichis pour ceux avec `userId`)
- Organisations créées pour chaque centre (`source='RESEAU_IMPORT'`)
- Migration : `organisations.departement` VARCHAR(10) → VARCHAR(100)

---

## COMMITS SESSION 05/06/2026

| Commit | Description |
|---|---|
| — | feat(inscription): champs saisie directe + parentEmail nullable + fix cascade invitations (SC1) |
| — | feat(inscription): endpoints config champs inscription hébergeur + expose via collab info (SC2) |
| — | feat(inscription): page config champs inscription hébergeur + sidebar + type collab (SC3) |
| — | feat(inscription): CRUD saisie directe participants (SC4) |
| — | feat(inscription): tableau saisie directe participants organisateur (SC5) |
| — | feat(inscription): import CSV enrichi + export CSV participants (SC6-SC7) |
| — | fix(collab): séjour DIRECT → CONVENTION + devis auto-sélectionné + redirect post-vérif login |
| `d6ade15` | fix(devis): bouton "Enregistrer" au lieu de "Envoyer" en mode DIRECT |

---

## TRAVAUX RÉALISÉS SESSION 05/06/2026

### 1. Chantier inscription directe participants (SC1-SC7, feature complète)

**Problème résolu** : chaque hébergeur demande des infos différentes aux organisateurs. Avant : Excel par email. Maintenant : tout dans LIAVO.

**SC1 — Migration schema** : champsInscription (Json?) sur CentreHebergement, parentEmail nullable, champsPersonnalises (Json?) + sourceInscription (String?) sur AutorisationParentale. Fix cascade envoyerInvitations + 2 call sites.

**SC2 — Backend config** : GET/PATCH /centres/config-inscription. Défaut = 9 champs standard. Validation complète. Exposé via getSejourInfo collab.

**SC3 — Frontend config** : /dashboard/hebergeur/parametres/inscription. Checkboxes standard + custom éditables. Sidebar item ajouté.

**SC4 — Backend CRUD** : POST /autorisations/batch-direct, PATCH /:id/update-fields (split signé/non-signé), DELETE /:id. Normalisation parentEmail, parseDateOrNull, objet data explicite.

**SC5 — Frontend tableau** : TabParticipantsSaisieDirecte.tsx extrait. Colonnes dynamiques, state _status tracking, sauvegarde globale Promise.allSettled, section signés read-only, sync guard, sticky columns.

**SC6 — Import CSV enrichi** : 9 colonnes supplémentaires, email optionnel, parseDateFR (JJ/MM/AAAA), prisma.create direct.

**SC7 — Export CSV** : bouton côté client, tous participants, séparateur ; + BOM UTF-8, dates FR.

### 2. Fix DIRECT→COLLABORATIF (bug Frederic Chevalier)

Fix SQL prod : séjour c2edf74f → CONVENTION, devis 939bf13c → SELECTIONNE, DemandeDevis pont créée.
Fix code : accepter() Branch 1 → statut CONVENTION + devis auto-sélectionné + DemandeDevis pont + rattachement.

### 3. Fix redirect post-vérification login

Cookie liavo_post_verify_redirect lu comme fallback dans login/page.tsx.

### 4. Fix bouton devis DIRECT

"Envoyer le devis" → "Enregistrer le devis" quand isDirect.

---

## DONNÉES PROD MODIFIÉES (SQL — session 05/06)

- Séjour c2edf74f (Séjour Hiver Lycée Bruyères) : statut OPTION → CONVENTION
- Devis 939bf13c : statut EN_ATTENTE → SELECTIONNE
- DemandeDevis pont créée (statut FERMEE, centre Sauvageon, enseignant Frederic Chevalier)

---

## PROCHAINS CHANTIERS (ordre de priorité)

### Priorité haute (prochaines sessions)
1. **Dashboard réseau LMDJ — refonte UX** : 81 centres LMDJ en base, dashboard à enrichir (KPIs conversion/élèves/fidélisation, remplacement de l'outil existant adherent.lamdj.com). Relance Marie lundi pour définition fidélisation. CA LMDJ = 30/06/2026.
2. **APIDAE Connect** : en attente réponse (demande envoyée 05/06), relance lundi 09/06. SSO OAuth2 pour connexion hébergeurs via compte APIDAE.
3. **Multi-user hébergeur** (accès collaborateurs, demande Yves)
4. **Stripe Checkout** page abonnement (deadline novembre 2026 pour Yves)

### Priorité moyenne
5. **Invitations parents** 2/enfant
6. **Page restreinte upload Kbis** post-inscription (flow claim UX)
7. **Menus dans l'espace collaboratif** — composition des menus repas, visible organisateur+hébergeur
8. **Plans de chambres** — drag & drop participants dans les chambres (pattern groupes/EleveGroupe, nouveau modèle ChambrePlan + affectation)

### Priorité basse / long terme
9. **Gestion humaine** — planning des équipes hébergeur, heures, affectation personnel aux séjours
10. **Palier abonnement "Pilotage"** — rentabilité (livré) + synchro bancaire + gestion humaine = plan premium au-dessus de Complet. Pricing à définir (0/29/59/99€ HT ?)
11. **Chatbot aide contextuel**
12. SC7 notifications APIDAE (prompt CC prêt, pending validation commerciale LMDJ)
13. Lots 2-4 facturation (PDF/A-3, avoir, Factur-X + Chorus Pro via PISTE)
14. Migration forge française (Gitea sur VPS OVH) — post-recrutement 2e dev

---

## BUGS CONNUS RESTANTS

| Bug | Priorité | Notes |
|---|---|---|
| Onglet "Signé direction" → "Signé" pour séjours DIRECT | Basse | Cosmétique |
| Import mariages : signature_directeur à nettoyer en base | Basse | SQL direct |
| regenererPdf peut écraser un PDF existant | Basse | Risque mineur conformité |
| conditions_annulation Sauvageon vide en base | Action Théo | Remplir dans /profil |

---

## ÉLÉMENTS STRATÉGIQUES ACTIFS

- **CA LMDJ : 30 juin 2026** — Théo présent, admin LMDJ depuis AGO 01/06
- **Jean-Christophe** (vice-président LMDJ, hébergeur La Joie de Vivre, Valloire) — email envoyé 02/06, à relancer
- **Yves Massard** : 3 centres actifs (Florimont, YAKA, Nants), trial jusqu'au 01/12/2026, demande multi-user
- **Frederic Chevalier** : Lycée les Bruyères, Sotteville-les-Rouen. Premier enseignant flux DIRECT→COLLAB. Séjour Hiver janv 2027, 55 élèves. Fix appliqué 05/06.
- **IDDJ** : refus définitif (Robin Baladi construit son propre outil)
- **APIDAE LMDJ** : credentials en attente d'Anaïtis (relance 04/06)
- **Parrainage hébergeurs** : docs/commercial/PARRAINAGE_HEBERGEURS.md, après Stripe
- **APIDAE Connect** : demande envoyée 05/06, en attente. Objectif = accès API propre LIAVO + SSO OAuth2. Relance lundi.
- **Credentials IDDJ** (apiKey=mr8RQgOh) : NE PAS utiliser hors périmètre IDDJ. Robin en refus définitif.
- **Site LMDJ** alimenté par APIDAE (images static.apidae-tourisme.com). 81 centres scrapés = données publiques.
- **adherent.lamdj.com** : outil existant LMDJ, à terme remplacé par LIAVO. Les hébergeurs s'y connectent avec identifiants APIDAE.

---

## INFRASTRUCTURE PROD

| Composant | Service | URL |
|---|---|---|
| Backend + PostgreSQL 17 | Scalingo Paris (liavo-backend) | api.liavo.fr |
| Frontend | Scalingo Paris (liavo-frontend) | liavo.fr |
| Storage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net / bucket liavo-uploads |
| Email | Brevo FR | contact@liavo.fr |
| DNS | OVH (dns14/ns14.ovh.net) | |

---

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL

| Modèle Prisma | Table PostgreSQL |
|---|---|
| User | utilisateurs |
| Organisation | organisations |
| Membership | memberships |
| CentreHebergement | centres_hebergement |
| FacturePrestataire | factures_prestataires |
| VentilationSejourPrestataire | ventilations_sejour_prestataire |
| Devis | devis |
| LigneDevis | lignes_devis |
| Facture | factures |
| SequenceNumero | sequence_numero |
| DemandeDevis | demandes_devis |
| Sejour | sejours |
| Client | clients |
| ActiviteClient | activites_client |
| SejourClient | sejours_clients |
| Rappel | rappels |
| ContactClient | contacts_clients |
| Message | messages |
| PlanningActivite | planning_activites |
| GroupeSejour | groupes_sejour |
| DocumentSejour | documents_sejour |
| AutorisationParentale | autorisations_parentales |
| AccompagnateurMission | accompagnateurs_missions |
| InvitationCollaboration | invitations_collaboration |
