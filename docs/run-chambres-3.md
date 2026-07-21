# RUN CHAMBRES 3/8 — Référentiel chambres/lits (backend) — Plan (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — **Statut : VALIDÉ PAR THÉO le 21/07/2026** (les 5 points du §6 +
> message explicite sur le plafond places + etage/ordre confirmés au PATCH). **LIVRÉ** — cf. §7.
> Sources lues : `ARCHITECTURE_MODULE_CHAMBRES.md` (D3/D4/D5, §2), `backend/src/chambres/`
> (module existant — `capacite.*` intouchés), `clients.controller.ts` + `dto/` (pattern
> calqué), `plan.decorator.ts` + `plan.guard.ts` (soft : GET passent, mutations gated),
> `schema.prisma` (Chambre/Lit livrés au run 1).

## 1. Contrat des endpoints

Nouveau couple `referentiel.controller.ts` + `referentiel.service.ts` dans
`backend/src/chambres/` (le module existant s'enrichit ; `capacite.*` intouchés).
Guards **au niveau classe**, calqués sur `ClientsController` :
`@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)` +
`@Roles(HEBERGEUR)` + `@RequirePermission('parametres')` (D5) + `@RequirePlan('COMPLET')`
(décision Théo 21/07 — soft : la consultation passe, les mutations exigent COMPLET).
`@CentreId()` explicite partout, `getCentreForUser` dans chaque méthode service.

Même `@Controller('chambres')` que le contrôleur capacité (chemins disjoints). ⚠️ Routes
`lits/…` déclarées AVANT les routes `:id` (leçon « routes statiques en premier »).

| Route | Corps | Effet |
|---|---|---|
| `GET /chambres` | `?inactives=1` optionnel | Liste des chambres du centre (actives seules par défaut), chacune avec `lits[]` triés (`ordre`) et **`capacite` dérivée = Σ `lits.places`** (calculée au mapping, JAMAIS stockée — D3) |
| `POST /chambres` | `{ nom, etage?, ordre?, notes?, lits?: CreateLitDto[] }` | Création, lits inline en une transaction (`create` imbriqué Prisma) |
| `PATCH /chambres/:id` | `{ nom?, etage?, ordre?, notes?, actif? }` | Update (dont réactivation/désactivation manuelle via `actif`) |
| `DELETE /chambres/:id` | — | Sémantique §2 option A (ci-dessous) |
| `POST /chambres/:id/dupliquer` | `{ nombre? }` | Duplication §3 option A |
| `POST /chambres/:id/lits` | `CreateLitDto[]` (1–30) | **Saisie rapide** : batch append (§3) |
| `PATCH /chambres/lits/:litId` | `{ type?, places?, libelle?, ordre? }` | Update lit |
| `DELETE /chambres/lits/:litId` | — | Hard delete (un lit n'a d'historique que via `AffectationChambre.litId` → `SetNull` : la suppression ne détruit aucune affectation) |

**Réponse chambre** : `{ id, nom, etage, ordre, notes, actif, capacite, lits: [{ id, type,
places, libelle, ordre }] }`.

**Validation (DTO class-validator, pattern `create-client.dto.ts`)** :
- `nom` requis, 1–100 ; `etage` ≤ 50 ; `notes` string ; `ordre` entier.
- `type` lit `@IsIn(['SIMPLE','SUPERPOSE','TIROIR','DOUBLE','BB','APPOINT'])`.
- `places` entier `@Min(1)` `@Max(6)` (défensif anti-typo : un « 45 » saisi dans places
  fausserait toute la capacité du centre ; aucun lit physique ne dépasse 6) — **optionnel,
  défaut par type côté serveur : SUPERPOSE/DOUBLE → 2, autres → 1**.
- Batch lits `@ArrayMinSize(1)` `@ArrayMaxSize(30)` ; `nombre` duplication 1–20.

**Cloisonnement** : chambre résolue par `findFirst({ id, centreId: centre.id })` → **404**
si autre centre (ne révèle pas l'existence, aligné `getCentreForUser` PENDING) ; lit résolu
via sa chambre (`include chambre.centreId`), même règle. Testé multi-centre.

## 2. Sémantique du DELETE chambre — options

**A — un seul geste, le service choisit (le §2.3 du doc archi)** : `DELETE /chambres/:id` →
`count(occupations)` ; **0 → hard delete** (les lits suivent par cascade), **≥ 1 →
`actif = false`**. Réponse explicite `{ deleted: true }` ou `{ deactivated: true }` pour que
le front affiche le bon message.
- ✅ Un seul bouton « Supprimer » côté UI, jamais d'erreur : la chambre créée par erreur
  pendant la saisie initiale (cas Tereva, 30 chambres à la chaîne) disparaît vraiment ; la
  chambre historisée est préservée (le rooming passé est une donnée).
- ✅ Le FK `onDelete: Restrict` reste le filet en base si un hard delete passait à tort.
- ❌ Sémantique « ça dépend » à documenter côté front (d'où la réponse explicite).

**B — deux gestes explicites** : `DELETE` → 409 si occupations (« désactivez-la ») ;
la désactivation passe par `PATCH { actif: false }`.
- ✅ Aucune magie. ❌ L'hébergeur doit comprendre la nuance occupation/pas occupation, l'UI
  doit gérer le 409 — friction pour le cas majoritaire (typo de saisie).

**C — soft-delete systématique** (`actif = false` toujours).
- ✅ Trivial. ❌ Le référentiel se pollue de chambres fantômes dès la première séance de
  saisie ; contredit le §2.3 qui réserve la désactivation au cas « historique ».

### ✅ Recommandation : **A** (+ `PATCH actif` déjà présent pour dés/réactiver à la main).

## 3. Saisie rapide + duplication — options

**Format du batch lits** :
- **A — tableau `[{ type, places?, libelle?, ordre? }]`** : « 3 superposés + 1 simple » = le
  front génère 4 items (les compteurs sont une UI, pas un contrat). Garde libellé/ordre par
  lit, défauts de places par type côté serveur.
- **B — compteurs `{ SUPERPOSE: 3, SIMPLE: 1 }`** : plus compact, mais perd libellé/ordre
  individuels, fige les places par type dans le contrat, et le front devra de toute façon
  éditer lit par lit ensuite (deux formats à maintenir).

### ✅ Recommandation : **A** — un seul format, l'UI compteur du sous-chantier 5 le génère.

**Duplication** :
- **A — `POST /chambres/:id/dupliquer { nombre? = 1 }`** : copie chambre + **tous ses lits**
  (c'est le but D3 — sans les lits, dupliquer = créer une chambre vide, geste qui existe
  déjà), même étage/notes, nom suffixé « (copie) », « (copie 2) »… en cas de collision dans
  le centre. `nombre` 1–20 pour matérialiser un étage entier en un geste.
- **B — incrément « intelligent » du nom** (Chambre 12 → Chambre 13) : séduisant, fragile
  (noms non numériques, collisions), magie non demandée — l'hébergeur renomme en un clic.
- **C — flag `avecLits`** : cas « sans lits » = création simple existante → flag inutile.

### ✅ Recommandation : **A** (suffixe bête, lits toujours copiés, `nombre` optionnel).

## 4. Tri/groupage étage — options

- **A — API plate triée, groupage côté front** : `orderBy: [{ etage: { sort: 'asc',
  nulls: 'first' } }, { ordre: 'asc' }, { nom: 'asc' }]`. D4 : l'étage est une étiquette —
  le groupage est une préoccupation d'affichage ; la grille du sous-chantier 4 et les
  sélecteurs voudront du plat. Sans-étage en tête (un centre qui n'utilise pas les étages
  garde son ordre naturel).
- **B — API groupée `[{ etage, chambres[] }]`** : épargne 5 lignes de front, fige la
  présentation dans le contrat, oblige un 2ᵉ format pour les autres usages.

### ✅ Recommandation : **A**.

## 5. Fichiers et commits (Phase 2, après validation)

| Fichier | Nature |
|---|---|
| `backend/src/chambres/dto/{create-chambre,create-lit,update-chambre,update-lit,dupliquer-chambre}.dto.ts` | nouveaux |
| `backend/src/chambres/referentiel.service.ts` + `referentiel.controller.ts` | nouveaux |
| `backend/src/chambres/chambres.module.ts` | +controller/+provider (seule retouche d'un fichier existant) |
| `backend/src/chambres/referentiel.service.spec.ts` | nouveau |

- **COMMIT 1** — DTOs + service + controller + module. Gates : `tsc --noEmit` 0 · build ·
  `npm test` (baseline 240 verts intacts).
- **COMMIT 2** — Tests (calqués `capacite.service.spec.ts`) : CRUD nominal ; capacité
  dérivée (superposé 2 + simple 1 → 3, chambre sans lits → 0) ; création avec lits inline ;
  batch append ; défauts de places par type ; duplication (lits copiés, suffixe collision,
  ×N) ; DELETE hard (0 occupation) vs désactivation (≥ 1) ; cloisonnement chambre ET lit
  d'un autre centre → 404 ; validation DTO types de lits (via `validate()` class-validator).

Interdits tenus : `capacite.*.ts` intouchés, pas d'occupations (sous-chantier 4), zéro
frontend, pas de `migrate dev` (aucune migration nécessaire — modèles livrés au run 1),
pas de push sans feu vert.

## 7. Livraison (Phase 2, 21/07/2026) — 2 commits, gates verts à chacun

| Commit | Contenu | Gates |
|---|---|---|
| `ca58720` | 6 DTOs + `referentiel.service.ts` + `referentiel.controller.ts` + module | tsc 0 · build OK · 240 verts |
| `934110e` | `referentiel.service.spec.ts` — 13 tests | tsc 0 · build OK · **253 verts** (240 + 13) + 2 todo |

**Écart vs §1 (seul)** : le batch `POST /chambres/:id/lits` prend `{ lits: CreateLitDto[] }`
et non un tableau top-level — le ValidationPipe global ne valide pas un tableau racine et le
projet n'utilise pas `ParseArrayPipe` ; enveloppe = le pattern nested des DTO devis. Les 2
consignes de validation sont intégrées : message d'erreur du plafond places (« un lit ne peut
excéder 6 places — pour un dortoir, créez plusieurs lits », vérifié au mot près par un test)
et `etage`/`ordre` modifiables au PATCH (verrouillé par un test dédié — l'ordre physique dans
l'étage est une donnée de premier rang, le plan se rendra spatialement).
`capacite.*.ts` intouchés, pas de push (feu vert Théo).

## 6. Points soumis à validation (✅ tous validés par Théo le 21/07)

1. §2 option A (DELETE auto hard/désactivation, réponse explicite).
2. §3 : batch tableau + duplication suffixe « (copie) » avec `nombre` 1–20, lits toujours copiés.
3. §4 option A (API plate, groupage front, sans-étage en tête).
4. `places` plafonné à 6 (défensif anti-typo) + défauts par type (SUPERPOSE/DOUBLE → 2, sinon 1).
5. `DELETE lit` = hard direct (les affectations pointant le lit passent à `litId = null` par
   FK `SetNull`, l'affectation chambre survit).
