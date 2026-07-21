# RUN CHAMBRES 5/8 — Frontend référentiel chambres/lits — Plan (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — **Statut : VALIDÉ PAR THÉO le 21/07/2026** (les 4 points du §6 +
> ajout D3 : bouton « Enregistrer et créer la suivante » dans le modal de création, étage et
> compteurs pré-remplis de la précédente — la saisie d'un centre s'enchaîne sans fermer).
> Sources lues : doc archi D3/D4/**D13** (rendu spatial partout — jamais de tri alphabétique),
> `referentiel.controller.ts` + `dto/` (contrat réel : batch `{ lits: [...] }`, DELETE →
> `{deleted}`/`{deactivated}`), `HebergeurSidebar.tsx` (groupe Paramètres, `requiredPlan`,
> `ROUTE_PERMISSION`), `parametres/inscription/page.tsx` (shell page + messages inline),
> `profil/page.tsx` (`handleDeplacerImage` — le pattern ←/→), `PlanInsufficientModal` (mur
> d'upsell GLOBAL monté dans `HebergeurShell`, déclenché par l'intercepteur api sur 403
> PLAN_INSUFFICIENT), `src/lib/chambres.ts` (lib à étendre).

## 1. Emplacement

- **Page** : `/dashboard/hebergeur/parametres/chambres` (nouveau dossier à côté de
  `parametres/inscription`).
- **Sidebar** : entrée « Plan des chambres » dans le groupe Paramètres, entre « Fiche
  d'inscription » et « Mon équipe », avec `requiredPlan: 'COMPLET'` (cadenas auto comme CRM)
  + `ROUTE_PERMISSION['/dashboard/hebergeur/parametres/chambres'] = 'parametres'` (D5 —
  masquée aux collaborateurs sans la permission). `parametresRoutes` couvre déjà le préfixe.
- **Upsell** : rien à coder — le GET passe en tout plan (gate soft), les mutations en plan
  insuffisant déclenchent le `PlanInsufficientModal` global via l'event de l'intercepteur ;
  la page se contente de ne PAS afficher d'erreur brute sur ces 403 (pattern `pilotage/ca`).

## 2. Maquette texte (D13 : grille par étage, ordre physique)

```
Plan des chambres                                         [+ Nouvelle chambre]
Capacité totale du référentiel : 46 places · 12 chambres    [☐ Voir les inactives]

── RDC ──────────────────────────────────────────────────────────────────────
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Chambre 1        6 pl│ │ Chambre 2        4 pl│ │ Dortoir Nord     8 pl│
│ 3× superposé         │ │ 2× superposé         │ │ 4× superposé         │
│ 𝑖 lavabo, vue vallée │ │                      │ │ [Inactive]           │
│ [✎] [⧉] [←] [→] [🗑] │ │ …                    │ │ [✎] [Réactiver]      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘

── 1er étage ────────────────────────────────────────────────────────────────
┌──────────────────────┐ …

── Sans étage ───────────────────────────────────────────────────────────────
┌──────────────────────┐ …
```

- Cartes en `flex-wrap` par étage, dans l'ordre `ordre` renvoyé par l'API. Lits résumés
  agrégés par type (« 3× superposé, 1× simple ») + capacité Σ en évidence.
- **Ordre des groupes d'étages — point à trancher** : l'API trie `etage` alphabétiquement
  (nulls first) → « 1er » passerait AVANT « RDC », contraire à D13. Le front ordonnera les
  groupes par **min(`ordre`) des chambres du groupe** (l'ordre du couloir saisi fait foi,
  l'étiquette n'est qu'un libellé), fallback alphabétique à égalité. Zéro backend.
- Inactives masquées par défaut, case « Voir les inactives » → `?inactives=1`, badge gris
  + bouton « Réactiver » (`PATCH { actif: true }`).

## 3. Interactions

**Création / édition (modal unique)** : nom, étage (texte libre), notes + **saisie rapide
compteurs** — une ligne par type avec stepper :

```
Lits superposés (2 pl.)   [−] 3 [+]
Lits simples (1 pl.)      [−] 1 [+]
Lit tiroir / double / bébé / appoint …
──────────────────────────────
Capacité : 7 places
```

Les compteurs GÉNÈRENT le tableau `lits: [{type}, …]` (places = défauts serveur) envoyé à
`POST /chambres` — l'UI compteur est une vue, le contrat reste le tableau (§3 run 3). En
édition, la modal liste les lits existants (type/places/libellé éditables → `PATCH lits/:id`
au blur, suppression ✕ → `DELETE lits/:id`) + les compteurs pour en AJOUTER
(`POST :id/lits { lits }`). `ordre` chambre non exposé dans la modal (géré par ←/→).

**Duplication** : bouton ⧉ → mini-popover « Dupliquer ×[N] » (1–20, défaut 1) →
`POST :id/dupliquer { nombre }` → refetch. Les copies héritent étage + lits (suffixe serveur).

**Suppression** : 🗑 avec confirmation → selon la réponse, message distinct :
`{deleted}` → « Chambre supprimée. » ; `{deactivated}` → « Chambre désactivée — son
historique d'occupations est conservé. » (messages inline en tête de page, pas de toast
système dans l'app).

## 4. Réordonnancement — options

- **A — boutons ←/→ (pattern galerie photos `handleDeplacerImage`)** : swap des `ordre` avec
  la carte voisine du même étage = **2 `PATCH /chambres/:id` séquentiels** puis refetch
  (échec → refetch + message, l'état revient du serveur). Pas d'endpoint de permutation côté
  back et interdit d'en créer — 2 PATCH est le coût de la V1. ⚠️ Non transactionnel : un
  crash entre les deux laisse un doublon d'`ordre`, bénin (le tri secondaire `nom` départage,
  un ←/→ suivant répare).
- **B — drag & drop** : plus séduisant, mais dépendance nouvelle (dnd-kit), N PATCH au drop,
  gestion tactile — hors de proportion pour la V1 (le vrai rendu spatial fin viendra avec la
  grille du sous-chantier 6).
- **C — pas de réordonnancement V1** (ordre = ordre de création) : contredit D13 (« saisi
  dans l'ordre du couloir » implique pouvoir corriger).

### ✅ Recommandation : **A**.

## 5. Fichiers et commits

| Fichier | Nature |
|---|---|
| `src/lib/chambres.ts` | +types `Chambre`/`Lit` + 8 fonctions API (batch `{ lits }`, delete typé `{deleted?} \| {deactivated?}`) |
| `app/dashboard/hebergeur/parametres/chambres/page.tsx` | nouveau — la page (grille + modal + interactions) |
| `app/dashboard/hebergeur/_components/HebergeurSidebar.tsx` | +1 entrée + 1 ligne `ROUTE_PERMISSION` |

- **COMMIT 1** — lib + page (grille, création compteurs, édition, duplication, suppression,
  inactives) + sidebar.
- **COMMIT 2** — réordonnancement ←/→ + polissage états busy/erreurs.

Gates à chaque commit : `npx tsc --noEmit` + `npx vitest run` (16) + `npm run build`.
Interdits tenus : zéro backend, pas de page séjour, pas d'occupations, pas de push sans
feu vert.

## 7. Livraison (Phase 2, 21/07/2026) — 2 commits, gates verts à chacun

| Commit | Contenu |
|---|---|
| `756e84c` | Lib étendue (8 fonctions) + page `/parametres/chambres` (grille D13, modal compteurs + « Enregistrer et créer la suivante », duplication ×N, delete 2 messages, inactives) + sidebar |
| `831c8db` | Réordonnancement ←/→ |

Gates à chaque commit : tsc 0 · vitest 16 · build + postbuild OK. **Écart vs §4 (seul)** :
le déplacement renumérote séquentiellement le groupe et ne PATCHe que les ordres qui
changent — le swap simple des deux `ordre` promis au plan aurait été un no-op sur un groupe
jamais ordonné (tout à 0, défaut de création). Premier déplacement d'un groupe = N PATCH,
les suivants = 2. L'ajout D3 validé (« Enregistrer et créer la suivante », étage + compteurs
pré-remplis, focus nom) est en place. Pas de push (feu vert Théo).
**Recette visuelle après déploiement** : saisie enchaînée de 3 chambres (RDC ×2, 1er ×1) →
groupes dans l'ordre de saisie ; ←/→ ; duplication ×3 ; suppression d'une chambre vierge
(« supprimée ») ; édition des lits au blur ; compte DECOUVERTE → clic mutation → modal upsell.

## 6. Points soumis à validation (✅ tous validés par Théo le 21/07)

1. Emplacement `/parametres/chambres` + entrée sidebar `requiredPlan COMPLET` (§1).
2. Ordre des groupes d'étages par min(`ordre`) côté front (§2) — l'API alphabétique mettrait
   « 1er » avant « RDC ».
3. Modal unique création/édition avec compteurs par type ; lits édités à la volée en édition
   (PATCH au blur) (§3).
4. Réordonnancement option A — ←/→ par swap, 2 PATCH séquentiels, non transactionnel assumé (§4).
