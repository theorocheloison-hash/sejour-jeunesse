# RUN CHAMBRES — Lot 5 : cascades séjour (update dates + soft-delete) — Plan (Phase 1, lecture seule)

> **Rédigé le 22/07/2026** — **Statut : VALIDÉ PAR THÉO le 22/07/2026** (règle de re-datage
> option A actée « je te fais confiance sur ce point » ; séquence globale actée :
> Lot 5 → sélecteur chambres page séjour → sous-chantier 7).
> **Source de vérité conception** : `ARCHITECTURE_MODULE_CHAMBRES.md` §6 (cascades) + D6/D8/D12/D14,
> `run-chambres-4b.md` §1 (le `tx?` de `syncOccupationsSejour` est **réservé aux cascades** — c'est ici).
> Sources lues ce jour (lignes vérifiées sur le code réel) :
> `collaboration/collaboration.service.ts` (1403-1538 `updateInfosSejour`, constructor l.32),
> `collaboration/collaboration.module.ts` (aucun import — Email/Prisma sont `@Global`),
> `collaboration/dto/update-infos-sejour.dto.ts` (intégral),
> `sejours/sejour.service.ts` (1235-1295 `softDeleteSejour` + site 11, 824-860 `update` DRAFT-only,
> 905-985 `updateStatus`, 1065-1100 `createDirect`),
> `chambres/occupations.service.ts` (l.40 `isConflitExclusion`, l.125 `chevauchementsFermes`,
> l.178 `syncOccupationsSejour(sejourId, tx?)`, l.222 `syncOccupationsSejourSafe`),
> `public/public.service.ts` (165-205), `invitation-collaboration/invitation-collaboration.service.ts`
> (100-210, 440-470), `centres/centre.service.ts` (1470-1490 → disponibilités, hors sujet),
> `demandes/demande.service.ts` (111 → création demande, hors sujet).

---

## 1. Census — le résultat central

**UN SEUL site écrit `dateDebut`/`dateFin` d'un séjour EXISTANT** :
`collaboration.service.ts:1434` — `updateInfosSejour` (PATCH `/collaboration/:sejourId/infos`,
controller l.127). Gate : `sejour.hebergementSelectionne.userId === userId` → couvre
**COLLAB et DIRECT** (les deux modes ont `hebergementSelectionneId` posé).

Tous les autres sites `dateDebut:` recensés sont des **créations** (createDirect,
creerDepuisCatalogue, dépôt public, invitations, demandes) ou d'autres tables
(disponibilités centre) — un séjour qui naît n'a pas d'occupations, aucune cascade à y
brancher. `sejour.service.update` est gaté `DRAFT` et **ne touche pas les dates**.
`updateStatus` ne touche que `statut`.

**Forme actuelle d'`updateInfosSejour` (le défaut à réparer en même temps)** — 3 écritures
**non transactionnelles** puis I/O :
1. `sejour.update` (dates + client + effectifs) — l.1434
2. propagation CRM Client (déjà try/catch non bloquant) — l.1454+
3. `demandeDevis.update` (titre + dates de la demande active) — l.1505
4. email organisateur `sendGenericNotification(...).catch(() => {})` — non awaité
5. `return updated`

Un crash entre 1 et 3 = séjour et demande avec des dates divergentes (même classe de défaut
que les blocs signature 4b). Le Lot 5 répare ça au passage — enveloppement + cascade dans
la même `$transaction`.

**DTO** : `dateDebut`/`dateFin` sont `@IsOptional() @IsDateString()` → `null` est rejeté
par class-validator. **Il est donc impossible d'EFFACER des dates par ce chemin** — la
cascade « dates posées → dates nulles » n'existe pas, seul « dates → autres dates » existe
(+ le cas « null → dates » : séjour « à définir » qui reçoit ses dates).

**`softDeleteSejour` (sejour.service.ts:1235-1295)** : gardes factures/devis engageants,
puis `$transaction([devis.deleteMany, sejour.update deletedAt])`, puis
`syncOccupationsSejourSafe(sejourId, 'sejour.softDeleteSejour')` (site 11, effet 4a =
rétrogradation OPTION), puis log CRM. Les occupations **survivent** au soft-delete
aujourd'hui (lignes fantômes, stock libéré mais bruit en grille malgré le filtre
d'affichage `deletedAt` du GET grille).

**Aucun spec n'instancie `CollaborationService`** (grep) → l'ajout d'une dépendance
constructor ne casse aucun test. Baseline : **287 verts**.

---

## 2. Design du re-datage — règle A (actée 22/07)

Nouvelle méthode dans `occupations.service.ts` (exportée par `ChambresModule`) :

```ts
async redaterOccupationsSejour(
  sejourId: string,
  anciennes: { debut: Date; fin: Date } | null,
  nouvelles: { debut: Date; fin: Date },
  tx: Prisma.TransactionClient,   // OBLIGATOIRE ici — cascade = même tx que l'update séjour
): Promise<{ redatees: number; passeesAReplacer: number; nonSuivies: number }>
```

Règles, dans l'ordre :

1. **Suivent** : les seules occupations `source='SEJOUR'` du séjour dont
   `[dateDebut, dateFin) == [anciennes.debut, anciennes.fin)` (les « plage complète »,
   seul cas que l'UI V1 crée). **Ne suivent pas** : les sous-périodes custom (dates ≠
   anciennes dates du séjour, posées via PATCH ou POST à dates explicites) — intactes,
   comptées `nonSuivies`, signalées par log `[redatage]` (la grille les montre de toute
   façon ; pas de nouveau canal d'alerte en V1).
2. **`anciennes = null`** (séjour « à définir » qui reçoit ses dates) : par construction
   aucune occupation « plage complète » n'existe (le POST exige des dates explicites sur
   un séjour sans dates) → **no-op**, `nonSuivies` = count. Cohérent avec la règle 1.
3. **Statuts au re-datage** :
   - `OPTION` → update dates, statut inchangé (une option ne bloque rien, rien à vérifier).
   - `FERME` → update dates + re-vérification `chevauchementsFermes` aux NOUVELLES dates
     (en excluant les occupations du même séjour — elles bougent ensemble) dans la même
     tx + filet `isConflitExclusion` (23P01) : conflit → **`A_REPLACER`** (D6 : jamais de
     refus du changement de dates, jamais de suppression silencieuse).
   - `A_REPLACER` → update dates, **reste `A_REPLACER`** (D8 : la résolution est un geste
     manuel uniquement — le re-datage ne « re-tente » pas la place ; si le conflit a
     disparu aux nouvelles dates, le PATCH de résolution existant aboutira du premier coup).
   - `BLOCAGE` → **jamais touché** (pas de `sejourId`, hors périmètre par construction).
4. Après le re-datage, **`syncOccupationsSejour(sejourId, tx)`** dans la même tx —
   premier usage réel du paramètre `tx?` préparé en 4a, exactement l'usage auquel il était
   réservé (`run-chambres-4b.md` §1). Idempotent, recale la dérivation FERME/OPTION si
   l'état des devis a bougé entre-temps.

**Réponse HTTP d'`updateInfosSejour` : INCHANGÉE** (`return updated`) — le frontend
existant la consomme telle quelle, on ne casse pas le contrat. La visibilité des
`A_REPLACER` nés du re-datage passe par les surfaces existantes (grille + alertes page
séjour). Amélioration possible plus tard (toast récapitulatif), hors V1.

---

## 3. Refactor `updateInfosSejour` — frontière de la transaction

Calqué sur le gabarit 4b (Lot 2, remontée de valeur) :

```
AVANT tx : findUnique + gate hébergeur (inchangés), capture anciennesDates
tx = $transaction(async (tx) => {
  updated = tx.sejour.update({ ... })                      // écriture 1
  si demande active : tx.demandeDevis.update({ ... })      // écriture 3 (remontée dans la tx)
  si dto.dateDebut/dateFin fournis ET dates effectivement changées :
    redaterOccupationsSejour(sejourId, anciennes, nouvelles, tx)
    syncOccupationsSejour(sejourId, tx)
  return updated
})
APRÈS commit, HORS tx : propagation CRM Client (try/catch existant, inchangé),
email organisateur (.catch(() => {}), inchangé), return updated
```

- Garde « dates effectivement changées » : comparer valeurs, pas seulement présence dans
  le dto (le front renvoie souvent tout le formulaire) — évite un re-datage no-op à chaque
  édition du nom du client.
- La propagation CRM lit `updated` → elle reste APRÈS commit (elle est déjà non bloquante).
- D12 non concerné ici : c'est un geste hébergeur, pas une signature — si la tx échoue,
  le 500 est légitime (rien n'a bougé, atomicité = le but).

---

## 4. `softDeleteSejour` — suppression effective des occupations

Dans la `$transaction` existante (forme tableau, elle reste en tableau) :

```ts
await this.prisma.$transaction([
  this.prisma.occupationChambre.deleteMany({ where: { sejourId } }),   // NOUVEAU
  this.prisma.devis.deleteMany({ where: devisSejourWhere }),
  this.prisma.sejour.update({ where: { id: sejourId }, data: { deletedAt: new Date() } }),
]);
```

- Les `AffectationChambre` suivent par FK `onDelete: Cascade` (niveau DB) — un séjour
  supprimé n'a plus de rooming, cohérent avec le DELETE occupation du 4a (§2.4 : voulu).
- **Retrait de l'appel site 11** (`syncOccupationsSejourSafe` post-tx, l.1284) : après le
  deleteMany il n'y a plus rien à synchroniser — l'appel devient un no-op garanti, on le
  retire avec son commentaire. ⚠️ **Amendement doc archi §3.1 à faire au commit** : le
  tableau « 11 sites » passe à 10 sites actifs (site 11 remplacé par la cascade Lot 5).
- Le filtre d'affichage `deletedAt` de la grille (amendement 4a §2.1) reste — il couvre
  la fenêtre entre un éventuel séjour supprimé AVANT ce déploiement et le nettoyage.
  **Pas de migration de nettoyage** : la prod n'a aujourd'hui aucune occupation (l'UI
  d'attribution n'existe pas encore) — vérifiable par `SELECT count(*) FROM
  occupations_chambre;` avant déploiement, 0 attendu.

---

## 5. Cascade analysis

| Fichier | Nature |
|---|---|
| `chambres/occupations.service.ts` | +1 méthode `redaterOccupationsSejour` (réutilise `chevauchementsFermes` — extension : exclusion par `sejourId` en plus de l'exclusion par occupation) |
| `collaboration/collaboration.module.ts` | `imports: [ChambresModule]` (premier import du module — Email/Prisma/Storage sont `@Global`, aucun autre besoin) |
| `collaboration/collaboration.service.ts` | constructor `+ occupations: OccupationsService` ; refactor `updateInfosSejour` (frontière tx §3) |
| `sejours/sejour.service.ts` | `softDeleteSejour` : +deleteMany occupations dans la tx, −appel site 11 |
| `chambres/occupations.service.spec.ts` | +tests §6 |
| `docs/ARCHITECTURE_MODULE_CHAMBRES.md` | §3.1 : site 11 → cascade Lot 5 (amendement au commit 3) |

**INTOUCHÉS** : `capacite.*`, `referentiel.*`, les 8 blocs signature (4b Lots 3-4 = autre
session), tous les emails (positions inchangées), frontend, DTOs (aucun changement de
contrat), `syncOccupationsSejour` lui-même (seul un nouvel APPELANT avec `tx`).

**Risques** : circularité modules — `ChambresModule` n'importe que `AuthModule` (vérifié
4a §3.2), `CollaborationModule` n'était importé par personne dans cette chaîne → pas de
cycle. Mock `$transaction` : les nouveaux tests suivent le harnais interactif existant
(`occupations.service.spec.ts:121`, `tx === prisma`) — il ne prouve pas l'atomicité (limite
connue 4b §2bis), il prouve la LOGIQUE (qui suit, qui passe A_REPLACER, qui est intact).

---

## 6. Tests (`occupations.service.spec.ts`, baseline 287)

1. **Nominal** : 2 occupations plage complète (1 OPTION, 1 FERME sans conflit aux
   nouvelles dates) → les deux re-datées, statuts conservés.
2. **Conflit au re-datage** : FERME re-daté sur un FERME d'un autre séjour → `A_REPLACER`,
   l'update des dates aboutit quand même (D6), `passeesAReplacer: 1`.
3. **Rotation du samedi** : nouvelles dates `fin A = début B` → PAS un conflit (demi-ouvert).
4. **Sous-période custom** : dates ≠ anciennes dates séjour → intacte, `nonSuivies: 1`.
5. **A_REPLACER** : re-daté, reste `A_REPLACER` (D8 — pas de re-tentative).
6. **BLOCAGE** : jamais touché (même chambre, même centre).
7. **`anciennes = null`** : no-op, `nonSuivies` = count des occupations existantes.
8. **Exclusion même séjour** : 2 FERME du même séjour sur 2 chambres → re-datage des deux
   sans se voir mutuellement en conflit.
9. **Filet 23P01** : mock rejet exclusion sur l'update FERME → `A_REPLACER` (2 formes du
   message, pattern 4a).
