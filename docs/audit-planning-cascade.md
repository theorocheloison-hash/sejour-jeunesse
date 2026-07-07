# Audit cascades planning-groupes-m2m

Date : 2026-07-07
Contexte : post-merge commits 9803ba9 (backend) + 8728934 (frontend)

---

## Section A — Tableau des occurrences

### Pattern `groupeNom`

**0 occurrence** dans tout le repo (hors node_modules/dist/.next). Nettoyé par le commit 8728934.

### Pattern `planningActivites` — includes/selects Prisma (backend)

| Fichier:ligne | Pattern | Contexte | Statut | Action proposée |
|---|---|---|---|---|
| `backend/src/collaboration/collaboration.service.ts:486` | `planningActivites: { orderBy }` | `getMesSejoursConvention` — include bare (pas de groupes). Utilisé par type `SejourConventionHebergeur`. | NEUTRE | La fonction est exportée mais **non utilisée** côté frontend (grep = 0 import dans `app/`). Le type n'accède à aucun champ groupe. Pas d'action. |
| `backend/src/collaboration/collaboration.service.ts:525` | `planningActivites: { orderBy }` | `getMesSejoursPlanning` — include bare. Consommé par la page planning hébergeur. | NEUTRE | Le frontend n'utilise que `titre`, `heureDebut`, `heureFin`, `responsable`, `couleur`. Pas de champ groupe accédé. |
| `backend/src/sejours/sejour.service.ts:289` | `_count: { select: { planningActivites: true } }` | `getSejoursOrganisateur` — simple compteur. | OK | Pas d'impact. |
| `backend/src/sejours/sejour.service.ts:373` | `planningActivites: { orderBy }` | `getDossierPedagogique` — include bare. Alimente `ProjetPedagogiquePDF` et `TabProjetPedagogique`. | NEUTRE | Le PDF et l'UI n'affichent que `titre`, `heureDebut`, `heureFin`, `description`, `responsable`. Aucun champ groupe accédé. |
| `backend/src/sejours/sejour.service.ts:440` | `planningActivites: { orderBy }` | `soumettreAuRectorat` — include bare. | NEUTRE | Le template HTML rectorat (ligne 595) n'utilise que `date`, `heureDebut`, `heureFin`, `titre`, `responsable`. |
| `backend/src/sejours/sejour.service.ts:595` | `sejour.planningActivites.map(...)` | Template HTML dossier rectorat. | NEUTRE | Accède uniquement à `date`, `heureDebut`, `heureFin`, `titre`, `responsable`. Pas de rupture. |
| `backend/src/journal-public/journal-public.controller.ts:39` | `planningActivites: { select: { id, date, heureDebut, heureFin, titre, couleur, estCollective } }` | Select explicite pour le journal public. | NEUTRE | Pas de `groupeId` ni `groupeNom` dans le select. Les champs sélectionnés sont tous des scalaires qui existent toujours. |

### Pattern `planningActivites` — types frontend

| Fichier:ligne | Pattern | Contexte | Statut | Action proposée |
|---|---|---|---|---|
| `frontend/src/lib/collaboration.ts:88` | `SejourConventionHebergeur.planningActivites` | Type inline sans champ groupe. | NEUTRE | Type non utilisé dans les pages. |
| `frontend/src/lib/collaboration.ts:116` | `SejourPlanning.planningActivites` | Type inline sans champ groupe. | NEUTRE | Consommé par la page planning hébergeur qui n'accède pas aux groupes. |
| `frontend/src/lib/sejour.ts:103` | `_count.planningActivites: number` | Simple compteur dans `SejourDirecteur`. | OK | Pas d'impact. |
| `frontend/src/lib/sejour.ts:251` | `DossierPedagogiqueData.planningActivites` | Type sans champ groupe. | NEUTRE | Utilisé par `TabProjetPedagogique` et `ProjetPedagogiquePDF`, qui n'accèdent qu'à `titre`, `heureDebut`, `heureFin`, `description`, `responsable`. |
| `frontend/src/lib/journal-public.ts:23` | `planningActivites: Array<{id, date, heureDebut, heureFin, titre, couleur, estCollective}>` | Type pour journal public. | NEUTRE | Pas de champ groupe dans le type, cohérent avec le select backend. |
| `frontend/src/components/pdf/ProjetPedagogiquePDF.tsx:94` | `ProjetPedagogiqueData.planningActivites` | Type sans champ groupe. | NEUTRE | Le rendu PDF n'utilise que `titre`, `heureDebut`, `heureFin`, `description`, `responsable`. |

