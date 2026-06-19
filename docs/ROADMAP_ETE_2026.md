# LIAVO — Roadmap Été 2026

> **Rédigé le 18/06/2026** — Issue d'un audit exhaustif code × docs.
> **Auteur** : Théo + Claude (sparring partner)
> **Ce document remplace** : ROADMAP_POST_DEMO.md, ROADMAP_COMPLETE.md, TIER1_CHANTIERS.md comme source de priorisation.
> **Règle** : les docs ci-dessus restent comme archives de décision. Celui-ci est le seul qui dit quoi faire et dans quel ordre.

---

## 0. État du produit au 18/06/2026

### Ce qui est en production et fonctionne

**Cœur produit (~90% livré)** : flow séjour DIRECT complet (création → devis → signature → facturation acompte/solde/avoir → envoi email PDF), flow COLLABORATIF (invitation → acceptation → espace partagé), facturation Factur-X EN 16931, arrondi TTC-first systémique, ajustement devis post-acompte, CRM hébergeur (pipeline dérivé automatique du devis le plus avancé, contacts, rappels, activités, kanban), planning couleurs par statut (5 états PMS), page liste séjours avec filtres/recherche/badges non-lus, module rentabilité (factures prestataires, ventilation par séjour, marges), page équipe/collaborateurs (permissions par module), dashboard global multi-centre, dashboard réseau (KPIs, scoring, invitation), import APIDAE (81 LMDJ + 54 IDDJ), catalogue public, landing page, autorisations parentales, journal séjour parents, page abonnement (frontend, non connectée au PSP).

**Architecture UX séjour (~70% livré)** : 4 composants extraits (SejourHeader, TabDevisFacturation, TabNotes, TabParticipantsSaisieDirecte), migrations schema faites (notesInternes sur Sejour, sejourId sur Rappel et ActiviteClient), page liste séjours livrée.

**Infra** : Scalingo Paris (2×M + PG Starter 512M = ~36€ HT/mois), OVH Object Storage Gravelines, Brevo FR, DNS OVH. Stable.

### Ce qui ne fonctionne PAS encore

- **Sécurité** : LOT 0 fait (trust proxy + throttle). LOTs 1 à 5 = 0 ligne de code. IDOR critiques ouverts.
- **Monétisation** : 0€ de revenu. Pas de PSP, pas de gating, pas de PlanGuard. Enum PlanAbonnement manque PILOTAGE.
- **Intégrations** : aucune (pas d'iCal, pas d'export CSV, pas de webhooks, pas de Chorus Pro service).
- **Notifications** : l'hébergeur ne reçoit pas de notification quand l'organisateur poste un message collab.
- **Labels** : termes scolaires encore présents dans le body de page.tsx séjour (TIER1 Ch.4 non terminé).

### Données production

- ~63 séjours/événements (Sauvageon)
- ~40 factures émises
- 1er client signé hors Sauvageon : Les Choucas (2 mois gratuits, plan Complet)
- 3 centres Pôle Montagne actifs (trial 6 mois)
- 81 centres LMDJ importés, 54 centres IDDJ importés
- Compte démo réseau : `demo-lmdj@liavo.fr` / `LMDJ2026!`

### Échéances

| Date | Événement |
|---|---|
| 30/06/2026 | CA LMDJ — Marie porte le dossier LIAVO |
| 01/09/2026 | Obligation réception e-invoicing (toutes entreprises) |
| ~Sept 2026 | Potentiel démarrage pilote LMDJ (si accord CA) |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |
| 01/09/2027 | Obligation émission e-invoicing (PME) |

---

## 1. Priorités P0 — Bloquant adoption (faire IMMÉDIATEMENT)

### 1.1 Notif hébergeur messages collaboratifs — 1h

**Problème** : quand un organisateur poste un message, l'hébergeur ne reçoit rien. Les Choucas et tout futur client en collab sont dans le noir.

