# RAPPORT — Unification devis étape 3a : VueOrganisateur (découpage par rôle)

> Branche : `feat/unif-devis-etape3a-vue-organisateur` (depuis `main` = `023efbb`, à jour origin). **Aucun push, aucun merge.**
> Rapport hors commit (add ciblé imposé), à versionner à la main si souhaité.

## git log --oneline main..HEAD

```
a1474c8 refactor(devis): retirer le rendu organisateur mort de TabDevisFacturation
9b9539b feat(devis): extraire VueOrganisateur et déléguer le rendu non-hébergeur
```

## git diff main...HEAD --stat

```
TabDevisFacturation.tsx                  | 224 +------------ (net −211 : 2246 → ~2035 lignes)
devis-facturation/VueOrganisateur.tsx    | 354 ++++++++++++ (nouveau)
2 fichiers, +369 / −209 — aucun autre fichier (cascade #5 ✓)
```

## Cascades

- **#1 Reproduction verbatim o1–o9 : OK, avec UN ÉCART DE CADRAGE SIGNALÉ (o5).**
  - o1 (état vide, version sans lien), o2 (builder pdfProps IIFE), o3 (DevisPDFButton), o4 (actions organisateur + input upload-signature), o5 (badge signé + lien scan), o6 (DevisPdfViewer), o7 (2× SignatureDevisPanel EN_ATTENTE / EN_ATTENTE_VALIDATION avec bloc contratUrl/contratOuvert), o8 (convention lecture seule), o9 (modale invitation direction) — recopiés à l'identique (classes/textes/ordre/logique, gates de rôle conservés pour distinguer ORGANISATEUR/SIGNATAIRE).
  - Deux ajustements type-only, zéro effet runtime : cast `as unknown as DevisType` (le `devisAffiche` de VueOrganisateur est `DevisBudget` seul, plus l'union du parent) ; au commit 1, cast temporaire `(user.role as string)` pour empêcher le narrowing TS tant que les blocs morts étaient présents — retiré au commit 2.
  - **⚠️ ÉCART o5** : le cadrage demandait de SUPPRIMER o5 du parent au commit 2, mais o5 (badge `d.signatureDirecteur` + lien `d.signatureDocumentUrl`) n'a AUCUN gate de rôle : l'HÉBERGEUR le voit aussi en COLLAB aujourd'hui. Le supprimer aurait violé l'invariant « ZÉRO changement hébergeur ». **Décision : o5 copié dans VueOrganisateur ET conservé au parent** (comme o2/o3/o6). Rien de cassé, un doublon de code résiduel de ~18 lignes — à trancher à l'étape suivante (le supprimer côté hébergeur serait un choix produit, pas un refactor).
- **#2 Early return APRÈS tous les hooks** : inséré ligne ~1195, après le dernier `useEffect` (~302) et les deux fonctions render — aucun hook conditionnel (gate React respectée, tsc/eslint verts).
- **#3 State/imports retirés prouvés morts** (recherche textuelle post-suppression : plus que les déclarations) : `contratOuvert`, `signatureFileRef`, `showInvitationDirection`, `invitationEmail`, `invitationSending`, `invitationSent` ; imports `SignatureDevisPanel`, `signerDevisConnecte`, `envoyerDirectionConnecte`, `uploadSignatureConnecte`. **Conservés et prouvés utilisés** : `api` (1 usage : useEffect envoisBloques `/centres/onboarding-status:254`), `SecureFileLink` (5 usages : FacturePdfLink, contrat événement… ).
- **#4 HÉBERGEUR : diff nul.** o2/o3/o6 restés au parent intacts ; o5 conservé (cf. écart) ; MarquerSignePanel, BlocDevisSigne, BlocConvention, BlocContratEvenement, renderFacturationPipeline, renderDevisComplementaires, collapse isDirect/!isDirect, budgetData/devisAffiche/reloadDevis : INTACTS. Pour l'ORGANISATEUR, `renderFacturationPipeline` retournait déjà `null` (`peutVoirFacturation = user.role === 'HEBERGEUR' && …`, `page.tsx:554`) — son absence de VueOrganisateur est sans effet.
- **#5** : stat ci-dessus — TabDevisFacturation net négatif (−211) + VueOrganisateur, rien d'autre.

## Gates

- Commit 1 (`9b9539b`) : tsc 0 / build 0 (après correction des 2 ajustements type-only — erreurs jamais commitées).
- Commit 2 (`a1474c8`) : tsc 0 / build 0.

## Confirmations finales

Rendu HÉBERGEUR intact ; `api` + `SecureFileLink` conservés ; sources de données (getDevisForSejour/budgetData), collapse `isDirect`, builders pdfProps hébergeur (`pdfPropsDirect` + `pdfProps` COLLAB) intacts. 0 backend, 0 migration, 0 endpoint/payload changé.
