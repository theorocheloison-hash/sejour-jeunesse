# RUN CHAMBRES 5.1 — Retours de recette référentiel — Plan (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — **Statut : EN ATTENTE DE VALIDATION THÉO.** Aucune écriture.
> Sources lues : `referentiel.service.ts` + `dto/`, `referentiel.service.spec.ts`,
> `schema.prisma` (Chambre + pattern `CentreHebergement.equipements`),
> `centres/dto/update-centre.dto.ts` + `centre.service.ts:1261` (pattern `{ set: [...] }`),
> `frontend/app/dashboard/hebergeur/parametres/chambres/page.tsx` (page + modal run 5),
> `frontend/src/lib/chambres.ts`, `profil/page.tsx` (chips équipements centre),
> migrations `TEXT[]` existantes (`20260326_add_centre_catalogue_fields`).
> ⚠️ **Baseline réelle : 282 tests verts** (le prompt dit 281 — le test de régression du
> fix nit `ada42b6` s'est ajouté depuis).

---

## A. BUG ordre (violation D13)

### A.1 Diff `createChambre`

L'attribution passe en transaction interactive : lecture du max puis create — deux
créations concurrentes ne peuvent produire un doublon d'ordre qu'à la marge (sans
contrainte unique, un doublon est bénin : le tri retombe sur `nom` entre égaux).

```ts
// createChambre — ordre = dto.ordre ?? max(centre) + 1, dans la transaction.
return this.prisma.$transaction(async (tx) => {
  const ordre =
    dto.ordre ??
    (((await tx.chambre.aggregate({
      where: { centreId: centre.id },
      _max: { ordre: true },
    }))._max.ordre ?? -1) + 1);
  const chambre = await tx.chambre.create({ data: { …, ordre, … }, include: LITS_INCLUDE });
  return this.mapChambre(chambre);
});
```

- `dto.ordre` explicite reste prioritaire (le DTO l'a toujours accepté ; le modal ne
  l'envoie pas).
- `?? -1` : premier ordre attribué = 0 (aligné sur le défaut historique).
- **Max par CENTRE, pas par étage** : le tri est `etage, ordre, nom` — un ordre
  supérieur à tout le centre place de toute façon la nouvelle chambre en dernier DANS
  son étage. Plus simple, et la renumérotation aux flèches reste locale au groupe.

### A.2 Diff `dupliquerChambre` (même chemin)

La transaction actuelle (forme tableau) devient interactive : lecture du max, puis les
N copies prennent `max+1, max+2, …` (au lieu de `source.ordre` copié — les copies se
rangent en fin d'étage dans l'ordre de création, plus d'empilement à égalité d'ordre).

### A.3 Migration de backfill — SQL exact

`backend/prisma/migrations/20260721190000_backfill_ordre_chambres/migration.sql` :

```sql
-- Backfill D13 (recette Sauvageon) : les chambres nées ordre=0 se triaient par nom
-- (« Chambre 10 » avant « Chambre 2 »). Renumérotation séquentielle par centre dans
-- l'ordre de création, UNIQUEMENT pour les centres où TOUTES les chambres sont à
-- ordre=0 (bool_and) — un ordre déjà réarrangé aux flèches n'est jamais écrasé.
-- Idempotente : ORDER BY (created_at, id) déterministe ; après passage, un centre
-- multi-chambres sort du filtre bool_and, un centre mono-chambre recalcule 0 → stable.
WITH centres_intacts AS (
  SELECT centre_id
  FROM chambres
  GROUP BY centre_id
  HAVING bool_and(ordre = 0)
),
renumerotees AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY centre_id ORDER BY created_at, id) - 1 AS nouvel_ordre
  FROM chambres
  WHERE centre_id IN (SELECT centre_id FROM centres_intacts)
)
UPDATE chambres c
SET ordre = r.nouvel_ordre
FROM renumerotees r
WHERE c.id = r.id;
```

- Renumérotation **par centre** (`PARTITION BY centre_id`, prompt) : l'ordre relatif
  dans chaque étage est une sous-suite de l'ordre par centre → correct par étage aussi.
- Sauvageon (18 chambres saisies à la chaîne, jamais réarrangées) : toutes à 0 →
  renumérotées 0..17 dans l'ordre de saisie = l'ordre du couloir (le flux « Enregistrer
  et créer la suivante » suit le couloir).

---

## B. Libellés de lits à la création (frontend seul)

Constat : le modal création ne connaît que les compteurs (`compteursVersLits` fabrique
des `{ type }` nus) ; libellés et places fines exigent un second passage en édition.

**Design : la liste détaillée devient LA source de vérité, les compteurs une vue.**

- Nouvel état `litsDetail: CreateLitInput[]` (mode création uniquement) ; les
  compteurs affichés sont **dérivés** (count par type) — plus de double état à
  synchroniser, la synchronisation est structurelle :
  - bouton `+` d'un type → append `{ type }` à la liste ;
  - bouton `−` → retire le **dernier** lit de ce type (avec son éventuel libellé) ;
  - dans la liste dépliée : type/places/libellé éditables par ligne, ✕ par ligne
    (mêmes contrôles que la liste d'édition existante, sans PATCH — tout part au POST).
- Lien discret sous les compteurs : « Détailler les lits (n) » ↔ « Replier » —
  replié par défaut (la saisie rapide Tereva reste le chemin court).
- `creer()` envoie `litsDetail` tel quel (places custom + libellés inclus) — le
  contrat `CreateLitDto` accepte déjà `places`/`libelle`, **zéro changement backend**.
- « Enregistrer et créer la suivante » : recopie types + places de la liste, **PAS les
  libellés** (« lit haut fenêtre » dupliqué 18 fois serait un mensonge).
- Capacité prévisionnelle : Σ `places ?? défaut du type` (aujourd'hui : compteurs ×
  défauts — devient exacte si places éditées).

---

## C. Équipements par chambre

### C.1 Migration additive + schema

`backend/prisma/migrations/20260721190000_…` (même dossier que le backfill A — une
seule migration pour le run, les deux ALTER sont indépendants) :

```sql
-- Équipements par chambre (recette Sauvageon) — pattern CentreHebergement.equipements.
ALTER TABLE "chambres" ADD COLUMN "equipements" TEXT[] DEFAULT ARRAY[]::TEXT[];
```

`schema.prisma`, sur `Chambre` après `notes` : `equipements String[] @default([])`
(copie du pattern `CentreHebergement.equipements`, ligne 606).

### C.2 CRUD backend

- `CreateChambreDto` + `UpdateChambreDto` : `@IsOptional() @IsArray()
  @IsString({ each: true }) @ArrayMaxSize(20) @MaxLength(50, { each: true })
  equipements?: string[]` — le DTO centre n'a pas de bornes ; je les ajoute ici
  (défensif : la saisie libre est ouverte, 20×50 couvre tout cas réel).
- `createChambre` : `equipements: dto.equipements ?? []` ; `updateChambre` :
  `...(dto.equipements !== undefined ? { equipements: { set: dto.equipements } } : {})`
  (pattern exact `centre.service.ts:1261`) ; `dupliquerChambre` copie
  `source.equipements` ; `mapChambre` + type `ChambreAvecLits` exposent le champ.

### C.3 Frontend

- `lib/chambres.ts` : `Chambre.equipements: string[]`,
  `CreateChambreInput/UpdateChambreInput.equipements?: string[]`.
- Modal (création ET édition) : chips à cocher, pattern exact des checkboxes
  équipements du profil centre (`toggleEquipement`), en grille compacte + **saisie
  libre** : input « Autre équipement… » + Entrée → chip cochée ; les valeurs serveur
  hors liste fixe s'affichent comme chips cochées (jamais perdues).
- Liste fixe V1 (prompt) :
  `Salle de bain, WC privés, Douche, Lavabo, TV, Climatisation, Sèche-cheveux, Balcon, Terrasse, PMR, Mezzanine`.
- Carte chambre : badges gris compacts sous le résumé lits (3 premiers + « +n » —
  la carte fait 230px, la liste complète vit dans le modal).
- L'édition envoie TOUJOURS `equipements` au PATCH (liste complète recalculée —
  sémantique `{ set }`).

---

## Cascades repérées

1. **`referentiel.service.spec.ts` à adapter** (harnais, pas les invariants) : les
   tests création/duplication mockent `$transaction` en **forme tableau**
   (`Promise.all(ops)`) et n'ont pas d'`aggregate` — le passage aux transactions
   interactives casse ces mocks. Le harnais gagne `chambre.aggregate` +
   `$transaction(callback)` ; l'assertion « duplication = 1 seule transaction »
   (l.176) reste et protège le nouveau chemin.
2. **Baseline 282** (pas 281) — à préserver, + nouveaux tests A/C.
3. Frontend : `mapChambre` s'enrichit → `Chambre` type + carte + modal touchés, rien
   d'autre (la grille run 6 n'existe pas encore ; `occupations.*`/`capacite.*`
   interdits et non concernés).
4. `equipements` du CENTRE (catalogue/public/hebergement.service) : homonyme, aucun
   partage de code — aucun impact.
5. L'ordre auto rend « Enregistrer et créer la suivante » fidèle au couloir sans
   retouche aux flèches — comportement voulu D13, aucun code front à changer pour A.

## Phase 2 — commits prévus

1. `fix(chambres-5.1): ordre auto création/duplication + backfill + equipements (backend)`
   — migration (A.3 + C.1), schema, service, DTOs, tests (ordre auto au create, ordre
   séquentiel à la duplication, dto.ordre prioritaire, equipements create/update/
   duplication/mapping, harnais spec adapté). Gates backend.
2. `feat(chambres-5.1): détail des lits à la création + équipements chambre (frontend)`
   — modal (B + C.3), carte, `lib/chambres.ts`. Gates frontend.

## Points à trancher

1. **Une seule migration** pour A.3 + C.1 (deux ALTER indépendants, un seul run) — ou
   deux dossiers séparés ?
2. **Bornes DTO equipements** (20 items × 50 chars) là où le centre n'en a pas — ok ?
3. **« Créer la suivante »** recopie types+places mais pas les libellés — ok ?
4. **Carte chambre** : 3 chips + « +n » (pas la liste complète) — ok ?

---

## Livraison (Phase 2, 21/07/2026) — LIVRÉ, rien reverté

| Commit | Contenu | Gates |
|---|---|---|
| `4941c61` | backend A+C : migration unique (DDL equipements puis backfill ordre), ordre auto création/duplication en tx interactive, equipements CRUD, DTOs bornés, harnais spec adapté | tsc OK, build OK, **282 → 287 tests** |
| `f5dbded` | frontend B+C : liste de lits source de vérité + « Détailler les lits », chips équipements + saisie libre, badges 3+n sur la carte | tsc OK, build OK |

Notes : les 4 arbitrages GO appliqués tels quels. Bonus assumé (cohérence
« saisie à la chaîne ») : « Enregistrer et créer la suivante » recopie AUSSI les
équipements (en plus des types+places). PAS de push (review Théo — la migration
backfill partira au prochain déploiement).
