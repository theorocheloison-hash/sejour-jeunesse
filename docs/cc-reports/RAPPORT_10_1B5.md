# Rapport — 10.1b-5 : self-service extension d'essai +14 jours

**08/07/2026 — direct sur `main`, commit `8e53900`. Non poussé.**
2 fichiers : `backend/src/abonnements/abonnement.service.ts` + `abonnement.controller.ts` — 58 insertions.

## La méthode `demanderExtension(userId, centreId?)`

Implémentée telle que spécifiée, insérée après `activerTrial` :

1. **Résolution** : `getCentreForUser` (mêmes protections SUSPENDED/tiers que le reste du module).
2. **Réservé aux essais** : `!trialStartedAt || mollieMandatId` → `BadRequestException("L'extension est réservée aux comptes en période d'essai.")`. Un client payé/virement (Choucas) a un `abonnementActifJusquAu` posé manuellement mais le guard mandat/trial reste correct ; un client Mollie est rejeté par le mandat.
3. **Anti-abus, une seule extension** : seuil dérivé des dates existantes — `trialStartedAt + 40j` (essai frais = 30j, étendu = 44j) ; fin actuelle au-delà → `"Une extension a déjà été accordée pour cet essai."`. Pas de champ, pas de migration.
4. **Prolongation** : +14j depuis `max(aujourd'hui, fin actuelle)` → update `abonnementActifJusquAu` + `abonnementStatut: ACTIF` (réactive un essai expiré).
5. **Notif admin** non bloquante (try/catch calqué sur `activerTrial`) : `sendNotifAdmin("[Admin] Extension d'essai — {nom}", …)` avec le tableau centre / hébergeur (email+prénom+nom fetchés) / nouvelle expiration en date FR.
6. **Retour** : `{ success: true, actifJusquAu: nouvelleFin }`.

## L'endpoint

`POST /abonnements/demander-extension`, `@Roles(Role.HEBERGEUR)`, `@CurrentUser` + `@CentreId` — calqué sur `POST /abonnements/trial` (guards JWT+Roles au niveau contrôleur, déjà en place).

## Périmètre

`souscrire`, `activerTrial`, webhook, `annuler`, `getStatut`, `getFactures` : intacts. Aucune migration, aucun frontend.

## Pas de test automatisé (assumé, cf. prompt)

`AbonnementService` instancie le client Mollie au chargement du module — un spec exigerait de mocker Mollie (différé pour rester chirurgical). Validation manuelle : appeler l'endpoint sur un compte d'essai. Le guard anti-abus mérite un spec quand le module sera testable.

## Reste à faire

Bouton frontend « demander +14j » (page abonnement hébergeur ou bandeau d'expiration d'essai) — prompt séparé. Sans lui, l'endpoint existe mais rien ne l'appelle.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | 0 erreur |
| `npm test` | 136 verts + 3 todo (inchangés) |
