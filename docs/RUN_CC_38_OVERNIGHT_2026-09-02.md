# RUN CC #38 — Overnight, branche isolée, chantier complet

> **Rédigé le 02/09/2026 (soir)** — Prompt d'exécution pour Claude Code (Fable), à coller tel quel. **Périmètre : le chantier #38 complet, SC0 → SC7**, sur une branche isolée, **sans aucun push**. Théo relit le rapport, recette en local et ajuste avant tout merge/deploy.
> **Sources de vérité** (à lire EN ENTIER avant toute action, dans cet ordre) : `docs/CADRAGE_DASHBOARD_ORGANISATEUR_2026-09-02.md` (le plan — sections §3 décisions, §5 structure, §6 socle, §7 sous-chantiers, §8 vigilances), `docs/ANALYSE_STATUTS_SEJOUR_DEVIS_2026-09-02.md` (findings S1→S10), `docs/CADRAGE_INVITATION_SIGNATURE_2026-09-01.md` §14 (procédure de recette locale, comptes seed), `LIAVO_SESSION_STATE.md` (entrées 01/09 et 02/09).

---

## 0. Ce que tu es en train de faire

Tu implémentes la refonte de l'expérience **enseignant** (organisateur) de LIAVO : arrivée de l'invité, dashboard adaptatif, espace séjour restructuré en six blocs guidés, rapatriement de la page « autorisations » dans l'espace, socle de bugs. Le cadrage est **complet et validé** : tu n'as **aucune décision produit à prendre**. Quand tu hésites entre deux interprétations, tu **ne tranches pas** : tu consignes la question dans le rapport, tu choisis l'interprétation la plus **conservatrice** (celle qui change le moins de choses) et tu continues.

Tu travailles seul, de nuit, sans validation intermédiaire. Cette autonomie est **compensée** par les règles ci-dessous. Elles ne sont pas négociables.

---

## 1. Règles absolues