**Fix** : créer `notifierHebergeur()` dans `collaboration.service.ts` (symétrique de `notifierOrganisateur`). L'appeler dans `createMessage()` et `createJournalPost()` quand l'auteur est l'ORGANISATEUR.

**Fichier** : `backend/src/collaboration/collaboration.service.ts`

### 1.2 LOT 1 sécurité — IDOR ownership helper — 1.5j

**Problème** : un SIGNATAIRE auto-inscrit peut accéder aux dossiers médicaux, devis et détails de séjours d'autres établissements. 6 findings CRITIQUE.

**Fix** : créer `auth/ownership.helper.ts` avec 4 helpers (`isSignataireLinkedToSejour`, `assertSignataireCanAccessSejour`, `assertSignataireCanAccessDemande`, `assertHebergeurCanAccessDemande`). Appliquer sur ~30 call sites (verifyAccess, signerDevis, updateStatut, getSejourDetail, dossier-pédagogique, demande.findOne, comparatif, getBySejour, factures lecture).

**Fichiers** : nouveau `backend/src/auth/ownership.helper.ts` + modifications dans `collaboration.service.ts`, `devis.service.ts`, `sejour.service.ts`, `facture.service.ts`, `demande.service.ts`, `accompagnateur.service.ts`

**Référence complète** : `docs/audits/PLAN_REMEDIATION.md` LOT 1 + `docs/audits/REMEDIATION_IDOR_ANALYSE.md`

### 1.3 LOT 3 sécurité — Storage privé + URL signées — 2j

**GATE DUR : aucune donnée médicale de mineur ne doit transiter tant que ce n'est pas déployé.**

**Fix** :
- Backend : bucket OVH privé + `getSignedUrl()` dans StorageService (TTL 15min) + endpoint authentifié `/files/:key` avec ownership check
- Frontend : composant `<SecureFile />`, remplacement des ~14 call sites d'upload
- Token autorisations parentales : ajouter `tokenExpiresAt` (dateFin + 30j)

**Dépendance** : backend avant frontend. Ne pas déployer pendant une semaine de démo.

**Total P0 : ~4j. Chemin critique : 1.2 → 1.3 (séquentiel). 1.1 en parallèle dès le premier jour.**

---

## 2. Priorités P1 — Forte valeur (semaines 2-4, avant ou juste après CA LMDJ)

### 2.1 LOT 2 sécurité — Auth hardening JWT refresh — 2j

- Réduire JWT TTL à 1h + refresh token rotatif + `tokenVersion` en base
- Migration SQL : `ALTER TABLE utilisateurs ADD COLUMN token_version INTEGER DEFAULT 0`
- Exiger ancien MDP dans set-password si `motDePasseDefini: true`
- Magic link TTL réduit à 30min
- Uniformiser bcrypt rounds=12
- **Impact frontend** : axios interceptor pour refresh token automatique

### 2.2 Migration enum PILOTAGE — 15min

```sql
ALTER TYPE "PlanAbonnement" ADD VALUE 'PILOTAGE';
```

Pré-requis pour le gating et le PSP.

### 2.3 Trancher et implémenter le PSP — 3-7j

**Décision à prendre** : Mollie (EU, meilleur DX) vs PayPlug (FR, souveraineté).

**Implémentation** :
1. Backend : PlanGuard middleware + application sur endpoints (1j)
2. Backend : intégration PSP checkout + webhooks (1-1.5j Mollie / 3-4j PayPlug)
3. Frontend : PricingTable v2 (4 plans, prix 29/49/69€) + checkout redirect (1j)
4. Frontend : sidebar gating par plan + pages upgrade CTA (1j)
5. Test E2E + passage mode live (1j)

**Référence** : `docs/commercial/MONETISATION_PLAN.md`

### 2.4 TIER1 Ch.4 — Labels universels — 1j

Remplacer dans `sejour/[id]/page.tsx` (body principal, pas les composants extraits qui sont déjà propres) :
- "Établissement scolaire" → "Structure organisatrice"
- "Enseignant responsable" → "Responsable du séjour"
- "Nombre d'élèves" → "Nombre de participants"
- "élèves" → "participants" (contexte groupes, inscriptions)
- Masquer "Lien avec les programmes scolaires" en mode EVENEMENT

