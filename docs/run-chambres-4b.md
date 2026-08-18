# LIAVO — Sous-chantier 4b : transactionalisation des blocs signature

> **Rédigé le 21/07/2026.** Session dédiée « à froid » — le refactor le plus risqué du module chambres.
> **Source de vérité conception** : `docs/ARCHITECTURE_MODULE_CHAMBRES.md` §3.3 (amendé ci-dessous) + §6 (cascades).
> **Statut** : **Lots 1 & 2 LIVRÉS, POUSSÉS, DÉPLOYÉS EN PROD** (`d6e27d0` + `32e0279`, Scalingo front+back `success`). 4 des 8 méthodes de signature écrivent désormais devis + séjour atomiquement ; sync/emails/CRM hors tx. Gates 287 verts aux 2 lots, review ligne à ligne sur fichier réel. **Recette happy-path reportée à l'usage réel** (cf. §2bis). Prochaine session : **Lots 3 → 4** (les plus lourds).

---

## 1. Décision de design actée (21/07) — amende §3.3 du doc archi

Le doc archi §3.3 écrivait : « le sous-chantier 4 enveloppe chaque bloc dans `$transaction` (devis + séjour + **sync occupations**) ». **Amendé après lecture du code réel, validé par Théo :**

- **DANS la transaction** : uniquement les écritures de transition — `{ devis, séjour, demande (FERMEE), rivaux (updateMany NON_RETENU), invitation }`.
- **APRÈS commit, HORS transaction** : emails (Brevo), `syncOccupationsSejourSafe` (**INCHANGÉ**), logs CRM `activiteClient` (best-effort try/catch).

**Raison.** D12 (« une signature n'échoue JAMAIS pour cause de chambres ») est déjà affirmée dans le code sur les chemins publics (commentaire `signerDevisDirect` / `uploadSignaturePublic`). Le paramètre `tx?` optionnel de `syncOccupationsSejour` (préparé en 4a) est **réservé aux cascades** (re-datage atomique du Lot 5), **PAS aux blocs signature**.

**Conséquence** : 4b-signature = **enveloppement pur** — tracer la frontière du `$transaction` autour des updates déjà présents, en gardant tout l'I/O dehors. Zéro logique nouvelle, zéro changement de sémantique sync/D12. La difficulté n'est pas la conception mais la **frontière** (ligne à ligne).

---

## 2. Périmètre réel — 8 méthodes sur 2 fichiers (pas « 5 blocs »)

Le doc §3.3 sous-estimait. Recensement par lecture (21/07) :

| Méthode | Fichier | Écritures de transition | I/O dans le flux | Criticité |
|---|---|---|---|---|
| `signerDevisDirect` (public) | devis.service | devis + séjour | 2 emails après | **max** (client réel, hiver) |
| `uploadSignaturePublic` (public) | devis.service | devis + séjour | storage **avant** + email après | max |
| `uploadSignatureDocument` | devis.service | devis + séjour | storage avant + email après | moy |
| `marquerDevisSigneHebergeur` | devis.service | devis + séjour | storage avant (optionnel) | moy |
| `annulerDevis` | devis.service | devis + séjour (updateMany conditionnel) | — | moy |
| `updateStatut` (SELECTIONNE) | devis.service | devis + updateMany(rivaux) + demande + séjour | **email au milieu** + auto-rattach CRM best-effort | complexe |
| `signerDevis` | devis.service | **double paquet** jusqu'à 6 updates | email après | **le plus lourd** |
| `signerSansCompte` (public) | invitations-directeur.service | invitation + devis + séjour | email après | max |

> Le « 11ᵉ site » du doc §3.1 (`sejour.service ~1253`, suppression) relève des **cascades** (Lot 5), pas des blocs signature.

---

## 2bis. Census Phase 1 — découvertes & décisions (21/07)

**Zéro test sur `DevisService` et `InvitationsDirecteurService`.** Grep exhaustif : aucun des 8 chemins de signature n'est couvert. Deux conséquences :
- La baseline 287 **ne peut pas casser** par le passage à `tx.*`. Le « débordement ½ j tests » annoncé au doc archi §7 **n'existe pas** (il présupposait des mocks `prisma.update`).
- Les chemins de **signature client** (les plus critiques, hiver 2027) tournent en prod **sans filet**. Angle mort réel — pas celui qu'on croyait.

**DÉCISION actée (Théo, 21/07) — Lot 1 = enveloppement pur, SANS test.** Raison technique : le seul mock `$transaction` du repo (`occupations.service.spec.ts:121`) rend `tx === prisma` → un test unitaire **ne peut pas distinguer dans-tx / hors-tx**, donc ne prouve **pas l'atomicité** (l'invariant central du chantier). Le vrai rollback n'est prouvable qu'en intégration sur vraie DB (absente du repo). **Filet retenu : review ligne à ligne + recette manuelle post-déploiement** — meilleur qu'un mock qui ne prouve pas l'invariant.

**DÉCISION actée — TOCTOU laissé hors Lot 1** (cf. §7 backlog) : change un comportement, brouillerait la review d'un commit « enveloppement pur ». Un problème à la fois.

**DÉCISION actée (Théo, 21/07) — recette happy-path REPORTÉE à l'usage réel** (Lots 1, 2 et suivants), pas de recette manuelle sur le Sauvageon avant push. Raison : hors saison (fenêtre commerciale = septembre), aucun client ne signe d'ici là ; le 1er vrai dossier de septembre exerce naturellement ces chemins ; un bug happy-path (très improbable sur un enveloppement pur, `tsc`+`build`+287 verts) se verrait au 1er usage réel, pas six mois plus tard sur des données de test noyées. Filet réel : review ligne à ligne + suite de caractérisation backloguée (§6bis).

