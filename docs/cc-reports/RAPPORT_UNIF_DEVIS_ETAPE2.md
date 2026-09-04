# RAPPORT — Unification devis étape 2 : extraction des blocs dupliqués de TabDevisFacturation

> Branche : `feat/unif-devis-etape2-extraction` (depuis `main` = `f49d276`, à jour origin). **Aucun push, aucun merge.**
> NB : rapport laissé hors commit (add ciblé imposé par composant) ; à versionner à la main si souhaité.

## git log --oneline main..HEAD (5 commits)

```
b0793f2 refactor(devis): extraction DevisPdfViewer (viewer 80vh + DevisPDFInline déplacé)
908bf18 refactor(devis): extraction MarquerSignePanel (bouton + panneau multipart, state interne)
eb75a6e refactor(devis): extraction BlocConvention (state + handlers internes, contactEmail paramétré)
cae1007 refactor(devis): extraction BlocContratEvenement (state loading interne)
4dd855a refactor(devis): extraction BlocDevisSigne (DRY DIRECT/COLLAB, rendu identique)
```

## git diff main...HEAD --stat

```
TabDevisFacturation.tsx                        | 484 ++------------------- (2640 → ~2200 lignes)
devis-facturation/BlocContratEvenement.tsx     |  46 ++ (nouveau)
devis-facturation/BlocConvention.tsx           | 119 ++ (nouveau)
devis-facturation/BlocDevisSigne.tsx           |  28 ++ (nouveau)
devis-facturation/DevisPdfViewer.tsx           |  85 ++ (nouveau)
devis-facturation/MarquerSignePanel.tsx        | 106 ++ (nouveau)
6 fichiers, +429 / −439 (net négatif)
```

Aucun autre fichier touché (cascade #5 ✓).

## Census (Phase 1) — emplacements d'origine (numéros pré-extraction)

| Bloc | DIRECT | COLLAB | Corps identique ? |
|---|---|---|---|
| Devis signé | 1600-1616 | 2118-2135 | ✓ (devis.* vs d.*) |
| Contrat événement | 1671-1686 | 2191-2206 | ✓ |
| Convention | 1618-1669 | 2137-2189 | ✓ sauf `contactEmail` (clientEmail vs createur?.email) — paramétré en prop |
| Marquer signé | 1511-1588 | 1944-2019 | ✓ panneau identique ; seul le libellé bouton diffère — paramétré `buttonLabel` |
| Viewer PDF | 1749-1769 | 2045-2065 | ✓ (dd/d.documentUrl, pdfPropsDirect/pdfProps) |

`DevisPDFInline` module-level (61-105) utilisé UNIQUEMENT par les 2 viewers de ce fichier (la copie de `invitation-direction/[token]/page.tsx` est un composant local distinct, non touché).

## Cascades

- **#1 Corps identiques** : vérifié ligne à ligne sur les 5 paires (tableau ci-dessus). Aucune divergence non paramétrée.
- **#2 State supprimé prouvé mort** (recherche textuelle après remplacement, seules les déclarations restaient) :
  `contratPreviewLoading` + `handlePreviewContrat` (commit 2) ; `conventionLoading`, `conventionSuccess`, `previewLoading` + `handlePreviewConvention`, `handleGenererConvention` (commit 3) ; `showMarquerSigne`, `marquerSigneNom`, `marquerSigneLoading`, `marquerSigneFileRef` (commit 4) ; `DevisPDFInline` (commit 5).
- **#3 Imports** : retirés du parent après preuve d'inutilisation — `previewContratEvenement` (commit 2), `genererConvention` (commit 3). Conservés et vérifiés encore utilisés : `api` (upload-signature, onboarding-status…), `SecureFileLink` (FacturePdfLink, contrat, conventions lecture seule…), `DevisPDFButton` (2 branches), `DevisPDFProps` (builders pdfProps), `FacturePdfLink` (pipeline facturation), `useRef` (signatureFileRef).
- **#4 Comportement** : mêmes endpoints (`/convention/preview`, `genererConvention`, `previewContratEvenement`, `/marquer-signe` multipart avec header `multipart/form-data`), mêmes moments de déclenchement, mêmes classes/textes/DOM. `style={{ height: '80vh', minHeight: 600 }}` préservé aux 2 endroits du viewer (iframe documentUrl + DevisPDFInline). Seuls ajustements de type sans effet runtime : `?? null` aux points d'appel (les champs Devis sont `string | null | undefined`, les Props du cadrage `string | null`).
- **#5 Diff** : cf. stat ci-dessus — TabDevisFacturation net négatif, 5 nouveaux fichiers, rien d'autre.

## Intacts (confirmés)

`renderFacturationPipeline`, `renderDevisComplementaires`, modales du bas (invitation direction, annuler, avoir, complémentaire, envoi facture), bloc `SignatureDevisPanel` ORGANISATEUR, bloc « Convention lecture seule » ORGANISATEUR/SIGNATAIRE (2210-2223, non extrait — corps différent, hors périmètre), builders `pdfPropsDirect`/`pdfProps` (restent dans chaque branche), `devisAffiche`/`budgetData`/sources de données, `FacturePdfLink`.

## Gates

tsc `--noEmit` = 0 erreur et build = exit 0 **avant chacun des 5 commits** (le commit 1 a nécessité une correction de nullabilité avant gate vert — aucune erreur commitée).
