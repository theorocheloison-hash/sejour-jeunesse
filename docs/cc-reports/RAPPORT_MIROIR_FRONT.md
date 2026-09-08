# RAPPORT — Miroir hébergeur Lot 3, volet frontend : census de confirmation (Phase 1, lecture seule)

Date : 08/09/2026. Code lu sur le working tree local (`main` = `f0a8291`).

## 1) `src/lib/api.ts` — ✅ CONFORME

- **l.10-20** : un `api.interceptors.request.use` existe déjà (header `X-Centre-Id`) — un second intercepteur de requête s'ajoute sans conflit (axios les chaîne).
- **l.88** : le refresh 401 utilise `axios.post(`${baseURL}/auth/refresh`)` — **axios brut, pas `api`** → non impacté par un intercepteur posé sur `api`. Le retry `api(originalRequest)` (l.95) repasserait par le verrou, mais un retry ne concerne que des requêtes déjà parties, donc des GET en mode aperçu — cohérent.
- Deux intercepteurs de **réponse** (PlanGuard l.23, refresh l.57) : non touchés par le plan.

## 2) `app/dashboard/sejour/[id]/page.tsx` — ✅ TOUS ANCRAGES LOCALISÉS

| Point | Ligne | Contenu |
|---|---|---|
| a. `navBlocs` | **l.112-113** | `const navBlocs = user?.role === 'ORGANISATEUR' && !!sejour && sejour.createur?.id === user.id && !isDirect && !isEvenement;` |
| b. `ongletsVisibles` / `const role = user?.role;` | **l.119** (useMemo ouvert l.118) | filtre TABS par rôle |
| c. ternaire chambres | **l.700-719** | `user.role === 'HEBERGEUR' ? <TabChambres/> : user.role === 'ORGANISATEUR' ? <TabRooming/> : null` (ternaire explicite, commentaire l.697-699) |
| d. onglet projet | **l.772** | `{activeTab === 'projet' && user.role === 'ORGANISATEUR' && (` |
| e. onglet devis | **l.558** | montage `<TabDevisFacturation …/>` (branche else du ternaire documents-officiels l.554+) |
| f. `<EducTour>` | **l.510** | monté dans la branche `navBlocs` (l.499+), gaté `user && (user.onboardingTourEtape ?? 0) < NB_ETAPES` |
| g. `marquerVisite` | **l.144-149** | useEffect : `if (!user || user.role !== 'HEBERGEUR' || … ) return; marquerVisite(id, activeTab)` — ne track QUE l'hébergeur, onglets messages/documents/journal |
| h. `<main>` | **l.545** | `<main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">` |
| i. `<SejourHeader>` | **l.428-439** | props : `sejourId, sejour, user, isDirect, isEvenement, retourHref, badgeEngagement, onSejourUpdate, onError, onDeleted` |

## 3) `TabDevisFacturation.tsx` — early-return VueOrganisateur — ✅

- **l.1143-1153** : `if (user.role !== 'HEBERGEUR') { return (<VueOrganisateur sejour={sejour} user={user} budgetData={budgetData} onReload={onReload} onError={onError} />); }` — 5 props : `sejour, user, budgetData, onReload, onError`.

## 4) `devis-facturation/VueOrganisateur.tsx` — ✅ COMPATIBLE HÉBERGEUR (lu en entier)

- **Source de données = props** : `devisAffiche = budgetData?.devis` (l.49), rendu depuis `budgetData.sejour` (l.65+). Aucun fetch au montage.
- **Usages de `user.role`** — tous fail-safe pour un HEBERGEUR (les blocs ne s'affichent simplement pas) : l.129 (actions envoyer-direction/scan, `=== 'ORGANISATEUR'`), l.199 et l.233 (panneaux signature, `=== 'ORGANISATEUR'`), l.249 (convention, `ORGANISATEUR || SIGNATAIRE`). Restent visibles pour un hébergeur : bouton PDF, badge signé, `SecureFileLink`, `DevisPdfViewer` — tous en lecture.
- **Usages de `user.firstName`/`user.organisation`** : uniquement dans la modale invitation direction (l.325-329), inatteignable pour un hébergeur (bouton d'ouverture gaté l.129).
- **Endpoint sous-jacent vérifié côté backend** : `GET /collaboration/:sejourId/budget` (`collaboration.controller.ts:150`) est sous `@Roles(ORGANISATEUR, HEBERGEUR, SIGNATAIRE)` (l.34) et `verifyAccess` accepte l'hébergeur du centre (`isHebergeur`, service l.84+) → `budgetData` SE CHARGE pour un hébergeur. ⚠️ Seule nuance : `page.tsx:286` ne déclenche `loadBudget` sur l'onglet devis que si `!isDirect` — l'aperçu étant gaté `!isDirect` (B2), c'est couvert.
- Verdict : **aucun blocage** — VueOrganisateur tourne avec un compte hébergeur, en lecture pure.

## 5) `SejourHeader.tsx` — ✅

- **l.390** : `<div className="flex items-center gap-2 shrink-0">` = bloc d'actions de droite, point d'insertion du bouton.
- **l.4 + l.60** : `useRouter` importé, `const router = useRouter()` disponible.

## 6) BUILD / Suspense — ⚠️ WRAP REQUIS

- `useSearchParams` est utilisé dans 12 pages client du repo, et les pages vérifiées l'encapsulent TOUTES dans un `<Suspense>` : `dashboard/organisateur/page.tsx` (l.562-564, export default = `<Suspense><Inner/></Suspense>`), `dashboard/hebergeur/planning/page.tsx` (l.72-78, avec fallback). Pattern maison confirmé → **`sejour/[id]/page.tsx` devra être wrappé pareil** (composant interne + export default Suspense), sinon erreur de build Next « useSearchParams() should be wrapped in a suspense boundary ».

## Conclusion

Les 6 points sont confirmés. Le plan Phase 2 est applicable ; seul ajustement anticipé : le wrap Suspense de `page.tsx` (pattern identique aux autres pages du repo).
