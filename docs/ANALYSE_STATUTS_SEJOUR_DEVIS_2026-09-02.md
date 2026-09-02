# LIAVO — Analyse des statuts séjour & devis (appel d'offres × direct)

> **Rédigé le 02/09/2026** — Session #38 (big picture dashboard + espace organisateur). Analyse issue d'une lecture MCP du code réel (fichiers listés §0). **Statut : ANALYSE CONSIGNÉE, refonte actée sur le principe par Théo, AUCUN code modifié.** La refonte des enums est un chantier séparé, hors #38 ; #38 n'en dépend que pour le vocabulaire affiché (§5).
> **Réf.** : `docs/CADRAGE_DASHBOARD_ORGANISATEUR_2026-09-02.md` (chantier parent), `docs/CADRAGE_INVITATION_SIGNATURE_2026-09-01.md` (T4), `backend/src/devis/devis-statuts.constants.ts`, `backend/src/sejours/sejour-statuts.constants.ts`, `docs/refacto-statuts-sejour-4.25.md`.

---

## 0. Fichiers lus (source de vérité de ce doc)

`prisma/schema.prisma` (enums + modèle Sejour), `devis-statuts.constants.ts`, `sejour-statuts.constants.ts`, `refacto-statuts-sejour-4.25.md`, `collaboration.service.ts` (`verifyAccess`), `autorisation.service.ts` (`create`, `createSansEmail`, `envoyerInvitations`), `devis.controller.ts` (carte complète des gestes), `devis.service.ts` (`uploadSignaturePublic`, wrappers C3 `*Connecte`, `annulerDevis`), `sejour.controller.ts`, `sejour.service.ts` (`create`, `creerDepuisCatalogue`, `getMesSejours`, `soumettreAuRectorat`, `declarerTam`, `update`, `updateStatus`, `createDirect`), `invitation-collaboration.service.ts` (`accepter`), `frontend/src/lib/sejour.ts` (types + `updateSejour`), `frontend/app/rejoindre/[token]/page.tsx`, `organisateur/sejours/[id]/autorisations/page.tsx`, `dashboard/sejour/[id]/page.tsx`, `_components/TabParticipantsCollab.tsx`, `TabParticipantsSaisieDirecte.tsx`, `TabBudget.tsx`.

---

## 1. Le problème en une phrase

Le vocabulaire des statuts a été calibré sur **l'appel d'offres** (l'enseignant reçoit plusieurs devis et en *sélectionne* un, puis on établit une *convention*) et a ensuite été **réutilisé tel quel** pour le séjour direct / l'invitation, où il n'y a qu'un devis et rien à sélectionner. Résultat : les mêmes mots (SELECTIONNE, CONVENTION) veulent dire deux choses selon le parcours, et deux axes différents (engagement contractuel ↔ sous-processus) sont mélangés dans les mêmes enums.

---

## 2. Les statuts tels qu'ils existent (factuel, lu sur le code)

### 2.1 Séjour (`StatutSejour`)

| Statut | Sens réel | Déclencheur | Appel d'offres | Direct / invitation | Verdict |
|---|---|---|---|---|---|
| DRAFT | brouillon d'appel d'offres | défaut à `create()` | ✅ | n'existe pas | Utile AO seulement. **Doublon** avec `appelOffreStatut = BROUILLON`. |
| SUBMITTED | appel d'offres publié | `updateStatus(SUBMITTED)` par l'organisateur (pose aussi `appelOffreStatut = OUVERT`) | ✅ | n'existe pas | Utile AO seulement. **Doublon** avec `appelOffreStatut = OUVERT`. |
| OPTION | pré-réservation, rien de signé | `createDirect()` ; rétrogradation par `annulerDevis` | ❌ (un AO publié avec devis reçus n'est pas OPTION alors que c'est la même réalité) | ✅ | **Le vrai pivot « pas engagé »**. Devrait être commun aux deux parcours. |
| CONVENTION | devis principal SELECTIONNE | automatique (signature client, ou choix AO) ; **`creerDepuisCatalogue` le pose à la création, sans devis** | « j'ai choisi » (sans signature) | « c'est signé » | Utile comme état « engagé », **mal nommé** (la convention est un document postérieur), **double sens**. Très porteur : `verifyAccess`, planning bleu, pilotage, rectorat, TAM. |
| SIGNE_DIRECTION | devis signé via compte signataire ou marqué par l'hébergeur | automatique | idem | idem | **Redondant.** Partout où le code teste « confirmé », il est dans le même set que CONVENTION. C'est un *canal* de signature, pas un état d'engagement. |
| SOUMIS_RECTORAT | dossier envoyé au rectorat | `soumettreAuRectorat` | scolaire | scolaire | **Mal placé** (jalon administratif orthogonal) et **inatteignable** : `@Roles(SIGNATAIRE)` au controller + `createurId === userId` au service, or seul un ORGANISATEUR peut être créateur. De fait code mort. |
| DECLARE_TAM | séjour hors-scolaire déclaré | `declarerTam` (créateur, HORS_SCOLAIRE, statut === CONVENTION strict) | hors-scolaire | hors-scolaire | **Mal placé** et **bug d'accès** : DECLARE_TAM n'est ni dans `STATUTS_SEJOUR_DIRECT` ni dans `STATUTS_SEJOUR_COLLABORATIFS` → après déclaration, `verifyAccess` refuse **tout le monde, créateur compris** (« Le séjour n'est pas dans un statut accessible »). |

`AppelOffreStatut` = `BROUILLON | OUVERT | FERME` (champ séparé sur Sejour). FERME n'a pas d'équivalent séjour. Ce champ est déjà la bonne modélisation du sous-processus AO ; DRAFT/SUBMITTED sur le séjour en sont le doublon.

### 2.2 Devis (`StatutDevis`)

| Statut | Sens réel | Appel d'offres | Direct / invitation | Verdict |
|---|---|---|---|---|
| EN_ATTENTE | émis, pas accepté | reçu, pas choisi | envoyé, pas signé | **Utile les deux.** |
| EN_ATTENTE_VALIDATION | délégué au directeur (`envoyerADirection`) | idem | idem | Utile comme information ; fonctionnellement = pas signé (sous-état de EN_ATTENTE). |
| SELECTIONNE | retenu | choisi parmi plusieurs **sans signature** (`updateStatut`, T4) | **signé** (lien public, espace connecté, upload scan — quel que soit le signataire) | **Utile en AO** (l'étape « choisi mais pas signé » existe vraiment). **Redondant en direct** avec « signé ». Double sens. |
| SIGNE_DIRECTION | signé via compte signataire (`signerDevis`) ou marqué par l'hébergeur (`marquerSigne`) | idem | idem | **Redondant** avec SELECTIONNE-direct ; toujours dans les mêmes sets (`RETENUS`, `ENGAGEANTS`). |
| FACTURE_ACOMPTE / FACTURE_SOLDE | facturation | — | — | **Legacy.** La facturation a migré vers le modèle `Facture` (Lot 1) ; le code marque ces statuts legacy « pour ne pas régresser ». À dériver des factures. |
| NON_RETENU | refusé (AO) / annulé (direct) | ✅ | ✅ | **Utile les deux.** |

### 2.3 Ce que posent réellement les gestes de signature

| Geste | Rôle | Devis → | Séjour → |
|---|---|---|---|
| `PATCH /devis/:id/statut` (`updateStatut`) | ORGANISATEUR, SIGNATAIRE | SELECTIONNE (sans signature — T4) | CONVENTION |
| Lien public `/devis/signer/[token]` (signer / upload) | anonyme | SELECTIONNE | CONVENTION |
| `POST /devis/:id/signature/signer|upload` (C3, connecté) | ORGANISATEUR | SELECTIONNE | CONVENTION |
| `POST /devis/:id/signature/envoyer-direction` | ORGANISATEUR | EN_ATTENTE_VALIDATION | inchangé |
| `PATCH /devis/:id/signer` (`signerDevis`) | SIGNATAIRE | SIGNE_DIRECTION | SIGNE_DIRECTION |
| `POST /devis/:id/marquer-signe` | HEBERGEUR | SIGNE_DIRECTION | SIGNE_DIRECTION |

Toutes les voies « client » écrivent dans des champs nommés `signatureDirecteur` / `nomSignataireDirecteur` / `dateSignatureDirecteur`, **même quand c'est l'enseignant qui signe**. Le geste connecté « signer moi-même » accepte une `fonctionSignataire` — **non vérifié** si elle influence le statut posé.

---

## 3. Découvertes annexes (bugs ou incohérences, toutes lues sur le code)

| # | Constat | Gravité | Fichier |
|---|---|---|---|
| S1 | **`creerDepuisCatalogue` crée le séjour en `CONVENTION` sans devis ni signature.** Une simple demande ciblée = séjour « confirmé » (planning hébergeur bleu, espace ouvert aux accompagnateurs/signataire). Inverse exact de l'invitation, qui reste OPTION. | Haute — incohérence produit entre les deux parcours « demande directe » | `sejour.service.ts` `creerDepuisCatalogue` |
| S2 | **`update()` (PATCH `/sejours/:id`) refuse tout séjour non-DRAFT** (« Ce séjour ne peut plus être modifié »). Or c'est l'endpoint appelé par `updateSejour()` depuis la page autorisations pour poser **prix par élève + date limite d'inscription**, page qui n'existe que sur un séjour CONVENTION/SIGNE_DIRECTION. → prix jamais enregistré, mail « paiement disponible » aux parents jamais envoyé. | **Bloquant flux enseignant** (quasi-certain, non exécuté — à confirmer par un test local) | `sejour.service.ts` `update` ; `lib/sejour.ts` `updateSejour` ; `autorisations/page.tsx` |
| S3 | `updateStatus` : l'organisateur ne peut poser que SUBMITTED, mais **SIGNATAIRE et AUTORITE peuvent poser n'importe quel statut** sans restriction de valeur. | Moyenne (trou de cohérence ; le commentaire indique que la voie normale est `signerDevis`) | `sejour.service.ts` `updateStatus` |
| S4 | `soumettreAuRectorat` inatteignable (cf. §2.1). | Basse (code mort de fait) | `sejour.controller.ts` + `sejour.service.ts` |
| S5 | `declarerTam` fait perdre l'accès à l'espace (cf. §2.1). Ne touche que les hors-scolaire. | Moyenne | `sejour-statuts.constants.ts` + `verifyAccess` |
| S6 | `soumettreAuRectorat` et `declarerTam` exigent `statut === 'CONVENTION'` **strict** : un séjour SIGNE_DIRECTION ne peut faire ni l'un ni l'autre. | Moyenne | `sejour.service.ts` |
| S7 | `AutorisationService.create()` **envoie le mail au parent immédiatement** à l'ajout manuel d'un élève ; `createSansEmail` + `envoyerInvitations` (import CSV) ajoutent en silence puis envoient sur demande. Deux comportements pour le même geste ; piège pour un novice qui « essaie ». | UX | `autorisation.service.ts` |
| S8 | `verifyAccess` : créateur et hébergeur accèdent dès OPTION ; **accompagnateurs et signataire sont bloqués tant que le séjour n'est pas CONVENTION/SIGNE_DIRECTION**. Contradiction avec le scénario « confirmation orale, on avance déjà » (accès collaboratif donné à un collègue avant le CA). | Moyenne — décision produit à prendre | `collaboration.service.ts` |
| S9 | `rejoindre/[token]` : après `accepter()`, redirection vers `/dashboard/organisateur` alors que le backend renvoie `sejourId` (le front ne le lit pas) ; wordings « Création du séjour en cours… » / « Séjour créé avec succès » **faux** (résidu d'une version où `accepter()` créait un séjour). | UX (déjà dans #38) | `rejoindre/[token]/page.tsx` |
| S10 | Deux workflows d'inscription coexistent pour la même finalité : **saisie directe** (grille tableur dans l'espace, `createBatchDirect`) et **envoi aux parents** (page autorisations satellite). Rien n'explique à l'enseignant lequel choisir ; la page autorisations (élèves, CSV, envoi parents, accompagnateurs, prix/élève) est **la tâche principale de l'enseignant et vit hors de l'espace**. | Haute (cœur de #38) | `TabParticipantsCollab.tsx`, `TabParticipantsSaisieDirecte.tsx`, `autorisations/page.tsx` |

---

## 4. Lecture métier (interprétation, validée par Théo le 02/09)

Le modèle réel n'a que **deux axes** :

**Axe 1 — l'engagement**, le seul qui compte pour tous les rôles :
`pas engagé` (OPTION / EN_ATTENTE, y compris EN_ATTENTE_VALIDATION) → `engagé / signé` (CONVENTION ou SIGNE_DIRECTION / SELECTIONNE ou SIGNE_DIRECTION) → `annulé` (NON_RETENU → OPTION).
Trois états métier, portés aujourd'hui par sept valeurs.

**Axe 2 — des sous-processus** orthogonaux, qui n'ont rien à faire sur la même échelle :
- la mécanique d'appel d'offres (brouillon / publié / **choisi** / fermé) — déjà partiellement modélisée par `appelOffreStatut` ;
- la délégation de signature au directeur (EN_ATTENTE_VALIDATION) ;
- la facturation (déjà migrée vers `Facture`) ;
- le dossier administratif scolaire (rectorat, TAM).

**Faits métier posés par Théo** :
- La signature reste **l'actif qui confirme** le séjour, mais elle **ne bloque pas** : confirmation orale → planning proposé, liste à remplir envoyée, avant signature. Un chemin *recommandé*, jamais un verrou.
- Des enseignants (notamment privé) **signent légitimement à la place du directeur**. La distinction SELECTIONNE / SIGNE_DIRECTION n'est donc pas « engagé / pas engagé » mais « signé par un compte signataire / signé autrement » — une distinction de **canal**, pas d'engagement. Ce qui compte : *est-ce signé*, et *par qui, avec quelle fonction* (donnée tracée), pas deux statuts.
- L'appel d'offres n'ajoute qu'**une seule** étape par rapport au direct : *choisi* avant *signé*. Tout le reste est commun.

---

## 5. Décisions

### 5.1 Actées (02/09)
- **Refonte des statuts actée sur le principe** (Théo : « je suis d'accord avec toi sur la refonte »). Cible conceptuelle : un axe d'engagement à 3 états commun aux deux parcours ; les sous-processus sortis dans leurs propres champs/modèles (`appelOffreStatut` existe déjà ; facturation déjà dans `Facture` ; rectorat/TAM et délégation direction à extraire). Canal et identité du signataire = **données**, pas statuts.
- **Chantier séparé de #38.** Migration lourde (enums Prisma, sets de constantes, `verifyAccess`, planning, pilotage, CRM dérivé, lecteurs organisateur). Ne pas l'ouvrir avant la fenêtre commerciale de septembre.
- **#38 ne dépend de cette refonte que pour le vocabulaire affiché** : le badge d'en-tête, le dashboard et les blocs de l'espace parlent **uniquement sur l'axe 1** — *en attente de signature* / *signé* / *annulé* — avec, en donnée secondaire, qui a signé et comment. Les sept valeurs brutes restent internes et ne sont jamais montrées à l'enseignant. Point unique de renommage : `StatutBadge` (couche 5, à lire).

### 5.2 À traiter DANS #38 (dépendances directes du parcours enseignant)
- **S2** (prix par élève / date limite bloqués hors DRAFT) — à confirmer par test, puis fix à la source (la garde `statut !== 'DRAFT'` est pertinente pour les champs d'appel d'offres, pas pour `prix`/`dateLimiteInscription`).
- **S9** (redirection post-acceptation + wordings).
- **S10** (rapatrier la page autorisations dans l'espace, unifier les deux workflows d'inscription).
- **S7** (ajout d'élève silencieux + « Envoyer aux familles » explicite) — décision produit à prendre.
- **S8** (accompagnateurs dès OPTION) — décision produit à prendre.
- Prix par élève **provisoire** sur devis non signé (aligner sur le budget prévisionnel) — décision produit à prendre.

### 5.3 À border dans le chantier refonte (hors #38)
S1, S3, S4, S5, S6, doublon DRAFT/SUBMITTED ↔ `appelOffreStatut`, FACTURE_* legacy, champs `*Directeur`, T4 (`updateStatut` sans signature), `fonctionSignataire` (vérifier son effet), harmonisation « prix par élève provisoire sur devis non signé » (le budget prévisionnel le fait déjà, §10.4 cadrage 01/09).

---

## 6. Ce que ce doc NE décide PAS
- La forme exacte des nouveaux enums (noms, migration, rétro-compatibilité des données prod).
- Le statut final d'un devis « choisi » en appel d'offres (T4) : reste ouvert jusqu'au chantier refonte.
- Le sort de SOUMIS_RECTORAT (réparer ou supprimer) — dépend de si le dossier rectorat est un livrable réel côté enseignant.

**Aucun code modifié dans le cadre de ce document.**
