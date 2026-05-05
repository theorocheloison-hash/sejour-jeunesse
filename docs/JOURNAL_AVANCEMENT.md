# LIAVO — Journal d'avancement

> Fichier de référence pour les sessions de développement.
> `ARCHITECTURE_ORGANISATIONS.md` reste le doc de référence architectural.
> Ce fichier documente uniquement **ce qui a été fait, décidé et déployé** session par session.

---

## État global des sous-chantiers (05/05/2026)

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ PROD | Scalingo Paris (liavo-backend + liavo-frontend), OVH Object Storage Gravelines, Brevo FR, DNS OVH |
| SC1 | ✅ PROD | Schéma Prisma Organisations+Memberships+RelationCommerciale, backfill BDD, doublons nettoyés |
| SC1bis | ✅ PROD | findOrCreateOrganisation(), helpers centralisés |
| SC2 | ✅ PROD | GET /organisations/search |
| SC3 | ✅ PROD | StructureSearch.tsx — debounce, clavier, badge source, allowFreeText |
| SC4 | ✅ PROD | Rôles français (ORGANISATEUR/SIGNATAIRE/HEBERGEUR/AUTORITE), routes renommées |
| SC4bis | ✅ PROD | claim.service.ts, upload Kbis, page admin /dashboard/admin/claims |
| SC4ter | ✅ PROD | InvitationDirecteur enrichie (organisationId+typeContexte), registerSignataire() Membership auto, getAllSejoursSignataire() via Membership+email |
| SC5 | ✅ PROD | getProfile() enrichi, dashboards lisent user.organisation, routes françaises 301 |
| SC5bis | ✅ PROD | 6 routes hébergeur corrigées, /centre/[id]/claim, page admin invitations, corrections registerHebergeur()+matching APIDAE+deduplication searchPublic() |
| SC6 | ✅ PROD | /catalogue, /catalogue/[id], /appel-offres, magic link, compte dormant, /auth/callback |
| SC7 | ⏸ SUSPENDU | Widget signalement + notification auto — attente validation commerciale LMDJ/IDDJ |
| SC8 | ✅ PROD | Suppression 7 colonnes etablissement* sur User, migration SQL appliquée, JWT_SECRET changé |
| SC9 | ✅ PROD | StatutDevis étendu (FACTURE_ACOMPTE/SOLDE), backfill SQL appliqué manuellement, migration 20260505_sc9 créée |
| Landing | ✅ PROD | page.tsx + landing.css déployés via CC (commit d79abc4) |
| Catalogue public | ✅ PROD | /catalogue refactorisé — même UX que dashboard organisateur, 700+ résultats, filtres multi-champs, vraies photos |

**Prochains chantiers (ordre) :** CRM legacy (Rappel+ContactClient → RelationCommerciale) → HORS_SCOLAIRE/DECLARE_TAM → SC7 post-validation commerciale

---

## Sessions

### Session 05/05/2026 — Landing page refactor

**Contexte :** Remplacement de l'ancienne landing (`frontend/app/page.tsx`) par le nouveau design (HTML statique Claude Design). Ajout d'une section catalogue dans la landing (cartes statiques + lien vers /catalogue).

