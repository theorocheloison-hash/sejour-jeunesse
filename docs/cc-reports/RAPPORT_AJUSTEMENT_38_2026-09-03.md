# Rapport passe d'ajustement #38 — 03/09/2026

> Suite du run overnight (`docs/cc-reports/RAPPORT_RUN_38_2026-09-03.md`). Prompt : `docs/AJUSTEMENT_CC_38_2026-09-03.md`. Branche `feat/38-dashboard-organisateur`, HEAD de départ = `cc3da82` (commit du doc d'ajustement), `git status` propre au départ. Aucun push.

## 0. Environnement

- `git status` propre au départ ✓. Baseline tests à re-vérifier en fin de passe (`4 failed, 2 todo, 442 passed` + tests ajoutés).
- Back : le serveur 4000 est l'enfant survivant du watch (code de la branche, sans hot reload) — sera rebuilé/relancé pour les recettes API des points backend (P4, P10). Front : `next dev` 3000 (hot reload actif).

## P1 — Bandeau « devis à signer » retiré pour navBlocs

### Modifications
- `page.tsx` — condition du bandeau ambre : `user.role === 'ORGANISATEUR' && !navBlocs && …` (une seule condition ajoutée, JSX intact — l'accompagnateur continue de le voir).

### Code mort supprimé : aucun.
### Gates : `tsc --noEmit` 0 erreur, `npm run build` OK.
### Recette : mécanique — `navBlocs` vrai uniquement pour l'organisateur créateur (SC3), tous les autres cas conservent le bandeau. NON TESTÉ : rendu (couvert par la recette Théo du badge, déjà validée).
### Écarts : aucun.
### Statut : TERMINÉ

## P2 — Badge secondaire dashboard supprimé

### Modifications
- `organisateur/page.tsx` — le badge « Signé direction — {centre} » / « En attente signature — {centre} » (CONVENTION/SIGNE_DIRECTION, dérivé de `signatureDirecteur`) est supprimé ; à sa place, le nom du centre en `<span>` texte simple gris. Le badge « Devis à signer — {centre} » (OPTION) est conservé (action).

### Code mort supprimé : le JSX du badge (dans le même commit, remplacé sur place).
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique — le bloc ne rendait que pour CONVENTION/SIGNE_DIRECTION avec devis ; le nouveau rend le nom du centre dans les mêmes conditions. NON TESTÉ : rendu (§ recette Théo).
### Écarts : aucun.
### Statut : TERMINÉ

## P3 — Modes d'inscription non exclusifs

### Modifications
- `TabParticipantsCollab.tsx` — la prop `mode` ne masque plus la grille de saisie directe (condition `mode !== 'FAMILLES'` retirée) ; le compteur reste conditionnel (SAISIE : « N élèves dans la liste » ; sinon « N/M signées »).
- `InscriptionsEleves.tsx` — prop `replieParDefaut` : rendu replié sous l'intitulé « Faire remplir par les familles » (+ sous-titre « En complément… »), un clic déplie.
- `page.tsx` — ordre par mode : FAMILLES = InscriptionsEleves → Accompagnateurs → TabParticipantsCollab (grille+liste) ; SAISIE = Accompagnateurs → TabParticipantsCollab (grille en tête) → InscriptionsEleves (replié). Le choix initial 2 cartes (0 élève) est inchangé. Rien n'est masqué dans aucun mode.

### Code mort supprimé : aucun.
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique (conditions relues). NON TESTÉ : rendu des deux ordres + section repliée (recette Théo §4 du doc).
### Écarts : la position d'Accompagnateurs n'était pas spécifiée — conservée en position intermédiaire dans les deux modes (chaque mode garde « sa » section élèves en tête de bloc).
### Statut : TERMINÉ

## P4 — Lien journal par élève + jeton saisie directe

### Census (collé)

`prisma/schema.prisma:363` : `tokenAcces String @unique @default(uuid()) @map("token_acces") @db.Uuid` — le jeton est généré par **défaut de schéma à toute création**, `createBatchDirect` (autorisation.service.ts:501-526, `create` sans `tokenAcces` explicite) inclus. **Aucun fix backend nécessaire** ; la spec « si non » du doc est sans objet — preuve par recette DB réelle ci-dessous (plus probante qu'un test unitaire à mock).

### Modifications

- Bouton « Copier le lien » par élève, tous modes : **endroit unique choisi = `InscriptionsEleves`** — depuis P3 il est rendu dans les deux modes (déplié en FAMILLES, repliable en SAISIE) et sa liste (`getAutorisationsBySejour`) contient TOUS les élèves, saisie directe incluse. Aucun doublon ajouté dans `TabParticipantsCollab`.
- `TabJournal.tsx` — bloc « lien d'exemple `liavo.fr/sejour/{token}/journal` » + bouton « Copier le lien d'exemple » supprimés (gabarit inutilisable) ; remplacés par la phrase du doc. State `journalLinkCopied` devenu orphelin supprimé.

### Code mort supprimé : bloc exemple + `journalLinkCopied` (TabJournal, même commit).
### Gates : tsc 0 erreur, build OK.
### Recette

```
POST /autorisations/batch-direct {"eleveNom":"SAISIEP4"...} → 201 {"created":1}
SELECT … WHERE eleve_nom='SAISIEP4' → source_inscription=SAISIE_DIRECTE, a_token=true
```

### NON TESTÉ : rendu de la phrase TabJournal (§ recette Théo).
### Écarts : pas de spec unitaire jeton (branche « si non » du doc sans objet — default de schéma, preuve DB collée).
### Statut : TERMINÉ

## P5 — ClotureInscriptions dans le bloc Inscriptions

### Census (collé)

Bandeau localisé dans `TabRooming.tsx:101-118` (« répliqué de TabGroupes » — duplication existante avec `TabGroupes.tsx:157-174`). Appel : `cloturerInscriptions(sejourId)` (lib collaboration → `POST /collaboration/:sejourId/cloturer-inscriptions`), succès → `onSejourUpdate({ inscriptionsCloturees: true })`, échec → `onError(...)` + `onReloadSejour()`. `inscriptionsCloturees` est bien dans `SejourCollabInfo` (collaboration.ts:53) — pas de type à ajouter.

### Modifications

- `_components/ClotureInscriptions.tsx` (nouveau) — composant unique (bandeau ambre + bouton + appel + état ✓ vert), prop `variant: 'inscriptions' | 'groupes' | 'chambres'` (textes distincts), gestion du loading.
- `TabRooming.tsx` — JSX inline + `handleCloturer` supprimés, remplacés par le composant (variant chambres).
- `TabGroupes.tsx` — la COPIE dupliquée (sur le chemin, règle « fix à la source ») + `handleCloturerInscriptions` supprimés, remplacés (variant groupes). Backend clôture non touché.
- `page.tsx` — monté dans le bloc Inscriptions sous la liste si `participantsCharges && participants.length >= 1 && !sejour.inscriptionsCloturees`, `onDone` recharge le séjour.
- `OrganisateurNav.tsx` — `etatInscriptions` : fait = `inscriptionsCloturees` ; en cours = ≥1 participant non clôturé ; à faire = 0. `calculerBlocEmphase` réécrite (retour `string | null`) : ≥1 participant → Inscriptions tant que non clôturé, puis premier bloc phase 1 restant (Réservation → Budget → Pédagogie), sinon `null` → badge « Tout est prêt ✓ » dans la nav ; 0 participant → ordre historique. `page.tsx` : onglet par défaut ignore l'emphase nulle (reste `devis`).

### Code mort supprimé : les 2 bandeaux inline + leurs 2 handlers (TabRooming, TabGroupes — mêmes commits).
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique — mêmes appels/callbacks que l'inline (diff relu) ; le contrat `cloturer-inscriptions` n'a pas changé. NON TESTÉ : clic réel de clôture + « Tout est prêt ✓ » (recette Théo).
### Écarts : le doc demandait le remplacement dans TabRooming ; la copie de TabGroupes était sur le chemin (même JSX dupliqué) → remplacée aussi, comportement identique.
### Statut : TERMINÉ

## P6 — Budget « fait » = bouclé

### Modifications
- `src/lib/budget-solde.ts` (nouveau) — `calculerBudgetTotaux(devis, lignesCompl, recettes)` : extraction PURE du calcul de `TabBudget` (l.57-64 : totalHebergeur = Σ lignes TTC sinon montantTTC ; + compléments ; recettes ; solde).
- `TabBudget.tsx` — importe le helper, les 7 lignes inline supprimées (une seule implémentation).
- `OrganisateurNav.tsx` — `etatBudget(sejour, budgetData)` : fait = `solde ≥ 0` ET ≥1 donnée saisie (dépenses > 0 ou recettes > 0 ou prix posé) ; en cours = donnée saisie et solde < 0 ; à faire = rien ; neutre si `budgetData` pas chargé. Pas de nouveau fetch (`budgetData` porte devis+lignesCompl+recettes).

### Code mort supprimé : calcul inline de TabBudget (remplacé par l'import, même commit).
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique — même formule que l'affichage (source unique) ; cas Théo : devis 9 000 €, 600 € de recettes → solde −8 400 → « en cours » (orange), plus jamais vert. NON TESTÉ : rendu de la pastille (recette Théo).
### Écarts : aucun.
### Statut : TERMINÉ

## P7 — Réservation : sous-vue Devis | Documents officiels

### Modifications
- `page.tsx` — state local `vueReservation: 'devis' | 'documents'` (pas une key de `TABS` : `ongletsVisibles`, tracking, accompagnateur intacts). La section devis rend soit `TabDevisFacturation` seul, soit `DocumentsOfficiels` seul (`navBlocs && devisSigne && vueReservation === 'documents'`) — plus jamais empilés. Autres rôles : `TabDevisFacturation` inchangé.
- `OrganisateurNav.tsx` — props `vueReservation` / `onVueReservation` / `documentsDisponibles` ; la sous-barre du bloc actif est généralisée en `sousVues` (onglets réels pour Sur place/Échanges, sous-vues locales pour Réservation : « Devis » / « Documents officiels » si devis signé — sinon un seul item, pas de barre). Cliquer le bloc Réservation retombe sur Devis. Les cartes internes de `DocumentsOfficiels` (→ Pédagogie/Inscriptions) fonctionnent toujours (`selectTab`).

### Code mort supprimé : aucun.
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique — devis non signé : 1 seule sous-vue, pas de barre ✓ (par construction). NON TESTÉ : rendu (recette Théo P7/P8).
### Écarts : aucun.
### Statut : TERMINÉ

## P8 — Sous-onglets : de vrais onglets

### Modifications
- `_components/SousOnglets.tsx` (nouveau) — composant unique, gabarit **copié** de la barre historique (py-3, bordure basse, actif souligné `var(--color-primary)`, libellés `TABS` transmis par OrganisateurNav) ; rend `null` si ≤ 1 vue. Le JSX de la barre hébergeur n'est pas touché.
- `OrganisateurNav.tsx` — la sous-barre grise inline est remplacée par `<SousOnglets vues={sousVues} />` (Sur place, Échanges, Réservation P7).

### Code mort supprimé : la sous-barre inline (remplacée, même commit).
### Gates : tsc 0 erreur, build OK.
### Recette : mécanique. NON TESTÉ : rendu (recette Théo).
### Écarts : aucun.
### Statut : TERMINÉ

## P9 — Bannière onboarding : trace et décision

### Trace (grep `onboarding=true` sur tout le repo — 2 occurrences)

1. **Qui le pose** : `backend/src/auth/auth.service.ts:860` — `consommerMagicLink()` redirige TOUT magic link consommé vers `/auth/callback#token=…&onboarding=true` (+ `&needsPassword=true` si `!user.motDePasseDefini`, l.832). C'est le SEUL émetteur.
2. **Qui le consomme** : `frontend/app/auth/callback/page.tsx:63-64` — dest = `ROLE_ROUTES[role]` (organisateur → `/dashboard/organisateur`) + `?onboarding=true` ; si `needsPassword`, le callback affiche D'ABORD un écran dédié de création de mot de passe (l.66-71) avant de rejoindre le dashboard.
3. **Quels flux envoient des magic links** : (a) `public.service.ts:238-241` — création de demande publique self-service (le cas historique du texte « votre demande a bien été envoyée ») ; (b) `devis.service.ts:215-229` — email « nouveau devis » au client avec magicUrl ; (c) `auth.service.ts:624-633` — « renvoyer le magic link ». Le flux invité `rejoindre/[token]` (register classique par mot de passe → accepter → redirection vers le séjour, SC2) ne passe **pas** par `?onboarding=true`.
4. **Mot de passe temporaire** : non — le compte magic-link n'a simplement PAS de mot de passe (`motDePasseDefini` faux) ; la création est proposée par l'écran du callback (pas par la bannière).

### Décision

Un compte **invité peut encore** atterrir au dashboard avec `?onboarding=true` : tout magic link générique (email devis b, renvoi c) le pose, quel que soit le profil du compte. La variante « vous avez rejoint le séjour » de SC6 n'est donc **pas du code mort** → **rien n'est supprimé**, `organisateur/page.tsx` inchangé.

### Proposition (pour décision Théo, pas de code)

L'information « définissez votre mot de passe » pour l'invité est déjà servie au bon moment par l'écran `needsPassword` du callback magic ; le rappel pour l'invité qui atterrit sur SON séjour (D2) aurait sa place dans l'encart « Comment fonctionne cet espace » de l'espace séjour (une ligne conditionnelle), plutôt que sur une bannière du dashboard qu'il ne visite pas à l'arrivée. Le flux mot de passe n'a pas été modifié.

### Gates : aucun code modifié (rapport seul).
### Statut : TERMINÉ

## P10 — Envoyer le lien du journal aux familles

_(non commencé)_

## 8. État final

_(à compléter)_