### 2.5 Export CSV factures — 0.5j

Bouton "Exporter" dans le dashboard facturation. CSV : numéro, date, client, HT, TVA, TTC, statut. Import direct dans Pennylane/Henrri/comptable.

### 2.6 LOT 4 sécurité — Cookie httpOnly + Helmet — 2j

- Cookie httpOnly+Secure+SameSite=Lax côté serveur
- Helmet (CSP, HSTS, nosniff, Referrer-Policy)
- CORS cleanup (retirer origines obsolètes)
- **Dépend de** : LOT 2 (refresh token en place)

**Total P1 : ~10-14j.**

---

## 3. Priorités P2 — Nice to have (juillet-août)

| # | Chantier | Effort | Trigger |
|---|---|---|---|
| 3.1 | LOT 5 — Purge IBAN git (`git filter-repo`) | 0.5j | Avant recrutement 2e dev ou ouverture repo |
| 3.2 | Refonte page Devis envoyés (tableau filtrable/triable) | 2-3j | Quand 100+ devis en base |
| 3.3 | Flux iCal lecture seule (`GET /centres/:id/calendar.ics`) | 0.5j | 1er hébergeur qui demande |
| 3.4 | SC7 — Notif centres APIDAE non inscrits | 2-3h | Après validation commerciale LMDJ |
| 3.5 | Concept Réponse PDF (adhérents LMDJ Découverte) | 1j | Si accord CA LMDJ |
| 3.6 | Fix "dont X€ via réseau" (mauvais fichier global→hebergeur) | 0.5j | Quick fix |
| 3.7 | Intégration APIDAE LMDJ (1 ligne dans syncApidae) | 15min | Quand credentials Amandine reçus |
| 3.8 | SSO APIDAE OAuth2 | 0.5j | Quand credentials APIDAE Connect reçus |
| 3.9 | Onboarding première connexion (flag premiereConnexion) | 1-2j | Avant ouverture grand public |

---

## 4. Priorités P3 — Dette technique (selon trigger)

| # | Chantier | Effort | Trigger |
|---|---|---|---|
| 4.1 | Fusionner 3 DevisBuilder → 1 paramétrique | 1-2j | Prochaine modif devis |
| 4.2 | DashboardShell unification (3 layouts → 1) | 4-6j | 2e dev ou post-validation LMDJ |
| 4.3 | Découper page.tsx séjour (restant) | 0.5j/onglet | Quand on touche l'onglet |
| 4.4 | LOT 6 maintenance continue (logs, HTML injection emails, omit Prisma) | Au fil de l'eau | Quand on touche les fichiers |

---

## 5. Chantiers conditionnels (SI accord CA LMDJ)

Ces chantiers ne sont codés QUE si le CA LMDJ du 30/06 donne un accord de principe.

| # | Chantier | Effort | Source |
|---|---|---|---|
| 5.1 | Validation réseau avant dispatch (statut `EN_VALIDATION_RESEAU`) | 2-3j | Débrief Marie §1 — BLOQUANT pour LMDJ |
| 5.2 | Motif obligatoire refus centre + enseignant | 1j | Débrief Marie §3 |
| 5.3 | Multi-classes (niveauClasse string → string[]) | 0.5j | Débrief Marie §4 |
| 5.4 | Split maternelle/PMI (agrementPMI, filtre findOpen) | 1-1.5j | Débrief Marie §5 |
| 5.5 | Ratio demandes/devis par centre (enrichir KPIs réseau) | 0.5j | Débrief Marie §8 |
| 5.6 | Capture demandes 73/74 hors LMDJ sur dashboard réseau | 0.5-1j | Débrief Marie §2 |
| 5.7 | CRM hébergeurs côté réseau (prospection adhérents) | 2-3j | Débrief Marie §7 |
| 5.8 | Pricing bundlé LMDJ (business decision, pas du code) | — | Débrief Marie §10 |

