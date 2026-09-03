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

_(non commencé)_

## P3 — Modes d'inscription non exclusifs

_(non commencé)_

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