10. **Soft-delete** : deleteMany occupations présent dans la tx (assertion sur l'ordre
    des opérations du tableau), appel site 11 absent.

---

## 7. Plan des commits (Phase 2, après feu vert)

1. `feat(chambres-lot5): redaterOccupationsSejour + tests` — méthode + extension helper +
   tests 1-9. Gates : tsc 0 · build · ≥287 verts.
2. `feat(chambres-lot5): updateInfosSejour transactionnel + cascade dates (D6)` —
   module + constructor + frontière tx §3. Gates identiques.
3. `feat(chambres-lot5): suppression occupations au soft-delete + retrait site 11` —
   §4 + test 10 + amendement doc archi §3.1. Gates identiques.

**Interdits** : pas de push (review Théo), pas de changement de contrat HTTP, pas de
frontend, pas de `migrate dev` (aucune migration — zéro DDL dans ce lot), blocs signature
4b intouchés, un seul CC backend à la fois.

---

## 8. Livraison (Phase 2, 22/07/2026) — LIVRÉ, rien reverté

| Commit | Contenu | Gates |
|---|---|---|
| `cdfbb93` | `redaterOccupationsSejour` (règle A) + extension `chevauchementsFermes` (`exclureSejourId`) + tests 1-9 | tsc 0 · build OK · **297** verts |
| `ea5ee6b` | `updateInfosSejour` transactionnel (séjour + demande + cascade dans une `$transaction`) + import `ChambresModule` + injection `OccupationsService` | tsc 0 · build OK · 297 verts |
| `6d43f2e` | soft-delete : `occupationChambre.deleteMany` dans la tx + retrait site 11 + test 10 + amendement doc §3.1 | tsc 0 · build OK · **298** verts |

