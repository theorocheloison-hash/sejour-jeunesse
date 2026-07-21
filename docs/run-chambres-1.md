# RUN CHAMBRES 1/8 + 2/8 — Plan d'implémentation (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — Phase 1 du run CC « migration module chambres + étage capacité globale (backend seul) ».
> **Statut : VALIDÉ PAR THÉO le 21/07/2026** — les 5 points du §8 sont actés (A « signé » avec
> SOUMIS_RECTORAT inclus, B empreinte avec la colonne `capacite_alerte_situation`, pas de
> relation inverse Sejour↔AffectationChambre, nuitées demi-ouvertes, permission `sejours` sans
> gate de plan). Consignes ajoutées à la validation : (1) référencer les constantes existantes
> (`STATUTS_SEJOUR_CONFIRMES`), jamais de liste locale de statuts ; (2) l'empreinte couvre
> capacité centre + effectif/dates de l'option + ensemble trié (id, effectif, dates) des signés
> chevauchants ; (3) note étage 2 ci-dessous (§3, encadré RETENUS).
> Sources lues intégralement : `docs/ARCHITECTURE_MODULE_CHAMBRES.md`, `schema.prisma`
> (Sejour, CentreHebergement, AutorisationParentale, AccompagnateurMission, Devis, DemandeDevis,
> enums), `centre.helper.ts`, `sejour-statuts.constants.ts`, `devis-statuts.constants.ts`,
> `rentabilite/` (structure module + spec), `pilotage.service.ts` (getRemplissage),
> `sejour.service.ts` (createDirect, creerDepuisCatalogue, softDeleteSejour, updateStatus),
> `devis.service.ts` (sites de transition), migrations récentes (conventions DDL).

---

## 1. Migration SQL — contenu exact

**Dossier** : `backend/prisma/migrations/20260721120000_module_chambres/migration.sql`
(convention relevée : `YYYYMMDDHHMMSS_nom`, cf. `20260714120000_tva_sur_marge`,
`20260718120000_multi_photos_catalogue`). Migration manuelle, appliquée par
`prisma migrate deploy` au boot Scalingo — **jamais** `prisma migrate dev`.

Conventions DDL calquées sur les migrations Prisma existantes (`20260625_add_facture_liavo`) :
UUID sans default DB (générés côté client par Prisma), `TIMESTAMP(3)`, `updated_at` NOT NULL
sans default, FK nommées `<table>_<col>_fkey`, index nommés `<table>_<cols>_idx`/`_key`.

