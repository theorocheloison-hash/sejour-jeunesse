# PASSE D'AJUSTEMENT #38 — après recette visuelle du 03/09

> **Rédigé le 03/09/2026 (matin)** — Prompt d'exécution pour Claude Code, à coller tel quel. Suite directe du run `docs/RUN_CC_38_OVERNIGHT_2026-09-02.md` (rapport : `docs/cc-reports/RAPPORT_RUN_38_2026-09-03.md`). Théo a recetté visuellement la branche ce matin ; ce document liste **exactement** ce qui change. Rien d'autre.
> **Toutes les règles du run (§1 Règles absolues, §2 Environnement, §5 Structure du rapport, §7 Ce que tu ne fais pas) restent en vigueur.** Ce document ne les répète pas ; relis-les avant de commencer.

---

## 0. Cadre

- **Branche** : tu restes sur `feat/38-dashboard-organisateur` (HEAD = commit de clôture du run). Pas de nouvelle branche. `git status` propre avant de commencer.
- **Baseline tests** inchangée : `4 failed, 2 todo, 442 passed` (les 4 = `facture.service.spec.ts`, interdits). `MOLLIE_API_KEY=test_dummy` exporté dans le shell.
- **Rapport** : `docs/cc-reports/RAPPORT_AJUSTEMENT_38_2026-09-03.md`, une section par point (P1 → P10) avec la même structure que le run (Modifications / Code mort supprimé / Commits / Gates / Recette / NON TESTÉ / Écarts / Statut). Écrit au fil de l'eau, commité avec chaque point.
- **Commits** : `fix(38/ajust-Pn): …`, un commit par point, gates avant chaque commit. Ordre imposé (§2). Chaque point est indépendant sauf mention.
- **Aucun push.**
- **Recette** : les serveurs tournent (back watch 4000, front dev 3000). Ce que tu peux vérifier au contrat HTTP, tu le fais ; le visuel est listé pour Théo.

## 1. Ce que la recette visuelle a validé (ne pas retoucher)

Hébergeur : barre 9 onglets et badge « Convention » strictement inchangés. Organisateur : encart, deux phases, six blocs, pastilles, « Prochaine étape », badge D7/D8, bandeau thématiques dans Pédagogie, verrou accompagnateurs, prix provisoire + bouton grisé, ajout d'élève sans mail, lien parent fonctionnel, dashboard à un bouton, CTA repliés, anciennes URLs en 404, redirection `rejoindre` non rejouée (API vérifiée au run). **Tout cela est acquis : n'y touche que là où un point ci-dessous le demande explicitement.**

---

## 2. Les points, dans l'ordre d'exécution

### P1 — Bandeau « devis à signer » : retiré pour l'organisateur créateur seulement
Le badge D7/D8 est vérifié à l'écran → le bandeau ambre (page.tsx, condition historique `role === 'ORGANISATEUR'`) devient redondant **pour `navBlocs`**. Ajouter `&& !navBlocs` à sa condition. **Ne pas supprimer le JSX** : l'accompagnateur (rôle ORGANISATEUR, `navBlocs` faux) doit continuer à le voir (vigilance §8 du cadrage, census « Rendu par rôle »). Liste blanche : `dashboard/sejour/[id]/page.tsx`.

