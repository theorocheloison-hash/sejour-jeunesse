# RUN CHAMBRES 4a/8 — Occupations + grille + syncOccupationsSejour — Plan (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — **Statut : VALIDÉ PAR THÉO le 21/07/2026** (les 7 points du §7,
> avec 2 amendements intégrés ci-dessous : grille filtrée des séjours `deletedAt` (§2.1) et
> log exploitable site+sejourId au lieu de `console.error` (§3.1)). Écriture déclenchée après
> confirmation `success` du déploiement run 5 (commit `831c8db`) sur les DEUX apps Scalingo.
> Périmètre 4a : construction du NEUF uniquement. La transactionalisation des sites de
> signature (§3.3 doc archi) et les cascades séjour (update dates / soft-delete) = **run 4b**.
> Sources lues ce jour : `ARCHITECTURE_MODULE_CHAMBRES.md` (D1/D2/D6/D8/D11/D12/D13, §2.3,
> §3, §3.1, §5), `backend/src/chambres/` (module complet), `devis-statuts.constants.ts`,
> `devis.service.ts` (blocs 627-1076 et 2140-2586), `invitations-directeur.service.ts`
> (140-271), `sejours/sejour.service.ts` (1180-1290), `schema.prisma` (1725-1811 + Sejour),
> migration run 1 (`20260721120000_module_chambres`), `plan.guard.ts`, `capacite.controller.ts`,
> `referentiel.controller.ts`, modules `devis`/`sejours`/`invitations-directeur`/`auth`.
> **Vérification roadmap-contre-code faite : les 11 sites du §3.1 sont aux lignes annoncées.**

---

## 1. Migration — étiquette + couleur (D13, marquage V1)

`backend/prisma/migrations/20260721180000_occupation_etiquette_couleur/migration.sql`
(SQL manuel, convention du run 1 — jamais `migrate dev`) :

```sql
-- Marquage V1 (D13 option a) : étiquette libre + couleur portées par l'OCCUPATION
-- (« Filles » / « Garçons » / « Accompagnateurs »…) — lecture d'un coup d'œil sur la
-- grille et la rooming list. Colonnes nullables : aucune donnée existante à migrer.
ALTER TABLE "occupations_chambre"
  ADD COLUMN "etiquette" VARCHAR(30),
  ADD COLUMN "couleur" VARCHAR(20);
```

`schema.prisma` — dans `OccupationChambre`, après `motif` :

```prisma
  etiquette String?  @db.VarChar(30)               // D13 : "Filles", "Encadrants"…
  couleur   String?  @db.VarChar(20)               // token/hex libre côté front
```

Aucune autre colonne, aucun index nouveau (les requêtes de grille passent par
`@@index([chambreId, dateDebut])` existant).

---

## 2. Contrat des endpoints (cadrage validé, détails ci-dessous)

Nouveau couple `occupations.controller.ts` + `occupations.service.ts` dans
`backend/src/chambres/` (`capacite.*` / `referentiel.*` **intouchés**). Guards au niveau
classe, calqués run 3 : `@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)`
+ `@Roles(HEBERGEUR)` + **`@RequirePermission('sejours')`** (D5 : affectation
chambres→séjour = module `sejours`, PAS `parametres`) + `@RequirePlan('COMPLET')`
(soft : `GET /grille` passe sans plan, les mutations exigent COMPLET). `@CentreId()`
partout, `getCentreForUser` dans chaque méthode service.

Collision de routes vérifiée : `grille`, `occupations`, `blocages` sont des segments
statiques ; aucun `GET/PATCH/DELETE /chambres/:id` à 2 segments n'existe côté
referentiel/capacite qui pourrait les avaler (`PATCH /chambres/occupations/:id` = 3
segments vs `PATCH /chambres/:id` = 2 — disjoints par construction).

### 2.1 `GET /chambres/grille?debut=YYYY-MM-DD&fin=YYYY-MM-DD`

- `debut`/`fin` **requis**, ISO date, `fin > debut`, fenêtre plafonnée à 370 jours
  (défensif) — sinon 400.
- Chambres retournées : toutes les **actives** du centre + les **inactives portant au
  moins une occupation chevauchant la fenêtre** (une A_REPLACER sur chambre désactivée
  doit rester visible), tri `etage (nulls first), ordre, nom` (même tri que le run 3).