**Total conditionnel : ~10j si tout est fait. Échelonnable en 3 sprints.**

---

## 6. Chantiers hors scope été (backlog)

Documentés pour mémoire. Ne pas commencer avant PMF.

- Module Pilotage enrichi (CA, taux occupation, planning équipes) — plan 69€
- Chorus Pro NestJS service (habilitation AIFE, ChorusProService)
- Webhooks événementiels (1-2j)
- Flow "Transmettre au gestionnaire" facture (token public, 2-3j)
- SC-MULTI-ORGANISATEURS (SejourCollaborateur)
- SC-PDF-DEVIS-EXTERNE (typeDevis UPLOAD_EXTERNE)
- SC-IMPORT-PARTICIPANTS (CSV Pronote)
- Intégration PMS (Mews, Amenitiz) — V2+
- Convention configurable par centre (quand 2e centre actif)
- App mobile PWA
- Marketplace activités
- Appel d'offres transport
- Forge française (Gitea OVH) — quand 2e dev ou appel d'offres public

---

## 7. Calendrier cible

```
Semaine 23/06 - 27/06 (avant CA)
├── Jour 1 : TIER1 Ch.1 notif hébergeur (1h) + début LOT 1 IDOR (ownership.helper.ts)
├── Jour 2-3 : LOT 1 IDOR (finir les ~30 call sites + tests)
├── Jour 4-5 : LOT 3 storage privé backend (getSignedUrl, endpoint /files/:key)
│
30/06 ★ CA LMDJ
│
Semaine 30/06 - 04/07
├── LOT 3 storage privé frontend (SecureFile, 14 call sites) + tokens expiration
├── LOT 2 JWT refresh (backend + frontend interceptor)
│
Semaine 07/07 - 11/07
├── Migration PILOTAGE + PSP choix + intégration (3-7j selon PSP)
│
Semaine 14/07 - 18/07
├── PSP fin + PlanGuard + gating frontend
├── Labels universels + export CSV factures
│
Semaine 21/07 - 25/07
├── LOT 4 httpOnly + Helmet
├── Si accord LMDJ : validation réseau (P0 LMDJ)
│
Août
├── P2 au fil de l'eau (iCal, refonte devis envoyés, notif APIDAE)
├── Si LMDJ : chantiers 5.2→5.7
├── LOT 5 purge IBAN
```

---

## 8. Métriques de suivi

| Métrique | Cible fin juillet | Cible fin août |
|---|---|---|
| Findings CRITIQUE restants | 0 | 0 |
| Findings HAUTE restants | ≤ 3 | 0 |
| PSP connecté + 1er paiement test | ✅ | ✅ |
| Centres payants | 1 (Les Choucas) | 3-5 |
| MRR | 49€ | 150-250€ |
| IDOR ownership helper déployé | ✅ | ✅ |
| Storage privé déployé | ✅ | ✅ |

---

## 9. Décisions de référence

| Sujet | Décision | Date |
|---|---|---|
| Grille tarifaire | 29/49/69€ HT/mois, tarif unique, pas de remise annuelle | 18/06/2026 |
| PSP | À trancher : Mollie (EU) vs PayPlug (FR). Stripe écarté. | En attente |
| CRM pipeline | Dérivé automatique côté frontend, plus de pipeline manuel | 18/06/2026 |
| Sécurité gate dur | LOT 3 (storage privé) avant tout upload de donnée médicale mineur | 15/06/2026 |
| Chantiers LMDJ | Conditionnés à l'accord CA 30/06, pas avant | 18/06/2026 |
| Positionnement | LIAVO = infrastructure technique modernisant la centrale, pas remplacement | 10/06/2026 |
| Commission réseau | 10% des abonnements LIAVO dès 2027 | 11/06/2026 |

---

**Ce document est la source unique de priorisation pour l'été 2026. Les autres docs restent comme archives de décision.**