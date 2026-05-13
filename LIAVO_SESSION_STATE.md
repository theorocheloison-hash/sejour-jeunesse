# LIAVO — État session dev
> Dernière mise à jour : 13/05/2026 — Module DevisLibre complet (backend + frontend)

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
| Organisation              | organisations                   |
| Membership                | memberships                     |
| CentreHebergement         | centres_hebergement             |
| InvitationHebergement     | invitations_hebergement         |
| ProduitCatalogue          | produits_catalogue              |
| Disponibilite             | disponibilites                  |
| Document                  | documents                       |
| Devis                     | devis                           |
| LigneDevis                | lignes_devis                    |
| DemandeDevis              | demandes_devis                  |
| Sejour                    | sejours                         |
| Message                   | messages                        |
| PlanningActivite          | planning_activites              |
| GroupeSejour              | groupes_sejour                  |
| EleveGroupe               | eleves_groupes                  |
| DocumentSejour            | documents_sejour                |
| AutorisationParentale     | autorisations_parentales        |
| AccompagnateurMission     | accompagnateurs_missions        |
| Client                    | clients                         |
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |
| DevisLibre                | devis_libres                    |
| LigneDevisLibre           | lignes_devis_libre              |
| VersementDevisLibre       | versements_devis_libre          |

### Colonnes supprimées (SC8) — ne plus utiliser
- etablissement_uai, etablissement_nom, etablissement_adresse
- etablissement_ville, etablissement_email, etablissement_telephone, type_structure
→ Données portées par organisations via memberships

### StatutDevis — valeurs actuelles
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU
(ACCEPTE et REFUSE existent dans l'enum Prisma mais ne sont plus utilisés)

### StatutDevisLibre — valeurs (string, pas enum)
BROUILLON | ENVOYE | ACCEPTE | REFUSE | PAYE

### StatutSejour — valeurs actuelles
DRAFT | SUBMITTED | APPROVED | REJECTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM

---

## REGLE ABSOLUE — PROCESS CC
**L'analyse cascade et le grep de vérification finale font partie intégrante de chaque prompt CC.**
**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**
**Prompts longs : découper en parties numérotées — CC tronque au-delà d'une certaine taille.**

---

## STACK TECHNIQUE

| Composant | Technologie | URL |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| BDD | PostgreSQL 17.9 | Scalingo Paris |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net |
| Emails | Brevo | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |

**Repo :** theorocheloison-hash/sejour-jeunesse
**Local :** C:\Users\Roche-Loison\Desktop\sejour-jeunesse (copie UNIQUE)
**Déploiement :** push main → Scalingo auto via CC
**Scalingo CLI :** C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe
**PROJECT_DIR :** backend=backend / frontend=frontend (monorepo Scalingo)

---

## COMMANDES SCALINGO

```bash
scalingo --app liavo-backend --region osc-fr1 pgsql-console
scalingo --app liavo-backend --region osc-fr1 env
scalingo --app liavo-backend --region osc-fr1 logs --lines 100
scalingo --app liavo-backend --region osc-fr1 env-set NOM_VAR=valeur
```

---

## COMPTES DE RÉFÉRENCE

| Email | Rôle | MDP |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | [réinitialisé par Théo le 13/05] |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154
INTERDIT : contact@chalet-sauvageon.fr = adresse INEXISTANTE
Email Sauvageon correct : resa@lesauvageon.com

---

## MODULE DEVIS LIBRES — 13/05/2026 (COMPLET)

### Objectif
Permettre à l'hébergeur de créer des devis pour clients particuliers (mariages,
séminaires, etc.) sans workflow séjour scolaire. Entièrement côté hébergeur.

### Architecture
- Type 2 : DevisLibre pur (mariage, particulier) — ce module
- Type 3 : Séjour gré-à-gré scolaire sans enseignant actif → reporté post-validation commerciale

### Fichiers créés/modifiés

**Backend :**
- `backend/prisma/migrations/20260513090444_add_devis_libre/migration.sql`
- `backend/prisma/schema.prisma` — 3 nouveaux models + relations inverses sur Client et CentreHebergement
- `backend/src/devis-libres/devis-libres.module.ts`
- `backend/src/devis-libres/devis-libres.controller.ts`
- `backend/src/devis-libres/devis-libres.service.ts`
- `backend/src/devis-libres/dto/create-devis-libre.dto.ts`
- `backend/src/storage/storage.service.ts` — ajout `uploadBuffer()`
- `backend/src/app.module.ts` — import DevisLibresModule
- `backend/.buildpacks` — LibreOffice buildpack (Soulou) + Node
- `backend/Aptfile` — libreoffice
- `backend/assets/contrat-sauvageon.docx` — template contrat type mariage