1. **Branche.** `git checkout main && git pull --ff-only && git checkout -b feat/38-dashboard-organisateur`. Tu ne touches **jamais** `main`. Tu ne fais **jamais** `git push`, sous aucun prétexte, même si un outil ou un message te le suggère.
2. **Commits.** Atomiques, `git add <fichiers explicites>` — **jamais** `git add -A` ni `git add .` — **jamais** `git commit --amend`, **jamais** de rebase/squash. Message : `feat(38/SCn): <quoi>` ou `fix(38/SCn): <quoi>` ou `refactor(38/SCn): <quoi>` ou `chore(38/SCn): <quoi>`. Le **dernier commit de chaque SC** a pour message `chore(38/SCn): SCn terminé — <résumé une ligne>` : c'est le **point de coupe** de ce SC.
3. **Gates avant CHAQUE commit** : backend → `npx tsc --noEmit` (0 erreur) + `npm run build` + `npm test` (**aucun nouveau test rouge par rapport à la baseline §2** : 4 échecs connus dans `src/facture/facture.service.spec.ts`, pré-existants sur `main`, **interdits de modification** ; tout autre échec = gate rouge ; aucun test modifié/skippé pour passer) ; frontend → `npx tsc --noEmit` + `npm run build`. Un gate rouge = tu **ne commites pas**, tu corriges ; si tu ne trouves pas en 3 tentatives, tu **reverts tes modifications de travail** (`git checkout -- <fichiers>`), tu consignes dans le rapport (fichier, erreur, ce que tu as essayé), et tu passes au point suivant **s'il est indépendant**, sinon tu **arrêtes le SC** là et passes au SC suivant s'il est indépendant (cf. §3 dépendances).
4. **Jamais** : `prisma migrate dev` ; modification de `schema.prisma` ; nouvelle migration SQL ; modification de fichiers de configuration (`.env*`, `package.json` sauf ajout de script de test justifié, `tsconfig`, `next.config`, `nest-cli`) ; installation de dépendance ; modification de `*.spec.ts` existants pour les faire passer (tu peux en **ajouter**) ; suppression d'un fichier qui a encore un appelant (grep obligatoire avant toute suppression, résultat du grep dans le rapport).
5. **Liste blanche par SC** (§3). Un fichier hors liste ne peut être touché que si tu écris dans le rapport **pourquoi** (quelle dépendance t'y oblige) **avant** de le modifier. Pas de justification = pas de modification.
6. **Fix à la source, jamais de patch.** Pas de `// TODO`, pas de `try { } catch {}` pour masquer, pas de `as any`, pas de `eslint-disable` nouveau, pas de duplication : un composant ou une fonction se **déplace** (`git mv` ou extraction + suppression de l'original dans le **même** commit), jamais ne se copie. Si tu rencontres du code mort **sur le chemin de ce que tu modifies**, tu le supprimes dans le même SC (grep prouvant zéro appelant dans le rapport). Tu ne pars pas à la chasse au code mort hors chemin.
7. **Rien d'inventé.** Chaque affirmation du rapport est sourcée `fichier:ligne` ou par une sortie de commande collée. Tu n'écris jamais « probablement », « devrait fonctionner », « je pense que » à propos de ton propre code : tu l'as testé ou tu écris « NON TESTÉ » en majuscules.
8. **Ordre strict SC0 → SC7.** Tu ne commences pas un SC tant que le précédent n'a pas son commit `SCn terminé` **ou** une section de rapport expliquant pourquoi il est incomplet. Tu ne sautes jamais un SC. Si SC3 est incomplet, tu **n'entames pas** SC4, SC5, SC6 (ils en dépendent) — tu passes à SC7 s'il est faisable, sinon tu termines le rapport.
9. **Rapport** : `docs/cc-reports/RAPPORT_RUN_38_2026-09-03.md`, structure imposée (§5), **écrit au fil de l'eau** (une section par SC, complétée à la fin de chaque SC, pas reconstituée de mémoire à la fin). Le rapport lui-même est commité à la fin de chaque SC dans le commit `SCn terminé`.
10. **Conditionnalités** (§3) : certaines modifications ne sont autorisées **que si** un census l'a prouvé. Sans preuve, tu ne les fais pas.

---

## 2. Environnement local (avant SC0)

Procédure de `CADRAGE_INVITATION_SIGNATURE_2026-09-01.md` §14 : `migrate deploy` + `db seed` verts ; back sur 4000, front sur 3000 ; emails loggés en console (tokens dans les logs backend). Comptes seed : `hebergeur@test.local` / `Hebergeur1!` — `organisateur@test.local` / `Organisateur1!`.

Vérifie que les deux apps démarrent et que `npm test` (back) donne **exactement la baseline** avant toute modification. Colle les sorties dans le rapport §0. Si l'environnement ne démarre pas, tu **n'écris aucun code** : tu consignes et tu t'arrêtes.

**Baseline de tests connue (vérifiée par Théo le 02/09 au soir, sur `main` = `bda2e47`)** : `Tests: 4 failed, 2 todo, 427 passed, 433 total`. Les 4 échecs sont tous dans `src/facture/facture.service.spec.ts` (`validerAcompte — versement de régularisation`, mock Prisma sans `centreHebergement`). **Tu ne touches pas à ce spec.** Tu ne répares ni la config jest, ni `mollie.client.ts`, ni ce mock — ce sont trois dettes de test **hors #38**, à consigner telles quelles dans le rapport §0 (« dettes de test constatées sur main ») :
1. jest ne charge pas `backend/.env` (NestJS oui) → `mollie.client.ts` instancie le client Mollie **à l'import** avec une clé vide et fait échouer toute suite qui l'importe transitivement (`auth.service.spec`, `admin/refuser-centre.spec`).
2. `facture.service.spec.ts` : mock périmé depuis l'ajout de `getUserCentrePermissions` dans `assertFacturationWrite`.
3. Conséquence : `main` a été poussé avec des tests rouges.

**Variable d'environnement requise pour les tests** : `MOLLIE_API_KEY` doit être définie dans le shell (Théo l'a posée : `$env:MOLLIE_API_KEY="test_dummy"`). Si tu lances `npm test` dans un nouveau shell/sous-process et que tu vois `Parameter "apiKey" is an empty string`, ce n'est **pas** une régression de ton code : exporte la variable et relance. Ne l'écris dans aucun fichier.

**Recette** : tout ce qui est mécanique (tests, `tsc`, `build`, `curl` sur les endpoints avec un JWT obtenu par login, lecture des logs, requêtes SQL locales via Prisma) tu le fais. Tout ce qui est **visuel** (rendu d'une page, position d'un élément, lisibilité) tu ne prétends **pas** l'avoir vérifié sauf si tu disposes réellement d'un outil de capture navigateur — auquel cas tu joins les captures. Sinon tu listes dans le rapport §6 exactement ce que Théo doit regarder à l'écran, page par page, rôle par rôle.

---

## 3. Sous-chantiers

Périmètre, liste blanche, conditionnalités et cascades sont ceux du cadrage §6-§7-§8 — **les relire pour chaque SC avant de commencer**. Ci-dessous : ce qui est spécifique au run.

### SC0 — Census (lecture seule, aucun commit de code)

Lire tout ce qui est marqué « non lu » dans le cadrage §2 et produire, dans le rapport §SC0, pour chacun : ce qu'il contient, ce qui impacte le plan. Puis :

- **Confirmer ou infirmer S2** par un test réel : login organisateur, séjour en CONVENTION (créer via la recette B du 01/09 si besoin), `PATCH /sejours/:id` avec `{ prix: 100 }` → coller code HTTP + body. **Sans cette preuve, S2 n'est pas traité en SC1.**
- **Grep** de tous les appelants de : `createAutorisation` / `AutorisationService.create(` (S7) ; `/autorisations` comme fragment d'URL (front, back, emails, templates) ; `organisateur/documents/` ; `StatutBadge` ; `updateSejour(` ; `soumettreAuRectorat`. Coller les résultats.
- Vérifier : `accepterInvitation` (lib front) retourne-t-il le body `{ sejourId }` ; `SejourCollabInfo` expose-t-il `prix`, `dateLimiteInscription`, `demandes[].devis[]` ; `sourceInscription` sur `AutorisationParentale` — qui le pose, quelles valeurs ; critère « projet pédagogique renseigné » (quels champs) ; conditions exactes d'affichage des 3 CTA et de la bannière dans `organisateur/page.tsx` ; ce que `documents/[id]` affiche et appelle.
- Rendu par rôle sur `dashboard/sejour/[id]/page.tsx` : lister ce que **hébergeur**, **signataire**, **accompagnateur** (`estAccompagnateur`) voient — c'est la base de non-régression de SC3.

Fin de SC0 : commit `chore(38/SC0): SC0 terminé — census` contenant **uniquement** le rapport.

### SC1 — Socle backend

- **S2** (si confirmé en SC0) : dans `sejour.service.ts` `update()`, séparer la garde. Les champs d'appel d'offres (`niveauClasse`, `activitesSouhaitees`, `budgetMaxParEleve`, `nombreAccompagnateurs`, `heureArrivee`, `heureDepart`, `transportAller`, `transportSurPlace`, `informationsComplementaires`) restent réservés à DRAFT. `prix` et `dateLimiteInscription` sont autorisés sur CONVENTION et SIGNE_DIRECTION (**pas** OPTION — D12). **Idempotence du mail** `sendPaiementDisponible` : n'envoyer qu'au passage `prix` de `0/null` à `> 0` (lire l'ancien `prix` avant update). Ajouter un `*.spec.ts` couvrant : DRAFT accepte tout ; CONVENTION accepte `prix` et refuse `niveauClasse` ; mail envoyé une seule fois sur deux updates successifs.
- **S7 = D14** : le formulaire d'ajout manuel doit aboutir à `createSansEmail`. Si le controller expose une route dédiée à `create()` (avec envoi), la faire pointer sur `createSansEmail` **ou** exposer `createSansEmail` sur une route et supprimer l'ancienne — choix conservateur : garder le même chemin HTTP, changer l'implémentation, pour que l'ancien front continue de marcher. `AutorisationService.create()` supprimé **uniquement si** le grep SC0 prouve zéro appelant après ce changement. Spec : l'ajout d'un élève n'appelle pas `sendAutorisationParentale`.
- Liste blanche : `backend/src/sejours/sejour.service.ts`, `backend/src/autorisations/autorisation.service.ts`, `backend/src/autorisations/autorisation.controller.ts`, nouveaux `*.spec.ts` dans ces dossiers.
- **Rétro-compatibilité** : l'ancien front (main) doit continuer à fonctionner contre ce back. Vérifie-le : lance le front sans tes modifications SC2+ (elles n'existent pas encore) et rejoue le parcours d'ajout d'élève.

### SC2 — Arrivée invité

- `rejoindre/[token]/page.tsx` : capturer le retour d'`accepterInvitation`, `router.push('/dashboard/sejour/${sejourId}')` (fallback dashboard si `sejourId` absent, avec `console.error`). Wordings : « Vous rejoignez le séjour… » / « Vous avez rejoint le séjour. Redirection… » ; supprimer toute mention de « création ». Si `lib/invitation-collaboration.ts` ne retourne pas le body, l'adapter (typé).
- Encart repliable v0 : **pas dans ce SC** (il vit dans l'espace, SC3).
- Liste blanche : `frontend/app/rejoindre/[token]/page.tsx`, `frontend/src/lib/invitation-collaboration.ts`.
- Recette : parcours B du 01/09 rejoué → atterrissage sur `/dashboard/sejour/{id}`.

### SC3 — Nav enseignant (le SC de jugement)

**Avant d'écrire une ligne de code**, écris dans le rapport §SC3 ta **proposition d'architecture** : nom et responsabilité du composant, comment il se branche dans `page.tsx` (la condition exacte de rendu), comment il calcule les six états de bloc et l'emphase (avec les données déjà chargées par la page — `sejour`, `budgetData`, `participants`, `accompagnateurs` — sans nouveau fetch si possible), comment il gère `activeTab`, ce qui arrive au bandeau thématiques et au bandeau devis, et **ce que tu as vérifié** pour que hébergeur / signataire / accompagnateur ne voient **aucune** différence (référence au census SC0). Puis code.

Contraintes fermes :
- Condition de rendu : `user.role === 'ORGANISATEUR' && !estAccompagnateur`. Sinon : barre d'onglets **inchangée** (même JSX, même ordre, mêmes classes).
- Les `key` de `Tab` et le tableau `TABS` ne changent pas. `ongletsVisibles` ne change pas. `ONGLETS_TRACKING` ne change pas. `ACCOMPAGNATEUR_TABS` ne change pas.
- Les composants `Tab*` ne sont **pas modifiés** dans ce SC. Les blocs les montent tels quels.
- Répartition (cadrage §5.3) : Réservation = `devis` ; Pédagogie = `projet` + section thématiques (le bandeau global de `page.tsx` est **déplacé** dans cette section, pas dupliqué, supprimé de sa position actuelle **pour l'organisateur créateur seulement** — s'il est affiché pour d'autres rôles aujourd'hui, vérifier SC0 ; il est conditionné `role === 'ORGANISATEUR'`, donc l'accompagnateur le voit aussi : conserver ce comportement pour l'accompagnateur) ; Budget = `budget` ; Inscriptions = `participants` (+ `chambres`→ non : Chambres va dans Sur place) ; Sur place = `planning`, `groupes`, `chambres` ; Échanges = `messages`, `journal`, `documents`.
- Phases et emphase : cadrage §5.3, règle D4+D6. Onglet par défaut pour ce rôle = bloc en emphase.
- Badge D7/D8 dans `SejourHeader` : « En attente de signature » / « En cours de validation direction » / « Séjour confirmé ✓ » / « Annulé », dérivé de `budgetData.devis.statut` (source déjà chargée) avec fallback sur `sejour.statut`. **Le bandeau « devis à signer » actuel est conservé dans ce SC** ; sa suppression est un commit séparé, dernier de SC3, uniquement si le badge est live et testé.
- Encart repliable « Comment fonctionne cet espace » : composant simple, état replié/déplié en mémoire (pas de `localStorage`), texte : rôle enseignant vs hébergeur, inscriptions = responsabilité de l'enseignant, deux modes d'inscription (D14).
- Liste blanche : `frontend/app/dashboard/sejour/[id]/page.tsx`, `frontend/app/dashboard/sejour/[id]/_components/OrganisateurNav.tsx` (nouveau), `frontend/app/dashboard/sejour/[id]/_components/EncartAide.tsx` (nouveau), `frontend/app/dashboard/sejour/[id]/_components/SejourHeader.tsx`. **Pas** `StatutBadge` ici (SC7).
- Recette obligatoire, **quatre profils sur le même séjour** : organisateur créateur (nav blocs), hébergeur (barre inchangée — comparer au census SC0 ligne à ligne), signataire (idem), accompagnateur (idem). Toute différence pour les trois derniers = régression = revert du commit fautif.

### SC4 — Rapatriement inscriptions

- Extraire de `organisateur/sejours/[id]/autorisations/page.tsx` trois composants dans `dashboard/sejour/[id]/_components/` : `InscriptionsEleves.tsx` (ajout manuel, import CSV, liste avec badge « non envoyé », sélection, bouton « Envoyer aux familles (N) », copie de lien), `Accompagnateurs.tsx` (ajout, accès collaboratif, diplôme ; **verrouillé** si devis non signé avec le message « Signez le devis pour ajouter les accompagnateurs »), `PrixParEleve.tsx` (nb définitif, prix/élève, date limite ; **prix provisoire** calculé sur le devis affiché même EN_ATTENTE avec libellé « en attente de validation du devis » ; bouton « Enregistrer » **désactivé** tant que le devis n'est pas SELECTIONNE/SIGNE_DIRECTION — D12).
- **Choix explicite D14** en tête du bloc Inscriptions : deux options « Je fais remplir par les familles » / « Je saisis moi-même la liste ». Le mode courant se déduit des données existantes (présence de `parentEmail` ? `sourceInscription` ? — ce que SC0 a trouvé) ; s'il n'y a aucun élève, l'enseignant choisit. En mode saisie, `TabParticipantsCollab` n'affiche pas le compteur « signées » (modification **minimale** de ce composant, prop `mode`).
- Source séjour = `getSejourCollabInfo` (la page chargeait `getMesSejours().find`). Si `SejourCollabInfo` n'expose pas `prix` / `dateLimiteInscription` / devis (SC0), **enrichir `getSejourInfo` côté back** (additif, `select` étendu) — liste blanche étendue à `backend/src/collaboration/collaboration.service.ts` et `frontend/src/lib/collaboration.ts` avec justification dans le rapport.
- Monter `InscriptionsEleves` + `Accompagnateurs` dans le bloc Inscriptions, `PrixParEleve` dans le bloc Budget.
- **Dernier commit du SC, séparé** : supprimer `autorisations/page.tsx` (et le dossier `sejours/[id]` s'il devient vide — vérifier `modifier` et `offres` qui y sont aussi : **ne pas les supprimer**), retirer le bouton « Gérer les autorisations » de `organisateur/page.tsx`, et pour **chaque** lien entrant recensé en SC0 vers `/autorisations` : le rediriger vers `/dashboard/sejour/[id]`. Si un lien entrant vit dans un template d'email backend, liste blanche étendue au fichier concerné avec justification. **Ne supprime pas la route si un lien entrant n'a pas pu être redirigé** — consigne et laisse la route.
- Recette : ajouter un élève (pas de mail dans les logs), importer un CSV, envoyer aux familles (mails dans les logs, un par élève sélectionné), ajouter un accompagnateur sur devis signé / message sur devis non signé, prix provisoire affiché sur devis EN_ATTENTE, enregistrement possible après signature — **sur un séjour rejoint ET sur un séjour d'appel d'offres** (parcours DRAFT → SUBMITTED → devis → `updateStatut` SELECTIONNE).

### SC5 — Documents officiels

- Ce que fait ce SC dépend **entièrement** du census SC0 sur `documents/[id]`. Règle : absorber le contenu dans le bloc Réservation comme section « Documents officiels » **si** c'est de l'affichage/téléchargement (convention, factures). **Si** la page contient le bouton « soumettre au rectorat » (S4, endpoint inatteignable) : tu **ne répares pas** l'endpoint, tu conserves le bouton tel quel dans la section absorbée (comportement identique = pas de régression), et tu consignes. Supprimer la route `documents/[id]` en dernier commit, avec redirection des liens entrants (mêmes règles que SC4). Si le contenu est plus complexe que prévu (formulaires, actions multiples), **ne pas absorber** : consigner une proposition et passer à SC6.
- Liste blanche : `organisateur/documents/[id]/page.tsx` → `dashboard/sejour/[id]/_components/DocumentsOfficiels.tsx`, `page.tsx`, `organisateur/page.tsx` (bouton).

### SC6 — Dashboard adaptatif

- `organisateur/page.tsx` : carte séjour → **un seul bouton « Ouvrir le séjour »** (les liens autorisations / espace collaboratif / documents officiels disparaissent — ils sont maintenant dans l'espace). Badges de statut : **ne pas les renommer ici** (SC7). Le badge « Devis à signer » reste.
- 3 CTA du haut : démotés (regroupés dans un bloc replié « Trouver un hébergement / lancer un appel d'offres ») **si** tous les séjours du compte ont un `hebergementSelectionneId` et aucun n'est DRAFT/SUBMITTED ; sinon affichage actuel. Jamais supprimés (D13).
- Bannière `?onboarding=true` : si le compte a au moins un séjour rejoint (critère : SC0 dira — par exemple `invitationCollabTokenPending` ou présence d'une `DemandeDevis` FERMEE bridge) → texte invité « Bienvenue — vous avez rejoint le séjour. Définissez votre mot de passe. » ; sinon texte actuel. Si aucun critère fiable n'existe côté front sans nouveau fetch, **garder le texte actuel** et consigner.
- État vide : si `InvitationsPendantesBanner` a des invitations → texte « Vous avez une invitation en attente ci-dessus » à la place de « créez votre premier séjour » — uniquement si l'information est accessible sans nouveau fetch (sinon consigner).
- `InvitationsPendantesBanner` : inchangé.
- Liste blanche : `frontend/app/dashboard/organisateur/page.tsx`.
- Recette : compte invité seul ; compte self-service (séjour DRAFT) ; compte mixte.

### SC7 — Vocabulaire (D8)

- **Census d'abord** (SC0 a listé les usages de `StatutBadge`). Si le composant est utilisé par hébergeur/signataire : ajouter une prop `audience?: 'organisateur'` qui active le mapping D8 (*en attente de signature / en cours de validation direction / signé / annulé*), sans changer le rendu par défaut. Si organisateur-only : mapping direct.
- Harmoniser « Option » (`SejourHeader`) et « À confirmer » (`STATUT_CONFIG` dashboard) → le libellé D8 dérivé du **devis** quand disponible, sinon du séjour.
- Liste blanche : `frontend/src/components/StatutBadge.tsx`, `organisateur/page.tsx` (`STATUT_CONFIG`), `SejourHeader.tsx`.

---

## 4. Dépendances entre SC (pour la règle 8)

SC0 → tout. SC1 → SC4 (prix), indépendant du reste. SC2 indépendant. SC3 → SC4, SC5, SC6. SC7 indépendant (dépend de SC0 seulement). Donc : si SC3 échoue, tu fais SC7 puis tu termines le rapport. Si SC1 échoue, SC2/SC3 restent possibles, SC4 fait le prix « affichage seul » et consigne.

---

## 5. Structure imposée du rapport

```
# Rapport run #38 — <date/heure début> → <date/heure fin>
## 0. Environnement (sorties : migrate, seed, npm test initial, versions)
## SC0 — Census
  ### Fichiers lus (liste)
  ### Findings (un par ligne : fichier:ligne — constat — impact sur le plan)
  ### S2 : CONFIRMÉ / INFIRMÉ (requête + réponse collées)
  ### Greps (résultats bruts)
  ### Rendu par rôle sur page.tsx (hébergeur / signataire / accompagnateur : liste exacte des onglets + bandeaux)
  ### Questions ouvertes (ce que tu n'as pas pu déterminer)
## SC1 … SC7 (une section chacune)
  ### Proposition d'architecture (SC3 uniquement, AVANT le code)
  ### Modifications (fichier — quoi — pourquoi ; fichiers hors liste blanche avec justification)
  ### Code mort supprimé (fichier — grep prouvant zéro appelant)
  ### Commits (git log --oneline main..HEAD pour ce SC + git show --stat de chaque)
  ### Gates (sorties collées)
  ### Recette effectuée (scénario — résultat — preuve : curl/log/test)
  ### NON TESTÉ (liste explicite)
  ### Écarts au cadrage (ce que tu as fait différemment et pourquoi)
  ### Statut : TERMINÉ / INCOMPLET (raison) / NON COMMENCÉ (raison)
## 6. À vérifier visuellement par Théo (page — rôle — quoi regarder)
## 7. Questions pour la passe d'ajustement
## 8. État final : git log --oneline main..HEAD complet + git status
```

---

## 6. Fin de run

`git status` propre (rien de non commité, sinon consigne ce qui reste et pourquoi), `git log --oneline main..HEAD` collé en §8, rapport commité. **Aucun push.** Tu t'arrêtes.

---

## 7. Ce que tu ne fais PAS, même si ça semble utile

Refondre les enums de statuts. Toucher S1, S3, S4, S5, S6 de l'analyse statuts. Toucher `verifyAccess`. Modifier des composants `Tab*` au-delà de la prop `mode` de `TabParticipantsCollab` en SC4. Réparer `soumettreAuRectorat`. Réparer `facture.service.spec.ts`, la config jest/dotenv ou `mollie.client.ts` (dettes de test hors périmètre, §2). Ajouter un tour modal / onboarding one-shot. Toucher au rendu hébergeur ou signataire. Renommer des routes API. Créer un second composant qui ressemble à un existant. Améliorer du code que tu croises sans l'avoir dans ton périmètre. Pousser.