**Décisions architecturales :**
- CSS isolation : `landing.css` global, toutes règles wrappées sous `.liavo-landing {}`. Variables scopées sous `.liavo-landing` (pas `:root`) — protège contre le dark mode global.
- Pas de `@font-face` dans `landing.css` : Inter déjà chargé dans `globals.css`.
- `PricingTable` réutilisé tel quel. `ActeursSchema` supprimé. `<a>` sans href → `<span role="button">`.
- Cartes catalogue statiques hardcodées (pas d'appel API depuis composant client).
- Formulaire de contact `/api/contact` supprimé — à recréer si besoin.

**Fichiers déployés (commit d79abc4) :**
- `frontend/app/landing.css` — CSS complet ~350 lignes sous `.liavo-landing`
- `frontend/app/page.tsx` — composant `'use client'`, 4 useEffect, section catalogue intégrée

**Nav :** lien «Catalogue» ajouté entre «Colonies» et «Tarifs» + dans footer. 4e CTA hero supprimé (Option B validée) → lien texte ocre dans hero-note.

**Statut :** déployé en production.

---

### Session 05/05/2026 — SC9 StatutDevis

**Contexte :** `SELECTIONNE` couvrait 5 états différents. Fix à la source : extension enum + backfill + badges frontend.

**Fichiers modifiés (commit 9e8def8) :**
- `backend/prisma/schema.prisma` : ajout `FACTURE_ACOMPTE` + `FACTURE_SOLDE` dans enum `StatutDevis`
- `backend/src/devis/devis.service.ts` : `facturerAcompte()` + `facturerSolde()` écrivent `statut` en plus de `typeDocument`
- `frontend/src/lib/devis.ts` : type `StatutDevis` étendu
- `frontend/app/dashboard/hebergeur/devis/page.tsx` : `STATUT_BADGE` enrichi (indigo/teal), `matchesOnglet` double critère statut+typeDocument, `actionsUrgentes` aligné sur `SIGNE_DIRECTION`
- Cascades CC : `dashboard/organisateur/demandes/page.tsx` + `sejours/[id]/offres/page.tsx` — `STATUT_BADGE` enrichi

**Migration :** pas générée automatiquement par CC. Appliquée manuellement via psql Scalingo :
```sql
ALTER TYPE "StatutDevis" ADD VALUE IF NOT EXISTS 'FACTURE_ACOMPTE';
ALTER TYPE "StatutDevis" ADD VALUE IF NOT EXISTS 'FACTURE_SOLDE';
UPDATE devis SET statut = 'FACTURE_ACOMPTE' WHERE type_document = 'FACTURE_ACOMPTE' AND statut != 'FACTURE_ACOMPTE'; -- UPDATE 1
UPDATE devis SET statut = 'FACTURE_SOLDE'   WHERE type_document = 'FACTURE_SOLDE'   AND statut != 'FACTURE_SOLDE';   -- UPDATE 0
```
Fichier migration `20260505_sc9_statut_devis_facture/migration.sql` créé et pushé en suivi.

**Statut :** déployé en production.

---

### Session 05/05/2026 — Catalogue public refactor

**Problème :** `/catalogue` public était une régression — barre de recherche unique, état vide par défaut, pas de photos, vs `dashboard/organisateur/hebergements` qui affiche 700+ résultats avec filtres et photos.

**Solution :** exposer `GET /hebergements` publiquement + réécrire `/catalogue` à l'identique du dashboard.

**Fichiers modifiés :**
- `backend/src/hebergements/hebergement.controller.ts` : `@UseGuards/@Roles` retirés au niveau classe, conservés uniquement sur `POST :id/interet`. Routes `GET /hebergements` et `GET /hebergements/:id` désormais publiques.
- `frontend/src/lib/hebergement.ts` : ajout `searchHebergementsPublic()` + `getHebergementPublic()` (fetch direct sans token)
- `frontend/app/catalogue/page.tsx` : remplacement intégral — filtres multi-champs (nom+ville+dépt+région), autocomplete geo.api.gouv.fr, chargement par défaut au mount, compteur total/affiché, vraies photos
- `frontend/app/catalogue/[id]/page.tsx` : migré vers type `Hebergement` + `getHebergementPublic()`, champs adaptés (imageUrl→image, capacite→capaciteEleves+capaciteAdultes, thematiquesCentre→thematiques, etc.)
- `frontend/app/page.tsx` : 4e CTA hero supprimé, lien texte ocre «Parcourir le catalogue →» dans hero-note

**Source de données :** `HebergementService.search()` = API EN officielle (data.education.gouv.fr) + centres LIAVO ACTIVE Prisma, fusion dédupliquée. 700+ résultats avec photos.

**Non modifié :** `dashboard/organisateur/hebergements` inchangé. `backend/src/public/` inchangé.

**Statut :** déployé en production.

---

### Session 28/04/2026 — Démo LMDJ+IDDJ + features livrées

**Démo faite :** visio LMDJ (Anaïtis Mangeon + Isabelle Louat + Marie Charvolin) + IDDJ (Robin Miglioli). LMDJ intéressée, visio de suivi à caler. IDDJ attentiste (CA à consulter).

**Pivot positionnement validé :**
- LIAVO = couche post-mise-en-relation, pas remplacement de la centrale LMDJ
- L'hébergeur invite l'enseignant (pas d'appel d'offres côté enseignant)
- Isabelle/Marie (LMDJ) gardent leur rôle de mise en relation

**Features livrées pour la démo :**
- Planning PDF A4 paysage (export)
- Import CSV élèves Pronote/ONDE (sans email auto + envoi invitations sélectif)
- Journal séjour parents (posts+photos+planning regroupé+réactions placeholder)
- Lien journal depuis page autorisation parentale

**Séjour démo en prod :** "4ème Morillon APPN", statut CONVENTION, 48 élèves, 5 accompagnateurs

---

### Session 29/04/2026 — Migration infra France + ARCHITECTURE_ORGANISATIONS v3

**Migration infra complète (SC0) :**
- Backend + BDD : Scalingo Paris (liavo-backend, PostgreSQL 17.9)
- Frontend : Scalingo Paris (liavo-frontend)
- Stockage : OVH Object Storage Gravelines (liavo-uploads, S3, endpoint s3.gra.io.cloud.ovh.net)
- Emails : Brevo FR — DNS : OVH
- URLs prod : liavo.fr (front), api.liavo.fr (back)
- Railway + Cloudflare R2 : à résilier après 1 semaine de stabilité

**Scalingo CLI :** `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**Commande SQL prod :** `scalingo --app liavo-backend --region osc-fr1 pgsql-console`

---

### Session 19/04/2026 — Landing prod + séjour démo

- Landing livrée en prod, favicon LIAVO ajouté
- Séjour démo "4ème Morillon APPN" créé en prod : statut CONVENTION, 48 élèves, 5 accompagnateurs
- Base nettoyée, CRM 270 clients Sauvageon conservés
- Admin prod migré sur contact@liavo.fr

---

### Session 08/04/2026 — Nettoyage prod + dashboard réseau

**Dashboard réseau livré (rôle RESEAU) :**
- Route `/dashboard/reseau` avec KPIs, filtres période, invitation centres, slide-over fiche, onboarding score 0-4, export CSV
- Compte démo : demo-lmdj@liavo.fr / LMDJ2026!
- Import IDDJ : 54 centres APIDAE en prod (apiKey=mr8RQgOh, projetId=3217, selectionId=67523)

---

## Infra de référence (état 05/05/2026)

| Composant | Service | Détail |
|---|---|---|
| Backend | Scalingo Paris | liavo-backend, Node 20, NestJS |
| BDD | Scalingo PostgreSQL 17.9 | liavo-backend-db |
| Frontend | Scalingo Paris | liavo-frontend, Next.js 15, standalone |
| Stockage | OVH Object Storage Gravelines | liavo-uploads, S3 compatible |
| Emails | Brevo FR | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |
| Repo | GitHub | theorocheloison-hash/sejour-jeunesse |
| CI/CD | Push main → Scalingo auto | Procfile: prisma migrate deploy + start:prod |

**URLs prod :** https://liavo.fr | https://api.liavo.fr
**Admin prod :** contact@liavo.fr
**Compte Sauvageon :** resa@lesauvageon.com ← seule adresse valide (jamais contact@chalet-sauvageon.fr)
**Compte démo réseau :** demo-lmdj@liavo.fr / LMDJ2026!

---

## Points ouverts (05/05/2026)

| Point | Priorité | Détail |
|---|---|---|
| CRM legacy | 🔴 PROCHAIN | Rappel+ContactClient → RelationCommerciale (section 3.7 doc archi). Estimé 1 jour. |
| HORS_SCOLAIRE/DECLARE_TAM | 🟠 Après CRM | typeContexte sur Sejour, flow colo complet |
| Visio LMDJ de suivi | 🟡 À caler | Anaïtis Mangeon — prérequis : CRM legacy + HORS_SCOLAIRE + DECLARE_TAM |
| Railway + R2 résiliation | 🟡 À faire | Après 1 semaine stabilité Scalingo (deadline ~06/05) |
| SC7 widget signalement | ⏸ SUSPENDU | Attente validation commerciale LMDJ/IDDJ |
| JWT httpOnly cookie | ⏸ DIFFÉRÉ | Post-validation commerciale, risque régression auth |
| DashboardShell unifié | ⏸ DIFFÉRÉ | 4-6 jours, risque moyen — ne pas faire avant stabilité commerciale |
| Mentions légales hébergeur | 🔵 Futur | "Railway Corp." encore mentionné → mettre à jour Scalingo + OVH |
| Chorus Pro AIFE inscription | 🔵 Futur | Vérifier getChorusXml() fonctionnel, inscription SIRET 102 994 910 00010 |
| RC Pro insurance | 🔵 Futur | ~500-700€/an, différé post-démo |
| GitHub → Gitea VPS OVH | 🔵 Long terme | Quand recrutement 2e dev ou appel d'offres public |

---

## Règles de développement (rappel permanent)

1. **Fix at source, never patch** — règle absolue
2. **Lire les fichiers avant toute proposition** — via filesystem MCP, jamais depuis hypothèses
3. **Anticiper les bugs cascade** avant d'écrire le moindre code
4. **Ne jamais push sans confirmation explicite** de Théo
5. **Pattern** : lire → proposer → valider → CC exécute → vérifier build → Théo confirme → push
6. **PostgreSQL Scalingo** : noms de tables snake_case, modèles Prisma PascalCase entre guillemets dans SQL
7. **`str_replace` non fiable sur chemins Windows** → utiliser `write_file`
8. **`search_files` filesystem** = matching sur noms de fichiers uniquement (jamais sur le contenu)
9. **Migrations Prisma** : vérifier que CC a bien créé le fichier migration dans `backend/prisma/migrations/` — sinon `ALTER TYPE` manuel sur Scalingo + créer le fichier à la main
