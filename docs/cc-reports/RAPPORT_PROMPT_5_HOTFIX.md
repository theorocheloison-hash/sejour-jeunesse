# Rapport — HOTFIX gate d'envoi : validation du claim (prompt 5)

Branche : `fix/gate-claim-validation` (depuis `main`). Backend uniquement,
`tsc --noEmit` + `npm run build` verts avant chaque commit. Pas de push.

## Faille corrigée

Le gate `assertEnvoiExterneAutorise` ne regardait que `centre.statut` : les
centres catalogue revendiqués via CLAIM sont **déjà ACTIVE**, donc un claimant
non validé (Membership `EN_ATTENTE_VALIDATION`) obtenait des envois externes
libres. Le gate se fonde désormais sur la validation de l'**utilisateur
propriétaire** pour ce centre.

## Commits

| SHA | Contenu |
|---|---|
| `06cca38` | Helper étendu (async, prisma + membership du propriétaire) + les 11 sites d'appel adaptés. |

Un seul commit fonctionnel : le changement de signature du helper et
l'adaptation des appelants sont indissociables (rien ne compile séparément).

## Nouvelle logique du gate (dans cet ordre)

1. Destinataire normalisé === email du compte normalisé → autorisé (inchangé,
   désormais évalué EN PREMIER : le claimant peut se tester vers sa propre
   adresse même sur centre ACTIVE).
2. `centre.statut !== 'ACTIVE'` → 403 `CENTRE_EN_VALIDATION` (message
   « centre », inchangé) — fenêtre ex-nihilo/PENDING.
3. **NOUVEAU** — centre ACTIVE avec `organisationId` ET `userId` non null :
   `membership.findUnique({ userId: centre.userId, organisationId })`
   (select `claimStatut` seul, clé composite indexée, pas de cache).
   `EN_ATTENTE_DOCUMENT` / `EN_ATTENTE_VALIDATION` / `REFUSE` → 403
   `CENTRE_EN_VALIDATION` avec le message « Votre revendication du centre est
   en cours de validation… ». `VALIDE`, `NON_APPLICABLE` ou membership
   absent → autorisé.

Justification JSDoc : `NON_APPLICABLE` = comptes historiques créés par
l'admin, jamais un claim en attente ; les 5 clients prod sont `VALIDE`
(vérifié en base le 07/07). La requête membership ne s'exécute que sur le
chemin bloquant potentiel (centre ACTIVE + destinataire ≠ self) — elle a
lieu aussi pour les clients validés, coût accepté : un findUnique indexé.

## Selects/formes modifiés par appelant

| Fichier | Site | Changement de données |
|---|---|---|
| `clients.service.ts` | `envoyerBrochure` | `organisationId` + `userId` ajoutés au select existant du centre. |
| `devis.service.ts` | `genererConventionScolaire` | `buildConventionScolairePdf` expose `centreOrganisationId` + `centreUserId` (centre complet déjà chargé en interne). |
| Tous les autres (9 sites) | — | Aucun : le centre vient de `getCentreForUser` ou d'un `findMany` sans select → record complet, `organisationId`/`userId` déjà présents. Zéro requête ajoutée pour charger le centre. |

Les 11 sites passent d'un appel conditionné à `statut !== 'ACTIVE'` à un
appel **inconditionnel** (`await`) — nécessaire puisque le blocage peut
maintenant survenir sur centre ACTIVE. Le fetch de l'email du compte devient
lui aussi inconditionnel sur ces chemins (1 select user par envoi gaté).
Les patterns locaux sont conservés : throw avalé dans le try/catch des
émissions de facture (facture persistée, seule la notif saute), skip sans 403
dans `updateDevis`, gate avant création dans `create`/invitations.

## Invariants rejoués (tâche 2)

- **Claimant non validé sur centre ACTIVE** : envoi self → étape 1, autorisé.
  Envoi tiers → étape 3, membership du claimant (`centre.userId` = lui)
  `EN_ATTENTE_VALIDATION` → **bloqué**. C'est le scénario reproduit en prod,
  désormais fermé (idem `EN_ATTENTE_DOCUMENT` et `REFUSE`).
- **Client validé (membership `VALIDE`)** : étape 3 → return. Aucun changement
  de comportement, coût = un findUnique composite par envoi gaté.
- **Hébergeur ex-nihilo (centre PENDING)** : bloqué à l'étape 2, inchangé
  (son membership `EN_ATTENTE_DOCUMENT` n'est même pas consulté).
- **Collaborateur d'un centre au propriétaire non validé** : le membership
  vérifié est celui du PROPRIÉTAIRE (`centre.userId`, jamais le déclencheur)
  → bloqué. L'exception self reste celle du déclencheur : le collaborateur
  peut tester vers sa propre adresse.
- **Centre legacy sans `organisationId`** (ou sans `userId`) : étape 3
  court-circuitée → autorisé, inchangé.