- Occupations retournées : celles chevauchant `[debut, fin)` (`dateDebut < fin AND
  dateFin > debut`), **en excluant celles dont le séjour porte `deletedAt`** (amendement
  Théo 21/07 — filtre d'affichage : `OR [{ sejourId: null }, { sejour: { deletedAt: null } }]`,
  les BLOCAGE n'ont pas de séjour ; la suppression réelle des occupations au soft-delete
  reste au run 4b).

```jsonc
{
  "debut": "2027-03-01", "fin": "2027-03-31",
  "chambres": [{
    "id": "…", "nom": "Chambre 12", "etage": "1er", "ordre": 3,
    "actif": true, "capacite": 4,
    "etat": { "type": "option", "nbOptions": 2 },   // libre | option | ferme | bloquee | a_replacer
    "occupations": [{
      "id": "…", "dateDebut": "2027-03-03", "dateFin": "2027-03-07",
      "source": "SEJOUR", "statut": "OPTION",
      "etiquette": "Filles", "couleur": "#C87D2E", "motif": null,
      "sejour": { "id": "…", "titre": "4ème Morillon" }   // null si BLOCAGE
    }]
  }]
}
```

- `etat` (résumé sur la fenêtre, le détail jour par jour est le travail du front à
  partir de `occupations[]`) — priorité : `a_replacer` (∃ A_REPLACER) > `ferme`
  (∃ FERME source SEJOUR) > `bloquee` (∃ FERME source BLOCAGE) > `option`
  (`nbOptions` = nb de **séjours distincts** en OPTION chevauchants) > `libre`.

### 2.2 `POST /chambres/occupations` — `{ sejourId, chambreIds[], dateDebut?, dateFin? }`

- Séjour : `findUnique` → 404 si introuvable/`deletedAt` ; 403 si
  `hebergementSelectionneId !== centre.id` (pattern exact de `capacite.service.ts:298-301`
  — couvre COLLAB sélectionné ET DIRECT, qui naît avec `hebergementSelectionneId`).
- Dates : défaut = celles du séjour ; **400 si le séjour n'a pas de dates et qu'aucune
  n'est fournie** (cascade §6.4 doc archi) ; si fournies, les DEUX sont exigées,
  `fin > debut`.
