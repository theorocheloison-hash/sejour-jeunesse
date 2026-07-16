# §4.25 — Recensement Sets de StatutSejour (avant dédup)

> Date : 16/07/2026 — Run Fable 5, suite directe de §4.13 (statuts DEVIS, livré : `src/devis/devis-statuts.constants.ts`, non touché ici).
> Périmètre : `backend/src/` uniquement, dédup pure, zéro changement de composition/comportement.
> Gates par composition : tsc + build + `npm test` (187 tests + 3 todo) verts.

## 0. Existant vérifié (Phase 1a)

- Aucun fichier de constantes statuts séjour n'existe (`src/sejours/` = controller/service/module/dto) → création de `src/sejours/sejour-statuts.constants.ts`, parallèle à `devis-statuts.constants.ts`.
- Les pointeurs du recensement §4.13 ont été re-vérifiés : lignes décalées depuis (pilotage:8→9, centre:696→697, collaboration 91-92→92-93), compositions confirmées.

## 1. Occurrences recensées (tout `backend/src/`, enum StatutSejour)

### 1.1 Composition S-A — « séjours confirmés » : `CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM` (2 littéraux)

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `pilotage/pilotage.service.ts:9` | `STATUTS_CONFIRMES: StatutSejour[]` (nommé, 3 usages : 125, 180, 212) | remplissage/CA pilotage |
| 2 | `centres/centre.service.ts:697` | `in: ['CONVENTION', 'SOUMIS_RECTORAT', 'SIGNE_DIRECTION', 'DECLARE_TAM']` | planning dashboard global (séjours confirmés) |

→ Canonique : **`STATUTS_SEJOUR_CONFIRMES`**.

### 1.2 Composition S-B — « séjours collaboratifs accessibles » : `CONVENTION, SIGNE_DIRECTION` (3 littéraux)

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `collaboration/collaboration.service.ts:92` | `const STATUTS_COLLABORATIFS = [...]` | verifyAccess : statuts accessibles (mode collaboratif) |
| 2 | `collaboration/collaboration.service.ts:480` | `in: [...]` | liste des séjours collaboratifs d'un user |
| 3 | `collaboration/collaboration.service.ts:558` | `in: [...]` | idem (variante hébergeur) |

→ Canonique : **`STATUTS_SEJOUR_COLLABORATIFS`**.

### 1.3 Composition S-C — « accessibles en gestion directe » : `OPTION, CONVENTION, SIGNE_DIRECTION` (2 occurrences)

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `collaboration/collaboration.service.ts:93` | `const STATUTS_DIRECT = ['OPTION', ...STATUTS_COLLABORATIFS]` (dérivée par spread) | verifyAccess : hébergeur en gestion DIRECT |
| 2 | `collaboration/collaboration.service.ts:506` | `in: ['OPTION', 'CONVENTION', 'SIGNE_DIRECTION']` | séjours DIRECT d'un hébergeur |

→ Canonique : **`STATUTS_SEJOUR_DIRECT`** — définie par le MÊME spread (`[OPTION, ...STATUTS_SEJOUR_COLLABORATIFS]`) pour préserver la dérivation existante.

## 2. Exceptions NON fusionnées

| Fichier:ligne | Forme | Raison |
|---|---|---|
| `devis/devis.service.ts:2554` | `in: [SUBMITTED, CONVENTION, SIGNE_DIRECTION]` | Composition unique (statuts « pilotés par le devis » à rétrograder vers OPTION) — 1 seule occurrence. |
| `centres/centre.service.ts:655` | `notIn: ['DRAFT']` | Singleton, unique. |
| Comparaisons `===` / `!==` : `sejour.service.ts:460, 784, 836, 912, 926`, etc. | conditions simples | Pas des littéraux de Set. |
| Assignations `data: { statut: X }` (devis.service 688/801/832/1030/2208/2435/2556, sejour.service 91/477/791/1090, invitation-collaboration 199/264, public 187, admin 149…) | écritures d'un statut | Pas des Sets. |
| Sets de **StatutDevis** | — | Déjà traités en §4.13 (`devis-statuts.constants.ts`), interdits ici. |

## 3. Plan de remplacement (Phase 3, un commit par composition)

1. `refactor(4.25): centralise STATUTS_SEJOUR_CONFIRMES` — pilotage (const locale + 3 usages) + centre:697.
2. `refactor(4.25): centralise STATUTS_SEJOUR_COLLABORATIFS` — collaboration 92 (const locale), 480, 558.
3. `refactor(4.25): centralise STATUTS_SEJOUR_DIRECT` — collaboration 93 (const dérivée), 506.

Gate avant CHAQUE commit : `npx tsc --noEmit` 0 erreur · `npm run build` succès · `npm test` 100 % verts.

## 4. Rapport final (Phase 4 — 16/07/2026)

### 4.1 Sites dédupliqués par composition

| Constante | Littéraux remplacés | Delta commit (ins/del) |
|---|---|---|
| `STATUTS_SEJOUR_CONFIRMES` | 2 (pilotage const locale + centre:697) | 3 fichiers, +41 / −9 (inclut la création du fichier de constantes) |
| `STATUTS_SEJOUR_COLLABORATIFS` | 3 (collaboration : const locale + 2 `in:`) | 1 fichier, +5 / −5 |
| `STATUTS_SEJOUR_DIRECT` | 2 (collaboration : dérivée locale + 1 `in:`) | 1 fichier, +3 / −4 |

### 4.2 Preuve de composition (aucune n'a changé)

| Constante | Composition | Usages après dédup |
|---|---|---|
| `STATUTS_SEJOUR_CONFIRMES` | `CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM` | pilotage:121, 176, 208 · centre:698 |
| `STATUTS_SEJOUR_COLLABORATIFS` | `CONVENTION, SIGNE_DIRECTION` | collaboration:95, 479, 557 |
| `STATUTS_SEJOUR_DIRECT` | `OPTION, CONVENTION, SIGNE_DIRECTION` (spread `[OPTION, ...COLLABORATIFS]` conservé de l'origine) | collaboration:94, 505 |

### 4.3 Exceptions non fusionnées

Voir §2 : `devis.service.ts:2554` (composition unique SUBMITTED+CONVENTION+SIGNE_DIRECTION), `centre.service.ts:655` (`notIn: ['DRAFT']` singleton), comparaisons `===`/`!==`, assignations de statut. Sets de StatutDevis non touchés (§4.13).

### 4.4 Gates par composition (avant chaque commit)

| Composition | `npx tsc --noEmit` | `npm run build` | `npm test` |
|---|---|---|---|
| CONFIRMES | ✅ 0 erreur | ✅ | ✅ 187 passés + 3 todo |
| COLLABORATIFS | ✅ 0 erreur | ✅ | ✅ 187 passés + 3 todo |
| DIRECT | ✅ 0 erreur | ✅ | ✅ 187 passés + 3 todo |

Aucun `*.spec.ts` touché. Nettoyage annexe : import `StatutSejour` devenu inutilisé retiré de pilotage.service.ts.

### 4.5 Commits créés (locaux, NON poussés — revue Théo avant push)

1. `d85ba91` — docs(4.25): recensement statuts séjour avant dédup
2. `9cc03a8` — refactor(4.25): centralise STATUTS_SEJOUR_CONFIRMES (2 littéraux → 1 constante)
3. `b9a78be` — refactor(4.25): centralise STATUTS_SEJOUR_COLLABORATIFS (3 littéraux → 1 constante)
4. `2604d44` — refactor(4.25): centralise STATUTS_SEJOUR_DIRECT (2 occurrences → 1 constante)

(+ le présent commit de clôture du rapport.)