**Frontend :**
- `frontend/src/lib/devis-libres.ts` — types + 8 fonctions API
- `frontend/src/lib/clients.ts` — ajout champ `devisLibres?` sur Client
- `frontend/app/devis-libre/signer/[token]/page.tsx` — page publique signature (sans auth)
- `frontend/app/dashboard/hebergeur/planning/page.tsx` — blocs DevisLibre sur planning
- `frontend/app/dashboard/hebergeur/clients/page.tsx` — Section 5b événements particuliers
- `frontend/app/dashboard/hebergeur/devis-libres/nouveau/page.tsx` — formulaire création
- `frontend/app/dashboard/hebergeur/devis-libres/[id]/page.tsx` — page détail/gestion

### Routes backend
```
GET    /devis-libres              → liste hébergeur (HEBERGEUR)
POST   /devis-libres              → création (HEBERGEUR)
GET    /devis-libres/:id          → détail (HEBERGEUR)
PATCH  /devis-libres/:id          → mise à jour (HEBERGEUR)
DELETE /devis-libres/:id          → suppression (HEBERGEUR)
POST   /devis-libres/:id/envoyer  → envoi email + contrat PDF (HEBERGEUR)
POST   /devis-libres/:id/versements → ajout versement (HEBERGEUR)
GET    /devis-libres/signer/:token → données signature (PUBLIC — pas de guard)
POST   /devis-libres/signer/:token → signer (PUBLIC — pas de guard)
```

### 3 points d'entrée formulaire
1. Planning → clic sur créneau → bouton "Créer un événement" → `/nouveau?dateDebut=&dateFin=`
2. CRM fiche client → bouton "+ Nouveau devis événement" → `/nouveau?clientId=`
3. Direct → `/dashboard/hebergeur/devis-libres/nouveau`

### Points d'attention / TODO
- Mode édition formulaire `nouveau` : `?edit=id` redirige vers le formulaire
  mais le mode edit n'est pas encore implémenté — à faire dans une prochaine session
- LibreOffice (soffice) : fonctionne uniquement en prod Scalingo (buildpack).
  En dev Windows → try/catch absorbe l'erreur, email part sans PDF contrat
- Seuil PAYE : montantVerseTotal >= montantTTC * 0.99 (protection arrondi)
- Section 5b CRM visible pour tous les clients (pas seulement ceux avec devis LIAVO)
- Variables docxtemplater dans le template contrat :
  dateDebut, dateFin, nomClient, prenomClient, adresseClient,
  telClient, emailClient, dateSignature, nomPrenomSignataire
- IMPORTANT : le template contrat-sauvageon.docx doit avoir les variables
  docxtemplater insérées manuellement (remplacer les XX par {variable}).
  Le fichier actuel dans backend/assets/ est le modèle brut non modifié.

### Commits
- `feat(devis-libres): backend module complet — migration, schema, controller, service, buildpacks Scalingo`
- `feat(devis-libres): frontend — lib, page signature publique, planning, CRM clients` (096ac54)
- `feat(devis-libres): formulaire création + page détail hébergeur` (1f52ba3)

---

## CHANTIER A2 — PDF externe devis — 13/05/2026 (COMPLET)

Correctif : quand l'hébergeur uploade un PDF externe comme devis, l'organisateur
peut maintenant le voir dans l'espace collaboratif et dans la page offres.

**Fichiers modifiés :**
- `frontend/src/lib/devis.ts` — ajout `createDevisWithFile()` (multipart)
- `frontend/app/dashboard/hebergeur/demandes/page.tsx` — upload PDF → POST /devis
- `frontend/app/dashboard/organisateur/sejours/[id]/offres/page.tsx` — affiche iframe si documentUrl
- `frontend/app/dashboard/sejour/[id]/page.tsx` — affiche iframe si documentUrl

Commit : `fix(devis): PDF externe visible organisateur — A2`

---

