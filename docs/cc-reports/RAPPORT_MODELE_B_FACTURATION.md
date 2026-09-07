# RAPPORT — Modèle B « devis figé / facture ajustable »

> Démarré le 07/09/2026. Écrit en temps réel au fil du chantier.
> Base : `main` = `85421ed` (origin/main aligné). Modifs locales préexistantes de Théo sur
> `LIAVO_SESSION_STATE.md` + `docs/ROADMAP_ETE_2026.md` — non touchées, jamais commitées ici.

## PHASE 1 — CENSUS (lecture seule, tout lu sur code réel)

### backend/src/devis/devis.service.ts (2705 l.)
- **`updateDevis` (l.429-537)** : garde statuts `['EN_ATTENTE','SELECTIONNE','SIGNE_DIRECTION']` (l.441)
  avec le commentaire « Lot 1 : modifiable jusqu'à la signature direction incluse… » (l.439-440) — périmé.
  Séquence : ownership → garde statut → upload PDF éventuel → `ligneDevis.deleteMany` (l.455)
  → `devis.update` (l.460, spreads `??`) → `createMany` lignes → sync `DemandeDevis`
  (+ `sejour.placesTotales`) si `nombreEleves`/`nombreAccompagnateurs` fournis et `demandeId` non-null.
  **AUCUNE vérification de factures existantes** (le trou complémentaires est documenté côté front,
  TabDevisFacturation l.669-679 : « le frontend est la seule protection réelle »).
  EN_ATTENTE_VALIDATION n'est PAS dans la whitelist actuelle (un devis parti chez la direction n'est
  pas modifiable aujourd'hui — le modèle B l'AJOUTE avec reset silencieux → EN_ATTENTE).
