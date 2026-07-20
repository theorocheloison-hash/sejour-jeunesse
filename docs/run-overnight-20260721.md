# Run overnight — 21/07/2026 (chantiers 2.4, 4.18, 4.9-frontend)

> Règles : AUCUN push, AUCUNE suppression de fichier, un commit atomique par chantier,
> gates tsc + build (+ tests backend si touché), périmètre fermé.
> Interdits ce run : 4.8 CI, 4.19/dédup/résolution d'orga, facturation multi-centre.

## Phase 1 — Recensement (lecture seule, avant toute écriture)

### Chantier 1 — 2.4 labels « élèves » en HORS_SCOLAIRE
**Diagnostic CONFIRMÉ, avec précision :** « élèves » n'apparaît dans `formatParticipants()`
(`frontend/src/lib/utils.ts:10-21`) QUE dans la branche avec accompagnateurs
(`X participants (Y élèves + Z accompagnateurs)`) ; la branche sans accompagnateurs est
déjà neutre (`N participant(s)`).

**Appelants recensés (6 sites, 5 fichiers) :**
| Site | typeContexte dispo ? |
|---|---|
| `SejourHeader.tsx:204` | OUI — `sejour: SejourCollabInfo` vient de `GET /collaboration/:id` qui fait un `include` sans select restrictif → `typeContexte` DÉJÀ renvoyé par l'API, seul le type front (`SejourCollabInfo`, lib/collaboration.ts:43) ne le déclare pas. Même situation que le fix `dateEnvoi` du 15/07. |
| `devis/nouveau/page.tsx:321` (directSejour) | OUI — même API `getSejourCollabInfo` ; ajouter le champ au state local + mapping. |
| `devis/nouveau/page.tsx:333` (`sejour = demande?.sejour`) | INCERTAIN (payload `getDemandeInfo` non instruit) — chemin collaboratif = quasi toujours SCOLAIRE → défaut « élèves » correct. NON touché. |
| `devis/signer/[token]/page.tsx:260` | NON — le select public (`devis.service.ts:2086-2095`) n'expose pas `typeContexte` (il a natureSejour/typeSejour). Toucher un endpoint public la nuit = non. NON touché, noté. |
| `hebergeur/global/page.tsx:472` (tooltip) | NON — `getMesSejoursPlanning` (collaboration.service.ts:509) ne sélectionne pas `typeContexte`. Tooltip mineur. NON touché, noté. |
| `DevisPDF.tsx:224` | NON — prop absente, cascade sur 2 sites de mapping + wording d'un document contractuel. NON touché, noté. |

**Option retenue : (a)** — 3e paramètre optionnel `typeContexte?: string | null`, défaut
rétrocompatible (« élèves » si non fourni). En HORS_SCOLAIRE :
`${total} participants (dont ${accompagnateurs} accompagnateurs)` (évite « X participants
(Y participants + …) » ; « jeunes » écarté : faux pour les événements type mariage).
Sites mis à jour : `utils.ts` + `SejourCollabInfo` (champ optionnel) + `SejourHeader:204`
+ `devis/nouveau` (state + mapping + site 321). **4 fichiers touchés, sous la barre des ~6.**
Précédent de pattern : `organisateur/page.tsx:62` fait déjà `estHorsScolaire(sejour) ?
'participant' : 'élève'`.

### Chantier 2 — 4.18 badges groupes journal public
**Diagnostic CONFIRMÉ :**
- Backend `journal-public.controller.ts:39-50` : select de `planningActivites` SANS `groupes`.
- Frontend `app/sejour/[token]/journal/page.tsx:73-117` : `regrouperParCreneau` parse les
  suffixes ` — G\d+` (regex L90/98/101) — schéma d'avant la refonte m2m du 07/07.
- Depuis la refonte : 1 activité par cluster, titre SANS suffixe, groupes dans
  `PlanningActiviteGroupe` (schema.prisma:1260) → badges disparus pour les nouveaux plannings.

**Contrat cible = celui déjà utilisé partout ailleurs** (collaboration.service.ts:219-223) :
`groupes: { include: { groupe: { select: { id, nom, couleur } } } }` puis aplati en
`groupes: [{id, nom, couleur}]`. Le controller journal-public renvoie l'objet Prisma brut →
j'aplatis dans le controller avant retour.