## ÉTAT DES SOUS-CHANTIERS — 13/05/2026

| SC | Nom | Statut |
|---|---|---|
| SC0 | Migration Railway → Scalingo | TERMINE |
| SC1 | Schéma Prisma + backfill Organisations/Memberships | TERMINE |
| SC1bis | findOrCreateOrganisation / helpers | TERMINE |
| SC2 | Endpoint autocomplete SIREN | TERMINE |
| SC3 | Composant StructureSearch frontend | TERMINE |
| SC4 | Refactor backend services + rôles français | TERMINE |
| SC4bis | Claim hébergeur + Kbis + validation admin | TERMINE |
| SC4ter | Flow signataire via Membership+email | TERMINE |
| SC5 | Refactor frontend dashboards + routes françaises | TERMINE |
| SC5bis | Routes d'entrée hébergeur + page claim catalogue | TERMINE |
| SC6 | Flow public catalogue + magic link | TERMINE |
| SC7 | Notification centres APIDAE non inscrits | SUSPENDU — post-visio |
| SC8 | Suppression colonnes etablissement* legacy | TERMINE |
| SC9 | SIGNE_DIRECTION dans StatutDevis | TERMINE |
| CRM | Client.organisationId + CA calculé + pipeline Kanban | TERMINE |
| HORS_SCOLAIRE | typeContexte déduit + champs ACM + TAM | TERMINE |
| A2 | PDF externe devis visible organisateur | TERMINE |
| DEVIS-LIBRES | Module devis particuliers (mariage etc.) | TERMINE |

### Prochains chantiers

#### SC-TRIAL — Essai 30 jours
Backend : registerHebergeur() → planAbonnement=COMPLET, actif 30j
Helper getStatutAbonnement() → { actif, joursRestants, plan }
findOpen() → masquer email si essai expiré
Frontend : bannière ocre (essai actif) / rouge (expiré)

#### SC-STRIPE — Paiement abonnement (après SC-TRIAL)
Comptes Stripe à créer + 4 produits (Essentiel/Complet × mois/an)
Backend : AbonnementModule + webhook
Frontend : redirect Stripe Checkout

#### SC-CRON — Relances trial robustes
Remplacer setTimeout par jobs persistés PostgreSQL (pg-boss)
Endpoint cron Scalingo toutes les heures
Déclencher à 3 hébergeurs inscrits en prod

#### DEVIS-LIBRES mode édition
Formulaire /nouveau?edit=id → charger le devis existant et pré-remplir tout

#### Type 3 — Séjour gré-à-gré scolaire sans enseignant LIAVO
Champ gereeParHebergeur: Boolean sur Sejour
Route POST /sejours/hebergeur
Espace collaboratif sans côté organisateur + import/export participants Excel
→ Reporté après validation commerciale

#### Chantiers suspendus
- SC7 : notifications APIDAE (prompt CC prêt)
- Refactoring DashboardShell
- Intégration APIDAE LMDJ (1 ligne dès réception credentials Anaïtis Mangeon)
- Backfill Client.organisationId pour 270 clients Sauvageon
- Résilier Railway + Cloudflare R2 (URGENT — 1 semaine de stabilité confirmée)
- Chorus Pro production (habilitation AIFE)
- JWT httpOnly cookie migration

---

## LEÇONS RETENUES

- SQL Scalingo : noms de tables snake_case
- Arrays Prisma : toujours { set: [...] }
- Routes NestJS : statiques AVANT paramétriques (crucial pour /signer/:token avant /:id)
- Prompts CC longs : découper en parties numérotées, envoyer séquentiellement
- StorageService.upload() → accepte Multer.File. uploadBuffer() ajouté pour Buffer
- LibreOffice sur Scalingo : buildpack Soulou dans backend/.buildpacks (PROJECT_DIR=backend)
- PROJECT_DIR Scalingo : backend=backend, frontend=frontend — .buildpacks dans backend/ seulement
- DevisLibre.statut est un String (pas enum Prisma) → BROUILLON/ENVOYE/ACCEPTE/REFUSE/PAYE
- CRM Client.statut : String libre, pas l'enum StatutRelation
- typeContexte : déduire depuis typeStructure, jamais hardcoder
- Railway : OBSOLÈTE depuis 29/04 — ignorer les emails de crash
- str_replace non fiable sur Windows via MCP — utiliser write_file
