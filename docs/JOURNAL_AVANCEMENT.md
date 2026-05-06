# LIAVO — Journal d'avancement

> Fichier de référence pour les sessions de développement.
> `ARCHITECTURE_ORGANISATIONS.md` reste le doc de référence architectural.
> Ce fichier documente uniquement **ce qui a été fait, décidé et déployé** session par session.

---

## État global des sous-chantiers (06/05/2026)

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ PROD | Scalingo Paris (liavo-backend + liavo-frontend), OVH Object Storage Gravelines, Brevo FR, DNS OVH |
| SC1 | ✅ PROD | Schéma Prisma Organisations+Memberships+RelationCommerciale, backfill BDD, doublons nettoyés |
| SC1bis | ✅ PROD | findOrCreateOrganisation(), helpers centralisés |
| SC2 | ✅ PROD | GET /organisations/search |
| SC3 | ✅ PROD | StructureSearch.tsx — debounce, clavier, badge source, allowFreeText |
| SC4 | ✅ PROD | Rôles français (ORGANISATEUR/SIGNATAIRE/HEBERGEUR/AUTORITE), routes renommées |
| SC4bis | ✅ PROD | claim.service.ts, upload Kbis, page admin /dashboard/admin/claims |
| SC4ter | ✅ PROD | InvitationDirecteur enrichie, registerSignataire() Membership auto |
| SC5 | ✅ PROD | getProfile() enrichi, dashboards lisent user.organisation, routes françaises 301 |
| SC5bis | ✅ PROD | 6 routes hébergeur corrigées, /centre/[id]/claim, page admin invitations |
| SC6 | ✅ PROD | /catalogue, /catalogue/[id], /appel-offres, magic link, compte dormant |
| SC7 | ⏸ SUSPENDU | Widget signalement + notification auto — attente validation commerciale LMDJ/IDDJ |
| SC8 | ✅ PROD | Suppression colonnes etablissement* sur User, JWT_SECRET changé |
| SC9 | ✅ PROD | StatutDevis étendu (FACTURE_ACOMPTE/SOLDE), backfill SQL appliqué |
| CRM legacy | ✅ PROD | Pont RelationCommerciale sur Rappel+ContactClient, autoRattacher+addRappel+addContact propagent relationId |
| HORS_SCOLAIRE | ✅ PROD | typeContexte propagé à la création, formulaire bifurqué, bouton récapitulatif TAM sur SIGNE_DIRECTION |
| Landing | ✅ PROD | Refactor complet — nouveau design, restructuration hero, actors flow, catalogue enrichi, ps-cta, titre tarifs |
| Catalogue public | ✅ PROD | /catalogue — 700+ résultats, filtres multi-champs, vraies photos |
| Infra | ✅ PROD | Railway + Cloudflare R2 résiliés, DNS Cloudflare nettoyé (Railway → Scalingo), variables S3_* |
| Légal | ✅ PROD | Mentions légales Railway → Scalingo/OVH, RGPD ajouté, Morillon/Haute-Savoie, CGU catalogue national |

**Prochaine étape : caler la visio LMDJ de suivi avec Anaïtis Mangeon.**

---

## Sessions

### Session 06/05/2026 — HORS_SCOLAIRE flow + CRM legacy + infra + légal

