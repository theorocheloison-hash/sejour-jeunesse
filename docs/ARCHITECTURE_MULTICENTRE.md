# LIAVO — Audit architecture multi-centre

> **Objectif** — passer du modèle implicite `1 user HEBERGEUR = 1 CentreHebergement` à `1 user = N centres`, sans rupture des flux existants.
> **Rédigé le 27 mai 2026** après audit lecture-seule du codebase.
> **Statut** — audit uniquement, aucune ligne de code modifiée. Décisions d'archi en attente (cf. §3).

---

## 1. État du modèle de données

### 1.1 Bonne nouvelle : le schéma supporte déjà 1:N

`backend/prisma/schema.prisma` :

- **`User.centres CentreHebergement[]`** (ligne 181) — déjà N côté user.
- **`CentreHebergement.userId String?`** (ligne 523) — **nullable, sans `@unique`**. Rien dans la contrainte SQL n'empêche un même `userId` d'apparaître sur plusieurs centres.
- Tous les modèles satellites portent un **`centreId`**, pas un `userId` :
  - `ProduitCatalogue.centreId` (catalogue produits) — ligne 580
  - `Devis.centreId` — ligne 717
  - `Disponibilite.centreId` — ligne 596
  - `Document.centreId` — ligne 613
  - `Client.centreId` — ligne 844
  - `DevisLibre.centreId` — ligne 1012
  - `ActiviteClient.centreId` — ligne 1062
  - `InvitationCollaboration.centreId` — ligne 631
  - `DemandeIgnoree.centreId` — ligne 781
  - `DemandeDevis.centreDestinataireId` — ligne 699 (optionnel — flèche centre → demande dédiée)
  - `Sejour.hebergementSelectionneId` — ligne 254

→ **Pas de migration schema requise**. Le travail est 100 % code applicatif.

### 1.2 Champs portés par CentreHebergement (donc déjà per-centre)

Ces champs sont déjà scopés à un centre — multi-centre les rendra hétérogènes par défaut :

- **Abonnement** : `abonnement`, `abonnementActifJusquAu`, `abonnementStatut`, `planAbonnement` (lignes 525-528)
- **Mandat de facturation** : `mandatFacturationAccepte` + 4 colonnes de trace (549-553)
- **Conditions d'annulation** : `conditionsAnnulation` (534)
- **IBAN, SIRET, TVA intra** (529-532)
- **Image, brochure** (547-548)

→ **Décision produit** requise pour chacun : per-centre ou hissé au user/Organisation (cf. §3).

---

## 2. Inventaire des points de rupture

### 2.1 Backend — `findFirst({ where: { userId } })` ⇒ "mon centre"

Le **pattern dominant** dans tout le backend hébergeur :

```ts
const centre = await this.prisma.centreHebergement.findFirst({ where: { userId } });
if (!centre) throw new NotFoundException('Centre introuvable');
```

**~30+ occurrences** identifiées :

| Fichier | Lignes (approx) | Action en multi-centre |
|---|---|---|
| `centres/centre.service.ts` | 485, 493, 510, 544, 560, 629, 706, 724, 766, 779, 821, 840 | Accepter `centreId` en paramètre, vérifier `centre.userId === userId` |
| `devis/devis.service.ts` | 26, 143, 199, 232, 468, 668, 714, 722, 760, 856, 1191 | idem |
| `demandes/demande.service.ts` | 126, 268, 293, 307 | `findOpen` doit agréger N centres OU accepter `centreId` |
| `clients/clients.service.ts` | 24, 165, 208, 285, 554 | idem |
| `activites-client/activites-client.service.ts` | 42, 50 | idem |
| `abonnements/abonnement.service.ts` | 10, 35 | Décision produit : abonnement per-centre ou compte ? (cf. §3) |
| `invitation-collaboration/invitation-collaboration.service.ts` | 20 | `centreId` obligatoire dans le DTO |
| `hebergements/hebergement.service.ts` | 186, 209 | idem |
| `devis-libres/devis-libres.service.ts` | 37 | idem |
| `sejours/sejour.service.ts` | 66 | À auditer (cas particulier signature) |

