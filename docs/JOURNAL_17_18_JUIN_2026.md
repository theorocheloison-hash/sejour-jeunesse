# LIAVO — Journal 17-18 juin 2026

> Deux journées majeures : 3 démos (Sauvageon interne, Les Choucas, Marie LMDJ), premier client signé, 10+ fixes/features livrés.

---

## Livraisons code (17/06/2026)

### Bug fixes
- **fix(catalogue): dédup hebergement.service par apidaeId** — Le doublon catalogue Le Choucas venait du mauvais fichier (`centre.service.ts` fixé au lieu de `hebergement.service.ts`). Ajout `liavoApidaeIds` Set + filtre `!liavoApidaeIds.has(String(r.id))` dans `hebergement.service.ts search()`.
- **fix(admin): onglet Invitations dashboard admin** — Ajout `<Link>` vers `/dashboard/admin/invitations` dans la barre d'onglets du dashboard admin.
- **fix(admin): détection UUID collé dans formulaire invitation** — Le champ "Centre déjà en base" ne supportait que la recherche par nom. Ajout détection UUID dans le useEffect debounced : si `UUID_RE.test(searchQuery)`, fetch direct `GET /public/centres/{uuid}` et auto-select.
- **fix(pdf): label "Solde à régler" → "Montant du solde"** — Backend `FacturePDF.tsx` + frontend `DevisPDF.tsx`. Supprime la contradiction "Solde à régler X€" + "Soldé ✓" sur les factures payées.

### Features
- **feat(devis-page): refonte page Devis & Facturation** — Titre renommé, tooltips sur 7 onglets, compteurs contextuels (N · X €) au lieu de compteurs bruts, tri par date/montant/client, renommage "Signé direction" → "Signé".
- **feat(capacite): filtre capacité groupe min/max** — Migration `capaciteGroupeMin/Max` sur CentreHebergement. Filtre appliqué dans `findOpen()`, `notifierCentresInscrits()`, `getDashboardGlobal()`. Total participants = `nombreEleves + (nombreAccompagnateurs ?? 0)`. Demandes ciblées passent toujours.
- **feat(dashboard): suppression compteur "Via LIAVO"** — Supprimé de sous la carte "Demandes reçues" (mal placé). KPI réseau documenté en roadmap pour réintégration propre.
- **feat(dashboard): CA via réseau hébergeur + réseau** — `caViaReseau` par centre dans `getReseauStats()`, colonne "CA réseau" dans la table des centres, KPI dans `CentreSlideOver`. Côté hébergeur : `caViaReseau` + `reseauNom` dans `getDashboardGlobal()` (affiché dans `global/page.tsx`). RETENUS élargi aux 4 statuts (SELECTIONNE, SIGNE_DIRECTION, FACTURE_ACOMPTE, FACTURE_SOLDE). `isComplementaire` exclu des calculs.

### Data
- **Régénération 14 PDFs facture solde Sauvageon** — Script PowerShell appelant `POST /factures/:id/regenerer-pdf` pour mettre à jour le label "Montant du solde".
- **Force signature devis Guillaume & Isabelle** — `UPDATE devis SET statut = 'SIGNE_DIRECTION'` sur DEV-2026-0033 (mariage BOULANGER/JUHEL).
- **Extraction 55 factures PDF Sauvageon** — Script PowerShell téléchargeant tous les PDFs depuis OVH pour la comptable.

---

## Livraisons docs (18/06/2026)

- **docs/commercial/DEBRIEF_DEMO_MARIE_18_06.md** — 10 demandes LMDJ documentées, priorisées, estimées. Posture : on note tout, on ne code rien sans accord CA.
- **docs/commercial/MONETISATION_PLAN.md** — Simplification pricing : tarif unique mensuel 29/49/69€ HT, suppression distinction mensuel/annuel. Historique conservé.
- **docs/commercial/DEBRIEF_DEMO_CHOUCAS_17_06.md** — À créer (contenu dans la mémoire Claude, pas encore dans le repo).
- **Proposition partenariat LMDJ v3** — PDF 2 pages mis à jour : nouveau pricing, section sécurité, 4 parties prenantes sur page 1, conditions page 2. Envoyé à Marie.

---

## Commercial

### Les Choucas — PREMIER CLIENT SIGNÉ (17/06)
- Centre de vacances Le Choucas, Sixt-Fer-à-Cheval (74)
- Directrice Anne Cheignon + adjointe Nora
- Inscription via invitation admin (CAS 1, centreExistantId)
- 2 mois gratuits puis plan Complet payant
- Demandes : module pilotage (CA, occupation, marges) + intégration PMS à terme
- Nora a envoyé spontanément un email positif à LMDJ

### Marie Charvolin LMDJ — Démo 18/06
- Se projette dans la collaboration
- Process interne : présentation salariées → note synthèse → bureau → CA → démo formelle
- 10 demandes documentées (voir DEBRIEF_DEMO_MARIE_18_06.md)
- Demandes clés : requalification avant dispatch, CRM hébergeurs/enseignants, PMI, multi-classes, pricing bundlé
- Posture LIAVO : on attend l'accord CA avant de coder du spécifique LMDJ

### Yves Massard (Pôle Montagne) — En trial
- 3 centres actifs prod, trial 6 mois
- Adhérent LMDJ 20 ans → lobbying interne potentiel

---

## Décisions prises

| Décision | Date |
|---|---|
| Pricing simplifié : 29/49/69€ HT/mois, tarif unique | 18/06 |
| Suppression remise annuelle 17% | 18/06 |
| "Signé direction" renommé "Signé" dans l'UI | 17/06 |
| Demandes ciblées passent toujours le filtre capacité | 17/06 |
| Pas de code spécifique LMDJ avant accord CA | 18/06 |
| KPI "Via LIAVO" supprimé, à réintégrer proprement en roadmap | 17/06 |
| RETENUS = 4 statuts (SELECTIONNE + SIGNE_DIRECTION + FACTURE_ACOMPTE + FACTURE_SOLDE) | 18/06 |

---

## Bugs identifiés non résolus

- **caViaReseau hébergeur** affiché dans `global/page.tsx` mais pas dans `hebergeur/page.tsx` (le dashboard principal calcule le CA côté client via getMesDevis, pas via getDashboardGlobal). Fix : exposer `sourceReseau` dans getMesDevis ou unifier les deux pages.
- **Convention hardcodée Sauvageon** — bloquant dès le 2e centre actif (Les Choucas). À rendre configurable par centre.

---

## Prochains chantiers identifiés (pas encore codés)

### Demandé par les clients
- Module Pilotage (CA, taux occupation, marges) — Les Choucas + Marie, justifie plan 69€
- Export factures ZIP/CSV pour comptable — besoin Sauvageon récurrent
- Pop-up onboarding hébergeur première connexion
- Planning équipe (gestion RH centre)

### Sécurité (PLAN_REMEDIATION.md)
- LOT 1 : IDOR ownership helper (1.5j)
- LOT 2 : Auth hardening JWT+refresh (2j)
- LOT 3 : Storage privé + URL signées (2j) — GATE DUR avant vrais mineurs
- LOT 4 : Cookie httpOnly + Helmet (2j)
- LOT 5 : Purge IBAN git (0.5j)

### TIER1_CHANTIERS (28/05) — statut à vérifier dans le code
1. Notifications hébergeur sur messages collab
2. Liaison CRM ↔ séjours collaboratifs
3. Nettoyage code mort DevisLibres
4. Labels universels (scolaire → générique)

### Conditionné à LMDJ (ne pas coder)
- 10 demandes Marie documentées dans DEBRIEF_DEMO_MARIE_18_06.md
