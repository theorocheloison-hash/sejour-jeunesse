# Rapport — Centre PENDING opérable (prompt 2ter)

Branche : `feat/onboarding-register-trial`. Backend uniquement, aucune migration,
`tsc --noEmit` + `npm run build` verts avant chaque commit.

## Commits de ce chantier

| SHA | Contenu |
|---|---|
| `88f504b` | **Tâche 1** — `centre.helper.ts` : PENDING opérable, SUSPENDED seul bloquant. `getCentreForUser` (branche centreId) : 404 si inexistant ou SUSPENDED ; appartenance vérifiée avant toute révélation ; tiers sur PENDING → 404 (pas de sondage), tiers sur ACTIVE → 403 conservé. Branche sans centreId + `getCentresForUser` : `statut: { not: 'SUSPENDED' }`. JSDoc du helper d'envoi : arbitrage collaboration.service documenté. |
| `eefdeb9` | **Tâche 3a** — `facture.service.ts` → `envoyerFactureParEmail` : gate sur `dto.email` (adresse libre du body), avant fetch PDF et email. |
| `694a9e9` | **Tâche 3b** — `sejour.service.ts` → `inviterOrganisateur` : gate sur `emailOrganisateur`, avant l'upsert de l'invitation (pas de token orphelin). |
| `f7cfa9f` | **Tâche 3c/3d** — `devis.service.ts` → `create` : gate AVANT la création du devis (la notif + magic link font partie du flux, aucun état partiel) ; `updateDevis` : la modification (interne) reste permise, seule la notif au tiers est skippée (pas de 403 après persistance). |

Conventions respectées partout : email du user rechargé depuis la base
(`select { email }` par userId, jamais du body), fetch conditionnel
(`if (centre.statut !== 'ACTIVE')`) → zéro requête ajoutée sur le chemin nominal.

## Tâche 2 — Surfaces publiques indépendantes du helper : CONFIRMÉ

- `public.controller.ts:26` → `centre.service.searchPublic` : requête Prisma
  propre avec `statut: 'ACTIVE'` (centre.service.ts:673).
- `hebergement.service.ts:138` (liste catalogue) et `:197` (détail par id) :
  filtres `statut: 'ACTIVE'` propres.
- `public.service.ts:281` (broadcast demandes publiques) : cible
  `statut: 'ACTIVE'` — un centre PENDING ne reçoit pas de demandes publiques.
- Aucun usage de `getCentreForUser` / `getCentresForUser` / `getCentreIdsForUser`
  dans `public/`, `hebergements/`, `journal-public/` (grep sans résultat).

Aucune surface publique ne dépend du helper : rien à modifier.

## Tâche 4 — Invariants rejoués (par lecture)

Un hébergeur PENDING **peut** :
- Voir son statut d'abonnement : `abonnement.service.getStatut` → `getCentreForUser` (PENDING désormais accepté).
- Modifier son profil : `centre.service.updateMonProfil` (:1159) → `getCentreForUser`.
- Créer des produits catalogue : `centre.service.createProduit` (:1437) / `importProduits` → `getCentreForUser`.
- Créer un séjour DIRECT : `sejour.service` → `getCentreForUser`.
- Créer un devis : `devis.service.createDirectDevis` → `getCentreForUser`, aucun email.
- L'envoyer À SA PROPRE ADRESSE : `envoyerDevisDirect` → gate `assertEnvoiExterneAutorise`, exception destinataire = email du compte.
- Faire signer via la page publique : `getDevisPublicByToken` / signature publique = accès par token de signature, aucun filtre statut centre.

Un hébergeur PENDING **ne peut pas** (gates, 403 `CENTRE_EN_VALIDATION|…`) :
- Envoyer un devis à un tiers (`envoyerDevisDirect`), une convention
  (`genererConventionScolaire` — génération/upload OK, email bloqué), une notif
  de modification (`notifierEnseignantModification`, `updateDevis` skip,
  `create` bloqué avant création), une brochure (`envoyerBrochure`), une
  facture (émissions : notif skippée dans le try/catch ; envoi manuel
  `envoyerFactureParEmail` : bloqué), une invitation (collaboration `create`,
  équipe `inviter`, organisateur `inviterOrganisateur`).
- Apparaître au catalogue public : filtres `ACTIVE` propres (tâche 2).

Un centre SUSPENDED :
- 404 pour tout le monde, propriétaire compris (`getCentreForUser` /
  `getCentresForUser` : `statut: { not: 'SUSPENDED' }` ou 404 direct).
- Invisible au catalogue public (filtres `ACTIVE`).

Un tiers sondant un centre PENDING par ID : 404 (`getCentreForUser`, branche
tiers — le 403 n'est renvoyé que pour un centre ACTIVE, comportement historique).

## Notes hors périmètre (à arbitrer plus tard)

- `getCentreIdsForUser` (centre.helper.ts) filtre toujours `statut: 'ACTIVE'`
  (hors périmètre énoncé). Seul consommateur : `collaboration.service`
  (listing des espaces collaboratifs sans header X-Centre-Id). Avec un
  centreId explicite, il délègue à `getCentreForUser` et accepte donc
  désormais PENDING — légère asymétrie, sans impact sur les invariants ci-dessus.
- Les 5 chemins de notification de `collaboration.service` ne sont pas gatés
  (arbitrage rendu, documenté dans le JSDoc du helper).