```sql
-- Module chambres (Monde 1) — référentiel physique + primitive d'occupation datée.
-- Réf : docs/ARCHITECTURE_MODULE_CHAMBRES.md §2. Étage 1 (capacité globale) : flag D10 sur sejours.

-- D2 : l'exclusion de chevauchement (uuid WITH =) exige btree_gist.
-- Vérifié en prod le 21/07 : extension 1.7 disponible, CREATE testé en BEGIN/ROLLBACK.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "chambres" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "etage" VARCHAR(50),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chambres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lits" (
    "id" UUID NOT NULL,
    "chambre_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "places" INTEGER NOT NULL DEFAULT 1,
    "libelle" VARCHAR(50),
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupations_chambre" (
    "id" UUID NOT NULL,
    "chambre_id" UUID NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "statut" VARCHAR(12) NOT NULL DEFAULT 'OPTION',
    "sejour_id" UUID,
    "motif" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupations_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_chambre" (
    "id" UUID NOT NULL,
    "occupation_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "autorisation_id" UUID,
    "accompagnateur_id" UUID,
    "lit_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectations_chambre_pkey" PRIMARY KEY ("id")
);

-- AlterTable — flag D10 (acquittement daté « prévenu, gardé en attente »)
ALTER TABLE "sejours" ADD COLUMN "capacite_alerte_acquittee_at" TIMESTAMP(3);
-- Empreinte de la situation acquittée (réarmement, option B — cf. run-chambres-1.md §4)
ALTER TABLE "sejours" ADD COLUMN "capacite_alerte_situation" VARCHAR(64);

-- CreateIndex
CREATE INDEX "chambres_centre_id_idx" ON "chambres"("centre_id");
CREATE INDEX "lits_chambre_id_idx" ON "lits"("chambre_id");
-- Support du FK composite d'affectations_chambre (un index unique suffit à PostgreSQL)
CREATE UNIQUE INDEX "occupations_chambre_id_sejour_id_key" ON "occupations_chambre"("id", "sejour_id");
CREATE INDEX "occupations_chambre_chambre_id_date_debut_idx" ON "occupations_chambre"("chambre_id", "date_debut");
CREATE INDEX "occupations_chambre_sejour_id_idx" ON "occupations_chambre"("sejour_id");
CREATE UNIQUE INDEX "affectations_chambre_sejour_id_autorisation_id_key" ON "affectations_chambre"("sejour_id", "autorisation_id");
CREATE UNIQUE INDEX "affectations_chambre_sejour_id_accompagnateur_id_key" ON "affectations_chambre"("sejour_id", "accompagnateur_id");
CREATE INDEX "affectations_chambre_occupation_id_idx" ON "affectations_chambre"("occupation_id");

-- AddForeignKey
ALTER TABLE "chambres" ADD CONSTRAINT "chambres_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lits" ADD CONSTRAINT "lits_chambre_id_fkey" FOREIGN KEY ("chambre_id") REFERENCES "chambres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Restrict : le rooming d'un séjour passé est une donnée — on désactive (actif=false), on ne détruit pas.
ALTER TABLE "occupations_chambre" ADD CONSTRAINT "occupations_chambre_chambre_id_fkey" FOREIGN KEY ("chambre_id") REFERENCES "chambres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "occupations_chambre" ADD CONSTRAINT "occupations_chambre_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- FK composite : impossible EN BASE d'affecter un participant sur l'occupation d'un AUTRE séjour.
-- MATCH SIMPLE + sejour_id NOT NULL côté affectation ⇒ une occupation BLOCAGE (sejour_id NULL)
-- ne peut porter aucune affectation.
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_occupation_id_sejour_id_fkey" FOREIGN KEY ("occupation_id", "sejour_id") REFERENCES "occupations_chambre"("id", "sejour_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_autorisation_id_fkey" FOREIGN KEY ("autorisation_id") REFERENCES "autorisations_parentales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_accompagnateur_id_fkey" FOREIGN KEY ("accompagnateur_id") REFERENCES "accompagnateurs_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_lit_id_fkey" FOREIGN KEY ("lit_id") REFERENCES "lits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── SQL inexprimable en Prisma (doc §2.2, copie conforme) — les 5 contraintes ──
ALTER TABLE "occupations_chambre"
  ADD CONSTRAINT "occupation_dates_valides" CHECK ("date_fin" > "date_debut"),
  ADD CONSTRAINT "occupation_statut_valide" CHECK ("statut" IN ('OPTION','FERME','A_REPLACER')),
  ADD CONSTRAINT "occupation_sejour_coherent" CHECK (
    ("source" = 'SEJOUR' AND "sejour_id" IS NOT NULL) OR
    ("source" <> 'SEJOUR' AND "sejour_id" IS NULL)
  ),
  -- La règle d'or (D2) : exclusion des seules occupations FERMES — [debut, fin) demi-ouvert,
  -- le jour de départ est libre (rotation des samedis).
  ADD CONSTRAINT "occupation_non_chevauchement" EXCLUDE USING gist (
    "chambre_id" WITH =,
    daterange("date_debut", "date_fin", '[)') WITH &&
  ) WHERE ("statut" = 'FERME');

ALTER TABLE "affectations_chambre"
  ADD CONSTRAINT "affectation_cible_xor" CHECK (
    ("autorisation_id" IS NOT NULL)::int + ("accompagnateur_id" IS NOT NULL)::int = 1
  );
```

**Écart annoncé vs prompt du run** : une 2ᵉ colonne sur `sejours`
(`capacite_alerte_situation VARCHAR(64)`) — conséquence de la recommandation §4 (option B).
Si Théo tranche pour l'option A, cette ligne saute et la migration est strictement conforme
au prompt.

