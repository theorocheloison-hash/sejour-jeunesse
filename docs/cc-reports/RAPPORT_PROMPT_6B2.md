# Rapport — Prompt 6b-2 : encart pré-envoi + fix message d'erreur (TabDevisFacturation)

**08/07/2026 — branche `feat/onboarding-phase2`, commit `9f455e5`. Non poussée.**
Fichier unique : `frontend/app/dashboard/sejour/[id]/_components/TabDevisFacturation.tsx` — 23 insertions, 2 suppressions. Aucun backend, aucune dépendance, aucun autre fichier.

## Les 3 changements

### 1. Source du flag
État `const [envoisBloques, setEnvoisBloques] = useState(false)` + `useEffect` au montage : `GET /centres/onboarding-status` → `setEnvoisBloques(!!data.envoisBloques)` (le champ exposé par le 6a), échec → `false`. Défaut `false` = rien affiché si l'appel échoue — le backend reste l'autorité. Ancré juste après le `useEffect` de chargement du devis (~ligne 313).

### 2. Encart pré-envoi
Localisation retenue : **dans la modale d'envoi**, juste au-dessus du bloc d'erreur et des boutons — c'est le bouton « Envoyer le devis » de cette modale qui déclenche le call site `envoyerDevisDirect` (ligne ~1252), donc l'hébergeur voit l'encart avant de cliquer. Style aligné sur le bandeau ambre existant du fichier (`text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2`, même classe que le bandeau « Renseignez l'email du client »). Texte :

> 🕐 Votre centre est en cours de validation par l'équipe LIAVO. En attendant, vous ne pouvez envoyer un devis qu'à votre propre adresse email — testez le parcours en vous l'envoyant à vous-même.

**Vérification préalable faite** : aucun encart pré-envoi équivalent n'existait dans le tab (grep sur « en cours de validation » / « propre adresse » : zéro match ; le seul bandeau ambre proche concerne l'email client manquant — autre objet, non touché). Aucune désactivation de bouton ajoutée.

### 3. Fix du message d'erreur
Import `extractApiError` depuis `@/src/contexts/AuthContext`. Dans le handler d'envoi (bouton « Envoyer le devis » de la modale), le `catch` générique (`"Erreur lors de l'envoi du devis. Réessayez."`) est remplacé par `catch (err) { setEnvoiError(extractApiError(err)); }` — le helper parse `CENTRE_EN_VALIDATION|…` et n'affiche que la partie lisible (vérifié dans sa source, ligne 205 d'AuthContext).

**Seul ce handler a été touché** : les autres `catch` du fichier (facturation, versements, avoirs, PDF, complémentaires…) sont intacts — le diff ne contient que le bloc modale d'envoi, l'état/effet du flag et les 2 imports/catch cités.

## Comportement à `envoisBloques === false`

Identique à aujourd'hui : l'encart ne rend rien, le fetch est silencieux, et le seul changement observable est un message d'erreur d'envoi plus précis en cas d'échec (au lieu du générique).

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |

## Note de scope

Conforme au prompt : le fix message est volontairement limité à l'envoi de devis (la fenêtre gatée = onboarding pas fini = avant le 1er devis). Les autres actions gatées (facture-email, convention, invitations) gardent leurs messages actuels — à traiter plus tard si besoin.