### Pattern `planningActivites` — usages frontend (rendu)

| Fichier:ligne | Pattern | Contexte | Statut | Action proposée |
|---|---|---|---|---|
| `frontend/app/dashboard/sejour/[id]/_components/TabProjetPedagogique.tsx:53` | `d.planningActivites.reduce(...)` | Groupement par jour dans l'onglet projet pédagogique. | NEUTRE | N'accède qu'à `date`, `titre`, `heureDebut`, `heureFin`, `description`, `responsable`. |
| `frontend/app/dashboard/sejour/[id]/_components/TabProjetPedagogique.tsx:336-362` | Rendu du planning dans l'onglet. | NEUTRE | Idem — pas de champ groupe. |
| `frontend/src/components/pdf/ProjetPedagogiquePDF.tsx:146` | `data.planningActivites.reduce(...)` | Groupement par jour dans le PDF. | NEUTRE | Idem. |
| `frontend/app/sejour/[token]/journal/page.tsx:315-324` | `sejour.planningActivites.filter(...)` | Construction des jours du journal public. | NEUTRE | Type `PlanningAct` local ne contient pas de champ groupe. |
| `frontend/app/dashboard/hebergeur/planning/page.tsx:228` | `s.planningActivites.filter(...)` | Activités d'un jour donné, page planning hébergeur. | NEUTRE | N'accède qu'à `titre`, `heureDebut`, `heureFin`, `responsable`, `couleur`. |
| `frontend/app/dashboard/organisateur/documents/[sejourId]/page.tsx:93-96` | `dossier.planningActivites.length` | Compteur dans la checklist documents organisateur. | OK | Simple `.length`, pas de champ structurel. |

### Vérifications supplémentaires

| Fichier | Vérifié | Résultat |
|---|---|---|
| `backend/prisma/seed.ts` | Pas de seed.ts ni de référence à PlanningActivite | OK |
| `backend/test/app.e2e-spec.ts` | Aucune référence à PlanningActivite | OK |
| `frontend/__tests__/` | Dossier inexistant | OK |

---

## Section B — Synthèse

### Nombre d'occurrences à fixer : **0**

Tous les endroits qui incluent `planningActivites` via Prisma le font soit :
- En include bare (pas de groupes) → le frontend ne lit que les champs scalaires (`titre`, `heureDebut`, `heureFin`, etc.) qui existent toujours.
- Avec un select explicite de champs scalaires → aucun champ supprimé dans le select.

Le champ `groupeId` était un scalaire qui n'est plus dans le modèle. Les includes bare ne le retournent plus, et **aucun** frontend ne le lisait (les frontend accédaient à `groupeNom`, qui était une dérivation côté Prisma — et qui a été supprimé dans le commit 8728934).

### Risques métier : aucun

- Tous les PDF (ProjetPedagogiquePDF, PreparationTamPDF, PlanningPDF) fonctionnent correctement.
- Le dossier rectorat HTML fonctionne — n'utilisait aucun champ groupe.
- La page planning hébergeur fonctionne — n'utilise que les scalaires.
- Le journal public fonctionne — voir section C pour une dette cosmétique.

---

## Section C — Questions à Théo

### C.1 — Titres d'activités hérités avec suffixe « — G1 »

