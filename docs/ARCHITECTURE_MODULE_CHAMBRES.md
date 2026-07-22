# LIAVO — Architecture module Chambres (Monde 1)

> **Rédigé le 21/07/2026** — Cadrage validé avec Théo, décision par décision.
> **Statut** — Conception close, validée par Théo le 21/07/2026. Aucune ligne de code écrite dans le cadre de ce document.
> **Amendé le 21/07/2026 (post-Phase 1 CC, run 1)** — validé par Théo : dérivation étage 2 par `STATUTS_DEVIS_RETENUS` (§3.2), colonne empreinte `capacite_alerte_situation` + mécanique de réarmement (§2.1, §4), définition « signé » étage 1 = `STATUTS_SEJOUR_CONFIRMES` (§4), retrait de la relation inverse `Sejour.affectationsChambre` (§2.1). Détail des justifications : `docs/run-chambres-1.md`.
> **Fondations vérifiées** : `schema.prisma` intégral, `collaboration.service.ts` (verifyAccess), `centre.helper.ts`, `devis.service.ts` (signature + annulation), `PROSPECT_TEREVA.md`, recensement `git grep` des 9 sites de transition, `btree_gist` **disponible (1.7) et créable en prod** (testé BEGIN/CREATE EXTENSION/ROLLBACK le 21/07 — l'extension n'est PAS installée, elle le sera par la migration du sous-chantier 1).
> **Référence complémentaire** — `docs/commercial/PROSPECT_TEREVA.md` §4 Panier B (plan des chambres = feature financée, généralisable à toute la base Venue360).

---

## 0. Périmètre

**Monde 1** (ce document) :
1. Référentiel physique configuré par l'hébergeur dans son profil : étages → chambres → lits (simple / superposé / tiroir / double / bébé / appoint).
2. Affectation par l'hébergeur des chambres à un séjour, avec cohabitation multi-séjours sur un même centre et cloisonnement strict.
3. Onglet Chambres dans l'espace collaboratif : l'organisateur voit uniquement les chambres de SON séjour, participants à gauche, drag & drop participant → chambre.

**Étage bonus découvert en conception** : alerte de capacité globale dès le devis (avant toute affectation de chambres) — voir §4, décisions D9/D10.

⚠️ Les chambres n'ont **rien à voir** avec les groupes d'activités (`GroupeSejour` / `PlanningActiviteGroupe`). Deux notions distinctes, ne jamais les mélanger.

**Hors scope Monde 1** (rayé ou différé, cf. §8) : PMS week-end particulier, widget résa public, tarification dynamique, paiement autonome, channel manager OTA (rayé définitivement).

---

## 1. Décisions de référence (ne pas relitiger)