- **`envoyerDevis` (l.1422-1602)** : garde `statut !== 'EN_ATTENTE'` → refus (l.1470). Conforme au
  modèle cible, seule la 2e phrase du commentaire l.1468-1469 (« il s'ajuste avant le solde ») est périmée.
- **`signerDevisDirect` (l.2209-2342)** : garde `statut !== 'EN_ATTENTE'` → refus (l.2236). Passe le
  devis à SELECTIONNE + séjour CONVENTION. Interdit de modification par ce chantier — RAS.
- **`envoyerADirection` (l.2347-2455)** : garde EN_ATTENTE, crée `InvitationDirecteur`
  (token aléatoire, `devisId`, `sejourId`), passe le devis à EN_ATTENTE_VALIDATION. Non touché.
- **`annulerDevis` (l.2600-2704)** : statuts annulables EN_ATTENTE/SELECTIONNE/SIGNE_DIRECTION, exige
  un avoir 1-1 sur chaque facture ACOMPTE/SOLDE émise. Non touché (cycle avoir/ré-émission = interdit).
- `createDevisComplementaire` (l.1608) : `tauxTva: dto.tauxTva ?? 0` — la « moyenne pondérée » est
  calculée CÔTÉ FRONT (TabDevisFacturation l.680-683 : `totalHT>0 ? round2((totalTVA/totalHT)*100) : 0`).
  C'est cette formule que le Lot B reprend côté backend.

### backend/src/facture/facture.service.ts (1363 l.)
- **`estIntegralementAnnulee` (privée, l.353-360)** : avoir 1-1 couvrant exactement le montant (comparaison
  en centimes). **`chargerFacturesActives` (privée, l.363-370)** : findMany par devisId+types avec include
  `avoirAssocie`, filtre les intégralement annulées. Usages : emettreAcompte (l.387), emettreFactureSolde
  (l.479+487), emettreFactureTotal (l.639), ajouterVersement (l.1064, via estIntegralementAnnulee direct).
- **`emettreAcompte` (l.373-470)** : garde statut (complémentaire : ≠NON_RETENU ; sinon SELECTIONNE|SIGNE_DIRECTION),
  garde acompte actif unique. `montantTTC = round2(devis.montantTTC ?? montantTotal)` ;
  `montantFacture = round2(devis.montantAcompte ?? (montantTTC × pct/100))` avec `pct = devis.pourcentageAcompte ?? 30`.
  Snapshot `devis.lignes` → LigneFacture. PDF await, loggerActivite, notif COLLAB (demandeId) non bloquante.
- **`emettreFactureSolde` (l.473-615)** : acompte actif requis + `acompteVerse`, pas de solde actif.
  `acompteEncaisse = max(montantVerseTotal ?? 0, montantFacture)` ; si `montantTTC <= acompteEncaisse` →
  exige avoir sur l'acompte, `acompteNet = encaisse + avoir.montantFacture` (négatif) ;
  `montantFacture = round2(max(0, montantTTC − acompteNet))`. Snapshot lignes devis.
- **`emettreFactureTotal` (l.623-726)** : mêmes gardes statut qu'acompte + AUCUNE facture active
  ACOMPTE/SOLDE. `montantFacture = montantTTC`, `pourcentageAcompte: null`, snapshot lignes devis.
- Les 3 émissions lisent les montants agrégés depuis le devis (`montantHT/TVA/TTC/tauxTva`) — c'est
  exactement le point d'injection des lignes ajustées du Lot B.
- `chargerDevisProprietaire` (l.165) : findUnique SANS select (tous scalaires dont `pourcentageAcompte`)
  + include lignes/centre/demande/sejourDirect. `emettreAvoir` (l.733), `envoyerFactureParEmail` (l.866),
  `ajouterVersement` (l.1014, filtre actives + throw si aucune) : non touchés.
- `loggerActivite` (l.325-345) : type 'FACTURE', description libre — le Lot B enrichit la description.

### Controllers + DTOs
- `facture.controller.ts` : POST /factures/{acompte,solde,total} avec body **inline** `{ devisId: string }`
  (AUCUN DTO class-validator aujourd'hui — la validation globale `ValidationPipe({whitelist,transform})`
  de main.ts l.79 ne mord pas sur un type inline). Guards HEBERGEUR + RequirePermission('facturation') + PlanGuard.
- `devis.controller.ts` : PATCH /devis/:id → UpdateDevisDto (tous champs optionnels, lignes = LigneDevisDto[]).
  `LigneDevisDto` (create-devis.dto.ts) : description/quantite/prixUnitaire/totalHT/totalTTC requis, tva
  et produitCatalogueId optionnels — modèle pour le DTO d'émission.

### backend/src/invitations-directeur/invitations-directeur.service.ts (290 l.)
- **`findByToken` (l.15-113)** : renvoie l'invitation + le devis complet (statut inclus) mais **AUCUN
  signal « devis modifié »** — la page publique ne peut pas distinguer un devis repassé EN_ATTENTE.
- **`signerSansCompte` (l.203-289)** : vérifie invitation existe / non signée / devisId non-null puis
  **signe SANS AUCUNE vérification du statut du devis** (l.237 : update direct → SIGNE_DIRECTION).
  Bug confirmé : un vieux lien signe n'importe quel état (y compris un devis modifié repassé EN_ATTENTE,
  un devis déjà signé par ailleurs, ou un NON_RETENU).
- `creer()` (l.122-201, flux ORGANISATEUR connecté) exige devis SELECTIONNE à la création de l'invitation ;
  `envoyerADirection` (devis.service) crée l'invitation sur un devis EN_ATTENTE → EN_ATTENTE_VALIDATION.
  D'où la whitelist Lot C `['EN_ATTENTE_VALIDATION','SELECTIONNE']` qui couvre les deux flux.

### frontend/app/dashboard/sejour/[id]/_components/TabDevisFacturation.tsx (1863 l.)
- **« Modifier le devis » (l.1401-1408)** : `peutEcrireDevis && ['EN_ATTENTE','EN_ATTENTE_VALIDATION','SELECTIONNE','SIGNE_DIRECTION'].includes(devis.statut) && !factureAcompte`.
- **« Ajuster avant solde » (l.1419-1427)** : `peutEcrireDevis && factureAcompte && !factureSolde && (SELECTIONNE|SIGNE_DIRECTION)` → même page modifier.
- **Handlers d'émission (l.326-366)** : `handleFacturerAcompte/Solde/Total` = appels à sec
  (`emettreFactureAcompte(activeDevisId)` etc.) + reload. Boutons aux l.1113-1140 (AUCUNE → acompte/total ;
  ACOMPTE → solde, gaté `factureAcompte.acompteVerse`).
