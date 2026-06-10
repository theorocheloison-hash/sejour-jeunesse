# LIAVO — État session dev
> Dernière mise à jour : 10/06/2026 — Sync post-commit 47a34e9

---

## COMMITS SESSION 10/06/2026

| Commit | Description |
|---|---|
| `47a34e9` | fix(sejour): signature/convention/participants fonctionnels en mode DIRECT **et** COLLABORATIF (3 fixes + persistance nomSignataire backend) |

---

## TRAVAUX RÉALISÉS SESSION 10/06/2026

### Commit `47a34e9` — Parité DIRECT/COLLABORATIF (signature, convention, participants)
Règle appliquée : toute feature hébergeur doit marcher dans les deux modes.

**Fix 1 — Bloc « Devis signé » visible même sans nom de signataire**
- `TabDevisFacturation.tsx` : bloc affiché dès statut `SELECTIONNE`/`SIGNE_DIRECTION` ET (`nomSignataireDirecteur` **OU** `dateSignatureDirecteur`). Upload de scan → nom null mais date présente ⇒ « Document signé le [date] à [heure] ». Heure ajoutée (`toLocaleTimeString`).
- Bloc **ajouté à la branche COLLABORATIF** (`HEBERGEUR`), absent jusqu'ici.
- Backend : `uploadSignaturePublic` / `uploadSignatureDocument` (`devis.service.ts`) persistent `nomSignataire` (optionnel, trim, max 255) dans `nomSignataireDirecteur` ; `devis-public.controller.ts` + `devis.controller.ts` extraient le champ texte du multipart.