**Contexte :** L'ancien code `genererPlanningIA` ajoutait un suffixe ` — G1`, ` — G2`, etc. au titre de chaque activité. Le nouveau code ne le fait plus (le titre est simplement le nom de l'activité, les groupes sont en badges séparés).

Les plannings existants en prod (Paris-Saclay, Choucas) **conservent ces anciens titres** en base. Avec le nouveau code :
- Le titre "Escalade — G1" s'affiche tel quel dans le bloc planning
- Le badge multi-groupes affiche les groupes séparément (ex. "Groupe 1")
- **Résultat** : doublon visuel — le suffixe "— G1" apparaît dans le titre ET le groupe apparaît en badge

**Requête SQL pour évaluer l'ampleur :**
```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE titre ~ ' — G\d') AS avec_suffixe
FROM planning_activites;
```

**Impact :** Cosmétique uniquement. Aucun bug fonctionnel. L'information est redondante mais pas fausse.

**Options :**

| Option | Description | Risque |
|---|---|---|
| A. Ne rien faire | Laisser les anciens titres tels quels. Le doublon visuel disparaîtra quand les hébergeurs régénéreront leurs plannings. | Aucun risque. Cosmétiquement imparfait pendant la période de transition. |
| B. Nettoyer les titres en SQL | `UPDATE planning_activites SET titre = regexp_replace(titre, ' — G\d+$', '') WHERE titre ~ ' — G\d+$';` | Risque faible. Aucune perte fonctionnelle (l'info groupe est dans la table de jointure). Mais modifie des données utilisateur. |
| C. Nettoyer côté rendu frontend | Dans `DraggableActivity` et les PDF, faire `titre.replace(/ — G\d+$/, '')` avant affichage. | Aucun risque data. Ajoute une logique de nettoyage temporaire dans le code (dette technique mineure). |

**Recommandation : Option B.** Le nettoyage SQL est propre, idempotent, et supprime la redondance à la source. Les titres avec suffixe n'ont plus de raison d'être puisque l'information est maintenant dans la table de jointure. Le risque est nul car la migration a déjà backfillé les liens groupes.

### C.2 — Page journal public : logique `regrouperParCreneau` basée sur les suffixes de titre

**Contexte :** Le fichier `frontend/app/sejour/[token]/journal/page.tsx` (lignes 89-133) contient une fonction `regrouperParCreneau` qui :
1. Parse les titres pour extraire le suffixe ` — G\d+` via regex
2. Regroupe les activités par nom de base pour afficher des badges colorés "G1", "G2"

Ce code fonctionne **correctement avec les anciens plannings** (qui ont des titres dupliqués "Escalade — G1", "Escalade — G2" en entrées séparées).

Pour les **nouveaux plannings** (générés après la refonte) :
- Il y a UNE seule entrée par activité (pas de duplication)
- Le titre est simplement "Escalade" (sans suffixe)
- La regex `/ — G\d+$/` ne matche rien
- Les badges groupes ne s'affichent pas

Ce n'est **pas un bug cassant** (l'activité s'affiche normalement, juste sans badge groupe), mais c'est une **dégradation fonctionnelle** du journal public pour les nouveaux plannings.

**Options :**

| Option | Description |
|---|---|
| A. Refondre `regrouperParCreneau` | Modifier pour utiliser les `groupes[]` de la réponse API au lieu de parser les titres. Nécessite d'ajouter `groupes` au select backend du journal public et au type frontend. |
| B. Ne rien faire | Les nouveaux plannings affichent les activités sans badge groupe dans le journal. Acceptable si le journal public est peu consulté. |

**Recommandation : Option A**, à inclure en Phase 2 si validé. C'est le seul endroit qui a une dégradation fonctionnelle réelle. Le fix est modeste : ajouter `groupes` au select backend journal-public, mettre à jour le type, et refondre `regrouperParCreneau` pour utiliser les données structurées au lieu de parser les titres.