- **Modale complémentaire (l.1684-1792)** = le pattern éditeur de lignes à dupliquer : `compForm.lignes`,
  `calcCompTotaux` (l.600-611 : PU saisi TTC → PU HT stocké `round2(puTTC/(1+tva/100))`, totaux round2),
  `CatalogueSuggestionInput` par ligne, add/remove, TVA pondérée l.680-683. Reconstitution PU TTC
  idempotente : `openEditComplementaire` l.643-645 (`quantite>0 ? round2(totalTTC/quantite) : round2(pu×(1+tva/100))`).
- **Dérivations (l.302-324)** : `estIntegralementAnnulee` (miroir front), `plusRecenteActive(type)`,
  `factureAcompte/factureSolde/etatFacturation/factureCibleVersement`.
- **Cartes pipeline (l.951-976)** : « Total TTC » = `ad.montantTTC` (devis figé), « Acompte (X%) » =
  `ad.montantAcompte` — mensongères dès qu'une facture ajustée existe. La variable `base` (l.858-860,
  Σ montantFacture toutes factures, avoirs négatifs inclus) existe déjà dans `renderFacturationPipeline`.
- `devis` state = `getDevisForSejour` → include lignes + factures(lignes+versements) + centre : la modale
  d'émission a tout ce qu'il faut sous la main.

### frontend/app/dashboard/hebergeur/devis/[id]/modifier/page.tsx (422 l.)
- **AUCUNE garde d'entrée sur le statut** — un devis signé/facturé se charge et s'enregistre (le backend
  actuel l'autorise pour SELECTIONNE/SIGNE_DIRECTION).
- `factureAcompte` (l.188), bandeau amber l.383-388 (« Vos modifications ajusteront le solde »),
  `totauxExtraSlot` l.350-355 (avertissement TTC < acompte facturé) — les 3 deviennent du code mort en modèle B.

### frontend/app/invitation-direction/[token]/page.tsx (370 l.)
- États rendus : loading / `loadError` (lien invalide) / `signed` (déjà signé ou succès) / formulaire
  de signature + aperçu PDF. **Aucun état « devis modifié »** ; le type `InvitationDirecteurPublic` n'a
  pas de champ `devisModifie`. `handleSign` (l.200-220) : sur `!res.ok` → message générique
  « Une erreur est survenue » (le message backend est perdu).

### frontend/src/lib/devis.ts (598 l.)
- `emettreFactureAcompte/Solde/Total(devisId)` (l.459-474) : POST body `{ devisId }` — pas de lignes.

### Divers
- **schema.prisma l.1054** : « Le Devis reste modifiable après l'acompte ; le solde se calcule sur le
  total révisé − acompte. » — périmé, à réécrire (commentaire seul).
- **TabNotes** : existe (`_components/TabNotes.tsx`), lit les ActiviteClient par sejourId via
  `getActivitesSejour(sejourId)` (section B « activités », l.137-156). Les descriptions CRM enrichies
  du Lot B y apparaîtront. **Rien créé.**
- Baseline tests backend connue : 4 rouges pré-existants (`facture.service.spec.ts`, mock
  `centreHebergement.findUnique` périmé) + jest sans dotenv (`MOLLIE_API_KEY=test_dummy` requis).
  Gates du chantier = tsc + build (comme demandé) ; le spec facture référence chargerFacturesActives
  seulement en commentaire (l.178) — le déplacement vers un helper ne casse rien de plus.

### Divergences / interprétations consignées AVANT écriture
1. **Ordre Lot A / Lot B** : le Lot A (commit 1) doit appeler `chargerFacturesActives` « via le helper du
   Lot B » (commit 2). Pour garder les gates verts à chaque commit, le fichier
   `facture-active.helper.ts` est CRÉÉ au commit 1 (fonctions déplacées à l'identique, consommées par
   DevisService) ; le commit 2 bascule FactureService dessus et supprime les copies privées.
2. **EN_ATTENTE_VALIDATION dans updateDevis** : ce statut n'est PAS modifiable aujourd'hui (pas dans la
   whitelist actuelle) — le modèle B ne restreint donc pas ce cas, il l'OUVRE (avec reset → EN_ATTENTE).
   Conforme au point 2 du contexte produit, mais c'est un ajout de capacité, pas un retrait.
3. **Formule tauxTva pondéré** : « même formule que createDevisComplementaire » = la formule FRONT
   (l.680-683 de TabDevisFacturation), le backend stockant `dto.tauxTva ?? 0`. Reprise backend :
   `totalHT > 0 ? round2((montantTVA/montantHT)*100) : 0`.
4. **Garde solde de la modale (Lot D-d)** : miroir strict du backend — blocage seulement si
   `TTC révisé ≤ acompte encaissé BRUT` ET aucun avoir sur l'acompte (avec avoir, le backend calcule
   l'acompte net et peut émettre, jusqu'à un solde de 0 €). L'affichage « Déjà encaissé » montre le net.