**Risque de régression : HAUT** — n'importe quel hébergeur avec ≥2 centres aujourd'hui (rare/inexistant) tomberait sur un centre arbitraire (`findFirst` ne garantit pas l'ordre).

### 2.2 Backend — patron déjà multi-centre (à reprendre)

Une seule occurrence "correcte" trouvée — `collaboration.service.ts:371` :

```ts
const centres = await this.prisma.centreHebergement.findMany({
  where: { userId }, select: { id: true },
});
const centreIds = centres.map((c) => c.id);
// ... .findMany({ where: { hebergementSelectionneId: { in: centreIds } } })
```

→ C'est le **patron cible** pour les vues "tous mes centres". Pour les actions ciblées (créer un devis, modifier un produit), le frontend devra envoyer un `centreId` explicite.

### 2.3 Backend — controllers : routes `/centres/...` sans `centreId`

`backend/src/centres/centre.controller.ts` — toutes les routes hébergeur sont implicites :

```
GET    /centres/mon-profil              (ligne 61)
PATCH  /centres/mon-profil              (ligne 68)
POST   /centres/image                   (75)
POST   /centres/brochure-upload         (87)
POST   /centres/documents-upload        (99)
PATCH  /centres/mandat-facturation      (112)
GET    /centres/disponibilites          (121)
POST   /centres/disponibilites          (128)
DELETE /centres/disponibilites/:id      (135)
GET    /centres/documents               (142)
POST   /centres/documents               (149)
GET    /centres/catalogue               (156)
POST   /centres/catalogue               (163)
POST   /centres/catalogue/import        (173)
PATCH  /centres/catalogue/:id           (183)
DELETE /centres/catalogue/:id           (194)
```

→ Choix d'API à faire (cf. §3, point routing) : préfixer par `/centres/:centreId/...`, ou ajouter un header `X-Centre-Id`, ou query param `?centreId=…`.

### 2.4 Backend — register hébergeur

`auth/auth.service.ts:186-280` — `registerHebergeur` crée **1 user + 1 centre** en transaction. Le user repart toujours avec exactement un centre.

→ **Pas un blocker direct** (le 1er centre se crée normalement), mais il faut prévoir :
- Un endpoint séparé `POST /centres` (créer un centre additionnel sur un user HEBERGEUR existant)
- L'invitation hébergement (`/centres/check-invitation/:token`) doit pouvoir attacher le centre à un user existant (aujourd'hui : `register` ⇒ crée user + centre)

### 2.5 Frontend — `lib/centre.ts` : 9+ fonctions implicites

`frontend/src/lib/centre.ts` — toutes les fonctions exportées ciblent "mon centre" :

```
getMonProfil()           → GET    /centres/mon-profil
updateMonProfil(dto)     → PATCH  /centres/mon-profil
getDisponibilites()      → GET    /centres/disponibilites
createDisponibilite(dto) → POST   /centres/disponibilites
deleteDisponibilite(id)  → DELETE /centres/disponibilites/:id
getDocuments()           → GET    /centres/documents
getCatalogue()           → GET    /centres/catalogue
createProduit(dto)       → POST   /centres/catalogue
uploadCentreImage(file)  → POST   /centres/image
```

→ **Toutes** doivent recevoir un `centreId`. Changement breaking côté SDK frontend.

### 2.6 Frontend — `AuthContext`

`frontend/src/contexts/AuthContext.tsx` — **0 référence à centre/Centre**. Le contexte expose `user` et `organisation`, point. Le centre est résolu page par page.

→ Ajout requis : `centreActif`, `centresDisponibles[]`, `setCentreActif(id)`. Persistance probable en `localStorage` + écho dans le user JWT à valider (cf. §3).

### 2.7 Frontend — dashboard hébergeur

`frontend/app/dashboard/hebergeur/` (11 sous-dossiers) — chaque page charge "le" centre via `getMonProfil()` :

- `page.tsx` — état `centre` singulier, pas de sélecteur
- `devis/page.tsx` — `getMesDevis()` (implicite)
- `demandes/page.tsx` — `getDemandesOuvertes()` (implicite)
- `planning/page.tsx` — `getDisponibilites()` (implicite)
- `catalogue/page.tsx`, `clients/page.tsx`, `documents/page.tsx`, `disponibilites/page.tsx`, `parametres/page.tsx`, `abonnement/page.tsx`, `profil/page.tsx`, `inviter-enseignant/page.tsx`, `devis/nouveau`, `devis/[id]/modifier` — toutes implicites.

→ **Selector de centre globaal** (header ou sidebar) à ajouter. Toutes les pages doivent lire `centreActif` depuis `AuthContext`.

### 2.8 Frontend — register hébergeur

`frontend/app/register/hebergeur/page.tsx` — 3 cas de figure (invitation existante / invitation pré-créée / inscription libre). Aucun ne prévoit "ajouter un centre à un compte existant".

→ Nouveau parcours `+ Nouveau centre` à concevoir, accessible depuis le dashboard.

---

## 3. Questions ouvertes — décisions d'architecture à prendre

### 3.1 Résolution du "centre actif" en session

| Option | Pour | Contre |
|---|---|---|
| **A. Header `X-Centre-Id`** sur chaque requête | Stateless, RESTful, simple à logger | Frontend doit l'injecter partout (intercepteur axios) |
| **B. Cookie + claim JWT** | Sticky côté serveur, plus discret | Re-issue JWT à chaque switch, complexifie le refresh |
| **C. Query param `?centreId=…`** | Trivial, debuggable | Verbeux, oubliable |
| **D. Route préfixée `/centres/:centreId/...`** | Self-documenting, REST canonique | Migration de toutes les routes |

→ **Recommandation** : combinaison **A + D** (path param pour les routes ressources, header pour les routes "mon centre courant" maintenues en compat).

### 3.2 Catalogue : per-centre ou compte ?

Aujourd'hui `ProduitCatalogue.centreId` (per-centre). Un hébergeur multi-sites veut probablement **dupliquer** son catalogue (un produit "Pension complète 49 €" décliné par centre) — ou au contraire **mutualiser** (un seul catalogue, prix unique).

→ **À trancher** : garder per-centre (status quo) avec un bouton "Dupliquer depuis [autre centre]", ou hisser vers `Organisation.produitsCatalogue` ?

### 3.3 Disponibilités

Forcément per-centre (différentes salles/places). **Status quo OK.**

### 3.4 Conditions d'annulation

Aujourd'hui `CentreHebergement.conditionsAnnulation`. Un réseau aura généralement les mêmes conditions partout, mais pas obligatoirement.

→ **Recommandation** : garder per-centre + héritage optionnel depuis `Organisation.conditionsAnnulationDefaut` (à créer).

### 3.5 CRM clients

`Client.centreId` aujourd'hui. Un client (école) peut intéresser plusieurs centres du même réseau — actuellement il faudrait dupliquer.

→ **À trancher** : `Client.organisationId` (mutualisé) + vue filtrée par centre ? Plus complexe mais plus juste.

### 3.6 Abonnement

Aujourd'hui per-centre (`CentreHebergement.abonnement*`). Un hébergeur 3 centres paye 3 abonnements ?

→ **Décision produit/commercial** :
- **Per-centre** : aligné sur la facturation actuelle, mais multi-centre devient cher.
- **Per-compte** (user) : un abonnement, N centres. Risque de churn moindre, monétisation à revoir (tarif palier `>3 centres` ?)
- **Per-organisation** : aligné sur `Membership`, complexité juridique (qui paye ?).

### 3.7 Invitations hébergement

`InvitationHebergement` pointe vers un `centreExistantId` optionnel. Le flow actuel suppose qu'accepter l'invitation **crée le user et le centre**.

→ Pour un user HEBERGEUR existant : nouveau flow "accepter et rattacher au compte courant". Le check-invitation doit détecter si l'email correspond à un user déjà créé.

### 3.8 Mandat de facturation

`mandatFacturationAccepte` per-centre. Si un user gère 3 centres, doit-il signer 3 fois ? Probablement oui juridiquement (chaque centre = entité de facturation), mais ergonomie à soigner.

---

## 4. Plan de migration suggéré (non engagé)

Découpage proposé en 6 phases incrémentales — **non décidé**, à valider après décisions §3 :

1. **Phase 0** — Ajout `AuthContext.centreActif` + selector header (lecture seule, aucune API touchée). Le frontend stocke un id, ne l'utilise pas encore.
2. **Phase 1** — Backend : nouveaux endpoints `/centres/:centreId/...` en parallèle des `/centres/mon-profil` (deprecated mais maintenus). `centreId` validé contre `centre.userId === user.id`.
3. **Phase 2** — Migration `lib/centre.ts` pour appeler les nouvelles routes avec `centreActif`.
4. **Phase 3** — Endpoint `POST /centres` (ajout centre additionnel) + page `/dashboard/hebergeur/centres/nouveau`.
5. **Phase 4** — Décisions §3 mises en code (catalogue, abonnement, CRM, conditions).
6. **Phase 5** — Retrait des routes deprecated `/centres/mon-profil` etc.

---

## 5. Annexe — fichiers audités

**Backend** :
- `backend/prisma/schema.prisma` — modèles User, CentreHebergement, ProduitCatalogue, Devis, etc.
- `backend/src/centres/centre.service.ts` + `centre.controller.ts`
- `backend/src/devis/devis.service.ts`
- `backend/src/demandes/demande.service.ts`
- `backend/src/collaboration/collaboration.service.ts`
- `backend/src/invitation-collaboration/invitation-collaboration.service.ts`
- `backend/src/abonnements/abonnement.service.ts`
- `backend/src/auth/auth.service.ts` (registerHebergeur)
- `backend/src/clients/clients.service.ts`, `activites-client/activites-client.service.ts`
- `backend/src/hebergements/hebergement.service.ts`, `devis-libres/devis-libres.service.ts`, `sejours/sejour.service.ts`

**Frontend** :
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/lib/centre.ts`
- `frontend/app/dashboard/hebergeur/` (11 sous-dossiers)
- `frontend/app/register/hebergeur/page.tsx`
- `frontend/app/dashboard/hebergeur/inviter-enseignant/page.tsx`

---

**Aucun code modifié dans le cadre de cet audit.**