| # | Sujet | Décision |
|---|---|---|
| D1 | Verrouillage | À la **signature** du devis uniquement. Les options se chevauchent librement (préserve l'avantage « multi-option même semaine » vs Venue360 — faiblesse Venue360 #1, `PROSPECT_TEREVA.md` §2). |
| D2 | Règle d'or amendée | Une chambre ne peut pas être occupée par deux sources **fermes** aux dates qui se chevauchent. Contrainte `EXCLUDE` partielle `WHERE statut='FERME'`. |
| D3 | Capacité chambre | **Dérivée de Σ Lit.places** — la saisie des lits est obligatoire, une chambre sans lits est inutilisable (capacité 0). Matelas d'appoint = lit type `APPOINT`. Conséquence assumée : la saisie rapide est indispensable (duplication de chambre, création groupée de lits type « 3 superposés + 1 simple » en un geste) — sans elle, l'onboarding d'un multi-centre (Tereva, 14 centres) meurt à la saisie. |
| D4 | Étage | Simple étiquette (`etage VarChar(50)` + `ordre Int` de tri sur Chambre), pas d'entité Etage. |
| D5 | Permissions collaborateurs | Réutilisation de l'existant : référentiel chambres/lits → module `parametres`, affectation chambres→séjour → module `sejours`. Pas de 7e clé dans le JSON `CollaborateurCentre.permissions`. **+ Gate de plan (décision 21/07)** : référentiel + affectation + onglet collab = `@RequirePlan('COMPLET')`. Seule l'alerte capacité (étage 1) reste sans gate. Monde 2 (PMS week-end) = palier/add-on de monétisation supplémentaire, à pricer le moment venu. |
| D6 | Changement de dates séjour | Les occupations **suivent** les nouvelles dates ; celles qui entrent en conflit avec un ferme passent `A_REPLACER` (alerte + action manuelle hébergeur). Jamais de refus du changement de dates pour cause de chambres, jamais de suppression silencieuse. |
| D7 | Capacité au drag & drop | **Bloquante** pour l'organisateur (`count(affectations) < Σ lits.places`). Si l'hébergeur accepte un matelas d'appoint, c'est LUI qui ajoute un lit `APPOINT` — la réalité physique reste sous son contrôle, pas sous celui de l'enseignant. |
| D8 | Perdant d'un conflit | Mécanisme `A_REPLACER` : l'occupation perdante ne bloque plus rien (exclue de la contrainte), ne disparaît pas, s'affiche en alerte (grille + page séjour) jusqu'à résolution manuelle (réaffectation ou suppression). |
| D9 | Conflit à deux étages | **Étage 1 = capacité globale**, calcul dérivé (aucune table), actif dès le devis : Σ effectifs des séjours signés chevauchants vs `centre.capacite` → alerte sur les options plus accueillables. **Étage 2 = chambres**, actif dès l'affectation. Raison d'être de l'étage 1 : dans la vraie vie, devis signé en mars, chambres affectées en septembre — sans l'étage 1, la surréservation se découvrirait six mois trop tard. |
| D10 | Option plus accueillable | Acquittement **« prévenu, gardé en attente »** : flag daté `capaciteAlerteAcquitteeAt` sur le séjour. L'option reste vivante en file d'attente (use case client-à-rappeler-si-désistement), l'alerte se tait. Réarmement automatique si la situation change après acquittement. Pas d'annulation forcée. |
| D11 | Blocage manuel | `source = BLOCAGE` (travaux, indisponibilité, chambre personnel) dès le Monde 1, compte comme ferme. ⚠️ Décision différée notée pour le Monde 2 : l'ouverture aux particuliers sera **fermée par défaut avec ouvertures explicites** (l'hébergeur ouvre des fenêtres), PAS ouverte par défaut avec blocages à maintenir — plus sûr, moins de gestes, un oubli ne met pas un particulier au milieu d'une colo. |
| D12 | Signature sacrée | Aucun contrôle chambre/capacité ne peut faire échouer une signature client (page publique comprise). Les conflits deviennent des alertes hébergeur, jamais des erreurs client. |
| D13 | Rendu spatial (décision 21/07, plan Sauvageon à l'appui) | **Le plan des chambres se rend spatialement PARTOUT** — grille par étage, chambres dans l'**ordre physique** (`etage` + `ordre`, saisis dans l'ordre du couloir) : saisie hébergeur, affectation, onglet enseignant, **export rooming list PDF** (le livrable = le plan par étage avec les noms dans les lits, remplaçant de l'Excel Sauvageon — jamais un tableau plat). Une liste triée alphabétiquement est un bug de conception. **Marquage V1 (option a)** : étiquette libre + couleur par chambre affectée à un séjour (« Filles » / « Garçons » / « Accompagnateurs »…) — portée par l'occupation, lecture d'un coup d'œil de la séparation filles/garçons/encadrants. **Backlog conditionné à une demande client** : champ `sexe` sur participant (contrôle automatique de mixité, tri auto) — cascade lourde (formulaire autorisation, import CSV Pronote/ONDE, donnée perso mineur supplémentaire), pas en V1. Si la géométrie fine devient nécessaire (rangées de couloir), champ `zone` additif — pas maintenant. |

---

## 2. Modèle de données

### 2.1 Modèles Prisma

```prisma
model Chambre {
  id        String   @id @default(uuid()) @db.Uuid
  centreId  String   @map("centre_id") @db.Uuid
  nom       String   @db.VarChar(100)        // "Chambre 12", "Dortoir Nord"
  etage     String?  @db.VarChar(50)         // étiquette libre : "RDC", "1er", "Chalet annexe"
  ordre     Int      @default(0)             // tri d'affichage (étage puis ordre)
  notes     String?  @db.Text                // "lavabo, vue vallée"
  actif     Boolean  @default(true)          // désactivation — JAMAIS de delete si historique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  centre      CentreHebergement   @relation(fields: [centreId], references: [id], onDelete: Cascade)
  lits        Lit[]
  occupations OccupationChambre[]

  @@index([centreId])
  @@map("chambres")
}
// D3 : capacité = Σ lits.places, TOUJOURS calculée — aucune colonne capacite.

model Lit {
  id        String  @id @default(uuid()) @db.Uuid
  chambreId String  @map("chambre_id") @db.Uuid
  type      String  @db.VarChar(30)    // SIMPLE | SUPERPOSE | TIROIR | DOUBLE | BB | APPOINT
  places    Int     @default(1)        // superposé = 2, double = 2…
  libelle   String? @db.VarChar(50)    // "lit haut fenêtre" (optionnel)
  ordre     Int     @default(0)

  chambre      Chambre              @relation(fields: [chambreId], references: [id], onDelete: Cascade)
  affectations AffectationChambre[]

  @@index([chambreId])
  @@map("lits")
}

// ── LA PRIMITIVE — datée dès le départ (contrainte d'architecture non négociable) ──
model OccupationChambre {
  id        String   @id @default(uuid()) @db.Uuid
  chambreId String   @map("chambre_id") @db.Uuid
  dateDebut DateTime @map("date_debut") @db.Date   // nuit d'arrivée incluse
  dateFin   DateTime @map("date_fin") @db.Date     // matin de départ EXCLU — [debut, fin)
  source    String   @db.VarChar(20)               // SEJOUR | BLOCAGE  (WEEKEND = Monde 2, additif)
  statut    String   @default("OPTION") @db.VarChar(12) // OPTION | FERME | A_REPLACER
  sejourId  String?  @map("sejour_id") @db.Uuid    // requis si source=SEJOUR (CHECK SQL)
  motif     String?  @db.VarChar(255)              // BLOCAGE : "travaux plomberie"
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  chambre      Chambre              @relation(fields: [chambreId], references: [id], onDelete: Restrict)
  sejour       Sejour?              @relation(fields: [sejourId], references: [id], onDelete: Cascade)
  affectations AffectationChambre[]

  @@unique([id, sejourId])          // support du FK composite (cf. AffectationChambre)
  @@index([chambreId, dateDebut])
  @@index([sejourId])
  @@map("occupations_chambre")
}

// Affectation participant → chambre (via l'occupation) — le drag & drop
model AffectationChambre {
  id               String   @id @default(uuid()) @db.Uuid
  occupationId     String   @map("occupation_id") @db.Uuid
  sejourId         String   @map("sejour_id") @db.Uuid   // dénormalisé, verrouillé par FK composite
  autorisationId   String?  @map("autorisation_id") @db.Uuid    // élève…
  accompagnateurId String?  @map("accompagnateur_id") @db.Uuid  // …XOR adulte (CHECK SQL)
  litId            String?  @map("lit_id") @db.Uuid             // V1 : niveau chambre, lit optionnel
  createdAt        DateTime @default(now()) @map("created_at")

  // FK composite (occupationId, sejourId) → OccupationChambre(id, sejourId)
  // ⇒ impossible EN BASE d'affecter un participant sur l'occupation d'un AUTRE séjour
  occupation     OccupationChambre      @relation(fields: [occupationId, sejourId], references: [id, sejourId], onDelete: Cascade)
  autorisation   AutorisationParentale? @relation(fields: [autorisationId], references: [id], onDelete: Cascade)
  accompagnateur AccompagnateurMission? @relation(fields: [accompagnateurId], references: [id], onDelete: Cascade)
  lit            Lit?                   @relation(fields: [litId], references: [id], onDelete: SetNull)

  @@unique([sejourId, autorisationId])     // un élève = une chambre max par séjour
  @@unique([sejourId, accompagnateurId])   // idem accompagnateur
  @@index([occupationId])
  @@map("affectations_chambre")
}
```

Sur `Sejour` : la relation inverse `occupationsChambre OccupationChambre[]` + les deux colonnes de l'étage 1 :

```prisma
  capaciteAlerteAcquitteeAt DateTime? @map("capacite_alerte_acquittee_at")
  capaciteAlerteSituation   String?   @map("capacite_alerte_situation") @db.VarChar(64) // empreinte D10, cf. §4
```

⚠️ **Pas de relation inverse `Sejour.affectationsChambre`** (amendement 21/07) : elle exigerait un FK direct `affectations_chambre.sejour_id → sejours` redondant avec le FK composite vers l'occupation. Le chemin de requête est `sejour → occupationsChambre → affectations` — fidèle au SQL, une seule source de vérité du lien.

Relations inverses également sur `Chambre`→`CentreHebergement`, `AutorisationParentale`, `AccompagnateurMission`, `Lit`.

### 2.2 SQL manuel de la migration (inexprimable en Prisma)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE occupations_chambre
  ADD CONSTRAINT occupation_dates_valides CHECK (date_fin > date_debut),
  ADD CONSTRAINT occupation_statut_valide CHECK (statut IN ('OPTION','FERME','A_REPLACER')),
  ADD CONSTRAINT occupation_sejour_coherent CHECK (
    (source = 'SEJOUR' AND sejour_id IS NOT NULL) OR
    (source <> 'SEJOUR' AND sejour_id IS NULL)
  ),
  -- La règle d'or (D2) : exclusion des seules occupations FERMES
  ADD CONSTRAINT occupation_non_chevauchement EXCLUDE USING gist (
    chambre_id WITH =,
    daterange(date_debut, date_fin, '[)') WITH &&
  ) WHERE (statut = 'FERME');

ALTER TABLE affectations_chambre
  ADD CONSTRAINT affectation_cible_xor CHECK (
    (autorisation_id IS NOT NULL)::int + (accompagnateur_id IS NOT NULL)::int = 1
  );
```

### 2.3 Notes d'implémentation

- **`[debut, fin)` demi-ouvert** : le jour de départ est libre — le groupe B arrive le samedi où le groupe A part (rotation des samedis en station). Convention PMS standard.
- **Un `BLOCAGE` est ferme par nature** → `statut='FERME'` (le CHECK l'autorise, l'exclusion le protège).
- **Violation d'exclusion = erreur PostgreSQL `23P01`**, non mappée par Prisma en erreur « connue » → catch explicite dans le service → 409 avec la liste des conflits (jamais un 500 brut).
- **Sous-périodes possibles par construction** : la primitive autorise « chambre 12 au séjour A du 3 au 5, au séjour B du 5 au 7 ». L'UI V1 propose par défaut la plage complète du séjour ; le modèle n'aura jamais à être réécrit pour les cas fins.
- **Suppression de chambre** : `onDelete: Restrict` + désactivation `actif=false` si historique d'occupation — le rooming d'un séjour passé est une donnée, on ne détruit jamais.

---

## 3. Machine à états des occupations — `syncOccupationsSejour`

### 3.1 Le problème constaté (factuel, recensement git grep du 21/07)

La transition de statut devis/séjour n'a **pas de point unique** : **9 sites de promotion + 2 de libération**, dans 3 fichiers :

> **Amendement Lot 5 (22/07)** : le site 11 (`sejour.service.ts` softDeleteSejour)
> ne branche plus `syncOccupationsSejour` — un séjour soft-supprimé **supprime
> désormais ses occupations** dans sa `$transaction` (cascade Lot 5, §6.2), ce qui
> rend une sync post-suppression sans objet. **10 sites actifs** branchent la sync ;
> le site 11 est remplacé par la cascade de suppression.

| Fichier | Lignes (21/07) | Transition |
|---|---|---|
| `devis.service.ts` | 665-673 | Sélection collab : `SELECTIONNE` + rivaux de la demande → `NON_RETENU` |
| `devis.service.ts` | 736 | Rejet signataire → `NON_RETENU` |
| `devis.service.ts` | 781-789 | Second bloc `SELECTIONNE` + rivaux `NON_RETENU` |
| `devis.service.ts` | 816 + 832 | `SIGNE_DIRECTION` devis + séjour |
| `devis.service.ts` | 919 + 929 | Upgrade `SELECTIONNE → SIGNE_DIRECTION` (devis + séjour) |
| `devis.service.ts` | 1029-1030 | Chemin générique paramétré client/direction |
| `devis.service.ts` | 2195 | `signerDevisDirect` (page publique par token) |
| `devis.service.ts` | 2423 | `uploadSignaturePublic` (scan signé) |
| `devis.service.ts` | 2531 + 2554 | `annulerDevis` → `NON_RETENU`, séjour rétrogradé `OPTION` |
| `invitations-directeur.service.ts` | 227 + 240 | Signature direction via invitation (devis + séjour) |
| ~~`sejour.service.ts`~~ | ~~~1253~~ | ~~Suppression séjour : passage forcé par `NON_RETENU`~~ → **Lot 5** : suppression des occupations dans la tx (plus de sync) |

Saupoudrer une logique de transition à chaque site = un site oublié garanti (cf. cicatrice « 3× Signé direction fixées »).

### 3.2 Le design : dérivé, idempotent, un seul écrivain

```
syncOccupationsSejour(sejourId, tx) :
  cible = FERME  si ∃ devis non-complémentaire du séjour dans STATUTS_DEVIS_RETENUS
        = OPTION sinon
  pour chaque occupation source=SEJOUR du séjour :
    si statut ≠ cible :
      tenter UPDATE statut = cible
      si cible = FERME et conflit (check applicatif + filet 23P01) → statut = A_REPLACER
  rétrogradation FERME → OPTION : toujours possible (libère le stock)
  A_REPLACER : conservé tel quel (résolution = geste manuel hébergeur uniquement)
```

⚠️ **`RETENUS`, pas `ENGAGEANTS`** (amendement 21/07) : des devis prod legacy ont muté en `FACTURE_ACOMPTE`/`FACTURE_SOLDE` (mutation supprimée depuis le Lot 1 facture, mais les données restent) — hors `ENGAGEANTS`, un séjour signé-et-facturé verrait ses occupations retomber en `OPTION`, chambres redevenues volables. `STATUTS_DEVIS_RETENUS` inclut les `FACTURE_*` ; c'est déjà la constante du CA pilotage (« compter le réel »).

Propriétés :
- **Recalcule** depuis l'état des devis (`STATUTS_DEVIS_RETENUS`, constante existante) au lieu de pousser une transition → un site oublié s'auto-répare au prochain appel n'importe où.
- Branchée en fin des 10 sites actifs du tableau §3.1, dans la transaction de chaque site (site 11 retiré — cascade de suppression Lot 5, cf. amendement §3.1).
- Affectation post-signature (cas nominal mars→septembre) : l'occupation naît directement au statut dérivé — pas de détour par OPTION.
- D12 : la promotion ne jette jamais — les conflits se résolvent en `A_REPLACER`, la signature aboutit toujours.

### 3.3 Fix embarqué (défaut préexistant, réparation à la source)

5 blocs écrivent devis + séjour en **deux updates non transactionnels** (816/832, 919/929, 1029-1030, 2195 + update séjour, invitations-directeur 227/240) : un crash entre les deux = devis `SELECTIONNE` avec séjour resté `OPTION`, incohérence silencieuse. Le sous-chantier 4 enveloppe chaque bloc dans `$transaction` (devis + séjour + sync occupations). Ce n'est pas un patch : c'est la réparation d'un défaut d'atomicité existant, embarquée par le chantier qui l'exige de toute façon.

⚠️ Le pseudo-code §3.2 et la règle de réarmement §4 sont des **principes actés, pas des specs finales** — le détail se fixe dans les prompts CC des sous-chantiers 2 et 4, revalidés par Théo.

---

## 4. Conflit à deux étages

### Étage 1 — Capacité globale (dès le devis, AUCUNE table)

Calcul dérivé, pattern « statut CRM dérivé » (cf. `ARCHITECTURE_UX_SEJOUR_FINAL.md` §2) :

- **« Signé » = `Sejour.statut ∈ STATUTS_SEJOUR_CONFIRMES`** (constante existante : CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM — amendement 21/07). Deux raisons vérifiées dans le code : `pilotage.getRemplissage` utilise exactement ce filtre et la même formule d'effectif — l'alerte et le taux de remplissage doivent raconter le même monde ; et `creerDepuisCatalogue` crée un séjour directement en CONVENTION **sans aucun devis** — une dérivation par devis le classerait « pas signé » alors qu'il consomme la capacité. **Asymétrie assumée avec l'étage 2** : étage 1 = « qui a réservé sa place » (statut séjour), étage 2 = « qui a verrouillé des chambres » (devis `RETENUS`, §3.2). Candidates à l'alerte : `statut = OPTION` + `hebergementSelectionneId` + `deletedAt: null` + dates non nulles (EVENEMENT inclus — un mariage consomme des lits comme une colo).
- Pour chaque option sur [d1, d2), nuitées demi-ouvertes : `max journalier de Σ effectifs (placesTotales + nombreAccompagnateurs ?? 0) des séjours signés chevauchants` vs `centre.capacite` — la rotation du samedi ne s'additionne pas.
- Si `max_j (Σ signés) + effectif_option > centre.capacite` → alerte **« plus accueillable »** : dashboard hébergeur + page séjour + liste séjours. Exemple : « ⚠️ Séjour C (option, 45 pers., 3-7 mars) : plus accueillable — 100/120 places prises par des séjours signés. À prévenir. »
- **Acquittement D10** : bouton « J'ai prévenu le client » → `capaciteAlerteAcquitteeAt = now()` → badge « ⏳ prévenu le … — en attente ». L'option reste vivante (file d'attente, rappel si désistement).
- **Réarmement automatique par empreinte de situation** (amendement 21/07, remplace l'esquisse « updatedAt ») : à l'acquittement, on stocke `capaciteAlerteSituation = sha256(JSON canonique)` de la situation — capacité du centre, effectif + dates de l'option, ensemble trié `(id, effectif, dateDebut, dateFin)` des signés chevauchants. Au read : alerte ACQUITTEE si surcapacité ET empreinte identique, réarmée si l'empreinte diffère. Motif : `updatedAt` bouge à chaque signature parentale (décrément `placesRestantes`), chaque note, chaque édition — l'esquisse initiale aurait réarmé en boucle en pleine saison et tué l'alerte par fatigue ; et un signé **annulé** sort de l'ensemble sans toucher son `updatedAt` — seule l'empreinte de composition le voit. Dérivé au read : aucun cron, aucun événement, aucun site de transition touché.

**Pourquoi cet étage existe** : devis signé en mars, chambres affectées en septembre. Sans lui, la surréservation (2 séjours de 50 signés + 1 option de 45 dans un 120 places) se découvrirait à l'affectation, six mois trop tard pour prévenir l'option dignement.

**Extension validée 21/07 (constat review, à livrer au prochain run backend)** : l'étage 1 tel que livré au run 1 n'alerte que les options. Deux séjours **signés** qui, entre eux, dépassent `centre.capacite` = zéro alerte (l'étage 2 ne le verrait qu'à l'affectation). Décision Théo : **il faut une alerte en cas de surcapacité entre signés** — même balayage des bornes sur les seuls signés, alerte « sur-engagement » (non acquittable en « prévenu » : il n'y a pas d'option à prévenir, seulement un problème à résoudre). Surface : dashboard hébergeur.

### Étage 2 — Chambres (dès l'affectation)

Trois couches de défense, les trois nécessaires :
1. **Contrainte `EXCLUDE`** (filet ultime) : tient face aux requêtes concurrentes, aux bugs de service, aux UPDATE SQL manuels.
2. **Contrôle applicatif transactionnel** (l'UX) : requête de chevauchement dans la même transaction, messages parlants (« Chambre 12 tenue par “4ème Morillon” du 3 au 7 mars »).
3. **Grille de disponibilité** (la prévention) : chambres × période, états libre / option ×N / ferme / bloquée / à replacer — 90 % des conflits meurent là.

---

## 5. Cloisonnement

- **Hébergeur** : toutes les routes référentiel + affectation passent par `getCentreForUser` avec `centreId` **explicite** — jamais de résolution implicite du centre (leçon du bug X-Centre-Id des exports CSV multi-centre). Permissions : D5 (`parametres` / `sejours`).
- **Organisateur** (espace collab) : `verifyAccess(sejourId)` puis requêtes strictement `WHERE sejourId` — il voit uniquement les chambres portées par les occupations de SON séjour, ni les autres occupations, ni l'existence des autres chambres du centre. Écriture drag & drop : mêmes règles que le reste de l'espace (`roleCollaboratif = 'LECTURE'` → 403).
- **Garantie en base** : le FK composite `(occupationId, sejourId) → OccupationChambre(id, sejourId)` rend l'évasion inter-séjours impossible au niveau SQL, même si un endpoint fuyait un jour.
- **Participants** : deux sources (`AutorisationParentale` élèves + `AccompagnateurMission` adultes), XOR par CHECK, un participant = une chambre max par séjour (index uniques partiels sur `sejourId`). Capacité bloquante (D7).

---

## 6. Cascades hors module (à traiter, pas à découvrir)

1. **Update dates `Sejour`** → re-datage des occupations dans la même transaction ; conflits → `A_REPLACER` (D6). Touche `sejour.service` (update).
2. **Soft-delete séjour** (`deletedAt`) → libération explicite des occupations dans le service — la cascade Prisma ne se déclenche pas sur un soft-delete (même classe de bug que le fix `deletedAt` du 09/06).
3. **Suppression chambre** → `Restrict` + `actif = false` si historique.
4. **Dates séjour nulles** (`dateDebut`/`dateFin` nullables) → affectation indisponible tant que les dates ne sont pas posées (gate service + UI).
5. **Étage 1** dépend de `centre.capacite` et des effectifs séjour — aucune donnée nouvelle, mais surfaces d'alerte sur dashboard hébergeur + liste séjours + page séjour.

---

## 7. Sous-chantiers (prompts CC séparés, backend/frontend distincts)

| # | Chantier | Contenu | Est. | Dép. |
|---|---|---|---|---|
| 1 | Migration + modèles | 4 tables, SQL manuel §2.2, flag D10 sur Sejour, relations inverses | 1 j | — |
| 2 | **Étage 1 capacité globale** | Calcul dérivé + endpoints + alertes (dashboard, page séjour, liste) + acquittement/réarmement. **Livrable seul, AVANT le reste** — protège les signatures dès maintenant, zéro dépendance à la saisie du référentiel | 1 j | 1 (flag) |
| 3 | Backend référentiel | CRUD chambres/lits (module `parametres`), duplication de chambre, saisie rapide de lits, désactivation | 1 j | 1 |
| 4 | Backend affectation (**le point dur**) | `syncOccupationsSejour` + branchement des 11 sites + mise en transaction des 5 blocs non atomiques (fix embarqué §3.3) + CRUD occupations + mapping 23P01→409 + grille dispo + `BLOCAGE` | 2 j | 1 |
| 5 | Frontend référentiel | Profil centre : étages → chambres → lits | 1 j | 3 |
| 6 | Frontend affectation hébergeur | Grille période × chambres, affectation à un séjour, alertes `A_REPLACER` | 1,5 j | 4 |
| 7 | Espace collab : onglet Chambres | Backend cloisonné + participants (2 sources) à gauche, drag & drop bloquant, rooming list | 1,5 j | 4 |
| 8 | Cascades | Update dates, soft-delete, recette croisée | 0,5 j | 4 |

**Total ~9,5 j** (fourchette basse — le #4 peut déborder d'une demi-journée si les mises en transaction réveillent des tests existants). **Chemin critique : 1 → 4 → 6/7. Le #2 est autonome et prioritaire.**

Règles d'exécution : chaque prompt CC = lecture des fichiers d'abord, cascade analysis explicite, gates `tsc --noEmit + build + npm test` à chaque commit, commits atomiques, backend et frontend en prompts/commits séparés, CC ne pousse jamais (review Théo avant push).

---

## 8. Hors scope Monde 1 (rappel)

PMS week-end particulier, widget de résa public, tarification dynamique, paiement autonome, channel manager OTA (**rayé définitivement**). Ces briques attendront le besoin réel (Tereva). Garanties d'additivité du Monde 2 : la primitive `OccupationChambre{source}` (ajouter `WEEKEND` = une valeur d'enum, rien d'autre) + le principe D11 « fermé par défaut, ouvertures explicites ».

---

**Aucun code modifié dans le cadre de ce document.**
