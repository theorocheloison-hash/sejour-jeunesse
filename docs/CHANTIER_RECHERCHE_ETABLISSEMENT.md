# Chantier « Recherche établissement gatée » — Plan d'exécution CC

> **Statut** : plan validé (Théo, 20/08). Rien codé, rien poussé. Empilé sur le commit `cdea3e3` (capture nom d'établissement, non poussé).
> **Rédigé à partir du code réel** (census MCP 20/08). Ancrages ✅ VÉRIFIÉ = lus ; 🔍 À CENSER = délégués à la Phase 1 CC de la couche.
> **Objectif** : rendre la recherche d'établissement simple, intuitive et gatée — même parcours pour un collège (Éducation Nationale) ou une mairie (SIRENE). Consolider la duplication backend au passage. Fix à la source, chirurgical, pas de patch, pas de dette.

---

## 0. Décisions verrouillées

| # | Décision |
|---|---|
| V1 | **Voie 2** : `ClientsService.searchEtablissement` délègue à `EtablissementsService.rechercher` (supprime la duplication ÉN). |
| V2 | **Gate universel nom + CP** : Scolaire (ÉN) et Autre (SIRENE) suivent le même parcours. |
| V3 | **Composant de recherche gaté réutilisable** (servira aussi à l'étape « payeur à la facture » du chantier racine). |
| V4 | On **empile** sur `cdea3e3` (on garde le champ Établissement éditable + garde-fou payload) ; on **remplace** seulement le `OrganisationSearch` de la modale. |
| V5 | La recherche par **UAI dans le champ nom est abandonnée** (le nouveau flux a des champs Nom + CP séparés ; l'UAI n'a plus de place). Perte assumée. |

---

## 1. Cahier des charges UX (le parcours, verrouillé)

1. L'utilisateur clique **Scolaire** ou **Autre organisation**. Visuellement **rien ne s'affiche** (pas de résultats) — le clic ne fait que fixer la source à interroger (ÉN ou SIRENE).
2. Deux champs **Nom** + **Code postal** sont visibles. Tant que **les deux** ne sont pas remplis (nom ≥ 2 caractères ET CP = 5 chiffres), **aucune requête, aucun dropdown**.
3. **Feedback permanent** pour que le silence soit compris — jamais de vide inexpliqué :
   - nature non choisie → « Choisissez d'abord le type d'organisation ».
   - nom saisi, CP manquant → « Ajoutez le code postal pour lancer la recherche ».
   - recherche en cours → indicateur.
   - aucun résultat → « Aucun résultat — vérifiez l'orthographe, ou saisissez le nom à la main ci-dessous ».
4. Nom + CP remplis → requête ancrée, **liste courte**. Un CP couvrant plusieurs communes affiche la commune sur chaque ligne (l'utilisateur choisit).
5. Clic sur un résultat → remplit **Établissement + adresse + ville** (valeurs exactes de la fiche), + email/téléphone **si vides**.
6. **Champ Établissement toujours éditable** en dessous → « pas trouvé ? saisissez-le à la main ». Données enregistrées correctement même sans passer par la recherche.

---

## 2. La carte du code (✅ VÉRIFIÉ)

**Deux recherches ÉN parallèles (duplication) :**
- `ClientsService.searchEtablissement(q)` — `nom_etablissement LIKE "${q}%"` (préfixe faible, pas de CP). **Utilisée par la modale** via lib `searchEtablissement`. Endpoint `/clients/search-etablissement` (gardé HEBERGEUR/crm/COMPLET, `q` seul).
- `EtablissementsService.rechercher(q, cp, type)` — `search(nom) OR search(commune)` + `code_postal` + `type_etablissement` (riche). Endpoint `/etablissements/recherche` (public). **Dort à côté.**

**SIRENE :** `OrganisationsService.searchExternal(q)` — `recherche-entreprises.api.gouv.fr?q=...` (pas de CP aujourd'hui, mais l'API accepte `&code_postal=`). Cache mémoire 5 min par clé `normaliserCle(q)`. Endpoint `/organisations/search`.

**Modules :** `EtablissementsModule` **n'exporte pas** `EtablissementsService` ; `ClientsModule` importe seulement `PrismaModule`.

**Contrat de retour à préserver** (ce que le front `EtablissementEN` attend) : `{ uai, nom, type, adresse, codePostal, ville, email, telephone, academie }`.
`EtablissementResult` (de `EtablissementsService`) renvoie : `{ uai, nom, type, nature, adresse, codePostal, commune, mail, telephone, academie }`.
→ **Remap obligatoire : `commune→ville`, `mail→email`, drop `nature`.**

---

## 3. Pièges anti-cascade (à graver dans chaque Phase 2)

1. **Remap ÉN** (`commune→ville`, `mail→email`) dans la délégation — sinon le front reçoit des champs vides. Fix à la source dans le passe-plat.
2. **`cp` optionnel partout** (backend + libs) → rétrocompatibilité : aucun appelant existant ne casse tant qu'il ne passe pas `cp`. C'est ce qui rend chaque couche déployable seule.
3. **Cache SIRENE** : la clé doit inclure `cp` (`normaliserCle(q) + '|' + (cp ?? '')`), sinon collisions entre recherches même nom / CP différents.
4. **`OrganisationSearch` n'est PAS supprimé** : il reste utilisé par d'autres écrans (inviter-enseignant, StructureSearch, appel-offres). On le remplace **uniquement dans la modale**.
5. **Code mort à supprimer** : le fetch ÉN dupliqué dans `ClientsService.searchEtablissement` (constantes `API_BASE`/`FIELDS` locales, `isUai`, `whereClause`, le `fetch`, le `.map`) → disparaît, remplacé par la délégation.
6. **Perte recherche UAI** (V5) : assumée. Ne pas réintroduire un chemin UAI dans le champ nom.

---

## COUCHE 1 — Backend : consolidation ÉN + CP (Voie 2) + SIRENE CP

**Objectif** : les endpoints acceptent `cp` (optionnel), la recherche ÉN est consolidée (une seule implémentation), SIRENE accepte l'ancrage CP. Rétrocompatible : tant que le front ne passe pas `cp`, comportement inchangé.

### Fichiers
- `backend/src/etablissements/etablissements.module.ts` ✅ (ajouter export)
- `backend/src/clients/clients.module.ts` ✅ (ajouter import)
- `backend/src/clients/clients.service.ts` ✅ (déléguer + remap + supprimer duplication)
- `backend/src/clients/clients.controller.ts` ✅ (ajouter `@Query('cp')`)
- `backend/src/organisations/organisations.service.ts` ✅ (`searchExternal(q, cp?)` + cache)
- `backend/src/organisations/organisations.controller.ts` 🔍 À CENSER (signature actuelle de la route search)
- `backend/src/etablissements/etablissements.service.ts` ✅ (accepte déjà `q, cp, type` — ne pas modifier sauf besoin confirmé en Phase 1)

### PROMPT CC — COUCHE 1, PHASE 1 (census)

```
CONTEXTE : chantier "recherche établissement gatée". On consolide deux recherches ÉN
dupliquées (Voie 2 : ClientsService.searchEtablissement délègue à
EtablissementsService.rechercher) et on ajoute un filtre code postal (cp) optionnel
partout, y compris SIRENE. Rétrocompatible : cp optionnel.

Vérifie tout sur le CODE RÉEL. Ne modifie rien.

PHASE 1 — LECTURE SEULE. Rapporte :
1. organisations.controller.ts : signature exacte de la route GET search
   (/organisations/search) — quels @Query aujourd'hui, où ajouter cp.
2. organisations.service.ts searchExternal : confirme l'URL (recherche-entreprises),
   la clé de cache (normaliserCle(q)), et que l'API accepte un paramètre code_postal.
3. clients.service.ts searchEtablissement : confirme le fetch ÉN dupliqué à supprimer
   (API_BASE, FIELDS, isUai, whereClause LIKE, map). Confirme la forme de retour
   actuelle { uai, nom, type, adresse, codePostal, ville, email, telephone, academie }.
4. etablissements.service.ts rechercher : confirme qu'il retourne
   { uai, nom, type, nature, adresse, codePostal, commune, mail, telephone, academie }
   et gère déjà q + cp. (On remappera commune→ville, mail→email.)
5. clients.controller.ts : la route GET search-etablissement, où ajouter @Query('cp').
6. Confirme qu'aucun autre appelant de ClientsService.searchEtablissement ou de
   searchExternal n'existe hors des controllers (grep), pour être sûr que changer la
   signature (ajout cp optionnel) ne casse personne.

STOP. Rapport clair. N'exécute pas la Phase 2.
```

### PROMPT CC — COUCHE 1, PHASE 2 (écriture — commits atomiques)

```
PHASE 2 — ÉCRITURE. Après validation. cp est OPTIONNEL partout (rétrocompat).

Commit 1 — consolidation ÉN (Voie 2) :
- etablissements.module.ts : ajouter exports: [EtablissementsService].
- clients.module.ts : ajouter EtablissementsModule aux imports.
- clients.service.ts :
  * injecter EtablissementsService dans le constructeur.
  * réécrire searchEtablissement(query: string, cp?: string) pour DÉLÉGUER à
    this.etablissements.rechercher(query, cp) et REMAPPER le résultat vers la forme
    existante : ville = r.commune, email = r.mail, (drop nature) ; les autres champs
    à l'identique (uai, nom, type, adresse, codePostal, telephone, academie).
  * SUPPRIMER le fetch ÉN dupliqué (API_BASE, FIELDS, isUai, whereClause, fetch, map).
    Ne rien laisser de mort.
- clients.controller.ts : searchEtablissement(@Query('q') q, @Query('cp') cp) →
  service.searchEtablissement(q ?? '', cp).

Commit 2 — SIRENE cp :
- organisations.service.ts : searchExternal(q: string, cp?: string).
  * si cp fourni ET non vide, ajouter &code_postal=${encodeURIComponent(cp)} à l'URL.
  * clé de cache = normaliserCle(q) + '|' + (cp ?? '') (éviter collisions).
- dto/search-organisations.dto.ts : AJOUTER un champ cp optionnel au DTO. (Choix de
  qualité : garder le controller homogène — un seul @Query() dto — et valider cp côté
  backend. NB : un @Query('cp') séparé fonctionnerait aussi — le whitelist ne strippe
  que l'objet DTO validé, PAS les bindings @Query('champ') primitifs — mais on préfère
  le DTO pour la validation 5 chiffres.) Ajouter :
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @Matches(/^\d{5}$/, { message: 'Code postal invalide (5 chiffres attendus)' })
    cp?: string;
  (le @Transform ''→undefined évite une 400 sur les recherches sans CP.)
- organisations.controller.ts : search() passe dto.cp au service (searchExternal(dto.q, dto.cp)).
- NE PAS toucher /public/organisations/search (public.controller.ts) : la route
  appel-offres reste sans cp ; searchExternal(q, cp?) optionnel la laisse intacte.
- NE PAS toucher importerProspects (clients.service) : ses constantes ÉN sont
  indépendantes de celles de searchEtablissement.

Contraintes :
- cp OPTIONNEL : les appels existants sans cp doivent se comporter comme avant.
- Fix à la source, pas de branche conditionnelle superflue.
- AUCUNE migration Prisma (rien en base).
- Gates : tsc --noEmit = 0, build, tests verts. Commits atomiques (ÉN, puis SIRENE).
- Ne pousse pas.

STOP. Diff résumé + confirmation : le contrat de retour de /clients/search-etablissement
est INCHANGÉ (mêmes noms de champs), et le fetch dupliqué est supprimé.
```

### Code mort à traiter
Fetch ÉN dupliqué dans `ClientsService.searchEtablissement` → supprimé (remplacé par délégation). Rien d'autre.

### Recette Couche 1
Sans front modifié, tester par URL :
- `/clients/search-etablissement?q=jean+moulin&cp=74110` (authentifié) → résultats ancrés, champs `ville`/`email` présents.
- `/organisations/search?q=mairie&cp=74110` → résultats filtrés par CP.

---

## COUCHE 2 — Frontend : composant de recherche gaté (réutilisable)

**Objectif** : un composant autonome qui implémente le cahier des charges UX §1. Réutilisable (modale de création + futur payeur facture).

### Nom proposé
`frontend/src/components/RechercheOrganisation.tsx` (nom à confirmer). **Ne pas modifier `OrganisationSearch.tsx`** (autres consommateurs).

### Interface proposée
```
interface RechercheOrganisationProps {
  onSelect: (r: {
    nom: string; adresse: string | null; codePostal: string | null;
    ville: string | null; email: string | null; telephone: string | null;
    uai: string | null; siret: string | null; typeClient: string;
  }) => void;
}
```
- Le composant gère EN INTERNE : la bascule Scolaire/Autre, les champs Nom + CP, le gate, le feedback, le dropdown, l'appel API selon la nature.
- Il ne porte PAS le champ "Établissement" éditable final — c'est l'appelant (la modale) qui le garde comme source de vérité. Le composant se contente de remonter la sélection via onSelect.

### Libs à étendre
- `frontend/src/lib/clients.ts` : `searchEtablissement(q, cp?)` → `params: { q, cp }`.
- L'appel SIRENE (aujourd'hui inline dans OrganisationSearch : `api.get('/organisations/search', { params: { q } })`) → une fonction lib `searchOrganisationSirene(q, cp?)` avec `params: { q, cp }` 🔍 à localiser/créer en Phase 1.

### PROMPT CC — COUCHE 2, PHASE 1 (census)

```
CONTEXTE : chantier recherche gatée, couche frontend. On crée un composant de recherche
AUTONOME (bascule Scolaire/Autre + champs Nom + CP + gate strict + feedback), qui appelle
l'ÉN (mode Scolaire) ou SIRENE (mode Autre) seulement quand nom>=2 ET cp=5 chiffres, et
remonte la sélection via onSelect. On NE modifie PAS OrganisationSearch (autres écrans).

Vérifie sur le CODE RÉEL. Ne modifie rien.

PHASE 1 — LECTURE SEULE. Rapporte :
1. frontend/src/lib/clients.ts : signature actuelle de searchEtablissement, type
   EtablissementEN. Où ajouter cp.
2. Comment le front appelle SIRENE aujourd'hui : y a-t-il une lib dédiée, ou seulement
   l'appel inline dans OrganisationSearch (api.get('/organisations/search', {params:{q}}))
   et dans d'autres écrans (inviter-enseignant, StructureSearch) ? Lister les appelants
   de /organisations/search côté front.
3. La forme du résultat SIRENE renvoyé par /organisations/search (data.results[*]) :
   quels champs (nom, siret, adresse, codePostal, ville, typeStructure...).
4. Le style/pattern des composants existants (OrganisationSearch) pour rester cohérent
   visuellement (classes Tailwind, dropdown).

STOP. Rapport clair. N'exécute pas la Phase 2.
```

### PROMPT CC — COUCHE 2, PHASE 2 (écriture)

```
PHASE 2 — ÉCRITURE. Après validation. Après que la Couche 1 (backend cp) est en place.

1. Lib clients.ts : searchEtablissement(q: string, cp?: string) → params { q, cp }.
2. Créer (ou compléter) une fonction lib searchOrganisationSirene(q, cp?) →
   api.get('/organisations/search', { params: { q, cp } }), forme de retour typée.
   (Ne pas casser les appels existants sans cp.)
3. Créer frontend/src/components/RechercheOrganisation.tsx :
   - State interne : nature ('SCOLAIRE'|'AUTRE'|null), nom, cp, results, loading.
   - Deux boutons Scolaire / Autre organisation (au clic : fixe nature, VIDE results,
     n'affiche rien d'autre).
   - Deux champs Nom + Code postal.
   - GATE : ne lancer une requête que si nature != null ET nom.trim().length >= 2 ET
     /^\d{5}$/.test(cp). Debounce ~300ms + AbortController.
   - Selon nature : SCOLAIRE → searchEtablissement(nom, cp) ; AUTRE →
     searchOrganisationSirene(nom, cp).
   - Feedback (voir cahier des charges) : nature manquante / cp manquant / recherche /
     aucun résultat. Jamais de vide inexpliqué.
   - Dropdown : chaque ligne montre nom + commune. Clic → onSelect(résultat normalisé)
     puis reset des champs de recherche du composant.
   - Normaliser le résultat vers la forme de l'interface onSelect (mapper ÉN et SIRENE
     vers { nom, adresse, codePostal, ville, email, telephone, uai, siret, typeClient }).
   - NE PAS porter le champ Établissement final (c'est l'appelant).

NE PAS toucher OrganisationSearch.tsx ni ses autres consommateurs.
Fix à la source. Gates tsc 0 / build / tests. Commit atomique. Ne pousse pas.

STOP. Confirme que OrganisationSearch est inchangé et lister les fichiers créés/touchés.
```

### Code mort
Aucun en couche 2 (on crée, on ne remplace pas encore).

---

## COUCHE 3 — Intégration dans la modale

**Objectif** : remplacer le `OrganisationSearch` du bloc PROFESSIONNEL de `CreateSejourModal` par `RechercheOrganisation`, en gardant le champ « Établissement » éditable (source de vérité).

### Fichier
- `frontend/app/dashboard/_shared/CreateSejourModal.tsx` ✅ (état post-`cdea3e3`)

### PROMPT CC — COUCHE 3, PHASE 2 (écriture — pas de census, fichier déjà connu)

```
PHASE 2 — ÉCRITURE. Après validation, après Couches 1 et 2.

Dans CreateSejourModal.tsx, bloc clientType === 'PROFESSIONNEL' :
- Remplacer <OrganisationSearch .../> par <RechercheOrganisation onSelect={handleSelectOrg} />.
- handleSelectOrg reçoit désormais le résultat normalisé du nouveau composant : conserver
  le comportement actuel — clientOrganisation = r.nom ; adresse/CP/ville depuis r
  (r.xxx ?? f.xxx) ; email/téléphone si vides. (Le handler existe déjà, adapter la forme
  du paramètre.)
- CONSERVER le champ texte "Établissement" éditable (form.clientOrganisation) et son
  micro-libellé : c'est la source de vérité et le chemin de saisie manuelle.
- Retirer l'import de OrganisationSearch dans ce fichier s'il n'y est plus utilisé
  (mais NE PAS supprimer le composant OrganisationSearch lui-même).

Ne pas toucher : mode Particulier, garde-fou payload clientType, autocomplétion CRM.
Fix à la source. Gates tsc 0 / build / tests. Commit atomique. Ne pousse pas.

STOP. Diff + confirmation que le champ Établissement éditable et le garde-fou payload
sont intacts.
```

### Code mort
Import `OrganisationSearch` dans `CreateSejourModal` devenu inutile → retirer (le composant reste pour les autres écrans).

---

## 4. Ordre de déploiement

1. **Couche 1** (backend cp, rétrocompatible) — déployable seule, ne change rien pour le front actuel.
2. **Couche 2** (composant + libs) — déployable, le composant existe mais n'est pas encore branché.
3. **Couche 3** (intégration modale) — bascule visible pour l'utilisateur.

À chaque déploiement : `git status`/`git log` avant, gates verts, diff relu par Claude sur fichiers réels, Théo pousse, preuve de déploiement.

Test en local possible dès la Couche 1 (rappel : `$env:MOLLIE_API_KEY` avant `npm run start:dev` tant que `main.ts` n'a pas `import 'dotenv/config'`).

---

## 5. Recette finale (le parcours complet)

- [ ] Clic Scolaire → rien ne s'affiche ; champs Nom + CP visibles.
- [ ] Nom seul → « ajoutez le code postal » ; aucune requête réseau (vérifier l'onglet Network).
- [ ] Nom + CP → liste courte, ancrée ; commune visible sur chaque ligne.
- [ ] « jean moulin » + CP trouve « Collège Jean Moulin » (preuve que le LIKE préfixe est mort).
- [ ] Clic résultat → Établissement + ville + adresse remplis correctement.
- [ ] Clic Autre + « mairie » + CP → résultats SIRENE ancrés.
- [ ] Pas trouvé → saisie manuelle dans Établissement, création OK, données enregistrées.
- [ ] Autres écrans utilisant OrganisationSearch : inchangés.
- [ ] tsc 0 / build / tests verts ; aucune migration Prisma.
```