**Vérification de fiabilité prévue en Phase 2** : le DDL des 4 tables sera regénéré par
`npx prisma migrate diff --from-schema-datamodel <schema HEAD> --to-schema-datamodel <schema modifié> --script`
(aucune connexion DB) et comparé à ce fichier — le SQL §2.2 restant ajouté à la main.
Toute divergence sera alignée sur la sortie de `migrate diff` (c'est elle qui fait foi pour la
partie exprimable en Prisma, sinon `prisma migrate deploy`/`db pull` divergeraient du schéma).

### schema.prisma (COMMIT 1)

Les 4 modèles du doc §2.1 **copie conforme**, plus les relations inverses :

| Modèle existant | Ajout |
|---|---|
| `Sejour` | `capaciteAlerteAcquitteeAt DateTime? @map("capacite_alerte_acquittee_at")` + `capaciteAlerteSituation String? @map("capacite_alerte_situation") @db.VarChar(64)` (option B) + `occupationsChambre OccupationChambre[]` + `affectationsChambre AffectationChambre[]` |
| `CentreHebergement` | `chambres Chambre[]` |
| `AutorisationParentale` | `affectationsChambre AffectationChambre[]` |
| `AccompagnateurMission` | `affectationsChambre AffectationChambre[]` |

Le `@@unique([id, sejourId])` d'`OccupationChambre` est le support Prisma du FK composite ;
la contrainte EXCLUDE, les CHECK et le caractère composite du FK vivent dans le SQL manuel
(Prisma sait déclarer `fields: [occupationId, sejourId]` → il génère bien le FK composite,
mais EXCLUDE/CHECK restent inexprimables).

⚠️ `AffectationChambre.sejour` : le doc §2.1 ne déclare **pas** de relation
`sejour Sejour @relation(...)` sur AffectationChambre (le `sejourId` est porté par le FK
composite vers l'occupation, pas par un FK direct vers `sejours`). On s'y tient — la relation
inverse `Sejour.affectationsChambre` passe par… rien côté Prisma si aucun champ relation
n'existe. **Correctif nécessaire** : Prisma exige un champ relation pour exposer l'inverse.
Deux écritures possibles, sans changer le SQL :
soit on n'ajoute PAS `affectationsChambre` sur Sejour en V1 (les requêtes passent par
`occupation.affectations`), soit on déclare la relation `sejour` non-FK impossible en Prisma.
**Choix retenu : pas de relation inverse Sejour↔AffectationChambre en V1** — le chemin
`sejour → occupationsChambre → affectations` suffit et reste fidèle au SQL. (Le doc §2.1 dit
« relations inverses sur Sejour » : satisfait pour `occupationsChambre` ; `affectationsChambre`
n'est pas représentable sans FK direct redondant — à confirmer en revalidation.)

---

## 2. Choix du module — `backend/src/chambres/` (nouveau)

**Recommandation : nouveau module `chambres`**, pas `sejours`.

- Les sous-chantiers 3 (référentiel CRUD) et 4 (occupations, grille, sync) vivront là de toute
  façon — l'étage 1 est l'« étage bas » du même système de conflit (doc §4), pas une feature
  séjour.
- `sejour.service.ts` fait déjà ~2 400 lignes ; y loger un domaine neuf recréerait le monolithe
  qu'on découpe partout ailleurs (précédent : `rentabilite/` module autonome, petit, importe
  `AuthModule`).