**Plan front :** `PlanningAct` gagne `groupes?: {id,nom,couleur|null}[]` ; regroupement par
titre exact (plus de strip) quand `groupes` est présent, badges = `nom` du groupe (couleur
du groupe) ; **fallback legacy conservé** (regex sur ` — G\d+`) si `groupes` absent/vide —
le backfill m2m était à 0 en prod (roadmap 07/07) mais le fallback coûte 3 lignes et rend
le rendu insensible au déploiement back/front décalé. Purement cosmétique, zéro écriture.

### Chantier 3 — 4.9 harness vitest + tests devis-calculs.ts
**Diagnostic CONFIRMÉ :** zéro framework de test frontend (package.json sans jest/vitest,
aucun *.spec/*.test sous frontend/). `devis-calculs.ts` = 4 fonctions pures (`round2`,
`resolvePrixCatalogueTTC`, `mapLignesForApi`, `calculerTotaux`) + `formatMontant` ;
imports **type-only** (`ProduitCatalogue`, `LigneDevis`) → testable sans DOM ni Next.

**Plan :** `vitest` en devDependency SEULE (aucun bump d'existant), `vitest.config.ts`
dédié (alias `@` → racine frontend, cf. tsconfig paths `@/* → ./*`), script `"test":
"vitest run"` séparé (le script `build` n'est PAS touché), tests en imports explicites
`from 'vitest'` (pas de globals → zéro modification tsconfig/next.config).
Pièges anticipés : séparateur de milliers fr-FR = espace insécable étroite (U+202F) →
assertions de `formatMontant` normalisées ; tests centrés sur la mécanique financière
(TTC→HT, arrondis ligne à ligne, artéfacts float documentés dans le commentaire L67-69,
acompte/reste). Gate : `npx vitest run` vert ET `npm run build` frontend vert.

### Vu pendant la lecture, NON touché
- `formatParticipants` : les 3 sites laissés au défaut (signer public, tooltip global,
  DevisPDF) = suite naturelle du 2.4 à faire éveillé (1 select public + 1 prop PDF).
- `journal-public` : le token n'expire que via `tokenExpiresAt` nullable — RAS, pas touché.
- Interdits du run respectés : rien vu ni touché côté CI/claim/abonnements.

---

## Phase 2 — Exécution

**3 chantiers sur 3 FAITS, 0 reverté. AUCUN push (4 commits locaux sur `main`).**
Gates par commit : tsc + build verts (frontend et backend selon côté touché) ;
suite Jest backend 217 verts + 2 todo après 4.18 ; vitest 16/16 après 4.9.

| Chantier | Statut | Commit | Notes |
|---|---|---|---|
| 2.4 | ✅ FAIT | `d73a354` | 4 fichiers : helper (3e param optionnel, défaut rétrocompatible), type `SejourCollabInfo`, SejourHeader, devis/nouveau. HORS_SCOLAIRE → « X participants (dont Z accompagnateurs) ». |
| 4.18 | ✅ FAIT | `673375d` | Backend : select + aplatissement `groupes` au contrat standard. Front : lecture structurée (badge = nom du groupe) + fallback legacy regex conservé. |
| 4.9 | ✅ FAIT | `3a29a1e` | vitest ^4.1.10 devDependency seule (diff package.json = 1 ligne + script test), config isolée, 16 tests. Build prod et next.config intacts. |

### À relire / recette à ta main
1. **2.4** : recette visuelle sur un séjour HORS_SCOLAIRE avec accompagnateurs
   (page séjour + création devis DIRECT). Les 4 sites restants au libellé scolaire
   (signer public, tooltip global, DevisPDF, branche collab devis/nouveau) = suite
   éveillée, ~0.5j, plan dans le recensement ci-dessus.
2. **4.18** : recette = ouvrir un lien journal parent d'un séjour avec planning
   par groupes post-refonte → badges nommés/colorés. Un seul accroc possible :
   payload legacy sans `groupes` → fallback regex, rendu identique à avant.
3. **4.9** : `cd frontend && npm test` = 16 tests en ~200 ms. Caractérisation
   relevée SANS fix (hors périmètre) : `calculerTotaux` ne filtre pas les lignes
   sans description, `mapLignesForApi` si — asymétrie sans impact connu (une ligne
   vide a des montants vides) mais documentée par un test.
4. **package-lock.json** : régénéré par l'install vitest (~1250 lignes de diff
   lock) — uniquement l'arbre vitest, aucune version existante bumpée
   (vérifié sur le diff package.json).