**Frontières Lot 1 confirmées** : `signerDevisDirect` l.2206–2225, `uploadSignaturePublic` l.2438–2454. 2 updates strictement consécutifs, résultats **jetés**, retours **littéraux**, storage **avant**, sync/emails/CRM **après** → **pas de remontée de valeur** du callback nécessaire. Forme imposée : callback interactif `$transaction(async (tx) => ...)` (identique `occupations.service.ts:361`), pas la forme batch.

**⚠️ À retenir pour les Lots 2–4** (pas maintenant) :
- `updateStatut`, `signerDevis`, `uploadSignatureDocument`, `marquerDevisSigneHebergeur` **retournent `updated`** issu d'un `devis.update` [TX] → leur Phase 2 devra **faire remonter la valeur du callback** (`const updated = await this.prisma.$transaction(async (tx) => { …; return tx.devis.update(…); })`). Pattern repo : `public.service:172`, `centre.service:273`.
- Emails **NON protégés par try/catch** dans `uploadSignatureDocument`, `signerDevis`, `signerSansCompte`, `updateStatut` (NON_RETENU) : un échec d'email **après commit** remonte aujourd'hui en 500. Décider s'ils sont protégés lors de leur lot (hors 4b strict, mais à trancher).
- `annulerDevis` : le `devis.count` (rétrogradation conditionnelle du séjour) **doit entrer dans la tx** (lit l'état post-`devis.update`).

---

## 3. Trois pièges transverses (à cadrer dans chaque prompt Phase 2)

1. **`storage.upload` jamais dans la tx** (3 méthodes) — il est déjà *avant* les updates : la tx doit commencer *après* l'upload. Ne pas envelopper depuis le début de la méthode.
2. **Email jamais dans la tx** — déjà après partout, *sauf* `updateStatut` SELECTIONNE (`sendDevisSelectionne` au milieu, mais après les 4 updates → englobable). À vérifier ligne à ligne.
3. **Tests (baseline 287)** — les tests qui mockent `prisma.devis.update` cassent au passage à `tx.devis.update`. Recensement **obligatoire en Phase 1** (c'est le « débordement ½ j » annoncé au doc archi §7).

---

## 4. Ordre d'attaque — simplicité croissante (rode le gabarit sur le simple)

- **Lot 1 (gabarit de référence)** — `signerDevisDirect` + `uploadSignaturePublic`. 2 updates, D12 déjà explicite, publics = protégés en premier. Définit le pattern revu ligne à ligne.
- **Lot 2** — `uploadSignatureDocument` + `marquerDevisSigneHebergeur` (même gabarit + storage avant).
- **Lot 3** — `annulerDevis` + `updateStatut` cas NON_RETENU.
- **Lot 4 (le lourd)** — `updateStatut` SELECTIONNE (4 updates + email milieu + premier `update` hors switch à ramener dans la tx) + `signerDevis` (double paquet) + `signerSansCompte`.
- **Lot 5 (session suivante)** — cascades : re-datage occupations sur update-dates séjour (utilise `tx?`) + libération sur soft-delete. Cf. doc archi §6.

*Alternative écartée* : criticité décroissante (Lot 4 d'abord) — refusée, on ne débute pas par le bloc le plus tordu sans gabarit validé. Rien ne presse (fenêtre commerciale = septembre).

---

## 5. État d'avancement

- [x] **Phase 1 census (CC)** — 8 méthodes recensées, **zéro test existant**, mock `$transaction` de réf. `occupations.service.spec.ts:121` — validé 21/07
- [x] **Lot 1** : `signerDevisDirect` + `uploadSignaturePublic` — enveloppement pur, **déployé prod** (`d6e27d0`, gates 287, review ligne à ligne). Seul écart : `!` de narrowing dans la closure.
- [x] **Lot 2** : `uploadSignatureDocument` + `marquerDevisSigneHebergeur` — **déployé prod** (`32e0279`, gates 287, review ligne à ligne). Garde séjour dédoublée (`sejour.update` dans la tx / sync après), remontée de `updated` via `return devisMaj`, zéro `!` nécessaire.
- [ ] **Lot 3** : `annulerDevis` (le `devis.count` entre dans la tx) + `updateStatut` (NON_RETENU, email non protégé)
- [ ] **Lot 4** : `updateStatut` (SELECTIONNE, email milieu + premier `update` hors switch) + `signerDevis` (double paquet) + `signerSansCompte` (email non protégé) — remontée de valeur pour les 2 premiers
- [ ] Lot 5 cascades (session suivante)

---

## 6bis. Backlog né du census (21/07)

- **TOCTOU double-signature** : la garde `statut !== 'EN_ATTENTE'` est lue **hors tx**, et l'`update` ne re-vérifie pas le statut dans son `where` → deux signatures concurrentes sur le lien public possibles (la 2ᵉ écrase en silence). **Préexistant**, ni aggravé ni corrigé par 4b. Fix éventuel : `where: { id, statut: 'EN_ATTENTE' }` dans la tx + catch `P2025` → message propre. Hors Lot 1 (change un comportement).
- **Caractérisation `DevisService` signature** : suite de tests happy-path des 8 méthodes, **avant l'hiver 2027**. Mock de réf. `occupations.service.spec.ts:121`. C'est là qu'un filet a du sens — pas noyé dans un commit d'enveloppement.

---

## 6. Invariants de session

- **CC ne pousse jamais** — review diff par Théo avant push.
- Gates **`tsc --noEmit` + `npm run build` + `npm test`** à chaque commit, **baseline 287**.
- **1 seul CC backend**, jamais 2 Phases 2 simultanées.
- Sync (`syncOccupationsSejourSafe`) **non touché** par 4b-signature.
- Emails/CRM restent **hors** transaction.
