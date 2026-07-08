# Rapport — 10.1b-5 frontend : bouton « Demander 14 jours de plus »

**08/07/2026 — direct sur `main`, commit `b3caa30`. Non poussé.**
2 fichiers : `frontend/src/lib/abonnement.ts` + `frontend/app/dashboard/hebergeur/abonnement/page.tsx` — 58 insertions, 1 suppression. Aucun backend.

## Lib

`demanderExtension()` ajoutée après `annulerAbonnement` : `POST /abonnements/demander-extension`, retourne `{ success, actifJusquAu }` (l'endpoint 10.1b-5 backend, commit 8e53900).

## Page abonnement

**États dédiés** : `extensionLoading` / `extensionMessage` / `extensionError`.

**Handler `handleDemanderExtension`** : appelle `demanderExtension()`, puis en cas de succès rafraîchit le statut (`getAbonnementStatut()` → `setAbo`) et affiche « +14 jours ajoutés à votre essai. » ; en cas d'erreur, affiche `err?.response?.data?.message` (même pattern que `handleSubmitIban`) — c'est ce qui remonte « Une extension a déjà été accordée pour cet essai. » quand le quota est atteint, ou « L'extension est réservée aux comptes en période d'essai. ».

**Bouton dans les deux bandeaux** :

- **Essai en cours** (`abo.isTrial && abo.actif`, bandeau ocre) : bouton discret — lien souligné ocre `#C87D2E`, dans le flux du bandeau après le compteur de jours. Message de succès (vert) et erreur (rouge) affichés dans le bandeau.
- **Essai expiré** (`abo.trialExpire`, bandeau rouge) : bouton plein ocre plus visible (fond `#C87D2E`, texte blanc, arrondi 8), à côté du texte d'expiration. Erreur affichée dans le bandeau.

Libellé « Demande en cours… » + désactivation pendant l'appel dans les deux cas. Détail de flux : un succès depuis l'état « expiré » re-fetch le statut → l'essai redevient actif → le bandeau bascule sur « Essai en cours », où le message de succès s'affiche.

## Périmètre respecté

Formulaire IBAN, souscription, annulation, factures : intacts. Styles inline cohérents avec le reste de la page (qui n'utilise pas Tailwind sur ces bandeaux).

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |
