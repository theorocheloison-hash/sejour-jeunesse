# LIAVO — Cadrage #38 : Big picture dashboard + espace organisateur

> **Rédigé le 02/09/2026** — Doc de reprise pour la session #38. **Statut : RÉFLEXION OUVERTE, PAS D'EXÉCUTION.** On cartographie, on challenge l'existant, on pose des options. Aucun code, aucun prompt CC tant qu'une direction n'est pas actée.
> **Ce doc capture l'état de la réflexion au 02/09** (findings lus sur code réel + décisions produit de Théo + questions ouvertes + plan de lecture). La session #38 a été ouverte puis mise en pause pour livrer le lot « pense-bête détails séjour » (cf. SESSION_STATE 02/09 (2)) ; on reprend ici.
> **Réf.** : `docs/CADRAGE_INVITATION_SIGNATURE_2026-09-01.md` (lot précédent, §8 backlog), `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` (archi UX côté HÉBERGEUR de mai — le pendant ORGANISATEUR n'a jamais été écrit, c'est le trou que #38 comble).

---

## 0. Le sujet, en une phrase

Le lot du 01/09 a prouvé que le dashboard organisateur (`/dashboard/organisateur`) et l'espace séjour (`/dashboard/sejour/[id]`, partagé 3 rôles) ont été conçus pour **UN SEUL parcours** — l'enseignant CRÉATEUR qui lance un appel d'offres — alors que celui de septembre (démos LMDJ, Choucas/Pôle Montagne qui invitent leurs enseignants) est **L'AUTRE** : l'enseignant INVITÉ par son hébergeur, qui n'a rien à créer.

**Le vrai objet de #38 n'est pas « le dashboard » seul** : les symptômes vivent sur DEUX surfaces — le dashboard organisateur (liste + cartes + 3 CTA + bannière invitations + état vide) ET l'espace séjour partagé. Toute refonte de l'espace a un **blast radius hébergeur + signataire** (composants partagés). Le sujet réel = « l'expérience organisateur = dashboard + la tranche organisateur d'un espace partagé ».

---

## 1. Cartographie FACTUELLE (lue sur code réel le 02/09)

### 1.1 Dashboard organisateur — `app/dashboard/organisateur/page.tsx` (~26 KB)
- **Aucun onglet.** Titre « Mes séjours » + **3 CTA FIXES toujours affichés** : « Parcourir le catalogue » (→ `/hebergements`), « Lancer un appel d'offres » (→ `/nouveau-sejour`), « Mes demandes de devis » (→ `/demandes`). Ces 3 CTA n'ont **aucun sens pour un invité**.
- **`?onboarding=true`** → bandeau bleu « Bienvenue sur LIAVO — **votre demande a bien été envoyée** ! Définissez votre mot de passe » (→ `profil?section=securite`). **Orienté SELF-SERVICE, pas invité** (un invité n'a envoyé aucune demande).
- Liste de `SejourCard` (source `getMesSejours`) **OU** état vide « Aucun séjour créé — Commencez par créer votre premier séjour pédagogique — [Lancer un appel d'offres] » si `sejours.length === 0`. **Servi à l'invité qui n'a pas encore accepté** (incohérent avec la bannière d'invitation juste au-dessus).
- **`SejourCard` par statut** : `DRAFT` (Modifier + « Lancer l'appel d'offres » / « Voir les offres ») ; `SUBMITTED` (« Voir les offres/ma demande ») ; **`OPTION`** (badge « Devis à signer » / « En attente validation direction » + **« Espace collaboratif »** → `/dashboard/sejour/[id]`) ; `CONVENTION`/`SIGNE_DIRECTION` (badge signé/en attente + **« Gérer les autorisations »** → `sejours/[id]/autorisations` + **« Espace collaboratif »** + **« Documents officiels »** → `organisateur/documents/[id]` + « Récapitulatif TAM » si hors-scolaire).
- `STATUT_CONFIG` (libellés dashboard) : DRAFT=« Brouillon », **OPTION=« À confirmer »**, SUBMITTED=« Soumis », CONVENTION=« Convention », SIGNE_DIRECTION=« Signé direction », SOUMIS_RECTORAT, DECLARE_TAM.

### 1.2 Layout + bannière invitations
- `organisateur/layout.tsx` = `<InvitationsPendantesBanner /> + children`. **Pas de sidebar/nav** à ce niveau.
- `InvitationsPendantesBanner.tsx` : fetch `/invitation-collaboration/pendantes`, bandeau ambre « {centre} vous invite sur «{titre}» » + CTA « Voir l'invitation » → `/rejoindre/{token}`. Dismiss en `sessionStorage` (si l'invité dismisse, il ne reste que l'état vide inadapté).

### 1.3 Routes satellites `/dashboard/organisateur/`
`demandes`, `documents/[id]`, `hebergements`, `nouveau-sejour`, `profil`, `sejours/[id]/{autorisations, modifier, offres}` (`sejours/[id]` n'a pas de `page.tsx` propre = conteneur de sous-routes).

### 1.4 Espace séjour partagé — `app/dashboard/sejour/[id]/page.tsx` (~27 KB)
- **Orchestrateur, extraction faite** (l'ancienne note « 4200 lignes » est PÉRIMÉE). 13 composants `Tab*` dans `_components/` : Budget, Chambres, DevisFacturation, Documents, Groupes, Journal, Messages, Notes, ParticipantsCollab, ParticipantsSaisieDirecte, Planning, ProjetPedagogique, Rooming. + `SejourHeader`, `InviteOrganisateurCard`, `ReadOnly`, `RoomingEditor`, `RoomingPlanView`.
- **Partagé 3 rôles** (HEBERGEUR / ORGANISATEUR / SIGNATAIRE) + accompagnateur (`ACCOMPAGNATEUR_TABS`).
- **`ongletsVisibles` pour ORGANISATEUR** (séjour scolaire, COLLABORATIF, non-événement) = **10 ONGLETS** : Devis, Messages, Planning, Groupes, Participants, Chambres, Documents, Journal, Budget prévisionnel, Projet pédagogique. (Notes exclu = hébergeur seul.) **C'EST LA SURCHARGE, et elle est DÉJÀ dans la page séjour.**
- **Onglet par défaut = `useState<Tab>('devis')` pour tous** (figé, pas de défaut par stade).
- **3 bandeaux empilables** au-dessus des onglets pour l'organisateur : `AlertesCapacite` + « Thématiques manquantes » + « Devis à signer / en attente validation ».
- **Seul guidage « prochaine action »** = bouton « Voir le devis » du bandeau devis (`setTab('devis')`). Après signature, plus rien ne dit « maintenant, inscris tes participants ».
- `retourHref` ORGANISATEUR = `/dashboard/organisateur`.
- `SejourHeader` : sticky, bouton « ✏️ Modifier » (édition inline infos via `updateInfosSejour`), libellé statut header = **« Option »** (vs dashboard « À confirmer » — deux libellés pour le même statut).

---

## 2. Interprétation (Claude) — le recadrage clé

- **Le vrai objet** = dashboard + tranche organisateur de l'espace partagé (pas juste le dashboard). Toucher l'espace = blast radius hébergeur + signataire → **censer d'abord ce que les 2 autres rôles voient sur les mêmes composants** (leçon gravée).
- **Double éparpillement réel** : (1) la carte séjour d'un `CONVENTION` pointe vers 3-4 surfaces (autorisations / espace collab / documents officiels) ; (2) l'espace montre 10 onglets à l'organisateur.
- **LE PARADOXE** : la demande initiale de Théo (« rassembler projet péda / inscriptions / documents DANS la page séjour ») **aggrave** le problème si on ne restructure pas — l'espace a déjà 10 onglets, y verser plus = 12. Le vrai objectif n'est pas « tout au même endroit » (concentration) mais **« réduire la charge cognitive »** (hiérarchisation). Instinct de Théo bon (supprimer l'étage dashboard-satellites), formulation à corriger.

---

## 3. Décisions produit de Théo (posées dans la session, à confirmer/compléter)

- **DEUX lectures à traiter** :
  - **(a) INVITÉ** qui ne connaît pas LIAVO : mail d'invitation → flux simple pour rejoindre + **créer son compte** → **atterrir DIRECT sur le séjour rejoint** (pas sur un dashboard vide) → **module d'explication** des onglets + prise en main de la co-organisation, en insistant sur **inscriptions participants = responsabilité organisateur, pas hébergeur**.
  - **(b) SELF-SERVICE** : a découvert LIAVO seul, a fait un appel d'offres via catalogue → compte auto-créé → **dashboard potentiellement différent**.
- **Enjeu n°1 = réduire la charge cognitive de l'enseignant** (recadré vs « rassembler ») : hiérarchiser / regrouper / révéler progressivement.

---

## 4. Questions ouvertes (à trancher AVANT de remplir la matrice complète)

1. **Dashboard unique piloté par le stade, ou fork invité/self-service ?** (fork = 2 surfaces à maintenir, 2× régressions). L'invité a-t-il seulement besoin d'un dashboard ? Piste : post-acceptation, rediriger vers le séjour unique ; dashboard-liste seulement si 2+ séjours.
2. **Appel d'offres : vivant ou mort en prod ?** À trancher **par la donnée** (SELECT prod : combien de dossiers réels nés via appel d'offres / catalogue / invitation). Si mort → candidat à masquer, pas à cadrer. **C'est le pivot** : si invité domine, on démote catalogue + appel d'offres.
3. **Réduire les 10 onglets organisateur à ~4-5** : quel regroupement ?
4. **Redirection post-acceptation** vers le séjour (aujourd'hui `accepter()` → dashboard) + **onboarding invité distinct** du bandeau self-service actuel (« votre demande a été envoyée » inadapté).
5. **Vocabulaire** (Option / À confirmer / Convention / Soumis / Signé direction) adapté à un enseignant ? Distinguer **cosmétique** (renommable au `StatutBadge`) vs **load-bearing** (« Convention » = terme contractuel, cf. lot 01/09).
6. **Le signataire (directeur)** : persona qui se connecte à `/dashboard/signataire`, ou simple destinataire d'un lien ? (détermine la profondeur de lecture de cette surface).
7. **Miroir hébergeur** : comment l'hébergeur voit-il où en est son enseignant ? (surface différente, à cadrer ou exclure).

---

## 5. Options de structure (à débattre, pas actées)

### 5.1 Dashboard
- **(1) Unique adaptatif** : mêmes composants, sections conditionnelles selon présence d'invitations en attente / de séjours / d'appels d'offres ouverts. Plus maintenable qu'un fork.
- **(2) Fork invité/self-service** : 2 surfaces. Non absurde (l'invité arrive sur UN séjour, le self-service gère un portefeuille) mais coûteux.
- Piste transverse : l'invité n'a peut-être pas besoin de dashboard au début (redirection séjour unique).

### 5.2 Onglets de l'espace (réduire 10 → ~5)
- **(A) Regroupement sémantique** : fusionner en ~5 super-onglets (sous-sections). Réutilise les Tab existants.
- **(B) Progressive disclosure par stade + rôle** : 4 onglets primaires + « Plus » ; onglets qui apparaissent selon le stade (Budget/Rooming après CONVENTION). Colle au concept « prochaine action par stade ».
- **(C) Onglet « Vue du séjour » guidé** : premier onglet = tableau de bord du séjour (où on en est, prochaine action, checklist), onboarding fondu dedans.
- **Reco Claude** : **B pour la structure + une dose de C** (onglet d'accueil léger portant la « prochaine action par stade » + onboarding contextuel). À condition de censer d'abord ce que hébergeur/signataire voient.
- **Regroupement proposé (à débattre)** : **Réservation** (devis + signature) / **Inscriptions** (Participants + autorisations parentales + documents familles — responsabilité organisateur ; candidat à absorber la route satellite `autorisations`) / **Pédagogie** (Projet péda + thématiques — le bandeau « thématiques manquantes » devient une section, plus un bandeau global) / **Organisation** (replié : Planning, Groupes, Chambres/Rooming, Budget) / **Échanges** (Messages + Journal + Documents partagés). « Documents officiels » (convention/factures) = section de Réservation ou accès header, pas un onglet.

### 5.3 Module d'explication (onboarding invité)
- Tour modal one-shot = vu une fois, skippé, faible rétention.
- UI auto-explicative (empty states contextuels par onglet + prochaine action explicite) = persistant, plus robuste.
- **Reco** : hybride (mini-encart repliable persistant + empty states), PAS un modal one-shot.

---

## 6. Plan de lecture pour remplir la matrice parcours × stade × écran

Ordre imposé : **backend d'abord** (on ne mappe pas « la prochaine action attendue » sans connaître les transitions réelles).

| Couche | Fichiers | État | Ce que ça remplit |
|---|---|---|---|
| **0 — Machine à états** | `sejours/sejour-statuts.constants.ts`, `devis/devis-statuts.constants.ts`, `sejours/sejour.service.ts` (`getMesSejours`, `creerDepuisCatalogue`, `create`, `getDossierPedagogique`), `invitation-collaboration/invitation-collaboration.service.ts` (`accepter`, `getPendantesPourUser`), `demande/demande.service.ts` (`findOpen`, `getComparatif`), `devis/devis.service.ts` (`updateStatut`, `signerDevis`, `envoyerADirection`) | à lire | Transitions réelles par parcours ; répond à « catalogue → CONVENTION direct ? », « POST /public/demande existe-t-il ? » |
| **1 — Dashboard** | `dashboard/organisateur/page.tsx`, `layout.tsx`, `_components/InvitationsPendantesBanner.tsx` | **✅ LU (02/09)** | Colonne « dashboard » + census endpoints + conditions par statut |
| **2 — Espace partagé** | `dashboard/sejour/[id]/page.tsx` (✅ LU), `_components/SejourHeader.tsx` (✅ LU), `_components/TabDevisFacturation.tsx` (branche `!isDirect` — ⚠️ 140 KB), `_components/TabBudget.tsx`, `SignatureDevisPanel` | partiel | Colonne « espace » + blast radius hébergeur/signataire |
| **3 — Arrivée + satellites** | `rejoindre/[token]/page.tsx`, `register/organisateur/page.tsx`, `devis/signer/[token]/page.tsx`, `organisateur/{demandes,hebergements,sejours/[id]/offres,sejours/[id]/autorisations,documents/[id]}`, `dashboard/signataire/page.tsx` | à lire | Colonne « première arrivée » + écrans satellites (dont cul-de-sac « Devis signé ! » sans CTA compte) |
| **4 — Hors écran** | `notifications/notifications.service.ts` (les 3 crons) | à lire | Ce que l'enseignant REÇOIT (invitation, relances J+30, notif « infos mises à jour ») |
| **5 — Transversal** | `src/lib/sejour.ts` (types `Sejour`/`StatutSejour`), `src/components/StatutBadge.tsx` | à lire | Types + point unique de renommage vocabulaire |

**Contrainte outillage notée** : `TabDevisFacturation.tsx` = 140 KB, `collaboration.service.ts` = 69 KB, `devis.service.ts` = 108 KB. Le serveur `fs` de la session web n'a pas toujours de grep/head fiable → prévoir full-read ciblé ou lecture depuis Claude Code local.

---

## 7. Backlog lié (à INTÉGRER dans #38, pas à traiter isolément)

- **T3 / #36** : devis DIRECT signé invisible côté signataire à compte.
- **T4** : `updateStatut` = sélection COLLAB appel d'offres sans signature ; statut final `CONVENTION` vs `SIGNE_DIRECTION`.
- **T6** : résidu `{error && …}` mort en bas de la page publique de signature.
- **T7** : `findByToken` ne vérifie pas l'éligibilité du séjour (erreur seulement au clic).
- Wording PDF `DevisPDF` « Signé électroniquement par la direction » faux pour une signature enseignant.
- « Option » (header) vs « À confirmer » (dashboard) — harmoniser.
- CTA « créer mon compte » après signature publique.
- Zéro test sur `accepter()` branche `sejourId` ni sur les signatures.
- `linkSejourToCRM` post-rattachement logge « créé via invitation » sur un séjour préexistant.
- F1 dualité effectif séjour/demande ; #85 routage emails.

---

## 8. Méthode de la session (rappel)

Sparring partner, jamais complaisant. Lecture MCP du code réel AVANT toute affirmation (jamais sur récap CC). Français dense, distinguer factuel / interprétation / incertain. Toujours 2-3 options avec trade-offs. **On ne code rien tant qu'une direction n'est pas actée** ; quand on passera à l'exécution : census Phase 1 read-only → STOP → Phase 2 après « ok » ; CC ne pousse jamais ; un push `main` redéploie les 2 apps Scalingo en parallèle.

**Prochaine action d'ouverture** : trancher les questions §4 (surtout n°1 dashboard unique vs fork, et n°2 appel d'offres vivant/mort par la donnée), puis lire la couche 0 (machine à états) pour remplir la matrice sur les parcours retenus.