5. **Page invitation-direction (Lot E)** : l'état « devis modifié » est rendu en carte pleine page (comme
   l'état signé), PAS seulement à la place du formulaire — afficher l'aperçu PDF d'un devis périmé sous
   un bandeau « demandez un nouveau lien » serait trompeur.
6. **signerSansCompte (Lot C)** : la whitelist `['EN_ATTENTE_VALIDATION','SELECTIONNE']` couvre les deux
   flux de création d'invitation (envoyerADirection → EN_ATTENTE_VALIDATION ; creer() organisateur →
   SELECTIONNE). Un devis déjà SIGNE_DIRECTION retombe dans le message générique (l'invitation `signeAt`
   bloque déjà le lien utilisé ; ceci bloque un 2e lien parallèle).

## PHASE 2 — COMMITS

### Commit 1 — `94a6378` feat(devis): devis signé immuable (Lot A)
- **Fichiers** : `backend/src/devis/devis.service.ts`, `backend/src/facture/facture-active.helper.ts`
  (NOUVEAU), `backend/prisma/schema.prisma` (+52/−6).
- **Diff** : whitelist updateDevis → `['EN_ATTENTE','EN_ATTENTE_VALIDATION']` avec message dédié pour
  SELECTIONNE/SIGNE_DIRECTION (« Un devis signé est immuable… ») et message générique pour le reste
  (NON_RETENU, FACTURE_* legacy) ; garde factures actives AVANT le `deleteMany` (ForbiddenException
  « Ce devis a une facture active… ») ; spread conditionnel `statut: EN_ATTENTE` dans le `devis.update`
  quand le statut chargé est EN_ATTENTE_VALIDATION ; commentaires « Lot 1 » et model Facture réécrits.
- **Helper créé dès ce commit** (cf. divergence n°1 du census) : code déplacé à l'identique de
  facture.service.ts, signature `chargerFacturesActives(prisma, devisId, types)`.
- **Gates** : tsc 0, build 0 (backend).

### Commit 2 — `2d9bba3` feat(facture): émission avec lignes révisées (Lot B)
- **Fichiers** : `facture.service.ts`, `facture.controller.ts`, `dto/emettre-facture.dto.ts` (NOUVEAU)
  (+134/−53).
- **Diff** : DTO `EmettreFactureDto { devisId (IsUUID), lignes? (LigneEmissionFactureDto[]) }` branché
  sur les 3 POST (les bodies inline non validés disparaissent — durcissement au passage : devisId
  désormais validé UUID) ; méthode privée `resoudreLignesEmission(devis, lignes?)` factorisant le choix
  lignes devis vs révisées + agrégats (TTC/HT/TVA round2, tauxTva pondéré `round2((TVA/HT)×100)`) ;
  ACOMPTE ajusté → `montantFacture = round2(TTC révisé × (pourcentageAcompte ?? 30)/100)` ;
  SOLDE → logique acompteEncaisse/acompteNet inchangée appliquée au TTC recalculé ; TOTAL →
  `montantFacture = montantTTC`. Suffixe CRM `(ajusté : devis X € → facturé Y €)` via
  `suffixeAjustement` quand `round2(ΣTTC) ≠ round2(devis.montantTTC ?? montantTotal)`.