- Chambres : `findMany({ id: { in }, centreId })` → 404 si un id manque (ne révèle pas
  l'existence — cloisonnement §5).
- Anti-doublon : une occupation SEJOUR **du même séjour** sur la même chambre avec
  chevauchement → 400 explicite (« déjà posée sur ces dates »).
- **Statut de naissance dérivé** (§3.2, jamais OPTION par défaut aveugle) :
  `cible = FERME` si ∃ devis non-complémentaire du séjour ∈ `STATUTS_DEVIS_RETENUS`,
  sinon `OPTION`. Si `cible = FERME` : contrôle applicatif de chevauchement **dans la
  transaction d'écriture** ; chambre en conflit → l'occupation **naît `A_REPLACER`** et
  la réponse porte un avertissement structuré — **la requête n'échoue JAMAIS pour cause
  de conflit (D12)**.

```jsonc
// 201
{
  "occupations": [ /* créées, forme grille */ ],
  "avertissements": [{
    "chambreId": "…", "nom": "Chambre 12", "statut": "A_REPLACER",
    "conflits": [{ "chambreId": "…", "nom": "Chambre 12",
                   "sejourTitre": "4ème Morillon", "motif": null,
                   "dateDebut": "2027-03-03", "dateFin": "2027-03-07" }]
  }]
}
```

- Écriture : une seule `$transaction` (check applicatif + creates). Filet 23P01
  (course entre le check et le commit) : catch → **un retry complet** ; le check revoit
  alors le FERME gagnant et pose A_REPLACER. Si un 2e 23P01 survient (double course,
  improbable) → 409 en dernier recours, documenté.

### 2.3 `PATCH /chambres/occupations/:id` — `{ dateDebut?, dateFin?, chambreId?, etiquette?, couleur? }`

- Occupation résolue par `findFirst({ id, chambre: { centreId } })` → 404 (cloisonnement).
- `etiquette`/`couleur` seuls (`null` = retirer, pattern `etage` du run 3) : simple
  update, **aucun recalcul de statut**.
- Re-datage / changement de chambre (= résolution A_REPLACER, D8) : recalcul de la
  cible (`SEJOUR` → dérivée devis ; `BLOCAGE` → FERME), tentative au statut cible dans
  la transaction ; **conflit → 409 `{ conflits }`** — geste manuel de l'hébergeur, il
  doit VOIR que ça ne passe pas, on ne re-crée pas de l'A_REPLACER en silence
  (asymétrie assumée avec le POST/sync qui, eux, servent des chemins que D12 protège).
- Un PATCH qui aboutit sort de l'A_REPLACER : statut = cible dérivée.
- `chambreId` cible : même centre → sinon 404. Dates : `fin > debut` sinon 400.

### 2.4 `DELETE /chambres/occupations/:id` — libérer

- Même cloisonnement. Hard delete ; les `AffectationChambre` suivent par FK
  `onDelete: Cascade` (**voulu** — libérer une chambre libère son rooming).
  Réponse `{ deleted: true }`.

### 2.5 `POST /chambres/blocages` — `{ chambreIds[], dateDebut, dateFin, motif }`

- `source = 'BLOCAGE'`, `statut = 'FERME'` d'office (D11), `sejourId = null` (le CHECK
  `occupation_sejour_coherent` l'exige).
- Dates requises, `fin > debut`. `motif` requis, 1–255 (un blocage sans motif est
  illisible sur la grille ; la colonne reste nullable en base).
- **Conflit → 409 `{ conflits }`** : un blocage qui ne bloque pas n'a pas de sens,
  et aucun D12 en jeu (geste hébergeur, pas une signature). Transaction tout-ou-rien
  sur le lot.

### 2.6 DTOs (class-validator, `ValidationPipe` whitelist oblige)

- `create-occupations.dto.ts` : `sejourId @IsUUID()` ; `chambreIds @IsArray()
  @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true })` ;
  `dateDebut/dateFin @IsOptional() @IsDateString()`.
- `update-occupation.dto.ts` : `dateDebut?/dateFin? @IsDateString()` ; `chambreId?
  @IsUUID()` ; `etiquette? @MaxLength(30)` nullable ; `couleur? @MaxLength(20)` nullable.
- `create-blocages.dto.ts` : `chambreIds` (idem) ; `dateDebut/dateFin @IsDateString()`
  requis ; `motif @IsString() @Length(1, 255)`.

---

## 3. `syncOccupationsSejour(sejourId, tx?)` — spec

Dans `occupations.service.ts`, exportée via `ChambresModule` (déjà `exports`-é) :

```ts
async syncOccupationsSejour(sejourId: string, tx?: Prisma.TransactionClient): Promise<void>
// db = tx ?? this.prisma — le paramètre tx existe dès 4a pour que 4b n'ait pas à
// changer la signature ; en 4a, AUCUN site ne le passe (sites non transactionnels).
```

Algorithme (§3.2, amendé RETENUS) :

1. `cible = 'FERME'` si `count(devis { isComplementaire: false, statut ∈
   STATUTS_DEVIS_RETENUS, OR: [{ sejourDirectId: sejourId }, { demande: { sejourId } }] }) > 0`,
   sinon `'OPTION'`. **RETENUS, pas ENGAGEANTS** : les devis legacy `FACTURE_ACOMPTE`/
   `FACTURE_SOLDE` restent du CA confirmé — hors RETENUS, un séjour signé-et-facturé
   verrait ses chambres redevenir volables (§3.2 doc archi).
2. Pour chaque occupation `{ sejourId, source: 'SEJOUR' }` :
   - `statut === 'A_REPLACER'` → **intouchée** (résolution = geste manuel, D8) ;
   - `statut === cible` → rien (idempotence) ;
   - `cible === 'OPTION'` → update (rétrogradation toujours possible, libère le stock) ;
   - `cible === 'FERME'` → check applicatif de chevauchement FERME (même chambre,
     `[debut,fin)` `&&`, `id ≠`, autres séjours + blocages) : conflit → `A_REPLACER` ;
     sinon update `FERME` sous filet 23P01 → `A_REPLACER`. **Promotion par occupation** :
     une chambre en conflit ne condamne pas les autres.
3. Ne jette **jamais** pour cause de conflit (D12). `source='BLOCAGE'` jamais touché.

Détection 23P01 (le doc archi §2.3 : non mappée par Prisma en erreur « connue ») —
helper défensif testé sur les deux formes :

```ts
const isConflitExclusion = (e: unknown) => {
  const s = e instanceof Error ? e.message : String(e);
  return s.includes('23P01') || s.includes('occupation_non_chevauchement');
};
```

### 3.1 Les 11 sites → 9 points d'insertion (lignes vérifiées ce jour sur le code)

**Diff minimal par site : UN appel ajouté après les écritures existantes** (avant les
emails/logs CRM, qu'on ne déplace pas), AUCUNE mise en transaction (= 4b), AUCUN autre
changement dans ces fichiers. **Amendement Théo 21/07 (log exploitable)** : le try/catch
et le log vivent dans un wrapper `OccupationsService.syncOccupationsSejourSafe(sejourId,
site)` — chaque site n'ajoute donc qu'UNE ligne, sans logger nouveau dans les services
hôtes :

```ts
/** Appel non bloquant pour les sites de signature (D12) : un bug de sync ne fait
 *  jamais échouer une écriture déjà commitée ; l'échec se voit et se localise. */
async syncOccupationsSejourSafe(sejourId: string, site: string): Promise<void> {
  try {
    await this.syncOccupationsSejour(sejourId);
  } catch (err) {
    this.logger.error(`[sync] échec — site=${site} sejourId=${sejourId}`, err as Error);
  }
}
// Au site : await this.occupations.syncOccupationsSejourSafe(id, 'devis.signerDevis');
```

(`private readonly logger = new Logger(OccupationsService.name)` — pattern exact
`accompagnateur.service.ts:21`. L'auto-réparation §3.2 fait le reste : un sync raté se
rattrape au prochain appel n'importe où.)

| # sites §3.1 | Fichier | Fonction | Insertion (après la ligne) | sejourId passé |
|---|---|---|---|---|
| 1 + 2 (665-673, 736) | `devis.service.ts` | `updateStatut` | 753 (fin du bloc NON_RETENU, avant `return updated`) — appel **conditionnel** `if (statut === SELECTIONNE \|\| statut === NON_RETENU)` | `demande.sejourId` |
| 3 + 4 (781-789, 816+832) | `devis.service.ts` | `signerDevis` | 834 (après l'update séjour SIGNE_DIRECTION, avant l'email l.836) — un seul appel couvre les deux blocs | `devis.demande?.sejour?.id` (skip si absent) |
| 5 (919+929) | `devis.service.ts` | `uploadSignatureDocument` | 931 (après l'update séjour, avant le fetch centre l.933) | `devis.demande?.sejourId` (skip si absent) |
| 6 (1029-1030) | `devis.service.ts` | `marquerDevisSigneHebergeur` | 1055 (après le bloc `if (sejourId)`, avant le log CRM) | `sejourId` local (skip si null) |
| 7 (2195) | `devis.service.ts` | `signerDevisDirect` | 2211 (après l'update séjour, avant les emails l.2213) | `devis.sejourDirect.id` |
| 8 (2423) | `devis.service.ts` | `uploadSignaturePublic` | 2436 (après l'update séjour, avant l'email l.2438) | `devis.sejourDirect.id` |
| 9 (2531+2554) | `devis.service.ts` | `annulerDevis` | 2559 (dans le `if (sejourCibleId)`, après la rétrogradation, avant le log CRM l.2561) — appel inconditionnel au `autresActifs === 0` : le sync recalcule lui-même | `sejourCibleId` |
| 10 (inv. 227+240) | `invitations-directeur.service.ts` | `signerSansCompte` | 241 (après l'update séjour, avant le re-fetch devis l.243) | `invitation.sejourId` |
| 11 (sejour ~1253) | `sejours/sejour.service.ts` | `softDeleteSejour` | 1276 (après la `$transaction` deleteMany devis + deletedAt, avant le log CRM l.1278) | `sejourId` |

Effet 4a du site 11 : les devis étant supprimés, `cible = OPTION` → les FERME du séjour
supprimé **libèrent le stock** au sens de l'exclusion. La **suppression** des occupations
au soft-delete (cascade §6.2) reste au run 4b — noté, pas fait ici.

### 3.2 Câblage modules (conséquence mécanique des 9 appels)

- `chambres.module.ts` : `+ OccupationsController` (controllers), `+ OccupationsService`
  (providers + exports).
- `devis.module.ts` : `imports += ChambresModule` ; `DevisService` constructor
  `+ private occupations: OccupationsService`.
- `invitations-directeur.module.ts` : idem (`imports += ChambresModule`, constructor).
- `sejours/sejour.module.ts` : idem.
- Circularité vérifiée : `ChambresModule` n'importe que `AuthModule`, qui n'importe
  que `OrganisationsModule`/Passport/Jwt — **aucun cycle**.

---

## 4. Contrôle applicatif de chevauchement + mapping 409

Helper privé partagé (POST / PATCH / blocages / sync) :

```ts
// Dans la MÊME transaction que l'écriture (couche 2 du §4 doc archi — l'UX ;
// l'EXCLUDE reste le filet ultime). Chevauchement demi-ouvert : deb < fin' ET fin > deb'.
private async chevauchementsFermes(db, chambreIds, debut, fin, exclureOccupationId?)
// → [{ chambreId, nom, sejourTitre|null, motif|null, dateDebut, dateFin }]
```

Erreur 409 (PATCH et blocages uniquement — le POST occupations et le sync n'échouent
jamais sur conflit) :

```jsonc
// ConflictException — jamais un 500 brut sur 23P01 (§2.3 doc archi)
{ "statusCode": 409, "error": "CHAMBRES_CONFLIT",
  "message": "Chambre 12 tenue par « 4ème Morillon » du 03/03 au 07/03",
  "conflits": [{ "chambreId": "…", "nom": "Chambre 12",
                 "sejourTitre": "4ème Morillon", "motif": null,
                 "dateDebut": "2027-03-03", "dateFin": "2027-03-07" }] }
```

---

## 5. Cascade analysis

**Fichiers NOUVEAUX** : migration `20260721180000_occupation_etiquette_couleur/`,
`chambres/occupations.controller.ts`, `chambres/occupations.service.ts`,
`chambres/occupations.service.spec.ts`, `chambres/dto/create-occupations.dto.ts`,
`chambres/dto/update-occupation.dto.ts`, `chambres/dto/create-blocages.dto.ts`.

**Fichiers MODIFIÉS** : `schema.prisma` (+2 champs), `chambres.module.ts`,
`devis.module.ts`, `devis.service.ts` (7 appels, 7 fonctions, +1 dépendance
constructor, +1 import), `invitations-directeur.module.ts`,
`invitations-directeur.service.ts` (1 appel, +1 dép., +1 import),
`sejours/sejour.module.ts`, `sejours/sejour.service.ts` (1 appel, +1 dép., +1 import).

**INTOUCHÉS** : `capacite.*`, `referentiel.*`, tous les emails/logs CRM (position
inchangée), les blocs de transition eux-mêmes, frontend.

**Tests existants à risque (baseline 253)** : AUCUN spec n'instancie `DevisService`,
`SejourService` ni `InvitationsDirecteurService` (recensement des 18 `*.spec.ts` — ces
trois services n'ont pas de spec) → l'ajout du paramètre constructor ne casse rien.
Les specs `capacite`/`referentiel` ne touchent pas aux fichiers modifiés. Baseline
re-vérifiée par `npm test` avant COMMIT 1 (protocole : gates `npx tsc --noEmit` +
`npm run build` + `npm test` à chaque commit, revert si rouge).

---

## 6. Plan des commits (Phase 2, après feu vert)

1. `feat(chambres-4a): migration etiquette/couleur + schema` — SQL §1 + schema.prisma.
2. `feat(chambres-4a): occupations service + sync + endpoints` — service/controller/DTOs
   + câblage `chambres.module.ts`.
3. `feat(chambres-4a): branchement syncOccupationsSejour aux 11 sites` — les 9 appels
   §3.1 + imports modules §3.2, rien d'autre dans ces fichiers.
4. `test(chambres-4a): occupations + sync` — `occupations.service.spec.ts` (pattern
   `capacite.service.spec.ts`, Prisma mocké) : dérivation RETENUS (devis legacy
   `FACTURE_*` inclus), naissance FERME vs OPTION, conflit POST → A_REPLACER sans échec
   (D12), blocage (FERME d'office, 409 si conflit, sejourId null), rotation samedi
   (fin A = début B ⇒ PAS un conflit, demi-ouvert), résolution A_REPLACER par PATCH
   (chambre libre → statut dérivé ; conflit → 409), libération (annulation devis →
   OPTION), idempotence du sync (2e appel = zéro update), A_REPLACER intouché par le
   sync, filet 23P01 (mock rejet → A_REPLACER, deux formes du message), cloisonnement
   multi-centre (404 chambre/occupation d'un autre centre, 403 séjour d'un autre
   centre), 400 séjour sans dates.

**Interdits respectés** : pas de mise en transaction des sites, pas de déplacement
d'email, pas de cascade update-dates/soft-delete (4b), pas de frontend, pas de
`migrate dev`, pas de push.

---

## 7. Points tranchés par Théo (21/07/2026) — les 7 validés

> Amendements : au point 2, le log passe par `syncOccupationsSejourSafe` (§3.1 amendé) ;
> au point 7 s'ajoute le filtre `deletedAt` de la grille (§2.1 amendé). Baseline vérifiée
> avant écriture : **253 tests verts** (18 suites, +2 todo).

1. **Asymétrie conflit** : POST occupations → jamais d'échec (A_REPLACER + avertissement,
   D12) ; PATCH (résolution manuelle) et POST blocages → **409** avec la liste des
   conflits. C'est ma lecture du cadrage — confirmer.
2. **Appel sync wrappé try/catch + `console.error`** dans les 9 sites (un bug de sync ne
   casse jamais une signature écrite ; auto-réparation au prochain appel, §3.2). L'autre
   option — appel nu — ferait remonter un 500 au client APRÈS que la signature soit en
   base. Confirmer le wrap.
3. **Grille** : inclusion des chambres inactives porteuses d'occupations dans la fenêtre
   (sinon une A_REPLACER sur chambre désactivée devient invisible). Confirmer.
4. **Anti-doublon POST** : même séjour + même chambre + chevauchement → 400. (Les
   sous-périodes disjointes du même séjour restent possibles, §2.3 doc archi.)
5. **`updateStatut`** : appel sync conditionnel à `SELECTIONNE | NON_RETENU` (la fonction
   accepte d'autres statuts sans effet séjour). Alternative : inconditionnel (idempotent
   mais requêtes pour rien). Je recommande conditionnel.
6. **`motif` requis** au POST blocages (colonne nullable en base, exigé au DTO).
7. **Site 11 (softDeleteSejour)** : en 4a le sync rétrograde les occupations du séjour
   supprimé en OPTION (stock libéré) ; leur suppression effective = 4b. Acceptable en
   attendant ?

---

## 8. Livraison (Phase 2, 21/07/2026) — LIVRÉ, rien reverté

| Commit | Contenu | Gates |
|---|---|---|
| `ea574b2` | migration `20260721180000_occupation_etiquette_couleur` + schema | tsc OK, build OK, 253 tests |
| `07439e7` | occupations.service/controller + 3 DTOs + module (713 lignes) | tsc OK, build OK, 253 tests |
| `b5c4f65` | branchement des 11 sites — 9 appels, 42 lignes, 6 fichiers | tsc OK, build OK, 253 tests |
| `37fd2c2` | 28 tests occupations + sync | tsc OK, build OK, **281 tests** |

Notes : baseline 253 → 281 tests verts, zéro test existant cassé. Frontend intouché
(gates backend seuls). PAS de push (review Théo avant prod — la migration partira au
prochain déploiement via `prisma migrate deploy`). `LIAVO_SESSION_STATE.md` et
`ROADMAP_ETE_2026.md` portaient des modifications locales préexistantes au run,
laissées telles quelles. Reste pour 4b : transactionalisation des 5 blocs de
signature (§3.3 doc archi), cascades update-dates séjour et suppression effective
des occupations au soft-delete.
