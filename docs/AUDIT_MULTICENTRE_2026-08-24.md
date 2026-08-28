# LIAVO — Audit multi-centre (vue par centre & vue consolidée)

> **Date** : 2026-08-24 · **Mode** : lecture seule sur le code (`backend/`, `frontend/`), zéro modif, zéro git.
> **Question** : (Q1) la « vue par centre » cloisonne-t-elle correctement tout ce qui a été développé ? (Q2) la « vue consolidée » est-elle complète, cohérente, avec des remontées correctes de tous les centres ?
> **Règle de preuve** : verdict = `fichier:ligne` ou recherche vide. Aucun pari.

---

## 0. Comment le multi-centre fonctionne (mécanisme réel, factuel)

- **Front → back** : `frontend/src/lib/api.ts` (interceptor) envoie le header `X-Centre-Id` sur **chaque** requête, lu depuis `localStorage['liavo-centre-actif']`. Le décorateur backend `@CentreId()` (`centres/centre-id.decorator.ts`) l'injecte dans les controllers sous `centreId: string | null`.
- **Primitive de cloisonnement** : `getCentreForUser(prisma, userId, centreId?)` (`backend/src/centres/centre.helper.ts:4`).
  - `centreId` fourni → vérifie propriété/collaboration, retourne CE centre. **Cloisonnement correct.**
  - `centreId` absent → **fallback** `findFirst({ where: { userId, statut ≠ SUSPENDED } })` **sans `orderBy`** (`centre.helper.ts:35-38`) = « un centre au hasard, non déterministe ».
- **Changement de centre** : `setCentreActif` (`frontend/src/contexts/AuthContext.tsx:119-122`) écrit le localStorage puis **`window.location.reload()`** → tout est refetché avec le nouveau header. **Pas de données périmées possibles.**
- **Vue consolidée** : `getCentresForUser` / `getCentreIdsForUser` (`centre.helper.ts:126,150`) renvoient TOUS les centres accessibles ; consommées par `getDashboardGlobal` + `getMesCentres` (`centre.service.ts:230,441`) et les listes séjours (`collaboration.service`).

**Conséquence structurelle** : le cloisonnement est **opt-in par endpoint**. La justesse dépend de la propagation de `centreId` jusqu'à `getCentreForUser`. **99 appels** dans 21 fichiers = 99 points de contrôle.

---

## Q1 — Vue par centre : census exhaustif des 99 points `getCentreForUser`

Signal décisif : appel **à 3 arguments** (`prisma, userId, centreId`) = cloisonné ; **à 2 arguments** (`prisma, userId`) = fallback « 1er centre ».