- **Code mort supprimé** : copies privées `estIntegralementAnnulee` / `chargerFacturesActives`
  (6 sites d'appel basculés sur le helper, dont `ajouterVersement` l.1095).
- **Rétrocompat vérifiée** : sans `lignes`, chaque valeur écrite est byte-identique à l'ancien code
  (branche `ajuste: false` de resoudreLignesEmission = les expressions d'origine).
- **Gates** : tsc 0, build 0 (backend).

### Commit 3 — `f1b2a0f` fix(invitations-directeur): garde signer-sans-compte + devisModifie (Lot C)
- **Fichier** : `invitations-directeur.service.ts` (+20).
- **Diff** : `signerSansCompte` charge `devis.statut` et refuse hors
  `['EN_ATTENTE_VALIDATION','SELECTIONNE']` — EN_ATTENTE → « Ce devis a été modifié depuis l'envoi de
  cette invitation. Demandez un nouveau lien à l'organisateur. » ; sinon « Ce devis ne peut plus être
  signé via ce lien. » (couvre aussi devis introuvable/supprimé). `findByToken` renvoie
  `devisModifie = !!devis && devis.statut === 'EN_ATTENTE'`.
- **Gates** : tsc 0, build 0 (backend).

### Commit 4 — `a8a3e8b` feat(front): modale de préparation d'émission (Lot D)
- **Fichiers** : `TabDevisFacturation.tsx`, `devis-facturation/ModaleEmissionFacture.tsx` (NOUVEAU),
  `src/lib/devis.ts` (+343/−72).
- **Diff** :
  - `ModaleEmissionFacture` (type ACOMPTE/TOTAL/SOLDE) : éditeur de lignes dupliqué du pattern
    complémentaire (PU TTC saisi → HT dérivé round2, `CatalogueSuggestionInput` par ligne,
    ajout/suppression, catalogue chargé en interne) ; pré-remplissage depuis la facture non-AVOIR la
    plus récente (active OU annulée) sinon `devis.lignes`, PU TTC reconstitué `round2(totalTTC/quantite)` ;
    récap « Total TTC révisé » + par type (acompte X € (Y %) / « Déjà encaissé Z € → Solde W €
    (estimation…) », Z net d'avoir) ; blocage solde miroir backend (TTC ≤ encaissé brut ET pas d'avoir) ;
    notice art. 289 CGI sur les 3 types ; submit → `emettreFacture{Acompte|Total|Solde}(devisId, lignes)`
    puis `onEmitted` (ferme + reload devis/factures). Erreur : affichée inline DANS la modale ET
    propagée via `onError` (le bandeau parent reste visible après fermeture).
  - `handleFacturerAcompte/Solde/Total` = simples ouvreurs de modale ; `handleFacturerComplementaire`
    inchangé (appel direct sans lignes).
  - « Modifier le devis » → `peutEcrireDevis && ['EN_ATTENTE','EN_ATTENTE_VALIDATION']` ;
    « Ajuster avant solde » SUPPRIMÉ.
  - Cartes : « Total TTC » = `base` (Σ montantFacture, avoirs inclus — variable existante réutilisée)
    quand `factures.length > 0`, sinon TTC devis ; « Acompte » = `factureAcompte.montantFacture`
    (avec son pourcentage) quand elle existe, sinon `devis.montantAcompte`.
  - `lib/devis.ts` : type `LigneEmissionFacture` + param `lignes?` sur les 3 fonctions (body inchangé
    sans lignes → rétrocompat totale).
- **Code mort supprimé** : state `facturerLoading` + les 3 anciens handlers async + imports
  `emettreFactureAcompte`/`emettreFactureSolde` du Tab (Total reste utilisé par les complémentaires).
- **Gates** : tsc 0, build 0 (frontend).

### Commit 5 — `79acfdf` feat(front): garde page modifier + état invitation (Lot E)
- **Fichiers** : `modifier/page.tsx`, `invitation-direction/[token]/page.tsx` (+68/−20).
- **Diff** : écran bloquant pleine page si statut ∉ EN_ATTENTE/EN_ATTENTE_VALIDATION (lien « Retour
  aux devis ») ; bandeau EN_ATTENTE_VALIDATION « Enregistrer vos modifications annulera le lien
  d'invitation en cours — renvoyez le devis ensuite » ; code mort supprimé (const `factureAcompte`,
  bandeau acompte, `totauxExtraSlot`, alias `fmt`, import `formatMontant`). Page invitation :
  champ `devisModifie?` sur le type, état dédié pleine page (warning ambre, pas d'aperçu du devis
  périmé) prioritaire sous l'écran « déjà signé » ; `handleSign` parse le body d'erreur NestJS et
  affiche le message backend (fallback message générique).
- **Gates** : tsc 0, build 0 (frontend).

### Commit 6 — `0577807` chore(devis): commentaire envoyerDevis aligné modèle B
- Commentaire seul (« il s'ajuste avant le solde » → immuable/ajustement à la facture), autorisé
  par l'interdit « envoyerDevis (hors commentaire périmé) ». Gates tsc/build backend verts.

## RAPPORT FINAL

### Récapitulatif
6 commits sur `main` (`94a6378` → `0577807`), 0 migration Prisma, 0 changement de schéma (commentaire
seul), aucun branchement sur `modeGestion`/`natureSejour` introduit (grep vérifiable sur les diffs :
aucun des fichiers touchés n'ajoute de référence à ces champs).

### Interdits — conformité
Non touchés : cycle avoir/ré-émission (`emettreAvoir`, gardes B2), `envoyerFactureParEmail`,
`envoyerDevis` (logique intacte, 1 commentaire), routage versements (`ajouterVersement` : seule la
référence au helper a changé, logique identique), `signerDevisDirect`, `marquerDevisSigneHebergeur`,
`uploadSignaturePublic`, `getDevisPublicByToken`, PDF mappers/Factur-X/Chorus, convention/contrat.

### Écarts au prompt (tous justifiés au fil du rapport)
1. Helper factures actives créé au commit 1 (le Lot A en dépend) au lieu du commit 2 — le commit 2
   n'a fait que basculer FactureService dessus.
2. Erreur de la modale d'émission : inline + `onError` parent (le prompt donnait `onError` en prop
   sans préciser l'affichage inline ; les deux coexistent).
3. État « devis modifié » de la page invitation rendu en pleine page (pas seulement à la place du
   formulaire) pour ne pas montrer l'aperçu d'un devis périmé.
4. Blocage solde de la modale : déclenché sur l'encaissé BRUT sans avoir (miroir exact de la garde
   backend) ; l'affichage « Déjà encaissé » montre le NET (conforme au prompt point c/d).
5. `EmettreFactureDto.devisId` validé `@IsUUID()` — durcissement au passage (le body inline n'était
   pas validé du tout) ; aucun appelant ne passe autre chose qu'un id Prisma.

### Points d'attention pour la recette
- **Acompte ajusté** : `montantFacture` ignore `devis.montantAcompte` et recalcule sur le TTC révisé —
  un devis dont le montantAcompte avait été saisi À LA MAIN (≠ pct × TTC) donnera un acompte différent
  quand on passe par la modale AVEC lignes modifiées. Sans modification des lignes… les lignes sont
  QUAND MÊME envoyées (la modale envoie toujours `lignes`) → le chemin « ajusté » s'applique dès que la
  modale est utilisée, même sans changement. C'est le comportement voulu du prompt (« les boutons
  ouvrent une modale … puis émettent »), mais à savoir : l'ancien raccourci `devis.montantAcompte` ne
  joue plus pour les émissions passant par la modale.
- **Complémentaires** : émission inchangée (sans lignes), édition désormais bloquée SERVEUR après
  facturation (avant : front seulement).
- Recette prod à faire : (1) devis signé → plus de bouton Modifier, page modifier bloquante en URL
  directe, PATCH refusé ; (2) modale acompte/total/solde avec ajustement 48→49 ; (3) invitation
  direction : modifier un devis EN_ATTENTE_VALIDATION → lien affiche « devis modifié », signature
  refusée avec le bon message ; (4) non-régression complémentaires.