### P2 — Dashboard : badge secondaire contradictoire supprimé
`organisateur/page.tsx` (~l.158-172) : le badge de droite de la carte (« En attente signature — {centre} » / « Signé direction — {centre} », ancienne sémantique deux niveaux) est **supprimé**. Le nom du centre reste affiché en texte simple à cet endroit. Le badge « Devis à signer — {centre} » (OPTION, devis EN_ATTENTE) est **conservé** (c'est une action, pas un statut). Liste blanche : `organisateur/page.tsx`.

### P3 — Modes d'inscription : plus d'exclusivité
Décision Théo : *familles par défaut, saisie manuelle toujours possible en complément* (cas réel : 3 parents ne répondent jamais, l'enseignant saisit ces 3 lui-même).
- Le choix initial (deux cartes, 0 élève) reste. Après choix ou déduction, **le mode n'a plus qu'un rôle d'ordre et de libellé** : en FAMILLES, la section `InscriptionsEleves` (ajout / CSV / envoi) est en haut, la grille de saisie directe (`TabParticipantsSaisieDirecte`) en dessous, **visible** ; en SAISIE, la grille est en haut, la section familles en dessous, **visible** (repliée par défaut avec un intitulé « Faire remplir par les familles »). Rien n'est masqué dans aucun mode.
- Le compteur reste conditionnel (SAISIE : « N élèves dans la liste » ; FAMILLES : « N/M signées »).
- Liste blanche : `TabParticipantsCollab.tsx` (prop `mode` : ne plus masquer la grille), `page.tsx` (ordre des sections), `InscriptionsEleves.tsx` (variante repliable).

### P4 — Lien journal par élève, dans les deux modes (+ vérification du jeton en saisie directe)
- **Census d'abord** : `createBatchDirect` (backend) génère-t-il `tokenAcces` sur chaque `AutorisationParentale` créée ? Coller le code. **Si non** : le générer à la création avec la même fonction que `createSansEmail` (fix à la source : une seule fonction de génération, pas de copie ; si elle est inline, l'extraire en helper privé du service). Spec : une saisie directe produit un `tokenAcces` non nul.
- Front : le bouton « Copier le lien » par élève existe dans `InscriptionsEleves` (mode familles). Il doit être disponible **pour chaque élève quel que soit le mode** — donc aussi sur les lignes issues de la saisie directe. Point d'accroche : la liste de `TabParticipantsCollab` (colonne actions) ou `InscriptionsEleves` rendue dans les deux modes (P3) — choisir **un seul** endroit, ne pas doubler le bouton.
- `TabJournal.tsx` : supprimer le bloc « lien d'exemple `{token}` » (gabarit inutilisable) ; le remplacer par une phrase : « Chaque famille accède au journal avec son lien d'autorisation (bloc Inscriptions › Copier le lien), ou envoyez-le à toutes les familles ci-dessous » — le bouton d'envoi vient en P10.
- Liste blanche : `backend/src/autorisations/autorisation.service.ts` (+ spec), `TabParticipantsCollab.tsx` ou `InscriptionsEleves.tsx`, `TabJournal.tsx`.

### P5 — Clôturer les inscriptions : dans le bloc Inscriptions, un seul composant
- Le bouton existe aujourd'hui dans **Sur place › Chambres** (`TabRooming` côté organisateur — encart « Inscriptions ouvertes — Clôturez les inscriptions pour répartir… »). Localiser le JSX + l'appel API exact (coller dans le rapport). **Ne pas changer le backend de la clôture.**
- Extraire en `_components/ClotureInscriptions.tsx` (composant unique : encart + bouton + appel + `onDone`). Le monter : (a) **dans le bloc Inscriptions**, sous la liste, si `participants.length ≥ 1 && !sejour.inscriptionsCloturees` ; (b) à sa place actuelle dans Chambres **et** dans Groupes comme état vide de rappel (même composant, prop `variant="rappel"` si le texte diffère). Supprimer l'ancien JSX inline de `TabRooming` dans le même commit.
- Après clôture, `onDone` recharge le séjour (`inscriptionsCloturees` doit être dans `SejourCollabInfo` — census dit oui ; vérifier, sinon type additif).
- **États et emphase (`OrganisateurNav`)** : Inscriptions **fait** = `sejour.inscriptionsCloturees === true` ; en cours = ≥1 participant non clôturé ; à faire = 0 participant. Emphase D6 réécrite : si ≥1 participant → premier bloc « à faire »/« en cours » de la phase 2 dans l'ordre Inscriptions → (Sur place n'a pas d'état) ; si Inscriptions est fait et aucun bloc phase 1 n'est « à faire » → **aucune emphase**, libellé « Tout est prêt ✓ » dans la nav ; si Inscriptions fait mais un bloc phase 1 reste à faire (ex. Budget négatif) → emphase sur ce bloc.
- Liste blanche : `TabRooming.tsx` (extraction), `TabGroupes.tsx` (rappel), `_components/ClotureInscriptions.tsx` (nouveau), `OrganisateurNav.tsx`, `page.tsx`.

### P6 — Budget : « fait » = bouclé
Critère actuel (`prix > 0`) faux à l'écran (vert avec un solde de −8 400 €). Nouveau : **fait** = `solde ≥ 0` avec au moins une donnée saisie (dépenses > 0 ou recettes > 0 ou prix posé) ; **en cours** = une donnée saisie mais `solde < 0` ; **à faire** = rien. `solde = totalRecettes − totalDépenses` tel que `TabBudget` l'affiche déjà. Si `OrganisateurNav` n'a pas accès aux totaux (`budgetData` ne les porte pas), **réutiliser le calcul de `TabBudget`** en l'extrayant dans un helper pur `src/lib/budget-solde.ts` (une seule implémentation, `TabBudget` l'importe aussi) — pas de nouveau fetch, pas de duplication. Liste blanche : `OrganisateurNav.tsx`, `TabBudget.tsx`, `src/lib/budget-solde.ts` (nouveau).

### P7 — Réservation : sous-onglets Devis | Documents officiels
Le viewer PDF avale l'écran ; la section Documents officiels est invisible sans scroll. Le bloc Réservation gère une **sous-vue locale** (`'devis' | 'documents'`) : sous-onglet « Devis » = `TabDevisFacturation` seul ; sous-onglet « Documents officiels » = `DocumentsOfficiels` seul, **affiché uniquement si `devisSigne`** (sinon un seul sous-onglet, pas de barre). Cette sous-vue est un état local du bloc, **pas une nouvelle `key` de `TABS`** (`ongletsVisibles`, tracking, accompagnateur : intacts). Les cartes internes de `DocumentsOfficiels` qui naviguent vers Pédagogie/Inscriptions continuent de fonctionner. Liste blanche : `OrganisateurNav.tsx`, `page.tsx`.

### P8 — Sous-onglets : de vrais onglets
Théo n'a pas trouvé les sous-barres (texte gris). Pour **tous** les blocs multi-vues (Sur place, Échanges, Réservation après P7) : un composant unique `_components/SousOnglets.tsx` rendu sous la nav, avec le **gabarit de la barre d'onglets historique** de la page (même hauteur, bordure basse, onglet actif souligné `var(--color-primary)`, libellés `TABS`) — pas trois mots gris. Le premier sous-onglet s'ouvre avec le bloc (déjà le cas). Liste blanche : `OrganisateurNav.tsx`, `_components/SousOnglets.tsx` (nouveau). Aucune classe de la barre hébergeur modifiée (on **copie le style**, on ne touche pas au JSX historique).

### P9 — Bannière `?onboarding=true` : tracer, puis trancher
- Grep `onboarding=true` sur tout le repo (front + back + emails). Rapport : **qui** pose le paramètre, dans quel flux (register self-service ? register depuis `rejoindre` ? création de compte par l'hébergeur ?), et si le compte invité est créé avec un mot de passe **temporaire** (coller le code du flux).
- Décision mécanique : si **aucun** flux invité ne mène au dashboard avec ce paramètre (SC2 redirige vers le séjour), la variante « vous avez rejoint le séjour » ajoutée en SC6 est du **code mort** → supprimer `estCompteInvite` et la variante, revenir au texte historique seul. Si un flux invité y mène encore, le dire, ne rien supprimer, et proposer dans le rapport où l'information « définissez votre mot de passe » devrait vivre pour l'invité (probablement l'encart de l'espace séjour). **Ne pas modifier le flux de mot de passe.**
- Liste blanche : `organisateur/page.tsx`.

### P10 — Envoyer le lien du journal aux familles (nouveau, back + front)
Décision Théo : on ne reporte pas. Un parent inscrit à la main n'a jamais reçu de lien ; il faut pouvoir l'envoyer à toutes les familles ayant un email, **sans** passer par le mail d'autorisation.
- **Backend** : `AutorisationService.envoyerLienJournal(sejourId, userId)` — garde `createurId === userId` (même garde que le reste du service) ; pour chaque `AutorisationParentale` du séjour avec `parentEmail` non vide et `tokenAcces` non nul → `EmailService.sendLienJournal({ to, prenomEleve, nomSejour, url })` ; ne touche **pas** `emailEnvoye` (c'est le flag de l'autorisation) ; retourne `{ sent, skipped }` (skipped = sans email ou sans jeton). Endpoint `POST /autorisations/sejour/:sejourId/envoyer-lien-journal`, `@Roles(ORGANISATEUR)`. **Construction de l'URL journal** : réutiliser la même base que le lien d'autorisation existant (`FRONTEND_URL` + `/sejour/{token}/journal` ou ce que `TabJournal` affichait) — si cette construction est inline ailleurs, l'extraire en helper unique, pas de seconde copie. Nouveau template dans `email.service.ts` calqué sur `sendAutorisationParentale` (même structure, texte : « Suivez le séjour de {prénom} : photos et nouvelles publiées par l'équipe. Lien personnel, à ne pas transférer. »). Spec : 2 autorisations avec email + 1 sans → `sent: 2, skipped: 1`, `emailEnvoye` inchangé.
- **Front** : `src/lib/autorisation.ts` → `envoyerLienJournal(sejourId)` ; `TabJournal.tsx` → bouton « Envoyer le lien du journal aux familles » (organisateur créateur uniquement, `navBlocs`), confirmation avant envoi (« N familles avec email recevront le lien »), retour « N envoyés, M sans email ». Visible aussi si le journal est vide (c'est justement le moment de l'envoyer).
- Liste blanche : `autorisation.service.ts` (+ spec), `autorisation.controller.ts`, `email.service.ts`, `src/lib/autorisation.ts`, `TabJournal.tsx`.
- Recette API : séjour seed (1 élève avec email, 1 accompagnateur) → `sent:1` + un mail loggé avec le bon subject ; séjour SC2 (3 élèves) → `sent:3`.

---

## 3. Dépendances
P3 → P4 (le bouton par élève dépend de l'ordre des sections). P5 → P6 (l'emphase « Tout est prêt » lit l'état Budget). P7 → P8 (Réservation devient multi-vues). P4 → P10 (helper d'URL et jeton). Le reste est indépendant. Si un point échoue (3 tentatives, gate rouge), revert, consigne, continue.

## 4. Fin
`git status` propre, `git log --oneline main..HEAD` en §8 du rapport, `npm test` = baseline + tests ajoutés. **Aucun push.** Tu t'arrêtes. Théo recette visuellement : P3 (deux modes visibles), P5 (bouton dans Inscriptions, « Tout est prêt »), P6 (Budget orange à −8 400), P7/P8 (sous-onglets visibles), P10 (bouton + mail loggé).

## 5. Ce que tu ne fais PAS
Tout §7 du run. Plus : refaire la nav ; changer les libellés D8 ; toucher `verifyAccess` ou le backend de la clôture ; ajouter un badge non-lus ; modifier l'état vide du dashboard ; toucher au rendu hébergeur/signataire/accompagnateur ; un lien journal unique par séjour (refusé : sécurité photos de mineurs — le jeton par famille est la règle).