Baseline 287 → 298 (montée = tests ajoutés, zéro rouge). Isolation du staging propre
(D13/D14 préexistants laissés unstaged, session state / roadmap non touchés).
Review croisée Claude sur les diffs réels des 3 commits — conforme au plan.

### ⚠️ Limite connue (relevée en review croisée, ACCEPTÉE pour ce push)

**Le filet 23P01 est du code mort à l'intérieur d'une tx interactive** — dans
`redaterOccupationsSejour` ET dans `syncOccupationsSejour` appelé avec `tx` : une
violation d'exclusion met la transaction Postgres en état *aborted*, le
`update → A_REPLACER` du catch échoue (25P02), la tx entière rollback → 500 pour
l'hébergeur. Le pattern marchait en 4a parce que le sync tournait HORS tx (updates =
tx implicites). **Pas de corruption possible** (rollback = atomicité préservée ; au
retry, le check applicatif voit le FERME gagnant et pose l'A_REPLACER proprement).
Fenêtre : course check→update entre deux écrivains concurrents sur la même chambre —
quasi nulle (prod à zéro occupation ce jour). **Fix futur si besoin** : pattern
« retry complet » du POST 4a — retirer le catch interne dans le chemin tx, laisser
remonter, rejouer UNE fois la transaction entière depuis `updateInfosSejour`.

### Backlog né du run

- **Hygiène** : `SejourService` conserve une injection `occupations` désormais inutilisée
  (seul usage = ex-site 11) + l'import `ChambresModule` de `SejoursModule` qui va avec —
  à retirer ENSEMBLE dans un lot d'hygiène ultérieur (hors périmètre validé de ce run).
- **Filet 23P01 en tx** : cf. limite connue ci-dessus (retry complet au niveau appelant).
