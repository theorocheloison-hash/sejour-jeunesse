# LIAVO — Cadrage #38 v2 : Dashboard organisateur + espace enseignant

> **v2 rédigée le 02/09/2026** (remplace la v1 du matin, dont l'état de réflexion est intégralement absorbé ici). Issue de la session sparring #38 : cartographie lue sur le code réel, décisions produit de Théo, plan d'exécution. **Statut : CADRAGE À VALIDER PAR THÉO. Aucun code modifié. Aucun prompt CC émis.**
> **Nature du chantier : GROS.** Exigences posées par Théo : vigilance maximale, prompts CC *safe* et sans cascade, **fix à la source** (jamais de patch, jamais de duplication), suppression du code mort rencontré sur le chemin.
> **Réf.** : `docs/ANALYSE_STATUTS_SEJOUR_DEVIS_2026-09-02.md` (statuts, findings S1→S10 — cité ici par leurs numéros), `docs/CADRAGE_INVITATION_SIGNATURE_2026-09-01.md` (lot précédent, T3/T4/T6/T7), `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` (pendant hébergeur, mai).

---

## 0. Le sujet en une phrase

LIAVO a **deux enseignants** — celui qui vient seul (appel d'offres ou demande directe via le catalogue) et celui qui est **invité par son hébergeur** — et l'interface n'a été conçue que pour le premier. Le second, celui de septembre (Choucas, Pôle Montagne, démos LMDJ), arrive sur un dashboard qui ne lui parle pas, dans un espace à 10 onglets sans guidage, et **sa tâche principale (inscrire ses élèves) vit sur une page qu'il ne peut pas trouver**. Objectif : un enseignant qui arrive **comprend seul** où il en est et quoi faire, sans jamais solliciter l'hébergeur — qui ne voit pas son écran.

---

## 1. Ce que l'enseignant invité vit AUJOURD'HUI (factuel, lu sur le code)

1. Reçoit le mail → `/rejoindre/[token]` → crée son compte → « Confirmer et rejoindre ».
2. Écrans « Création du séjour en cours… » puis « Séjour créé avec succès » — **faux** : le séjour existe, il le rejoint (résidu d'une version où `accepter()` créait un séjour). Redirigé vers `/dashboard/organisateur` alors que `accepter()` renvoie déjà `sejourId` (le front ne le lit pas) — **S9**.
3. Dashboard : bannière `?onboarding=true` « votre demande a bien été envoyée » (**faux**) ; 3 CTA fixes catalogue / appel d'offres / mes demandes (**hors sujet**) ; sa carte « À confirmer » ; bouton « Espace collaboratif ».
4. Espace : 10 onglets (Devis, Messages, Planning, Groupes, Participants, Chambres, Documents, Journal, Budget, Projet péda), ouverture sur Devis, deux bandeaux empilés (thématiques manquantes + devis à signer). Il signe — guidé par le bandeau.
5. **Après la signature, plus aucun guidage.** Participants = « Aucun participant enregistré » + une grille de saisie type tableur.
6. Il ne peut pas savoir que **la vraie voie** — ajouter ses élèves, envoyer le lien d'autorisation aux parents, déclarer ses accompagnateurs, fixer le prix par élève — est sur `organisateur/sejours/[id]/autorisations`, atteignable **uniquement** par le bouton « Gérer les autorisations » de la carte dashboard, visible **seulement** au statut Convention — **S10**.
7. Le budget prévisionnel (dépenses devis + transport/assurance, recettes familles/subventions, export PDF — un livrable pour sa direction) est dans un onglet dont rien ne signale l'existence.
8. Et quand il pose enfin son prix par élève : `PATCH /sejours/:id` **refuse tout séjour non-DRAFT** → prix jamais enregistré, mail « paiement disponible » aux parents jamais envoyé — **S2** (quasi-certain, non exécuté, à confirmer en SC0).

**Le diagnostic n'est donc pas « 10 onglets ».** C'est : tâche principale cachée hors de l'espace, deux workflows d'inscription parallèles sans indication, zéro « prochaine action » après la signature, quatre wordings faux, et un bug bloquant sur le prix.

---

## 2. Cartographie factuelle complémentaire (lue le 02/09)

- **`accepter()`** pose `createurId = user.id` + `modeGestion = COLLABORATIF`, séjour reste OPTION, devis reste EN_ATTENTE (bridge `DemandeDevis` FERMEE). L'invité est donc **créateur** après acceptation : il passe `verifyAccess` dès OPTION et `peutSaisirParticipants`.
- **`verifyAccess`** : créateur + hébergeur accèdent dès OPTION ; **accompagnateurs et signataire** limités à CONVENTION/SIGNE_DIRECTION — **S8**.
- **Inscriptions** (`AutorisationService`) : seule garde = `createurId === userId`, **aucune garde de statut** → inscrire avant signature est déjà permis.
- **Barre d'onglets** = un seul composant partagé 3 rôles (`ongletsVisibles`). Organisateur créateur = 10 onglets ; hébergeur = 9 (pas projet, pas budget, + notes) ; signataire = 6 ; **accompagnateur (rôle ORGANISATEUR non-créateur, `estAccompagnateur`) = `ACCOMPAGNATEUR_TABS`** (planning, participants, groupes, chambres, journal). `activeTab` par défaut = `'devis'` pour tous. `ONGLETS_TRACKING` (messages/documents/journal) alimente les notifications hébergeur.
- **Page autorisations** = ajout d'élève (mail immédiat — **S7**), import CSV (silencieux + envoi groupé), copie de lien, envoi des invitations, **accompagnateurs** (ajout, accès collaboratif LECTURE/EDITION, diplôme), **prix par élève** (calculé sur `devis.statut === 'SELECTIONNE'` uniquement, sinon 0) + date limite, via `getMesSejours().find(...)` + `updateSejour` (→ S2).
- **Onglet Participants** (`TabParticipantsCollab`) = **lecture** (liste, statut signée/en attente, docs médical/assurance, paiement, export CSV, accompagnateurs) + `TabParticipantsSaisieDirecte` (grille tableur, `createBatchDirect`). Les deux workflows d'inscription coexistent — **S10**.
- **Budget** (`TabBudget`) = budget prévisionnel enseignant : dépenses (devis + lignes complémentaires) / recettes / solde / PDF. S'appuie déjà sur le devis **non signé** (assumé, cadrage 01/09 §10.4).
- **Gestes de signature** (7 voies) et statuts posés : cf. `ANALYSE_STATUTS` §2.3. Toutes les voies « client » → SELECTIONNE / CONVENTION.
- **Non lu (à lire en SC0)** : `organisateur/documents/[id]/page.tsx`, `dashboard/signataire/page.tsx`, `src/components/StatutBadge.tsx`, `notifications/notifications.service.ts` (3 crons), `TabProjetPedagogique.tsx`, `TabDevisFacturation.tsx` branche `!isDirect` (140 KB), `SignatureDevisPanel`, `autorisation.controller.ts`, `src/lib/autorisation.ts`, `organisateur/page.tsx` conditions exactes des CTA (lu en v1, à relire pour SC6), `demande.service.ts` (`findOpen`), `centre.service.ts` (planning dashboard global, pour la couleur OPTION).

---

## 3. Décisions produit ACTÉES (Théo, 02/09)

| # | Décision |
|---|---|
| D1 | **Un seul dashboard adaptatif**, pas de fork invité / self-service. L'invité converge vers un portefeuille dès son 2ᵉ séjour ; deux surfaces = deux fois les régressions. |
| D2 | **L'invité atterrit sur son séjour** après acceptation, pas sur le dashboard. |
| D3 | **Les trois boutons de la carte séjour** (autorisations / espace collaboratif / documents officiels) **disparaissent**. Un seul bouton « Ouvrir le séjour ». Autorisations et documents officiels deviennent des sections de l'espace. |
| D4 | **Structure de l'espace côté enseignant = blocs par tâche + guidage.** Six blocs (§5.3), chacun avec un état (fait / à faire / pas encore), des consignes dans les blocs vides, et **une seule action mise en évidence** à l'ouverture. Ce n'est pas un regroupement d'onglets : c'est la nav qui guide. |
| D5 | **Deux phases** — *Je monte mon dossier* (pour le CA) / *J'organise le séjour* — séparées par la signature, **jamais verrouillées**. Confirmation orale, planning proposé, liste envoyée avant signature = normal. Chemin recommandé, pas verrou. |
| D6 | **L'emphase suit l'activité**, pas la signature seule : dès que l'enseignant inscrit ou touche au planning, l'action mise en avant bascule sur la phase 2 ; la signature reste un rappel discret et persistant. |
| D7 | **La signature est un état affiché en permanence** dans l'en-tête (« Séjour confirmé ✓ » / « En attente de signature »), **pas une porte**. C'est le sens du statut OPTION (réservé, non confirmé), même modèle que le planning hébergeur orange hachuré. |
| D8 | **Vocabulaire affiché = axe d'engagement uniquement** : *en attente de signature* / *signé* / *annulé* (+ « en cours de validation direction » comme sous-état). Les 7 valeurs brutes des enums ne sont **jamais** montrées à l'enseignant. Point unique de renommage : `StatutBadge`. « Option » (header) et « À confirmer » (dashboard) harmonisés. |
| D9 | **Refonte des statuts = chantier séparé, post-septembre** (`ANALYSE_STATUTS` §5). #38 n'en dépend que pour D8. |
| D10 | **Structure organisateur-only.** Hébergeur, signataire et **accompagnateur** gardent leur barre d'onglets telle quelle. Zéro changement de rendu pour eux. |
| D11 | **S8 — accompagnateurs après signature : verrou conservé.** Les accompagnateurs n'interviennent qu'après signature. Côté UI : le bloc Inscriptions affiche « Signez le devis pour ajouter les accompagnateurs » tant que le devis n'est pas signé. Aucun changement de `verifyAccess`. |
| D12 | **Prix par élève provisoire : oui.** Calculé sur le devis **non signé**, **affiché** avec le libellé « en attente de validation du devis », aligné sur le budget prévisionnel. **Affiché ≠ enregistré** : l'enregistrement de `sejour.prix` (qui déclenche le mail « paiement disponible » aux parents) reste conditionné à la signature. |
| D13 | **Appel d'offres : parcours vivant, on le garde.** Il est démoté dans le dashboard pour un compte qui n'a que des séjours rejoints, jamais supprimé. |
| D14 | **S7 = A. Aucun mail ne part à l'ajout d'un élève.** Et le bloc Inscriptions présente **un choix explicite** à l'enseignant, dès l'entrée : *« Je fais remplir par les familles »* (ajout manuel ou CSV, puis un bouton « Envoyer aux familles (N) » au moment choisi) **ou** *« Je saisis moi-même la liste »* (grille de saisie directe — l'enseignant gère les autorisations **papier** de son côté). Ce sont deux modes d'un même bloc, pas deux endroits. En mode saisie manuelle, le compteur « autorisations signées » n'a pas de sens : l'état du bloc = « liste complète ». |

## 4. Décision EN SUSPENS

Aucune. Toutes les décisions produit nécessaires à #38 sont actées (§3).

---

## 5. Structure cible

### 5.1 Arrivée de l'invité
- `rejoindre/[token]` : après `accepterInvitation`, lire `result.sejourId` → `router.push('/dashboard/sejour/${sejourId}')`. Wordings : « Vous rejoignez le séjour… » / « Vous avez rejoint le séjour ». Supprimer « Création du séjour » (code mort de wording).
- Première ouverture de l'espace par un invité : un **encart repliable persistant** en tête (« Comment fonctionne cet espace » : rôle de l'enseignant vs hébergeur, inscriptions = responsabilité enseignant), **pas de tour modal** (vu une fois, skippé, aucune rétention). Les consignes vivent dans les blocs vides.

### 5.2 Dashboard adaptatif (`/dashboard/organisateur`)
Règles d'affichage (à préciser en SC6 après relecture des conditions exactes) :
- **3 CTA du haut** (catalogue / appel d'offres / mes demandes) : affichés si le compte a ≥ 1 séjour créé par lui (DRAFT/SUBMITTED ou `demandes` non-bridge) OU aucun séjour du tout. **Démotés** (repliés sous « Trouver un hébergement ») si tous ses séjours sont des séjours rejoints. Jamais supprimés (D13).
- **Bannière `?onboarding=true`** : distinguer invité (« Bienvenue — vous avez rejoint le séjour X. Définissez votre mot de passe. ») et self-service (texte actuel). Le déclencheur `?onboarding=true` reste ; le texte dépend de la présence d'une invitation acceptée.
- **État vide** : si invitations pendantes → « Vous avez une invitation en attente » (pas « créez votre premier séjour ») ; sinon état vide actuel.
- **Carte séjour** : un seul bouton **« Ouvrir le séjour »** quel que soit le statut (les 3 boutons disparaissent — D3). Badge = vocabulaire D8. Le badge « Devis à signer » reste (il vient de `STATUTS_DEVIS_VISIBLES_ORGANISATEUR`).
- Liste-dashboard seulement si ≥ 2 séjours ? **Non tranché** — proposition : toujours la liste, mais l'invité n'y passe pas à l'arrivée (D2).

### 5.3 Espace enseignant — six blocs, deux phases

Rendu **uniquement** si `user.role === 'ORGANISATEUR' && !estAccompagnateur` (D10). Les `Tab*` existants sont **réutilisés tels quels**, montés dans les blocs. Les `key` de `Tab` ne changent pas (préserve `ONGLETS_TRACKING`, `ACCOMPAGNATEUR_TABS`, `activeTab` fallback).

**Phase 1 — Je monte mon dossier** (pour le CA)

| Bloc | Contenu | Provenance | État « fait » (proposition, à valider en SC0) |
|---|---|---|---|
| **Réservation** | Devis + signature (`SignatureDevisPanel`) ; après signature : convention / documents officiels (contenu de `documents/[id]` — **non lu**) | `TabDevisFacturation` (branche organisateur) + route `documents/[id]` à absorber (SC5) | devis `SELECTIONNE` ou `SIGNE_DIRECTION` ; « en cours » si `EN_ATTENTE_VALIDATION` |
| **Pédagogie** | Projet pédagogique + **thématiques** (le bandeau global « thématiques manquantes » devient une section ; une pastille « à compléter » sur le bloc conserve l'incitation) | `TabProjetPedagogique` + bandeau de `page.tsx` déplacé | `thematiquesPedagogiques.length > 0` ET projet renseigné (critère projet **à lire** dans `TabProjetPedagogique`) |
| **Budget** | Budget prévisionnel + **prix par élève** + date limite d'inscription (extraits de la page autorisations) ; prix provisoire D12 | `TabBudget` + section `PrixParEleve` extraite (SC4) | `sejour.prix > 0` (enregistré) |

**Phase 2 — J'organise le séjour**

| Bloc | Contenu | Provenance | État |
|---|---|---|---|
| **Inscriptions** | **Choix explicite en tête de bloc (D14)** : *Je fais remplir par les familles* (ajout manuel / CSV → liste avec badge « non envoyé » → bouton « Envoyer aux familles (N) » ; ensuite statuts signée / en attente, docs médical / assurance) **ou** *Je saisis moi-même la liste* (grille de saisie directe, autorisations papier gérées hors plateforme). + **accompagnateurs** (verrouillés avant signature, D11). Le champ `sourceInscription` d'`AutorisationParentale` existe déjà — **à lire en SC0** pour savoir s'il porte déjà cette distinction. | `TabParticipantsCollab` + `TabParticipantsSaisieDirecte` + sections extraites de la page autorisations (SC4) | mode familles : à faire = 0 élève ; en cours = non tous envoyés / non tous signés ; fait = tous signés. Mode saisie : fait = liste complète (nb élèves ≥ effectif annoncé), pas de compteur « signées » |
| **Sur place** (replié par défaut, déplié dès ≥ 1 participant) | Planning, Groupes, Chambres/Rooming | `TabPlanning`, `TabGroupes`, `TabRooming` | pas d'état « fait » (optionnel) |

**Transverse**

| Bloc | Contenu | Provenance | État |
|---|---|---|---|
| **Échanges** | Messages, Journal, Documents partagés | `TabMessages`, `TabJournal`, `TabDocuments` | badge non-lus (endpoint `mes-non-lus`) |

**Règle d'emphase (D4 + D6)** — l'action mise en avant à l'ouverture = la première « à faire » dans l'ordre Réservation → Inscriptions → Budget → Pédagogie, **sauf** si ≥ 1 participant existe : alors l'emphase est en phase 2 même si le devis n'est pas signé, et la signature devient un rappel discret dans l'en-tête (D7). Onglet par défaut pour l'organisateur = le bloc en emphase (remplace `useState<Tab>('devis')` pour ce rôle uniquement).

**Deux notions de « documents »** : ceux des familles (médical, assurance — portés par `AutorisationParentale`, dans Inscriptions) et les partagés hébergeur/enseignant (`TabDocuments`, dans Échanges). Libellés distincts obligatoires.

### 5.4 Ce qui ne change PAS
- Rendu hébergeur, signataire, accompagnateur : identique (D10).
- Les composants `Tab*` : inchangés (montés ailleurs pour l'organisateur, c'est tout).
- `verifyAccess`, `ongletsVisibles` pour les autres rôles, `ONGLETS_TRACKING`.
- Backend des devis / signatures (lot 01/09).

---

## 6. Socle technique (à faire quelle que soit la structure)

| # | Sujet | Nature | Fix à la source |
|---|---|---|---|
| **S2** | `update()` refuse non-DRAFT → prix/date limite bloqués | Bug bloquant (à confirmer SC0) | Séparer la garde : `statut !== 'DRAFT'` reste pour les champs d'appel d'offres (niveau, activités, budgetMax, accompagnateurs, horaires, transport, description) ; `prix` et `dateLimiteInscription` autorisés sur CONVENTION/SIGNE_DIRECTION (et OPTION ? → non, D12 : enregistrement conditionné à la signature). **Cascade à border** : `sendPaiementDisponible` part à **chaque** update de prix → idempotence (n'envoyer qu'au premier passage `prix: 0 → > 0`, ou flag). |
| **S9** | Redirection + wordings `rejoindre` | UX | §5.1 |
| **S10** | Page autorisations satellite | Structure | SC4 — **déplacer**, pas copier ; supprimer la route après |
| **S7** | Mail parent immédiat | **D14 = A** | Le formulaire d'ajout appelle `createSansEmail` ; l'envoi passe exclusivement par `envoyerInvitations` (bouton « Envoyer aux familles »). `AutorisationService.create()` (avec envoi) **supprimé** s'il n'a plus d'appelant (census SC0). Le compteur « signées » de `TabParticipantsCollab` devient conditionnel au mode. |
| **D12** | Prix provisoire | Front | calcul sur `devisAffiche` même EN_ATTENTE, libellé, **pas d'appel `updateSejour`** tant que non signé |
| **D8** | Vocabulaire | Front | `StatutBadge` (point unique) — à lire SC0 |

**Code mort à supprimer sur le chemin** (uniquement ce qu'on touche) : wordings « Création du séjour » ; route `autorisations/page.tsx` après SC4 ; route `documents/[id]` après SC5 ; conteneur `sejours/[id]` s'il devient vide ; `AutorisationService.create()` si S7=A et sans appelant ; le bandeau thématiques de `page.tsx` après SC3. **Hors chemin, ne pas toucher** : `soumettreAuRectorat` (S4, inatteignable) et le reste de `ANALYSE_STATUTS` §5.3 → chantier refonte.

---

## 7. Sous-chantiers — ordre d'exécution

Principe : **socle d'abord** (bugs, zéro régression possible), **structure ensuite** (les anciens onglets restent accessibles dans les blocs = aucune perte à aucun moment), **dashboard en dernier** (dépend de la structure). Chaque SC = Phase 1 census read-only → STOP → Phase 2 après « ok » → gates → commits atomiques → **push par Théo**.

| SC | Périmètre | Fichiers (indicatif) | Blast radius | Cascade anticipée | Gate |
|---|---|---|---|---|---|
| **SC0 — Census** | Lire tout §2 « non lu ». **Confirmer S2 en local** (poser un prix sur un séjour CONVENTION). Recenser : tous les appelants de `/autorisations` (liens, emails, notifications, dashboard, signataire) ; tous les appelants de `AutorisationService.create()` ; critère « projet renseigné » ; ce que `documents/[id]` contient ; conditions exactes des CTA dashboard ; si `accepterInvitation` (lib) retourne bien le body. | lecture seule | — | — | rapport écrit, **STOP** |
| **SC1 — Socle back** | S2 (garde séparée + idempotence mail) ; S7 = A (`createSansEmail` exposé au formulaire, `create()` supprimé si sans appelant) | `sejour.service.ts` `update`, `autorisation.service.ts`, `autorisation.controller.ts` | back seul, **additif / rétro-compatible** (l'ancien front continue de marcher) | mail paiement en double ; un test unitaire sur la garde `update` (zone sans test aujourd'hui) ; **vérifier que l'ancien front ne dépend plus de `create()` avant de le supprimer** — sinon supprimer en SC4 | tsc + build + test verts ; recette locale : prix posé sur CONVENTION, un seul mail ; ajout d'élève sans mail |
| **SC2 — Arrivée invité** | S9 : redirection `sejourId`, wordings ; encart repliable v0 | `rejoindre/[token]/page.tsx`, `lib/invitation-collaboration.ts` | page dédiée, **zéro** rôle tiers | `accepterInvitation` doit retourner `{ sejourId }` (vérifier SC0) | build ; recette B du cadrage 01/09 rejouée |
| **SC3 — Nav enseignant** | Composant `OrganisateurNav` (6 blocs, 2 phases, états, emphase, badge D7/D8) rendu seulement pour organisateur créateur ; bandeau thématiques → section Pédagogie ; `activeTab` par défaut = emphase pour ce rôle. **Aucun Tab modifié.** | `dashboard/sejour/[id]/page.tsx`, `_components/OrganisateurNav.tsx` (nouveau), `SejourHeader.tsx` (badge), `StatutBadge.tsx` | **page.tsx partagé 3 rôles** → census obligatoire du rendu hébergeur/signataire/accompagnateur **avant** ; le rendu conditionnel doit être une branche, pas une réécriture | `estAccompagnateur` doit garder `ACCOMPAGNATEUR_TABS` ; `ONGLETS_TRACKING` intact ; `activeTab` fallback ; bandeau devis à signer conservé (D7 le remplace par le badge → supprimer le bandeau seulement quand le badge est live) | tsc + build ; recette **3 rôles + accompagnateur** sur le même séjour |
| **SC4 — Rapatriement inscriptions** | Extraire `autorisations/page.tsx` en composants : `InscriptionsEleves` (ajout/CSV/envoi/liens), `Accompagnateurs` (verrou D11 + message), `PrixParEleve` (D12 provisoire + enregistrement) ; monter dans Inscriptions et Budget ; source séjour = `getSejourCollabInfo` (plus `getMesSejours().find`). Puis **supprimer** la route et le bouton dashboard. | `autorisations/page.tsx` → `_components/*`, `page.tsx`, `organisateur/page.tsx` (bouton), `lib/autorisation.ts` | organisateur seul ; **tous les liens entrants** vers `/autorisations` recensés en SC0 doivent être redirigés vers `/dashboard/sejour/[id]` (sinon 404 depuis un vieil email) | `getMesSejours` vs `getSejourCollabInfo` : champs différents (`prix`, `dateLimiteInscription`, `demandes[].devis`) → vérifier que `SejourCollabInfo` les expose ou l'enrichir (**back**, additif) ; `envoyerInvitations` et `importAutorisationsCsv` inchangés | build ; recette : ajouter / importer / envoyer / accompagnateur / prix, sur invité **et** sur AO |
| **SC5 — Documents officiels** | Absorber `documents/[id]` dans Réservation ; supprimer la route | à définir après SC0 | organisateur ; **`soumettreAuRectorat` (S4) est probablement appelé depuis cette page** → décider réparer/retirer le bouton (ne pas réparer l'endpoint ici = chantier refonte) | — | build ; recette |
| **SC6 — Dashboard adaptatif** | §5.2 : CTA démotés, bannière invité/self-service, état vide, carte à un bouton | `organisateur/page.tsx`, `layout.tsx`, `InvitationsPendantesBanner.tsx` | organisateur seul | conditions par statut de la carte (leçon C4e) ; badge D8 | build ; recette invité + self-service + compte mixte |
| **SC7 — Vocabulaire** | `StatutBadge` → D8 ; harmoniser Option / À confirmer ; libellés dashboard `STATUT_CONFIG` | `StatutBadge.tsx`, `organisateur/page.tsx`, `SejourHeader.tsx` | **`StatutBadge` peut être utilisé côté hébergeur/signataire** → census des usages avant | — | build ; grep usages |

**Ordre de déploiement** (un push `main` redéploie back + front en parallèle, cadrage 01/09 §9) : SC1 → SC2 → SC3 → SC4 → SC5 → SC6 → SC7, **un push par SC** en heure creuse. SC1 est rétro-compatible avec l'ancien front ; SC3 ne retire rien (les anciens onglets sont dans les blocs) ; SC4 supprime la route **dans son dernier commit seulement**, après que les composants sont montés et recettés.

---

## 8. Vigilances gravées (cascades identifiées)

1. **`page.tsx` est partagé 3 rôles + accompagnateur.** Toute modification = census du rendu des autres rôles d'abord. La nav enseignant est une **branche** conditionnelle, jamais une réécriture des onglets.
2. **Accompagnateur = rôle ORGANISATEUR non-créateur.** Il ne doit **pas** voir la nav blocs (il verrait Réservation/Budget qu'il n'a pas le droit de voir). Condition : `role === 'ORGANISATEUR' && !estAccompagnateur`.
3. **Prix provisoire affiché ≠ enregistré.** Enregistrer `prix` déclenche le mail parents. Tant que le devis n'est pas signé : calcul à l'écran, aucun `updateSejour`.
4. **Mail paiement à chaque update de prix** (S2) : idempotence obligatoire avant de débloquer la garde.
5. **Liens entrants vers `/autorisations`** (emails historiques, notifications, `dashboard/signataire` ?) : recenser en SC0, rediriger avant de supprimer la route.
6. **`SejourCollabInfo` ≠ `Sejour` (lib/sejour)** : la page autorisations lit `prix`, `dateLimiteInscription`, `demandes[].devis[]` via `getMesSejours` ; l'espace lit `getSejourCollabInfo`. Vérifier les champs exposés ; enrichir côté back (additif) plutôt que garder deux fetchs.
7. **Bandeau « devis à signer »** : ne le retirer qu'une fois le badge D7 en place (aucune fenêtre sans rappel de signature — même règle que le lot 01/09).
8. **`StatutBadge`** : point unique de renommage, mais potentiellement partagé avec hébergeur/signataire → census avant SC7.
9. **Zéro test sur ces zones** (`accepter()`, signatures, `update`, autorisations) : recette manuelle par SC, sur **les deux parcours** (invité **et** appel d'offres) — l'AO reste vivant (D13), il ne doit pas régresser.
10. **Un push = deux apps.** Chaque SC back doit tolérer l'ancien front pendant le build ; chaque SC front doit tolérer l'ancien back (SC1 est déployé avant).
11. **`getMesSejours` filtre `STATUTS_DEVIS_VISIBLES_ORGANISATEUR`** (lot 01/09) : OK pour EN_ATTENTE. Ne pas réintroduire un filtre SELECTIONNE.
12. **DECLARE_TAM fait perdre l'accès** (S5) : hors #38, mais ne pas y ajouter d'appelant.

---

## 9. Méthode d'exécution (rappel, non négociable)

Lecture MCP du code réel avant toute affirmation (jamais de récap CC). Par SC : **Phase 1 census read-only + STOP** → validation Théo → **Phase 2** écriture. Contenu exact soumis avant toute écriture. CC ne pousse **jamais** ; Théo pousse après relecture des diffs. Commits atomiques, `git add` ciblé, jamais `-A`, jamais `--amend`. Gates `tsc --noEmit` + `npm run build` (+ `npm test` back) verts avant chaque commit. Fix à la source, pas de patch, pas de duplication : **déplacer** un composant, jamais le copier. Code mort rencontré sur le chemin : supprimé dans le même SC, jamais laissé « pour plus tard ». Source de vérité de l'état git = `git show --stat`.

---

## 10. Hors scope #38
Refonte des enums de statuts (`ANALYSE_STATUTS` §5.3) ; S1 (catalogue → CONVENTION), S3, S4, S5, S6 ; T4 ; miroir hébergeur (« où en est mon enseignant ») ; persona signataire (`/dashboard/signataire` — lu en SC0 seulement pour les liens entrants) ; multi-organisation ; vidéo/doc marketing ; module PMS.

---

## 11. Prochaine action
1. Théo valide ce cadrage (ou le corrige). **Plus aucune décision produit en suspens.**
2. **SC0 — census** : prompt CC Phase 1 read-only, rapport, STOP.
3. Puis SC1.

**Aucun code modifié dans le cadre de ce document.**