- Le seul écrit côté séjour (2 colonnes d'acquittement) ne justifie pas la localisation : le
  calcul, lui, est 100 % centre/capacité.

Fichiers (COMMIT 2) — structure calquée sur `rentabilite/` :

```
backend/src/chambres/
  chambres.module.ts        // imports: [AuthModule] — providers/exports: CapaciteService
  capacite.controller.ts    // @Controller('chambres') + guards JwtAuthGuard, RolesGuard, PermissionGuard
  capacite.service.ts
  capacite.service.spec.ts  // COMMIT 3
```

`app.module.ts` : + `ChambresModule` dans imports.

**Permission** : `@RequirePermission('sejours')` (clés existantes : parametres/planning/crm/
sejours/devis/facturation — l'alerte porte sur des séjours, et les endpoints séjour hébergeur
de `collaboration.controller` utilisent déjà `sejours`). **Pas de `@RequirePlan`** : l'étage 1
protège les signatures (D9), ce n'est pas une feature Pilotage — le prompt du run ne gate que
par rôle HEBERGEUR.

---

## 3. Définition de « séjour signé » (étage 1) — décision

### Options

**A — `Sejour.statut ∈ STATUTS_SEJOUR_CONFIRMES`** (constante existante : CONVENTION,
SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM).
- ✅ **Cohérence hébergeur** : `pilotage.getRemplissage` calcule l'occupation avec exactement
  ce filtre (`hebergementSelectionneId + STATUTS_SEJOUR_CONFIRMES + deletedAt: null`, effectif
  `placesTotales + nombreAccompagnateurs ?? 0`). L'alerte capacité et le taux de remplissage
  racontent le même monde — deux définitions divergentes = deux chiffres inexplicables côté UI.
- ✅ Couvre `creerDepuisCatalogue` (`sejour.service.ts:91`) : un séjour né du catalogue est créé
  **directement en CONVENTION sans aucun devis signé** — la dérivation par devis le classerait
  « pas signé » alors que, métier, il consomme la capacité.
- ✅ Couvre SOUMIS_RECTORAT/DECLARE_TAM (convention déjà signée, plus de devis « en cours »).
- ✅ Une requête simple, index `@@index([statut])` existant.
- ❌ Le statut séjour peut dériver (5 blocs devis+séjour non transactionnels, cicatrice « 3×
  Signé direction ») — mais la dérive est corrigée à la racine par le sous-chantier 4, et la
  dégradation est douce : un séjour sous-évalué = une alerte manquée/en trop, pas de corruption.

**B — dérivation par devis** : ∃ devis non-complémentaire du séjour ∈ `STATUTS_DEVIS_ENGAGEANTS`.
- ✅ Aligné sur le pseudo-code `syncOccupationsSejour` (doc §3.2) ; insensible à la dérive du
  statut séjour.
- ❌ Rate `creerDepuisCatalogue` (CONVENTION sans devis) — trou métier réel.
- ❌ Statuts legacy : avant le Lot 1 facture, des devis prod ont muté en `FACTURE_ACOMPTE`/
  `FACTURE_SOLDE` (hors ENGAGEANTS) → leurs séjours seraient comptés « pas signés ». Il faudrait
  `STATUTS_DEVIS_RETENUS`, divergeant du §3.2 qu'on prétend suivre.
- ❌ Requête double jointure (`sejourDirectId` OU `demande.sejourId`), et un chiffre
  incohérent avec le remplissage Pilotage.

**C — combinaison (A OU B)** : ceinture-bretelles.
- ✅ Couvre la dérive ET le catalogue.
- ❌ Deux sources de vérité fondues = sémantique floue, plus de code et de tests pour couvrir
  un cas (la dérive) que le sous-chantier 4 supprime ; contraire à la ligne « une constante par
  intention » de `sejour-statuts.constants.ts`.

### ✅ Recommandation : **option A** — `STATUTS_SEJOUR_CONFIRMES`

Et l'asymétrie avec l'étage 2 est **assumée et documentée** : étage 1 = « qui a réservé sa
place au centre » (statut séjour, comme le remplissage) ; étage 2 = « qui a verrouillé des
chambres » (devis engageant, via `syncOccupationsSejour`, sous-chantier 4). Un séjour catalogue
en CONVENTION consomme la capacité globale dès sa création (correct : l'enseignant s'est
engagé) même si ses occupations chambres resteront OPTION jusqu'à signature du devis.

> ⚠️ **Note pour le sous-chantier 4 (hors périmètre de ce run, actée par Théo le 21/07)** :
> la dérivation de l'étage 2 (`syncOccupationsSejour`) devra utiliser **`STATUTS_DEVIS_RETENUS`**
> et non `STATUTS_DEVIS_ENGAGEANTS` comme l'écrit le pseudo-code du doc archi §3.2 — même motif
> legacy que l'analyse de l'option B ci-dessus : des devis prod antérieurs au Lot 1 facture
> portent `FACTURE_ACOMPTE`/`FACTURE_SOLDE` (hors ENGAGEANTS) ; leurs occupations seraient
> rétrogradées OPTION alors que le séjour est facturé.

**Côté « options » candidates à l'alerte** : `statut = OPTION` + `hebergementSelectionneId =
centre.id` + `deletedAt: null` + dates non nulles. (OPTION est le seul statut pré-signature
rattaché à un centre : `createDirect` naît en OPTION, `annulerDevis` rétrograde en OPTION ;
DRAFT/SUBMITTED n'ont pas de `hebergementSelectionneId`. `natureSejour` EVENEMENT inclus —
un mariage consomme des lits comme une colo.)

---

## 4. Mécanique de réarmement — décision

Principe D10 : *un acquittement ne vaut que pour la situation acquittée*. Le réarmement est
**dérivé au read** (aucun cron, aucun événement) : l'alerte d'un séjour acquitté redevient
active si la situation a changé depuis l'acquittement.

### Options

**A — comparaison `capaciteAlerteAcquitteeAt` vs `updatedAt` des séjours impliqués**
(l'esquisse du doc §4). Réarmé si un séjour impliqué (l'option ou un signé chevauchant) a
`updatedAt > capaciteAlerteAcquitteeAt`.
- ✅ Zéro colonne supplémentaire, migration strictement conforme au prompt.
- ❌ **Faux réarmements structurels** : `updatedAt` bouge sur N'IMPORTE QUELLE écriture —
  chaque inscription décrémente `placesRestantes`, chaque note interne, chaque édition client
  touche `updatedAt`. En saison (les signatures parentales tombent pendant des semaines),
  chaque acquittement serait invalidé en boucle → l'hébergeur ré-acquitte sans fin → il apprend
  à ignorer l'alerte → la feature meurt (le sort exact qu'on veut éviter à D9).
- ❌ Faux silence symétrique : un signé annulé **sort** de l'ensemble des chevauchants — son
  `updatedAt` n'est plus consulté, le changement de composition passe inaperçu.

**B — empreinte de situation** : à l'acquittement, stocker
`capaciteAlerteSituation = sha256(JSON canonique de la situation)` avec la situation =
`{ capacite, effectifOption, dates option, signés chevauchants triés par id : [id, effectif, dateDebut, dateFin] }`.
Au read : recomputer l'empreinte courante ; alerte acquittée si `surcapacité ET empreinte
courante = empreinte stockée`, réarmée si `surcapacité ET empreinte ≠`.
- ✅ Sémantique **exacte** de D10 : réarme sur tout changement *réel* (effectifs, dates,
  composition — arrivée OU départ d'un signé —, capacité du centre), jamais sur le bruit.
- ✅ Toujours dérivé au read : aucun job, aucun écouteur, aucun site de transition touché.
- ✅ Le calcul de l'empreinte réutilise le même code que le calcul d'alerte (une fonction pure,
  testable).
- ❌ +1 colonne (`capacite_alerte_situation VARCHAR(64)`), posée/reposée par le PATCH
  d'acquittement, ignorée partout ailleurs. C'est l'écart de migration signalé au §1.

*(Variante B′ écartée : ne stocker que le déficit max acquitté et ne réarmer que si ça
empire — moins de données mais viole le principe « composition change ⇒ réarmement ».)*

### ✅ Recommandation : **option B** — empreinte de situation

L'option A rend l'alerte criarde précisément pendant la période où elle sert (saison des
inscriptions) ; une alerte qu'on ré-acquitte chaque semaine est une alerte morte. Le coût de
B est une colonne nullable inerte hors du couple GET/PATCH.

---

## 5. Service capacité globale — spec d'implémentation (COMMIT 2)

### Calcul (fonction pure + une requête)

```
getAlertesCapacite(userId, centreId):
  centre = getCentreForUser(prisma, userId, centreId)        // centreId EXPLICITE
  options = sejour.findMany({ hebergementSelectionneId: centre.id, statut: OPTION,
                              deletedAt: null, dateDebut/dateFin non nuls })
  signes  = sejour.findMany({ hebergementSelectionneId: centre.id,
                              statut: { in: STATUTS_SEJOUR_CONFIRMES }, deletedAt: null,
                              dateDebut/dateFin non nuls })
  pour chaque option :
    maxSignes = max sur j ∈ [dateDebut, dateFin) de Σ effectif(signés chevauchant j)
    effectif  = placesTotales + (nombreAccompagnateurs ?? 0)
    si maxSignes + effectif > centre.capacite → alerte
      empreinte = hash(situation)
      etat = 'ACTIVE'    si !capaciteAlerteAcquitteeAt ou empreinte ≠ capaciteAlerteSituation
           = 'ACQUITTEE' sinon
```

- **Nuitées demi-ouvertes `[dateDebut, dateFin)`** — alignées sur la convention chambre §2.3 :
  le jour de départ est libre, deux séjours en rotation du samedi ne s'additionnent PAS.
  (Écart assumé avec `overlapDays` du remplissage, qui est inclusif : le remplissage est une
  stat, l'alerte ne doit pas crier faux sur chaque rotation — à confirmer en revalidation.)
- Le max journalier se calcule par balayage des bornes (événements début/fin des signés),
  pas jour par jour — O(n log n), aucune boucle de requêtes (leçon `getTableau`).
- Dates nulles = hors calcul (options ET signés) ; `deletedAt` exclus ; effectifs nuls → 0.
- 2 requêtes exactement (options + signés), plus `getCentreForUser`.

### Endpoints (`capacite.controller.ts`)

| Route | Rôle | Effet |
|---|---|---|
| `GET /chambres/alertes-capacite` (`@CentreId()`) | HEBERGEUR, perm `sejours` | `{ capacite, alertes: [{ sejourId, titre, dateDebut, dateFin, effectif, maxOccupationSignee, deficit, etat, capaciteAlerteAcquitteeAt }] }` — dashboard + page séjour filtrent côté front |
| `PATCH /chambres/alertes-capacite/:sejourId/acquitter` (`@CentreId()`) | HEBERGEUR, perm `sejours` | Vérifie : séjour du centre (`hebergementSelectionneId === centre.id`), non supprimé, statut OPTION, **réellement en surcapacité** (sinon 400 — rien à acquitter). Pose `capaciteAlerteAcquitteeAt = now()` + `capaciteAlerteSituation = empreinte` |

Aucun autre écrivain des 2 colonnes. Aucun branchement dans les transitions devis (interdit —
sous-chantier 4) : le réarmement étant dérivé au read, il n'en a pas besoin — c'est l'argument
décisif pour livrer l'étage 1 AVANT le point dur.

---

## 6. Cascade analysis

**Fichiers touchés (exhaustif)** :

| Fichier | Commit | Nature |
|---|---|---|
| `backend/prisma/migrations/20260721120000_module_chambres/migration.sql` | 1 | nouveau |
| `backend/prisma/schema.prisma` | 1 | +4 modèles, +2 colonnes Sejour, +relations inverses (Centre, Autorisation, Accompagnateur) |
| `backend/src/chambres/{chambres.module,capacite.controller,capacite.service}.ts` | 2 | nouveaux |
| `backend/src/app.module.ts` | 2 | +1 import |
| `backend/src/chambres/capacite.service.spec.ts` | 3 | nouveau |

**Risques sur l'existant** :
- Schéma **purement additif** (tables neuves + colonnes nullables) : aucun code existant ne lit
  ces tables ; `prisma generate` élargit les types sans casser d'appelant (les relations
  inverses sont optionnelles dans les payloads).
- Tests existants (baseline **217 verts**, à confirmer par un `npm test` AVANT le commit 1) :
  tous mockent Prisma → insensibles au schéma. Aucun spec ne référence `chambre|occupation|
  affectation` (vérifié par grep). Risque résiduel ≈ nul.
- **Interdits respectés** : 0 modification des 11 sites de transition devis, 0 frontend,
  0 `prisma migrate dev`, 0 SQL exécuté (la migration s'appliquera au déploiement), 0 push.
- Le dépôt porte des modifs Théo non commitées (`LIAVO_SESSION_STATE.md`,
  `docs/ROADMAP_ETE_2026.md`, `docs/ARCHITECTURE_MODULE_CHAMBRES.md`) : les commits du run
  n'embarqueront **que** les fichiers du tableau ci-dessus.

**Gates à chaque commit** : `npx tsc --noEmit` (0 erreur) + `npm run build` + `npm test`
(≥ baseline verts). `npx prisma generate` doit passer au commit 1.

---

## 7. Tests (COMMIT 3) — `capacite.service.spec.ts`

Style calqué sur `rentabilite.service.spec.ts` (Prisma mocké, factories, invariants nommés) :

1. **Nominal** : 2 signés de 50 + option de 45, capacité 120 → alerte, deficit 25, état ACTIVE.
2. **Chevauchement partiel** : signés décalés — le max journalier prend le pic, pas la somme
   totale ; rotation du samedi (fin A = début B) → PAS d'addition (demi-ouvert).
3. **Pas de surcapacité** → aucune alerte ; PATCH acquitter → 400.
4. **Acquittement** : PATCH pose `capaciteAlerteAcquitteeAt` + empreinte ; GET → ACQUITTEE.
5. **Réarmement** : effectif de l'option change / un signé change de dates / un signé
   disparaît (annulé) / capacité centre change → empreinte ≠ → ACTIVE. Situation identique →
   reste ACQUITTEE (anti-bruit).
6. **Effectifs nuls** : `nombreAccompagnateurs: null` → traité 0, pas de NaN.
7. **Dates nulles** : option sans dates → absente ; signé sans dates → exclu du calcul.
8. **Multi-centre** : séjours d'un autre centre ignorés (cloisonnement) ; centreId explicite
   requis, séjour d'un autre centre au PATCH → 403/404.

---

## 9. Livraison (Phase 2, 21/07/2026) — 3 commits, gates verts à chacun

| Commit | Contenu | Gates |
|---|---|---|
| `246bc4c` | Migration `20260721120000_module_chambres` + schema.prisma (4 modèles, flag D10 + empreinte, relations inverses) | tsc 0 · build OK · 217 verts · prisma generate OK |
| `549db03` | Module `backend/src/chambres/` (CapaciteService + controller) + import app.module | tsc 0 · build OK · 217 verts |
| `a7240a4` | `capacite.service.spec.ts` — 19 tests | tsc 0 · build OK · **236 verts** (217 + 19) + 2 todo |

DDL des tables vérifié conforme à la sortie de
`prisma migrate diff --from-schema HEAD --to-schema courant --script` (correspondance
exacte) ; extension + 5 contraintes ajoutées à la main en queue de migration. **Pas de push**
(review Théo), fichiers non commités de Théo intacts. Écarts vs plan : néant — les points
§8 ont été validés tels quels (+ les 2 consignes de validation intégrées : constantes
partagées assertées dans les tests, empreinte = capacité + effectif/dates option + ensemble
trié des signés chevauchants).

**Restes connus (hors périmètre run)** : frontend alertes (prompt séparé) ; sous-chantiers
3/4 ; note §3 (encadré RETENUS) à reporter dans le prompt du sous-chantier 4.

---

## 8. Points soumis à revalidation avant Phase 2 (✅ tous validés par Théo le 21/07)

1. **§3 option A** (« signé » = `STATUTS_SEJOUR_CONFIRMES`) — dont l'inclusion de
   SOUMIS_RECTORAT (le prompt du run ne citait que CONVENTION/SIGNE_DIRECTION/DECLARE_TAM).
2. **§4 option B** (empreinte) → **+1 colonne** `capacite_alerte_situation` vs le prompt.
3. **§1** : pas de relation Prisma `Sejour.affectationsChambre` (pas de FK direct — chemin via
   occupations), fidèle au SQL du doc §2.1.
4. **§5** : nuitées `[debut, fin)` à l'étage 1 (écart assumé avec l'`overlapDays` inclusif du
   remplissage).
5. **§2** : permission `sejours`, pas de gate de plan.
