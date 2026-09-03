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

_(non commencé)_

## P5 — ClotureInscriptions dans le bloc Inscriptions

_(non commencé)_

## P6 — Budget « fait » = bouclé

_(non commencé)_

## P7 — Réservation : sous-vue Devis | Documents officiels

_(non commencé)_

## P8 — Sous-onglets : de vrais onglets

_(non commencé)_

## P9 — Bannière onboarding : trace et décision

_(non commencé)_

## P10 — Envoyer le lien du journal aux familles

_(non commencé)_

## 8. État final

_(à compléter)_