| Fichier (domaine) | Appels | 3-arg (cloisonné) | 2-arg (fallback) | Controller threade `@CentreId` | Verdict |
|---|---|---|---|---|---|
| `centres/centre.service.ts` (catalogue, produits, disponibilités, profil, permissions) | 27 | 26 | 1 (`:59`) | oui | **OK** (l'unique 2-arg = fallback permissions, cf. note A) |
| `devis/devis.service.ts` | 16 | 16 | 0 | oui (17/24 routes ; reste = `:id`/persona) | **OK** — `getMesDevis` → `where:{centreId:centre.id}` (`:266`) |
| `facture/facture.service.ts` | 10 | 10 | 0 | oui (12/12 routes) | **OK** |
| `chambres/referentiel.service.ts` | 8 | 8 | 0 | oui | **OK** |
| `rentabilite/rentabilite.service.ts` | 7 | 7 | 0 | oui (7/7) | **OK** |
| `pilotage/pilotage.service.ts` | 6 | 6 (`centreId ?? undefined`) | 0 | oui (6/6) | **OK** (per-centre, cf. Q2 note) |
| `chambres/occupations.service.ts` | 5 | 5 | 0 | oui | **OK** |
| `clients/clients.service.ts` | 3 | 3 (dont `centreIdHeader`) | 0 | oui (17/18) | **OK** |
| `demandes/demande.service.ts` | 3 | 3 | 0 | oui (3/6 ; reste = `:id`) | **OK** |
| `sejours/sejour.service.ts` | 3 | 3 | 0 | partiel (3/17, cf. note B) | **OK** (le reste est séjour-scopé) |
| `chambres/capacite.service.ts` | 2 | 2 | 0 | oui | **OK** |
| `activites-client/activites-client.service.ts` | 2 | 2 | 0 | oui | **OK** |
| `abonnements/abonnement.service.ts` | 1 | 1 | 0 | oui (7/7) | **OK** |
| `chambres/rooming.service.ts` | 1 | 1 | 0 | via séjour (cf. note C) | **OK** |
| `invitation-collaboration/…service.ts` | 1 | 1 | 0 | oui | **OK** |
| `collaborateurs/collaborateur.service.ts` | 1 | 0 | 1 (`:246`) | oui | **OK** (fallback permissions, note A) |
| `auth/guards/plan.guard.ts` | 1 | 1 (`centreId||undefined`) | 0 | header direct | **OK** |
| `centres/centre.helper.ts:156` | 1 | 1 | interne `getCentreIdsForUser` | — | **OK** |
| **Total** | **~99** | **~96** | **2** | | |

**Verdict Q1 : le cloisonnement par centre est systématique et fonctionne** sur l'ensemble des domaines développés (catalogue/produits, devis, factures, chambres, clients, demandes, séjours hébergeur, pilotage, rentabilité, abonnements, activités CRM). Les **2 seuls appels 2-arg** ne sont pas des bugs (note A). Les endpoints non cloisonnés par centre le sont légitimement par **persona** (notes B/C).

### Notes (les cas qui « sortent » du header centre — tous justifiés)

- **Note A — les 2 appels 2-arg = fallback permissions, pas des mutations.** `getMesPermissions` (`centre.service.ts:56-60`) et `mesPermissions` (`collaborateur.service.ts:243-247`) : `if (!centreId) centre = getCentreForUser(userId)` → défaut si header absent. Lecture de permissions uniquement, jamais d'écriture de données métier. Risque faible **mais** s'appuie sur le `findFirst` non déterministe (cf. risque latent #1).
- **Note B — `sejours/me` (organisateur), pas une vue centre.** `sejour.service.getMesSejours` (`:162-163`) filtre `where: { createurId }` = les séjours de l'ORGANISATEUR connecté, pas d'un centre. La vue séjours de l'**hébergeur** passe par `collaboration/mes-sejours` (`collaboration.controller.ts:41-55`) qui **threade `@CentreId`** → `getCentreIdsForUser(userId, centreId)` (per-centre si header, tous centres sinon). Cloisonné correctement.
- **Note C — chambres/affectation = scopé SÉJOUR.** `affectation.controller.ts` n'a pas `@CentreId` : l'accès est résolu par `resoudreAccesRooming` (`rooming.service.ts:99`) via la propriété du séjour, pas via le header centre. Correct par design (un séjour appartient à un centre).
- **Note D — listes signataire.** `getDevisAValider` / `getFacturesAcompte` (`devis.service`) sont scopées `getSignataireSejourIds(userId)` = persona SIGNATAIRE, pas centre. Correct.

### Risques latents (réels, mais pas des bugs actifs aujourd'hui)

1. **🟠 `findFirst` sans `orderBy` (centre.helper.ts:35-38)** — le « centre par défaut » (quand le header est absent) est **non déterministe** (ordre SQL arbitraire). Aujourd'hui masqué car le front pose toujours le header et recharge au changement de centre. Mais toute fenêtre où le header manque (première connexion avant sélection, race, futur appelant serveur) → l'app agit silencieusement sur un centre au hasard. **C'est exactement la famille du bug export déjà corrigé (roadmap item 77).** Correctif trivial et sûr : `orderBy` déterministe sur le fallback.
2. **🟠 Cloisonnement opt-in, aucune garantie au compilateur** — un futur endpoint qui oublie `@CentreId` hérite en silence du fallback « 1er centre ». Il n'existe aucun garde-fou (test/lint/type) qui force le threading. Fragilité architecturale, pas un bug présent.

---

## Q2 — Vue consolidée : `getDashboardGlobal` (`centre.service.ts:441-758`)

**Construction** : `getCentresForUser(userId)` → `centreIds` → toutes les agrégations filtrent `{ in: centreIds }`. Fournit aussi une **ventilation par centre** (`:714 return { centreId, devisEnAttente, sejoursActifs }`).

**Remontées agrégées, toutes en `{ in: centreIds }` (= tous les centres)** :
- **KPI 1 « À traiter »** : demandes `OUVERTE` ciblées `centreDestinataireId ∈ centreIds` **ou** broadcast (`null`) avec post-filtre capacité multi-centre (`:475-484`) ; + devis `EN_ATTENTE` (`:497`). Urgents J+7 (`:517`).
- **KPI 2 « À facturer »** : acompte à émettre (`devis.centreId ∈ centreIds`, `:530`) + solde à émettre (`:566`). Montant total agrégé.
- **KPI 3 « Paiements en attente »** : factures impayées (`devis.centreId ∈ centreIds`, `:567`) + devis libres impayés (`:597`).
- **KPI 4 « CA »** : encaissé (`versementPaiement`, `:610`) + encaissé devis libres (`:620`) + prévisionnel (`:628`) + **CA via réseau** (`:640`).

**Verdict Q2 : la vue consolidée est complète et cohérente sur le périmètre financier/opérationnel**, et les remontées de tous les centres fonctionnent (`{ in: centreIds }` partout, jamais un seul centre). Trois réserves :

1. **🟠 Incohérence commentaire ⇄ code sur les PENDING.** Le commentaire (`:442-443`) affirme « Seuls les centres ACTIVE… PENDING exclus », mais `getCentresForUser` **inclut les PENDING** (exclut seulement `SUSPENDED`, `centre.helper.ts:127`). Donc les données d'un centre PENDING **remontent** dans les KPI consolidés, contrairement à l'intention affichée. À trancher : soit corriger le commentaire, soit filtrer `statut = ACTIVE` dans `getDashboardGlobal`.
2. **🟡 Périmètre non consolidé : remplissage & rentabilité.** L'occupation/remplissage (`pilotage.getRemplissage`) et la rentabilité/TVA sur marge (`rentabilite.service`) sont **per-centre uniquement** — aucune agrégation multi-centre. La « vue consolidée » est donc commerciale/financière (demandes, facturation, CA), **pas** une consolidation 360° (pas de taux d'occupation global, pas de marge consolidée). Gap de complétude **si** l'attendu produit était une vraie vue « tous mes centres » sur ces axes.
3. **🟡 Couplage résiduel `DevisLibre`.** Le dashboard lit encore `prisma.devisLibre` / `versementDevisLibre` (`:597,620`). Cohérent avec la décision TIER1 Ch.3 (module supprimé, **tables conservées**), mais à savoir : un pan « devis libres » subsiste dans la remontée consolidée alors que le module métier n'existe plus.

---

## Contrôle d'intégrité

- **99 points de cloisonnement** `getCentreForUser` recensés (21 fichiers) : **~96 cloisonnés (3-arg)**, **2 fallback permissions (2-arg, justifiés)**, 1 interne. Aucun appel 2-arg sur une mutation de donnée métier.
- **Endpoints non centre-scopés** : tous justifiés par persona (organisateur `createurId`, signataire `getSignataireSejourIds`) ou par scoping séjour (affectation rooming). Aucun cas de fuite/mélange de centres détecté.
- **Front** : header `X-Centre-Id` sur chaque requête (`api.ts`) + reload au changement de centre (`AuthContext.tsx:122`) → pas de vue périmée.
- **Vue consolidée** : agrège tous les centres pour à-traiter / à-facturer / impayés / CA. 3 réserves ci-dessus.

### Synthèse (réponse directe)

- **Q1 — « la vue par centre marche sur tout ce qu'on a dev ? »** → **Oui**, le cloisonnement est systématique et couvre tous les domaines. Zéro bug de mélange/fuite trouvé. **Deux fragilités latentes** (findFirst non déterministe + opt-in sans garde-fou) qui ne mordent pas aujourd'hui mais ont déjà mordu une fois (export).
- **Q2 — « la vue consolidée est complète et cohérente ? »** → **Oui sur le financier/commercial**, remontées de tous les centres OK. **Trois réserves** : PENDING inclus contrairement au commentaire (incohérence à trancher), remplissage & rentabilité non consolidés (gap de périmètre), résidu DevisLibre.

**Rien de bloquant. Les seuls correctifs « sûrs » (AUTO) : `orderBy` sur le fallback (#1) et l'alignement commentaire/PENDING (#Q2-1). Le reste (consolidation remplissage/rentabilité) est une décision produit.**