**CRM legacy — pont RelationCommerciale :**
- `Rappel` et `ContactClient` : FK nullable `relationId` ajoutée
- `autoRattacherDepuisDevis()` : crée/récupère `RelationCommerciale` après upsert SejourClient (try/catch non bloquant)
- `addRappel()` et `addContact()` : propagent `relationId` si disponible
- `importerDepuisCSV()` : paramètre optionnel `organisationHebergeurId` préparé (non exposé UI pour l'instant)
- Migration `20260506_crm_legacy_pont_relation_commerciale` appliquée manuellement (ADD COLUMN IF NOT EXISTS, idempotente)

**HORS_SCOLAIRE/DECLARE_TAM :**
- `CreateSejourDto` backend : `typeContexte` ajouté (`@IsOptional @IsEnum TypeContexteSejour`)
- `sejour.service.ts create()` : `typeContexte: dto.typeContexte ?? SCOLAIRE`
- `CreateSejourDto` frontend : `typeContexte?: 'SCOLAIRE' | 'HORS_SCOLAIRE'`
- `nouveau-sejour/page.tsx` : `typeContexte` envoyé à la création selon `estHorsScolaireUser`
- Dashboard organisateur : bouton "Récapitulatif TAM" sur `SIGNE_DIRECTION` + `estHorsScolaire()`, génère .txt avec données du séjour
- **Décision architecturale :** `DECLARE_TAM` reste dans l'enum BDD mais n'est plus un statut atteignable via l'UI. L'organisateur télécharge le récapitulatif TAM directement depuis `SIGNE_DIRECTION` et effectue la déclaration manuellement sur tam.extranet.jeunesse-sports.gouv.fr. Le bouton "Déclarer au SDJES" a été supprimé (patch inutile).
- Dashboard signataire : déjà bifurqué (rectorat masqué pour HORS_SCOLAIRE, message informatif)

**Infra — résiliation Railway + Cloudflare R2 :**
- Projet Railway supprimé (sejour-jeunesse + Postgres + precious-comfort)
- Bucket Cloudflare R2 `liavo-uploads` vidé et supprimé
- DNS Cloudflare nettoyé : CNAME `liavo.fr` et `www` → `liavo-frontend.osc-fr1.scalingo.io`, entrées railway-verify supprimées
- Variables Scalingo renommées `R2_*` → `S3_*`, anciennes variables supprimées
- `storage.service.ts` mis à jour (logs renommés, références R2 → S3)
- Compte Cloudflare conservé (gère le DNS de liavo.fr)

**Pages légales :**
- `mentions-legales` : Railway → Scalingo SAS (Strasbourg), Cloudflare R2 → OVH Object Storage (Gravelines) + Brevo
- `confidentialite` : sous-traitants mis à jour, section 4 "Aucun transfert hors UE" réécrite, section 5 stockage OVH
- `cgu` : "catalogue de 649+ centres" → "catalogue national de centres"

**Landing :**
- Titre section pricing ajouté : "Tarifs hébergeurs"
- `.ps-cta` : textes mis à jour + fond `var(--surface)` pour meilleur contraste

---

### Session 05/05/2026 — Landing page refactor complet (Passe 1 + Passe 2)

**Passe 1 — Corrections ponctuelles :**
- Hero eyebrow supprimé, hero note supprimée, 3 boutons → 2, pills supprimées du hero
- Badges profils : "Solution payante" → "30 jours d'essai" / "Gratuit" → "Offert"
- Nav : "Réseaux" ajouté, ordre mis à jour
- "workflow" → "flux", "app" → "application", RGPD ajouté compliance
- Footer : Annecy → Morillon, Haute-Savoie

**Passe 2 — Restructuration :**
- Dashboard mockup déplacé hero → section hébergeurs
- Section #collaboratif déplacée après #colonies, tag "Différenciation" supprimé
- Pills acteurs remplacés par `.actors-flow` + SVG animé (stroke dashoffset)
- CATALOGUE_CARDS enrichi (region, description, cat-card-cta)
- Section #collaboratif passée en `.dark` (fix contraste actors-flow)
- `.hero-catalogue-cta` ajouté (bandeau ocre "Parcourir le catalogue")

---

### Session 28/04/2026 — Démo LMDJ+IDDJ

**Démo faite.** LMDJ intéressée (visio de suivi à caler). IDDJ attentiste.

**Pivot positionnement validé :** LIAVO = couche post-mise-en-relation. L'hébergeur invite l'enseignant. Isabelle/Marie (LMDJ) gardent leur rôle de mise en relation.

**Features livrées :** planning PDF A4, import CSV élèves Pronote/ONDE, journal séjour parents, lien journal depuis autorisation.

---

### Session 29/04/2026 — Migration infra France

- Backend + BDD : Scalingo Paris
- Frontend : Scalingo Paris
- Stockage : OVH Object Storage Gravelines
- Emails : Brevo FR — DNS : OVH
- ARCHITECTURE_ORGANISATIONS.md v3 validé

---

## Infra de référence (état 06/05/2026)

| Composant | Service | Détail |
|---|---|---|
| Backend | Scalingo Paris | liavo-backend, Node 20, NestJS |
| BDD | Scalingo PostgreSQL 17.9 | liavo-backend-db |
| Frontend | Scalingo Paris | liavo-frontend, Next.js 15, standalone |
| Stockage | OVH Object Storage Gravelines | liavo-uploads, S3 compatible |
| Emails | Brevo FR | contact@liavo.fr |
| DNS | Cloudflare | CNAME → liavo-frontend.osc-fr1.scalingo.io |
| Registrar | OVH | dns14/ns14.ovh.net |
| Repo | GitHub | theorocheloison-hash/sejour-jeunesse |
| CI/CD | Push main → Scalingo auto | Procfile: prisma migrate deploy + start:prod |

**URLs prod :** https://liavo.fr | https://api.liavo.fr
**Admin prod :** contact@liavo.fr
**Compte Sauvageon :** resa@lesauvageon.com
**Compte démo réseau :** demo-lmdj@liavo.fr / LMDJ2026!

---

## Points ouverts (06/05/2026)

| Point | Priorité | Détail |
|---|---|---|
| Visio LMDJ de suivi | 🔴 URGENT | Caler avec Anaïtis Mangeon — produit prêt |
| Onboarder enseignants Sauvageon | 🔴 ACTION THÉO | Inviter 1-2 enseignants via resa@lesauvageon.com |
| Démarchage hébergeurs | 🟠 En cours | Accompagnement manuel pour les premiers |
| SC7 widget signalement | ⏸ SUSPENDU | Attente validation commerciale LMDJ/IDDJ |
| JWT httpOnly cookie | ⏸ DIFFÉRÉ | Post-validation commerciale |
| DashboardShell unifié | ⏸ DIFFÉRÉ | 4-6 jours, risque moyen |
| Mentions légales dashboard | 🔵 Futur | "Railway Corp." peut encore apparaître dans d'autres pages légales — vérifier |
| Landing hover features hébergeur | 🔵 Post-commercial | Assets (screenshots dashboard) requis |
| Chorus Pro AIFE inscription | 🔵 Futur | Vérifier getChorusXml() fonctionnel, inscription SIRET |
| DECLARE_TAM enum BDD | 🔵 Info | Statut conservé en BDD mais non atteignable via UI — à nettoyer en SC10 si besoin |

---

## Roadmap fonctionnalités nouvelles (voir ROADMAP_NOUVELLES_FEATURES.md)

- B.1 — Pop-up aide IA contextuelle
- B.2 — Menu intelligent IA (allergies → menus)
- A.0 — Phase commercialisation (onboarding guidé, CRM Théo, deck LMDJ, LinkedIn, /a-propos)
- C.0 — Flow colonie complet (BAFA/BAFD, ratio, TAM Cerfa)
- A.4 — Intégration APIDAE sans partenariat réseau (à confirmer avec APIDAE)
- A.3bis — Récupération emails centres EN pour notification géographique

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
10. **Scalingo CLI** : `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
11. **Commande SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