**Fix 2 — Convention de séjour accessible en mode COLLABORATIF**
- `TabDevisFacturation.tsx` : bloc convention dupliqué dans la branche `!isDirect` (`HEBERGEUR` + `natureSejour === 'SEJOUR'` + devis signé), câblé sur `budgetData.devis.id` / `.conventionUrl`.
- `handleGenererConvention` recharge la bonne source selon le mode (`reloadAllDirect` vs `onBudgetReload`).
- Backend `genererConventionScolaire` : **acceptait uniquement les devis DIRECT** → étendu pour un devis COLLABORATIF (séjour via `demande.sejour`, établissement/contact dérivés de l'enseignant + son organisation principale via `getOrganisationPrincipale`, e-mail envoyé au contact résolu). Sans ça le bouton plantait en collab.
- `conventionUrl` ajouté au type `DevisBudget` (déjà retourné par `getBudgetData`, tous scalaires).
- ⚠️ Limite connue : `getBudgetData` ne renvoie le devis collab que si `statut === 'SELECTIONNE'` (état signé normal — le statut ne mute pas à la facturation). Les conditions `SIGNE_DIRECTION`/`FACTURE_*` des nouveaux blocs sont donc des branches mortes inoffensives en collab.

**Fix 3 — Participants (places + accompagnateurs) éditables**
- `SejourHeader.tsx` : champs `placesTotales` / `nombreAccompagnateurs` dans le formulaire d'édition, visibles `HEBERGEUR` **dans les deux modes** (non conditionnés sur `isDirect`, contrairement aux champs client).
- `updateInfosSejour` (lib `collaboration.ts` + `UpdateInfosSejourDto` + service) accepte les deux entiers (`@IsInt @Min(0)`).
- **Aucune migration** : colonnes `places_totales` / `nombre_accompagnateurs` déjà présentes sur le modèle Sejour.

`tsc --noEmit` : 0 erreur backend + frontend. Poussé sur `origin/main`.

---

## COMMITS SESSION 09/06/2026

| Commit | Description |
|---|---|
| — | fix: sejourDirect select aligné (dateDebut/dateFin/modeGestion) |
| — | feat: refonte 4 KPIs hébergeur cliquables (CA confirmé+période / devis en attente / à facturer / impayés) + via LIAVO + tab query |
| — | fix: Unicode (caractères spéciaux PDF/emails) |
| — | feat: directeur voit auto tous séjours établissement (3 sources : org + invitation + DIRECT clientOrganisationId) + deletedAt + filtre devis élargi + index prod |
| — | feat: convention séjour scolaire Phase 1 — backend + frontend |

---

## COMMITS SESSION 08/06/2026

| Commit | Description |
|---|---|
| — | fix: label "Signé" en mode DIRECT + guard regenererPdf immuable |
| — | feat: dates nullable on sejour (migration + cascade null-safety) |
| — | feat: extract CreateSejourModal + nullable dates frontend |
| `d9a6b58` | feat: unified CRM client creation + OrganisationSearch + CreateSejourModal from CRM + clientId linkage |
| `2664215` | feat: multi-user hébergeur — CollaborateurCentre + permissions par module/centre |
| — | fix: getMesCentres + getDashboardGlobal incluent les centres en collaboration |
| — | feat: permission guard backend (RequirePermission) + isOwned sur getMesCentres |
| — | feat: multi-user frontend — permissions, sidebar filtrée, page équipe, acceptation invitation |

---

## TRAVAUX RÉALISÉS SESSION 09/06/2026

### 1. Fix sejourDirect select
- `sejourDirect` : sélection étendue à `dateDebut`, `dateFin`, `modeGestion` pour aligner les réponses devis.

### 2. KPIs hébergeur refonte complète
- Dashboard hébergeur (`/dashboard/hebergeur/page.tsx`) : 4 KPIs cliquables.
  - **CA confirmé** : montant TTC + nb séjours, filtrable par période (DDA/DDM/T1-T4). Helpers `resolveSejourDateDebut`, `resolveSejourId`, `computeCAConfirme` extraits.
  - **Devis en attente** : count devis EN_ATTENTE.
  - **À facturer** : count devis SELECTIONNE/SIGNE_DIRECTION non encore facturés.
  - **Impayés** : count devis FACTURE_ACOMPTE/FACTURE_SOLDE sans versement.
  - **Via LIAVO** : séjours avec organisateur invité (mode COLLABORATIF).
- Tab query : clic KPI → redirection vers onglet filtré concerné.

### 3. Fix Unicode
- Caractères spéciaux corrigés dans la génération PDF et emails Brevo.

### 4. Directeur multi-séjour (3 sources)
- `GET /collaboration/mes-sejours-convention` étendu : retourne les séjours où le directeur est lié via (1) organisation, (2) invitation directe, (3) `DIRECT clientOrganisationId`.
- `deletedAt` filtré (séjours supprimés exclus).
- Filtre devis élargi.
- Index ajouté en prod pour la performance.
- Email envoyé à Marie Charvolin (LMDJ) après livraison.

### 5. Convention séjour scolaire Phase 1
- **Backend** :
  - `convention-scolaire-sauvageon.pdf.tsx` : PDF React-PDF (design LIAVO bleu/ocre, 2 colonnes signature, mentions légales).
  - `genererConventionScolaire(devisId)` dans `devis.service.ts` : idempotent (retourne `conventionUrl` si déjà générée), upload OVH Object Storage, email auto à l'enseignant avec lien PDF.
  - `POST /devis/:id/convention` endpoint HEBERGEUR.
  - Migration `convention_url` sur table `devis` appliquée en prod.
- **Frontend** :
  - Bouton "Télécharger la convention" dans `TabDevisFacturation.tsx` : visible si séjour signé (SIGNE_DIRECTION) + mode DIRECT.
- **Contrainte connue** : hardcodé sur le Sauvageon (coordonnées, SIRET, IBAN). Convention configurable par centre = roadmap quand 2e centre actif hors Sauvageon.

### 6. Throttle login/register
- `auth.controller.ts` : `@Throttle` appliqué.
  - `POST /auth/login` : 5 tentatives / 60s par IP.
  - `POST /auth/register/hebergeur` : 5 / heure.
  - `POST /auth/register/organisateur` + `register/signataire` : 10 / heure.
  - `POST /auth/forgot-password` : 5 / heure.

---

## TRAVAUX RÉALISÉS SESSION 08/06/2026

### 1. Fix bugs cosmétiques (3 traités, 1 faux positif)
- **Label "Signé direction" → "Signé" en mode DIRECT** : SejourHeader.tsx + TabDevisFacturation.tsx + clients/page.tsx (badge séjours liés). 3 occurrences corrigées.
- **Guard regenererPdf immuable** : `facture.service.ts` — refuse la régénération si `pdfUrl` existe déjà.
- **Bug signature_directeur mariages** : faux positif — vraies signatures clients, données valides.
- **conditions_annulation Sauvageon** : réglé par Théo dans /profil.

### 2. Dates nullable sur Sejour (backend + frontend)
- Migration : `dateDebut`/`dateFin` → `DateTime?`. 13 cascades backend + 31 cascades frontend corrigées par tsc.
- Checkbox "Dates à définir" dans CreateSejourModal.
- Planning null-safety complet.

### 3. Composants partagés (extraction + uniformisation)
- **CreateSejourModal** extrait de planning → `_shared/`. Props : natureSejour, initialDates, initialClient (avec clientId).
- **OrganisationSearch** unifié ÉN + SIRENE. Promise.allSettled, dedup, 2 sections.
- Planning allégé de ~406 lignes.

### 4. CRM unifié
- Modal "Nouveau client" : toggle Particulier/Pro, OrganisationSearch, adresse complète.
- Boutons séjour → ouvrent CreateSejourModal avec initialClient pré-rempli.
- `clientId` passthrough : skip duplication client.
- Code mort supprimé.

### 5. Multi-user hébergeur (COMPLET)

**Backend :**
- **CollaborateurCentre** : nouveau modèle (userId, centreId, permissions Json, inviteEmail, inviteToken, acceptedAt). Migration SQL manuelle.
- **permission.helper.ts** : types PermissionLevel/PermissionModule/CentrePermissions, getUserCentrePermissions(), hasPermission(), OWNER_PERMISSIONS.
- **getCentreForUser** modifié : accepte propriétaire OU collaborateur accepté. Type de retour inchangé → 14+ callers ne cassent pas.
- **getCentresForUser** modifié : centres possédés + collaborateur, dédupliqués.
- **getMesCentres** + **getDashboardGlobal** : cascade corrigée (utilisaient des requêtes directes, pas le helper). getMesCentres retourne `isOwned: boolean` par centre.
- **Module collaborateurs** : POST /inviter, GET / (liste), PATCH /:id, DELETE /:id, POST /accepter, GET /invitation/:token (public).
- **Hook inscription** : registerHebergeur rattache automatiquement les CollaborateurCentre existants par email.
- **RequirePermission decorator** + **PermissionGuard** : vérifie les permissions par module, niveau READ (GET) ou WRITE (POST/PATCH/DELETE). Appliqué sur 48 endpoints HEBERGEUR.

**Frontend :**
- **usePermissions hook** : charge GET /centres/mes-permissions, expose `can(module, level)` et `isOwner`. Fallback LOCKED en cas d'erreur réseau.
- **Sidebar filtrée** : mapping ROUTE_PERMISSION, items masqués si permission NONE, "Ajouter un centre" et "Mon équipe" propriétaire-only.
- **Page Équipe** (`/hebergeur/equipe`) : liste collaborateurs, modal invitation, modal modification, suppression.
- **Page acceptation** (`/invitation-equipe/[token]`) : auto-accept si connecté HEBERGEUR, redirect login/register sinon.
- **AuthContext** : CentreResume inclut `isOwned`.

---

## COMPOSANTS PARTAGÉS FRONTEND

| Composant | Chemin | Rôle |
|---|---|---|
| `CreateSejourModal` | `_shared/CreateSejourModal.tsx` | Modal création séjour/événement avec clientId, dates optionnelles. |
| `OrganisationSearch` | `_shared/OrganisationSearch.tsx` | Recherche unifiée ÉN + SIRENE. |

---

## ÉTAT DU DASHBOARD RÉSEAU (factuel — lu 10/06)

**Le dashboard réseau existe déjà. Il n'est pas à créer from scratch.**

- **Frontend** : `frontend/app/dashboard/reseau/page.tsx` — implémenté. KPIs, tableau centres triable/filtrable, slide-over détail centre, modal invitation, badges APIDAE/onboarding.
- **Backend** : `GET /reseau/stats` → `AdminService.getReseauStats()` — KPIs : totalCentres, centresActifs, demandesRecues, devisEnvoyes, devisSelectionnes, caTotal, tauxReponse. Par centre : demandesRecues, devisEnvoyes, devisSelectionnes, caGenere, derniereActivite, onboardingScore (4 critères), source APIDAE.
- **Auth** : `ReseauController` protégé `Role.RESEAU`. Compte demo-lmdj@liavo.fr / LMDJ2026!

**Ce qui MANQUE pour la démo Marie (bloquant brief) :**
- KPIs "fidélisation" et "fuites" non définis (dépendent du brief Marie)
- `caGenere` basé sur `statut === 'SELECTIONNE'` uniquement (pas FACTURE_ACOMPTE/SOLDE)
- Pas de graphique d'évolution temporelle
- Données LMDJ actuelles : 81 centres importés, 0 avec userId (aucun hébergeur LMDJ actif) → KPIs devis/CA à 0 jusqu'à acquisition

---

## PROCHAINS CHANTIERS (ordre de priorité — 10/06/2026)

### Priorité immédiate (démo Marie 18/06)
1. **Appeler Marie Charvolin** → brief KPIs dashboard réseau + walkthrough adherent.lamdj.com
2. **Dashboard réseau LMDJ** : enrichir `getReseauStats` selon brief Marie + vérifier `caGenere` inclut FACTURE_ACOMPTE/SOLDE
3. **Appeler APIDAE Connect** : 04 51 42 01 57 (Amandine Chatain, souscription 1210€HT/an)

### Priorité haute
4. **Mention TVA 293 B CGI** sur PDFs factures hébergeur (tauxTva = 0) — quick win, aucune dépendance
5. **Sécurité : email alerte nouvelle connexion** (IP différente → email hébergeur) — avant 30 hébergeurs actifs, estimé 0.5j
6. **Notifier Yves Massard** que multi-user est live (3 centres Florimont/YAKA/Nants)

### Priorité moyenne
7. APIDAE Connect : SSO OAuth2 (dès credentials reçus) — estimé 0.5j
8. Inviter-enseignant → OrganisationSearch partagé
9. Convention configurable par centre (quand 2e centre actif hors Sauvageon)
10. Stripe Checkout (deadline novembre 2026)

### Priorité basse / long terme
11. Invitations parents 2/enfant
12. Menus espace collaboratif
13. Plans de chambres
14. Gestion humaine (planning équipes, CollaborateurCentre étendu)
15. Palier abonnement "Pilotage"
16. Lots 3-4 facturation (PDF/A-3, avoir, Factur-X, Chorus Pro)
17. Facturation LIAVO → Hébergeur (SaaS billing + Stripe)
18. Migration forge française (Gitea sur VPS OVH)

---

## BUGS CONNUS RESTANTS

Aucun.

---

## ÉLÉMENTS STRATÉGIQUES ACTIFS

- **Démo Marie Charvolin (LMDJ) : 18/06/2026** — brief KPIs à obtenir d'abord
- **CA LMDJ : 30/06/2026** — Théo présent, admin LMDJ depuis AG 01/06
- **Yves Massard** : 3 centres (Florimont, YAKA, Nants), trial → 01/12/2026 — à notifier multi-user live
- **Frederic Chevalier** : Lycée Bruyères (Sotteville-lès-Rouen), séjour janv 2027, 55 élèves. Flow DIRECT→COLLABORATIF. Convention hardcodée Sauvageon — vérifier si son séjour est bien au Sauvageon avant utilisation.
- **Jean-Christophe** (VP LMDJ) — non-répondant depuis 02/06, à relancer
- **IDDJ** : refus définitif (Robin construit son outil)
- **APIDAE Connect** : souscription en cours 1210€HT/an, contact Amandine Chatain — relance 10/06
- **LIAVO TVA** : franchise en base (293 B CGI), SIRET 102994910 00010

---

## SÉCURITÉ ROADMAP (validée 09/06)

1. ✅ **LIVRÉ** : Throttle login 5/min + register 5-10/h
2. **Avant 30 hébergeurs** : Email alerte nouvelle connexion (IP diff → email hébergeur) — estimé 0.5j
3. **Q3** : TOTP 2FA optionnel hébergeur
4. **À planifier** : Audit sécurité global (RGPD, sessions JWT, permissions, données mineurs, headers HTTP) avant montée en charge commerciale

---

## INFRASTRUCTURE PROD

| Composant | Service | URL |
|---|---|---|
| Backend + PostgreSQL 17 | Scalingo Paris (liavo-backend, osc-fr1) | api.liavo.fr |
| Frontend | Scalingo Paris (liavo-frontend) | liavo.fr |
| Storage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net / bucket liavo-uploads |
| Email | Brevo FR | contact@liavo.fr |
| DNS | OVH | |

**Scalingo CLI** : `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**PostgreSQL 17 client** : `C:\Program Files\PostgreSQL\17\bin\`
**psql prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`

---

## COMPTES PROD

| Email | Rôle | Mot de passe |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Chalet Le Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (La Montagne des Juniors) | LMDJ2026! |
| enseignant@test.fr | ORGANISATEUR | Test1234! |
| directeur@test.fr | SIGNATAIRE | Test1234! |

---

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL

| Modèle Prisma | Table PostgreSQL |
|---|---|
| User | utilisateurs |
| Organisation | organisations |
| Membership | memberships |
| CentreHebergement | centres_hebergement |
| CollaborateurCentre | collaborateurs_centre |
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

---

## NOTES TECHNIQUES

- **Migrations SQL** : manuelles uniquement (`ALTER TABLE` via Scalingo psql), jamais `prisma migrate dev` en prod. Vérifier systématiquement que CC crée le fichier migration dans `backend/prisma/migrations/`.
- **TypeScript** : 0 erreurs au build (`npx tsc --noEmit`) avant tout commit.
- **`window.location.href` vs `router.push`** : pour les redirects post-registration nécessitant un rechargement complet de l'AuthProvider (cookies), `window.location.href` est correct.
- **Scalingo psql multi-statements** : passer dans un seul `BEGIN;...COMMIT;` sans lignes vides.
- **Body limit NestJS** : 5mb configuré.
- **JWT_SECRET** : sécurisé en prod depuis 29/05/2026, aucun fallback faible.
- **OG tag "649 centres"** : donnée réelle, ne jamais supprimer.
