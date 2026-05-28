# LIAVO — État session dev
> Dernière mise à jour : 28/05/2026 — Session Tier 1 post-séjour DIRECT + notifications + CRM + nettoyage + fix contrat

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
| Organisation              | organisations                   |
| Membership                | memberships                     |
| CentreHebergement         | centres_hebergement             |
| InvitationHebergement     | invitations_hebergement         |
| ProduitCatalogue          | produits_catalogue              |
| Disponibilite             | disponibilites                  |
| Document                  | documents                       |
| Devis                     | devis                           |
| LigneDevis                | lignes_devis                    |
| DemandeDevis              | demandes_devis                  |
| Sejour                    | sejours                         |
| Message                   | messages                        |
| PlanningActivite          | planning_activites              |
| GroupeSejour              | groupes_sejour                  |
| EleveGroupe               | eleves_groupes                  |
| DocumentSejour            | documents_sejour                |
| AutorisationParentale     | autorisations_parentales        |
| AccompagnateurMission     | accompagnateurs_missions        |
| Client                    | clients                         |
| ContactClient             | contacts_clients                |
| Rappel                    | rappels                         |
| SejourClient              | sejours_clients                 |
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |
| DevisLibre                | devis_libres                    |
| LigneDevisLibre           | lignes_devis_libre              |
| VersementDevisLibre       | versements_devis_libre          |
| ActiviteClient            | activites_client                |
| InvitationCollaboration   | invitations_collaboration       |
| RelationCommerciale       | relations_commerciales          |
| SejourRelation            | sejours_relations               |
| InvitationDirecteur       | invitations_directeur           |
| SejourVisiteHebergeur     | sejour_visites_hebergeur        |

### StatutDevis
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU | FACTURE_ACOMPTE | FACTURE_SOLDE

### StatutDevisLibre (string)
BROUILLON | ENVOYE | ACCEPTE | REFUSE | PAYE

### StatutSejour
DRAFT | OPTION | SUBMITTED | APPROVED | REJECTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM

### TypeActivite
APPEL | EMAIL | VISITE | DEVIS | SIGNATURE | VERSEMENT | NOTE | BROCHURE

---

## RÈGLE ABSOLUE — PROCESS CC
**Prompts longs : découper en parties numérotées.**
**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**
**Lire les fichiers source avant toute proposition. Ne jamais écrire de prompt sans avoir lu.**

---

## STACK TECHNIQUE

| Composant | Technologie | URL |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net |
| Emails | Brevo | contact@liavo.fr (fromName configurable) |

**Repo :** theorocheloison-hash/sejour-jeunesse
**Local :** C:\Users\Roche-Loison\Desktop\sejour-jeunesse (copie UNIQUE)
**Scalingo CLI :** C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe
**Railway + Cloudflare R2 : RÉSILIÉS**

---

## COMPTES DE RÉFÉRENCE

| Email | Rôle | MDP |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154
INTERDIT : contact@chalet-sauvageon.fr = INEXISTANT

---

## FLUX DIRECTION — LIVRÉ PARTIELLEMENT (21/05/2026)

### Backend livré ✅ — commit 28c372a
- Migration `20260521_flux_direction_signature` : 5 colonnes ajoutées (4 sur invitations_directeur, 1 sur devis)
- `POST /invitations-directeur` (ORGANISATEUR) — crée invitation + envoie email avec 2 CTA
- `POST /invitations-directeur/:token/signer-sans-compte` (PUBLIC) — signature sans compte, anti-double, hash SHA256, notif hébergeur
- `POST /devis/:id/upload-signature` (ORGANISATEUR) — upload scan PDF signé, passe SIGNE_DIRECTION
- `facturerAcompte()` enrichi : email auto à organisateur + signataire (via InvitationDirecteur.emailDirecteur)
- `validerAcompte` : @Roles élargi à SIGNATAIRE + HEBERGEUR (c'est l'hébergeur qui valide réception paiement)
- Schema Prisma synchronisé : `signatureDocumentUrl` sur Devis, `nomSignataire/fonctionSignataire/signeAt/signatureIp` sur InvitationDirecteur

### Frontend EN COURS ❌
- Page publique `/invitation-direction/[token]` — à créer (PDF inline + formulaire signature + lien register)
- Bouton "Envoyer à la direction" dans onglet Devis `sejour/[id]/page.tsx` — à ajouter
- Bouton "Joindre document signé" (upload scan) — à ajouter
- Badge signature direction dans onglet Devis — à ajouter
- `findByToken()` à enrichir pour retourner données complètes du devis (lignes, montants, centre, organisateur) pour le PDF inline

### Terminologie UI
JAMAIS "directeur" dans l'interface. Utiliser "direction" (neutre) ou "signataire".
Modèle Prisma `InvitationDirecteur` reste inchangé (nom de table OK, c'est la BDD pas l'UI).

### Architecture signature — 3 chemins, même résultat
1. **Upload scan** : organisateur imprime → fait signer → scanne → uploade via `POST /devis/:id/upload-signature`
2. **Signature par lien** : signataire reçoit email → page publique `/invitation-direction/[token]` → voit PDF inline → signe en 1 clic
3. **Dashboard signataire** : signataire a un compte → `/dashboard/signataire` → signe depuis SejourCard
Les 3 aboutissent à : devis `SIGNE_DIRECTION`, séjour `SIGNE_DIRECTION`, email hébergeur.

### Facturation post-signature
- Signature NON BLOQUANTE pour facturer (option A retenue). L'hébergeur peut facturer dès SELECTIONNE.
- `facturerAcompte()` envoie email auto à organisateur + signataire (si invitation existe).
- C'est l'HÉBERGEUR qui valide la réception du paiement (pas le signataire).
- Le signataire n'a pas besoin de compte pour recevoir la facture → email automatique.

### Schema InvitationDirecteur — pas de relation Prisma `devis`
`devisId String?` sans `@relation` → `findByToken()` doit faire une requête Prisma séparée pour charger le devis.

### User frontend (AuthContext)
`user.firstName`, `user.lastName`, `user.role`, `user.organisation?.id`, `user.organisation?.nom`, `user.organisation?.uai`

---

## DÉBRIEF CLIENT — François Croquette / Collège Lucien Herr Altkirch (19/05/2026)

### Contexte démo
Onboarding en direct. Hébergeur : Le Chalet Le Sauvageon (Morillon, 74).
3 séjours créés hiver 2026-2027. Flux invitation → création compte → espace collaboratif présenté en live.

### Ce qui a fonctionné ✅
- Flux invitation et création de compte : sans accroc
- Espace collaboratif : pertinent, il commence à organiser ses séjours dessus
- Séjour 1 et Séjour 2 acceptés et visibles dans son dashboard ✅

### Blocage — Mon Bureau Numérique (MBN)
Communications parents EN doivent passer par MBN. LIAVO ne peut pas envoyer directement.
Voie alternative : enseignant copie le lien LIAVO dans MBN.
Action : contacter cellule juridique rectorat. François voit avec sa gestionnaire.

### Feedback — Granularité droits accompagnateurs par onglet
François veut choisir quel(s) onglet(s) sont visibles par chaque accompagnateur.
Spéc : `ongletVisibles: string[]` sur `accompagnateurs_missions`. Rétrocompatible (vide = tout visible).

---

## ARCHITECTURE CRM — LIVRÉ (commit 061f84d)

### Fix livré
Dans `invitation-collaboration.service.ts` méthode `accepter()` : `linkSejourToCRM()` cherche Client par email → UAI → nom, crée si pas trouvé, upsert SejourClient + ActiviteClient. Fire-and-forget, non bloquant.

### Backfill fait
3 liaisons créées en prod (Croquette Altkirch + 2 Loué). Vérifié via SQL.

---

## MODULES LIVRÉS EN PROD

### DevisLibre (13/05/2026) ✅
### Invitation Collaboration — devis pré-rempli (14/05/2026) ✅
### CRM Activité (14/05/2026) ✅
### Brochure hébergeur (18/05/2026) ✅
### Notifications espace collaboratif (18/05/2026) ✅
### Accompagnateurs avec accès collaboratif (18/05/2026) ✅
### Logo cliquable + Sidebar hébergeur universelle (18/05/2026) ✅
### Notifications manuelles devis + planning (19/05/2026) ✅
### Modification infos séjour par hébergeur (19/05/2026) ✅
### Devis — améliorations nombreEleves (19/05/2026) ✅
### Audit qualité codebase (20/05/2026) ✅
### Flux direction — backend (21/05/2026) ✅ — commit 28c372a

### Séjour en gestion directe — CHANTIER COMPLET (28/05/2026) ✅

### Chantier Tier 1 — Session 28/05/2026 ✅

**Chantier 1 — Notifications hébergeur (badge non-lus)** — commits a3affb0, af5363b, ed3f73a
- Modèle `SejourVisiteHebergeur` (tracking dernière visite par onglet messages/documents/journal)
- `GET /collaboration/mes-non-lus` : count par séjour, exclut messages de l'hébergeur lui-même
- `POST /collaboration/marquer-visite` : upsert visitedAt au changement d'onglet
- Badge rouge sur "Planning" dans la sidebar (via `useHebergeurCounts` + `sejoursNonLusCount`)
- Fire-and-forget `marquerVisite()` dans useEffect sur tab change (page sejour/[id])
- **⚠️ UX INCOMPLÈTE** : le badge existe mais cliquer sur Planning amène au calendrier sans indication du séjour concerné. À traiter dans le chantier global refonte dashboard/page séjour.

**Chantier 2 — Liaison CRM ↔ séjours collaboratifs** — commit 061f84d + backfill SQL
- Méthode `linkSejourToCRM()` dans `invitation-collaboration.service.ts` : cherche Client par email → UAI → nom → crée si pas trouvé
- Appel fire-and-forget après `accepter()` (couvre branches DIRECT et standard)
- Upsert SejourClient + création ActiviteClient
- Backfill SQL exécuté en prod : 3 liaisons créées (Croquette + 2 Loué)
- Séjour test "flux direction" supprimé (hard delete)

**Chantier 3 — Nettoyage code mort DevisLibres** — commit 87c7a20
- Supprimé : `backend/src/devis-libres/` (controller, service, module, DTOs, contrat PDF)
- Retiré `DevisLibresModule` de `app.module.ts`
- Supprimé : `frontend/app/devis-libre/`, `frontend/app/dashboard/hebergeur/devis-libres/`, `frontend/src/lib/devis-libres.ts`
- Conservé : interface `DevisLibreImpayee` dans `global/page.tsx` (backend retourne encore cette shape)
- Redirect `/devis-libre/signer/:token` → `/devis/signer/:token` déjà en place dans next.config.ts
- **Tables DevisLibre en base NON supprimées** → dette technique, DROP après 2 semaines stabilité

**Chantier 4 — Labels universels page séjour** — REPORTÉ (cosmétique, pas bloquant)

**Fix régression contrat PDF Sauvageon** — commit 44cc73f
- `contrat-sauvageon.pdf.tsx` restauré depuis git history, déplacé dans `backend/src/devis/`
- Branché sur `envoyerDevisDirect()` : génère le contrat PDF si `isEvenement && centre.iban`
- Contrat uploadé sur OVH Object Storage, lien inclus dans l'email au client
- Non-bloquant : si erreur PDF, l'email part sans contrat

**Fix recherche structure 3 champs** — commit f984820
- Modale création séjour DIRECT : ajout champ Code postal (grid 3 colonnes)
- Texte d'aide : "Renseignez les 3 champs pour trouver plus facilement la structure."
- `fireStructSearch(nom, ville, cp)` : query = [nom, cp, ville].join(' ')

**Architecture** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md` (source de vérité)
**10 prompts CC exécutés** : Phase 1 P1/P2, Phase 2 P1/P2, Phase 3A, Phase 3B-1/B-2, Phase final (cosmétique + Phase 4 + Phase 5)

**Concept** : L'hébergeur crée un séjour depuis son planning sans que le client ait besoin d'un compte. L'invitation à collaborer est un upgrade, pas un prérequis. Le modèle DevisLibre est migré vers le modèle unifié.

**Schema Prisma** :
- Enum `StatutSejour` : ajout `OPTION` (dates bloquées, devis en cours)
- Sejour : 11 nouveaux champs (`modeGestion` DIRECT/COLLABORATIF, `natureSejour` SEJOUR/EVENEMENT, `typeSejour`, `clientNom/Prenom/Email/Telephone/Organisation/OrganisationId`, `deletedAt` soft delete)
- Devis : `demandeId` nullable, `sejourDirectId` (lien direct sans DemandeDevis), `tokenSignature` (signature par lien)
- Relation bidirectionnelle `Sejour.devisDirect[] ↔ Devis.sejourDirect`

**Backend livré** :
- `POST /sejours/direct` — création séjour DIRECT + auto-création Client CRM + SejourClient + ActiviteClient
- `DELETE /sejours/:id` — soft delete (deletedAt) + log CRM
- `GET /collaboration/mes-sejours-planning` — séjours OPTION+CONVENTION+SIGNE_DIRECTION pour le planning
- `POST /devis/direct` — création devis sur séjour DIRECT (sans DemandeDevis)
- `POST /devis/:id/envoyer-direct` — envoi email client avec lien signature
- 4 endpoints publics `GET/POST /devis/public/:token/*` — signature sans compte (signer, direction, upload scan)
- `POST /sejours/:id/inviter-organisateur` — invite organisateur, upgrade DIRECT → COLLABORATIF
- `verifyAccess()` élargi : accepte OPTION pour hébergeur en mode DIRECT + filtre soft delete
- `accepter()` adapté : si invitation liée à séjour DIRECT → rattache createurId au lieu de créer nouveau séjour

**Frontend livré** :
- Planning : 3 couleurs (OPTION orange/violet, CONVENTION palette, indispo rouge) + légende
- Modale planning : 3 boutons (Nouveau séjour / Nouvel événement / Indisponible)
- Formulaire création séjour DIRECT avec StructureSearch (SIRENE + API EN + LIAVO)
- Page `/devis/signer/[token]` publique : PDF détail + 3 onglets signature (en ligne / direction / upload scan)
- Page `/dashboard/sejour/[id]` universelle : onglets conditionnels selon modeGestion + natureSejour
  - DIRECT : onglets Messages/Journal grisés avec CTA "Inviter l'organisateur"
  - EVENEMENT : masque Groupes/Participants/Projet
  - Label "Programme" au lieu de "Planning" pour événements
- Onglet Devis DIRECT : affichage dynamique (loading / devis existant avec lignes+montants+badge / placeholder création)
- Bouton "📨 Envoyer à {email}" + bouton "Supprimer" + bouton "Inviter l'organisateur"
- Fix cosmétique Destinataire/Objet sur page devis/nouveau en mode DIRECT
- Redirect `/devis-libre/signer/:token` → `/devis/signer/:token`

**Migration DevisLibres** :
- Script SQL PL/pgSQL : chaque DevisLibre → Séjour DIRECT (EVENEMENT) + Devis standard + lignes + versements + SejourClient
- Mapping type_evenement → typeSejour (MARIAGE/SEMINAIRE/ANNIVERSAIRE/AUTRE_EVENEMENT)
- Tables originales conservées pour vérification, code mort non supprimé (nettoyage manuel après validation)

**Taxonomie** :
- `natureSejour` : SEJOUR (collectif) | EVENEMENT (ponctuel)
- `typeSejour` (sous-types) : CLASSE_DECOUVERTE, COLONIE_VACANCES, CAMP_SPORTIF, SEJOUR_LINGUISTIQUE, AUTRE_SEJOUR | MARIAGE, ANNIVERSAIRE, SEMINAIRE, TEAM_BUILDING, REUNION_FAMILLE, AUTRE_EVENEMENT

**Flow complet testé en prod** :
Planning → Créer séjour DIRECT → Page séjour → Créer devis → Envoyer au client → Email reçu → Page publique signature → Signer → Séjour CONVENTION ✅

**Leçons retenues** :
- verifyAccess() : ne jamais modifier la logique existante, créer un branchement conditionnel (modeGestion)
- Fichier 5000 lignes (sejour/[id]/page.tsx) : modifications chirurgicales uniquement, jamais de refactoring complet dans un prompt CC
- Découper les prompts en backend/frontend séparés pour éviter les erreurs de contexte
- getMesDevis retourne tous les scalaires (dont sejourDirectId) car pas de select restrictif → filtre client-side OK
- Le soft delete (deletedAt) doit être ajouté dans CHAQUE query existante qui touche aux séjours

---

## PROSPECTS / CONTACTS ACTIFS

### Yves Massard — 3 centres (Les Gets + Bellevaux)
- **Source** : LinkedIn inbound (message 27/05/2026)
- **Profil** : RSE, Tourisme et Sensibilisation en Savoie Mont-Blanc — Facilitateur pour une Montagne de Transition
- **Centres** : 3 centres de vacances aux Gets et à Bellevaux
- **Besoin** : outil de gestion adapté aux gestionnaires de centre, plus de professionnalisme et d'efficacité
- **Statut** : RDV téléphonique à caler semaine du 02/06/2026
- **Enjeu LIAVO** : premier prospect multi-centre → force la priorisation du refactor Organisations + facturation multi-centre
- **Prépa RDV** : wireframe multi-centre + discours planning options + tarification multi-centre à définir
### Quentin Dervaux — UFCV, 120 lits, tout compris
- **Source** : LinkedIn inbound (message 27/05/2026, suite à commentaire sur post LIAVO)
- **Profil** : "Leader engagé", dirige un lieu d'hébergement 120 lits, propose du tout compris
- **Organisation** : UFCV (Union Française des Centres de Vacances) — association nationale fondée en 1907, reconnue d'utilité publique, agréée Éducation Populaire. Gère des centres partout en France (Clair Matin en Auvergne, Haut-Peyron à Saint-Raphaël, etc.). Séjours scolaires, colos, vacances adaptées, formation BAFA/BAFD. **Potentiel énorme : si Quentin adopte LIAVO pour son centre, c'est un pied dans le réseau UFCV national.**
- **Équipe** : a une coordinatrice (en congés jusqu'au ~15/06)
- **Besoin** : intéressé par LIAVO pour améliorer le quotidien de sa coordinatrice
- **Statut** : visio à caler après le 15/06/2026 (avec la coordinatrice)
- **Enjeu LIAVO** : 2ème prospect inbound. Si Quentin est satisfait → présentation au réseau UFCV = scaling national. Même logique que LMDJ/IDDJ mais à l'échelle France entière.

---

## SÉJOURS EN COURS

### Christophe Migevant — Lycée Julien Witmer Charolles
- Séjour : `440e9fd1-2a85-40fb-acd0-ffbaea35d46c`
- Devis : `ecf4635b-cdb3-47ec-8afb-4c171967b59a` — DEV-2026-003 — SELECTIONNE
- Email : Christophe.Migevant@ac-dijon.fr

### Jessy Renaudet — Collège de Loué
- Séjour ski hiver 2027, invitation envoyée à renaudet.jessy@sfr.fr

### François Croquette — Collège Lucien Herr Altkirch
- Email : francois.croquette@orange.fr
- 3 séjours hiver 2026-2027, Séjour 1 et 2 acceptés ✅

---

## ROADMAP — PRIORITÉS

### LIVRÉ SESSION 21/05/2026 ✅
- [x] **Flux direction — backend** (commit 28c372a)
- [x] **Flux direction — frontend** (commit 6b0ed53) — page publique + bouton envoi + upload scan + badge
- [x] **Droits accompagnateurs** (commit ba3a5fe) — set fixe : planning/participants/groupes/journal
- [x] **Planning hébergeur amélioré** (commit 0be730c)

### LIVRÉ SESSION 26/05/2026 ✅
- [x] **Formulaire invitation universalisé** — labels neutres + StructureSearch SIRENE (remplace API EN)
- [x] **Recherche structure 3 champs** (Nom, Ville, SIRET) dans inviter-enseignant/page.tsx
- [x] **Invitation ILEPS envoyée** — INSTITUT POLYTECHNIQUE SAINT-LOUIS, SIRET 34483642400020, Cergy (Théo BRIOT, t.briot@ileps.fr)

### LIVRÉ SESSION 27/05/2026 ✅
- [x] **Labels universels 3 PDFs** (DevisPDF, BudgetPDF, PlanningPDF) — commit 8ec73f8
- [x] **Labels universels ProjetPedagogiquePDF** — 5 remplacements (structure organisatrice, responsable du séjour, participants, programmes)
- [x] **Devis nouveau — saisie PU TTC** — commit fdfe82c — l'hébergeur saisit le TTC, le HT est calculé automatiquement via round2()
- [x] **Devis modifier — saisie PU TTC** — commit f4ea1b3 — même logique + conversion HT→TTC au chargement devis existants
- [x] **Labels universels formulaires devis** — "Séjour scolaire"→"Séjour", "élèves"→"participants" dans nouveau + modifier

### EN COURS 27/05/2026
- [x] **Labels universels ProjetPedagogiquePDF** — prompt CC Partie 2 prêt, à exécuter
- [x] **Multi-centre backend** — commit 0ee8f62 : helper getCentreForUser + dashboard-global + migration 11 services
- [x] **Multi-centre frontend** — commits 6bf0f2b + 8189f9e + dashboard global : AuthContext + intercepteur + CentreSelector + page /global
- [ ] **Conditions annulation Sauvageon** — champ conditions_annulation NULL en base → à remplir
- [ ] **Onboarding multi-centre complet** — page /centres/nouveau (recherche catalogue + claim + création manuelle) + validation admin + `POST /centres` en PENDING + inscription hébergeur libre

### PARCOURS ONBOARDING HÉBERGEUR — SPÉCIFIÉS 27/05/2026

**Parcours 1 (self-service, centres dans le catalogue)** : inscription 1er centre + claim RNA/Kbis → dashboard mono → /centres/nouveau → recherche catalogue → revendication 2ème centre + claim → validation admin → multi-centre
**Parcours 2 (self-service, mix catalogue + hors catalogue)** : idem P1 pour les centres trouvés + formulaire création manuelle pour les autres → PENDING → validation admin
**Parcours 3 (self-service, aucun centre dans le catalogue)** : inscription libre sans invitation (register/hebergeur step 1.5 → pas trouvé → formulaire manuel) → PENDING → puis /centres/nouveau pour les suivants
**Parcours 4 (accompagné par admin)** : admin crée invitation → hébergeur s'inscrit avec 1 centre → ajoute les autres depuis /centres/nouveau. OU admin crée tout + reset password.

**Briques existantes :**
- register/hebergeur : steps 1 → 1.5 (recherche catalogue) → 2 (formulaire manuel) → 3 (types). Gère invitation token cas 1/2/3.
- GET /centres/search-public : recherche catalogue
- GET /auth/sirene/:siret : lookup SIRENE
- POST /centres : création centre additionnel (statut à changer ACTIVE → PENDING)
- Schema Membership : claimStatut + champs claim en base, jamais utilisés
- registerHebergeur : crée User + Centre + Organisation + Membership PROPRIETAIRE, statut PENDING

**Briques manquantes :**
- [x] Lien "Ajouter un centre" toujours visible dans sidebar hébergeur (mono ET multi-centre)
- Page /dashboard/hebergeur/centres/nouveau (user connecté) : recherche + claim + création manuelle
- Backend endpoint revendication centre existant (rattacher centreId à userId + upload claim doc)
- Admin : liste claims en attente + approuver/refuser
- Invitation qui détecte email existant → rattache au lieu de recréer (V2)
- **Question "Combien de centres gérez-vous ?" dans le flow d'inscription** (après step 3) → si > 1, boucle ajout centres supplémentaires avant fin inscription. V2 post-stabilisation multi-centre.


### CRITIQUE — en cours
- [ ] **Badge notifications séjours : dernier kilomètre** — L'endpoint `mes-non-lus` et le tracking visites fonctionnent (Chantier 1 livré). Le badge apparaît sur "Planning" dans la sidebar mais ne mène nulle part d'utile. Il faut : (1) une page liste séjours hébergeur avec badges non-lus par séjour, (2) un item "Séjours" dans la sidebar, (3) la carte aperçu top 3 sur le dashboard, (4) déplacer le badge de "Planning" vers "Séjours". **À traiter dans le chantier global refonte page séjour / dashboard hébergeur.** En attendant le badge est visible mais l'UX est incomplète.
- [x] **Liaison Client ↔ User à l'acceptation invitation** — LIVRÉ commit 061f84d + backfill SQL
- [ ] **Notifications hébergeur sur nouveaux messages collaboratifs** : Chantier 1 livré (backend tracking + badge sidebar). **UX incomplète** : le badge sur Planning ne mène nulle part d'utile. Nécessite : page liste séjours hébergeur + item "Séjours" dans sidebar + carte aperçu dashboard. **À traiter dans le chantier global refonte dashboard.**

### Features devis
- [ ] **Devis libre sans compte** — envoi devis PDF signable à un organisateur sans compte LIAVO, lien public `/devis/[token]` avec bouton Accepter, pas d'espace collaboratif. Nécessite : rendre `demandeId` optionnel dans schema Devis OU créer DemandeDevis fantôme. Estimé 1-2 semaines. Cas d'usage : client régulier au téléphone, pas envie de créer un compte.
- [ ] **Refactoring DevisBuilder** (3 fichiers dupliqués — faire AVANT drag&drop)
- [ ] **Drag & drop lignes** (dnd-kit installé)
- [ ] **Titres de section**
- [ ] **Auto-signature organisateur** (cas colo où l'organisateur est aussi signataire)

### CHANTIER GLOBAL — Refonte page séjour + facturation + planning couleurs (identifié 28/05/2026)

**Constat** : La page séjour, le CRM et le planning sont trois silos. Pour gérer un mariage ou un séjour de bout en bout, l'hébergeur navigue entre les trois. La facturation n'existe pas côté UI (backend existe). Le planning utilise une palette de couleurs incohérente.

**Volume Sauvageon** : ~60 séjours/an (2/semaine x 30 semaines) + 35 mariages/an. L'outil doit être utilisable à ce volume.

**Parcours cible mariage** : Premier contact (CRM) → Brochure (CRM) → Visite → Création événement (planning ou CRM) → Devis + contrat PDF → Signature → Acompte → Mariage → Facture solde → Soldé. Tout doit être gérable depuis la page séjour une fois le dossier créé.

**Décisions prises :**
- **Couleurs planning = statut uniquement** (convention marché PMS). Supprimer la PALETTE 8 couleurs. Orange = option, Bleu = confirmé, Vert = acompte versé, Gris = soldé, Rouge hachures = indispo.
- **Page séjour = centre de gestion unique.** Le CRM reste la vue transversale (tous clients), pas le point de gestion d'un séjour individuel.
- **Layout événement allégé** : même page mais masque Budget/Participants/Groupes/Projet, met en avant client + devis + facturation + notes.
- **Brochure accessible depuis les deux** (CRM pour prospect sans dossier, page séjour pour client avec dossier).
- **Bouton "Nouvel événement" depuis fiche CRM** : prospect → dossier en un clic, infos pré-remplies.

**Sous-chantiers (ordre de priorité) :**
1. Facturation sur page séjour (bouton acompte/solde, versements, PDF facture) — 2-3j
2. Bouton "Nouvel événement/séjour" depuis fiche CRM — 0.5j
3. Couleurs planning par statut — 0.5j
4. Layout événement allégé + infos client éditables — 0.5j
5. Section Notes & suivi sur page séjour — 1-2j
6. Page liste séjours hébergeur + badge notifications dernier km — 1j

**Théo gère la réflexion globale avant de coder.** Ne pas commencer sans validation.

### Court terme — PRIORITÉ HAUTE
- [ ] **Planning hébergeur — options/devis en attente** : quand un devis est envoyé (EN_ATTENTE), les dates + nb personnes apparaissent au planning en mode "option" (visuellement distinct des séjours confirmés). L'hébergeur voit la capacité totale = confirmés + options. CRITIQUE pour gestion capacité multi-séjours. Données déjà en base (DemandeDevis.dateDebut/dateFin + nombreEleves). Estimé 2-3 jours. **PRIORITÉ #1 pour démo Yves Massard.**
- [ ] **Import Excel participants** : template LIAVO fixe téléchargeable (.xlsx) avec colonnes standardisées (nom, prénom, date naissance, taille, poids, pointure, allergies, régime). Organisateur remplit offline → uploade dans espace collaboratif → participants créés en base. Fallback pour organisateurs qui ne veulent pas utiliser les inscriptions en ligne. Même pattern que l'import catalogue existant. Estimé 3-4 jours.
- [ ] **Widget embeddable "Demander un devis"** : script JS/iframe que l'hébergeur colle sur son propre site web (WordPress etc). Formulaire structuré (dates, nb participants, centre préféré, thématique, email). La demande atterrit dans LIAVO comme une DemandeDevis/InvitationCollaboration. Endpoint public POST `/demandes/widget` + script embed `<script src="https://liavo.fr/widget.js" data-centre="xxx">`. Killer feature pour le pitch Yves (son formulaire contact actuel = champ libre non structuré). Estimé 3-5 jours. **Pour le RDV : montrer en wireframe, développer après.**
- [ ] **Invitations parents** → 2 parents/tuteurs par enfant
- [ ] **Bouton "Nouveau séjour pour client existant"** depuis fiche CRM
- [ ] **Opportunités CRM / liste d'attente** : quand une demande arrive pour des dates non disponibles, l'hébergeur crée une opportunité sur le client avec dates souhaitées + nb participants. Si un séjour s'annule ou un créneau se libère, LIAVO notifie l'hébergeur des contacts en attente qui matchent. Nouveau modèle `OpportuniteCRM` (clientId, centreId, dateDebutSouhaitee, dateFinSouhaitee, nombreParticipants, statut EN_ATTENTE/CONTACTE/CONVERTI/EXPIRE). Estimé 2 jours. **Use case réel Sauvageon 27/05/2026.**
- [ ] **Email prospection personnalisable depuis le CRM** : l'hébergeur envoie un email à un prospect/client avec contenu personnalisé + PJ multiples. Template éditable en direct (pas juste un envoi de brochure fixe). PJ possibles : brochure centre, dossier photos, PDF partenaires/traiteurs. Deux sous-chantiers :
  - *Template email CRM* : éditeur texte simple (pas WYSIWYG lourd), variables dynamiques (nom client, nom centre, dates), aperçu avant envoi, historique dans ActiviteClient.
  - *Documents commerciaux hébergeur* : en plus de la brochure (qui existe déjà), permettre d'uploader N documents commerciaux typés (BROCHURE, GALERIE_PHOTOS, PARTENAIRES, TARIFS, AUTRE) sur le centre. Accessibles depuis le CRM au moment de l'envoi email. Question : garder les photos sur Google Drive (lien externe) ou les intégrer dans LIAVO (OVH Object Storage) ? À discuter avec Théo.
  - Estimé 3-5 jours total. **Use case réel Sauvageon 27/05/2026 — mariage, premier contact téléphonique → envoi brochure + photos + partenaires avant visite.**
- [ ] **Bouton "Envoyer la brochure" désactivé si pas de brochure** : UX fix — griser le bouton dans le CRM avec tooltip "Uploadez votre brochure dans Profil" si brochureUrl est null. Estimé 30 min.

### Scalabilité
- [ ] **Multi-centre hébergeur** : un utilisateur hébergeur gère N centres. Dashboard unifié avec switch entre centres. Catalogue, dispos, planning par centre. Devis émis depuis un centre spécifique. Lié au refactor Organisations v3 (Organisation type ENTREPRISE → N CentreHebergement). **PROSPECT RÉEL : Yves Massard (3 centres, Les Gets + Bellevaux, RDV semaine du 02/06/2026).** Options : (A) wireframe + discours roadmap pour le RDV, (B) quick hack sélecteur centre même userId, (C) accélérer sous-chantier 1 Organisations. Recommandation : A pour le RDV, C en parallèle.

### DÉCISIONS MULTI-CENTRE — VALIDÉES 27/05/2026

| Point | Décision |
|---|---|
| Routing | Header `X-Centre-Id` + guard NestJS `getCentreForUser()`. Si header absent → findFirst (rétrocompatible mono-centre) |
| Catalogue | Per-centre + bouton "Dupliquer depuis" |
| Dispos | Per-centre |
| Annulation | Per-centre + bouton "Copier depuis" |
| CRM | Différé — hybride probable (centreId + organisationId), feedback Yves d'abord |
| Pricing | Early adopter gratuit 3 centres. Ensuite : 49€/mois premier centre (annuel) + 39€/centre supplémentaire |
| Flow inscription | Inscription 1 centre → "+ Ajouter un centre" depuis dashboard global |
| Mandat | Un seul SIRET Pôle Montagne (440246106) → un mandat par Organisation, pas par centre |

**Dashboard global multi-centre — structure validée :**
- Header : nom de l'organisation
- KPIs (4 cartes ACTIONNABLES, chaque clic → liste filtrée) :
  1. "À traiter" (orange) : demandes sans devis + devis en attente réponse. Badge urgence < 7j. Sous-texte explicatif.
  2. "À facturer" (rouge si > 0) : devis signés sans facture acompte + séjours terminés sans facture solde. Montant total.
  3. "Paiements en attente" (orange si > 0) : factures émises non totalement payées. Montant total.
  4. "Chiffre d'affaires" (vert) : encaissé + prévisionnel. Sélecteur période.
- Planning consolidé : 3 lignes (1/centre), 8 semaines, séjours + options
- Cartes centres : photo + KPIs par centre + CTA "Gérer ce centre"

**Données facturation en base :**
- Devis : statut FACTURE_ACOMPTE/FACTURE_SOLDE, estFacture, dateFacture, montantVerseTotal
- VersementPaiement : devisId + montant + datePaiement → encaissements réels
- CA encaissé = somme VersementPaiement.datePaiement sur période
- CA prévisionnel = somme (montantTTC - montantVerseTotal) des devis signés

**Implémentation : 4 prompts CC séquentiels (P1 backend, P2 AuthContext+intercepteur, P3 CentreSelector, P4 page dashboard global)**

**Pôle Montagne — audit prospect :**
- Asso loi 1901, SIREN 440246106, un seul SIRET actif (00064), Les Gets
- 3 chalets : Yaka (86p, agrément EN+DDCS), Florimont (Bellevaux, 100p), Nants (Les Gets, 70p, gestion libre possible)
- Référencé catalogue LMDJ + répertoire EN Grenoble

- [ ] **Facturation multi-centre** : un abonnement par centre ? Un abonnement entreprise couvrant N centres avec tarif dégressif ? À décider avant RDV Yves.

### Accès multi-utilisateurs hébergeur (V2 — post multi-centre)

**Profils identifiés (cas Pôle Montagne, 6 personnes) :**
- Gestionnaire (Yves) : accès total, dashboard global, tous centres, devis, facturation, CRM, paramètres
- Commercial (Thomas) : devis/demandes, CRM, planning lecture, pas facturation ni paramètres
- Opérationnel (Christelle, Mansour) : planning lecture + participants lecture (allergies, régimes, tailles). Use case Mansour = combien de couverts + régimes spéciaux cette semaine
- Pédagogique (Anne, Laure) : espace collaboratif côté hébergeur, planning activités modifiable, pas de commercial ni facturation

**Architecture cible :** MembershipCentre (user + centre + rôle + modules accessibles). Pattern existant : `ongletVisibles` des accompagnateurs.
**Timing :** V2 post-onboarding Yves. Pas au premier RDV. Mentionner en roadmap pour montrer la scalabilité.

### Tarification hébergeurs — RÉFLEXION EN COURS 27/05/2026

**Plans validés précédemment :**
- Découverte : gratuit (profil + dispo + aperçu demandes, pas de détail enseignant)
- Essentiel : 29€ HT/mois ou 290€/an
- Complet : 59€ HT/mois ou 590€/an

**Multi-centre ajouté :** 49€/mois premier centre (annuel), 39€/mois par centre supplémentaire.

**Question ouverte :** est-ce qu'on est trop cheap ? Benchmark à faire vs PMS/outils de gestion centres de vacances. Le potentiel de l'outil (devis structurés, espace collaboratif, planning, CRM, facturation Chorus Pro, multi-centre) justifie potentiellement un pricing plus élevé.
**Facturation :** per-centre, pas per-utilisateur. L'accès multi-utilisateurs est inclus dans le plan du centre.

- [ ] **Freemium hébergeur** + Stripe + Trial
- [ ] **SC7 notifications APIDAE** (suspendu)

### Intégrations
- [ ] **APIDAE LMDJ** : attente credentials Anaïtis Mangeon
- [ ] **Chorus Pro** : vérifier si getChorusXml() est stub ou fonctionnel

### V2 — Service PDF centralisé backend
- [ ] **Génération PDF côté Node** (pdfkit ou @react-pdf/renderer)
- [ ] Couvre : devis, factures acompte/solde, budget, projet pédagogique
- [ ] Use case principal : PJ email Brevo (facture→signataire/organisateur, devis signé→hébergeur)
- [ ] Permettrait export PDF côté API sans frontend
- [ ] Prérequis : refactoring DevisBuilder (extraire data structures en lib partagée)
- [ ] Estimation : 3-5j — ne pas coder avant volume suffisant de séjours

### Cohérence universelle scolaire / colos / hors-scolaire
> ⚠️ CHANTIER UX GLOBAL — Théo doit valider la logique avant chaque implémentation.
> Pattern de référence : EtapeInfos.tsx (prop estHorsScolaireUser) + appel-offres/page.tsx (sélecteur type structure étape 1).
> Objectif : toute la plateforme doit fonctionner aussi bien pour un collège, une colo asso, un CSE, ou un enseignant du supérieur.

**Livrés :**
- [x] Formulaire invitation hébergeur : labels universels + StructureSearch SIRENE (26/05/2026)
- [x] Appel d'offres / contact direct : sélecteur type structure + labels adaptatifs (existant)
- [ ] **Labels universels 4 PDFs** (DevisPDF, BudgetPDF, PlanningPDF, ProjetPedagogiquePDF) — prompts CC prêts, à exécuter

**À faire — Frontend (labels / UX) — VALIDATION THÉO REQUISE :**
- [ ] **Emails backend invitation** : "Nombre d'élèves estimé" → "Nombre de participants" / "L'enseignant que vous avez invité" → "L'organisateur" — revoir le wording de TOUS les templates emails invitation-collaboration.service.ts
- [ ] **Email notification hébergeur acceptation** : mêmes corrections
- [ ] **URL /inviter-enseignant** → décider si on renomme en /inviter-organisateur (= nouvelle route, redirects, liens CRM) ou si on garde l'URL actuelle
- [ ] **Formulaire inscription organisateur** (register/organisateur/page.tsx) : ajouter type ENSEIGNEMENT_SUPERIEUR dans TypeStructure ? Ou suffisant avec "Autre" + StructureSearch ?
- [ ] **Page /rejoindre/[token]** : vérifier que les labels sont neutres quand l'invitation vient d'une structure non-scolaire
- [ ] **Espace collaboratif sejour/[id]** : label "Nombre d'élèves" dans les infos séjour → "Nombre de participants" conditionnel
- [ ] **Devis PDF** : vérifier que le nom de structure apparaît bien (pas un champ vide quand pas d'UAI) — ✅ VÉRIFIÉ 26/05 : chaîne complète SIRENE→Organisation→Membership→getBudgetData→PDF OK. Vérification SQL ILEPS restante.
- [ ] **Page dashboard/sejour/[id]/page.tsx — labels scolaires à neutraliser** : "Établissement scolaire"→"Structure organisatrice", "Enseignant responsable"→"Responsable du séjour", "Nombre d'élèves"→"Nombre de participants", "Élèves non affectés"→"Participants non affectés", "Clôturez les inscriptions pour affecter les élèves"→ formulation neutre, "Lien avec les programmes scolaires"→"Lien avec les programmes". **À faire APRÈS les 4 PDFs pour cohérence. Fichier de ~3000 lignes — prompt CC dédié, pas en parallèle.**

**À faire — Backend (naming interne) — DETTE, PAS PRIORITAIRE :**
- [ ] Renommer champs Prisma : emailEnseignant → emailOrganisateur, nbElevesEstime → nbParticipantsEstime (migration + DTO + tous les endpoints) — **à faire seulement lors d'un chantier dédié, pas en parallèle d'autre chose**

**À faire — Cohérence colos spécifique (avant visio LMDJ) :**
- [ ] Suppression rectorat frontend + PDF dossier déclaration
- [ ] Audit libellés scolaires → génériques dans toute la nav et les dashboards

**Décisions à prendre par Théo :**
1. Est-ce qu'on ajoute un sélecteur type de structure dans le formulaire d'invitation hébergeur (comme appel d'offres étape 1) ? Si oui, on peut adapter les labels dynamiquement. Si non, labels neutres universels = solution actuelle.
2. Est-ce que ENSEIGNEMENT_SUPERIEUR doit être un type de structure à part entière dans le schema Prisma, ou "Autre" suffit ?
3. Pour les colos ACM : est-ce que l'hébergeur doit pouvoir renseigner tranche d'âge / type ACM dans l'invitation, ou c'est l'organisateur qui complète à l'inscription ?

### À investiguer — non technique
- [ ] **MBN / rectorat** : contacter cellule juridique
- [ ] **Gestionnaire François** : attendre retour validation inscriptions parents

### Dette technique secondaire
- [ ] **Supprimer tables DevisLibres en base** : `DROP TABLE lignes_devis_libre, versements_devis_libre, devis_libres CASCADE;` + retirer les 3 modèles Prisma (DevisLibre, LigneDevisLibre, VersementDevisLibre) + nettoyer `DevisLibreImpayee` dans `global/page.tsx`. Code backend/frontend déjà supprimé (Chantier 3, commit 87c7a20). Faire APRÈS confirmation que la migration est stable en prod (minimum 2 semaines).
- [ ] **Harmonisation visuelle dashboard global vs mono-centre** : divergences typo/taille/spacing entre les deux dashboards. Prompt CC dédié avec captures. À faire quand le multi-centre est fonctionnellement stable.
- [ ] DashboardShell organisateur/signataire
- [ ] Migration selects Prisma etablissement* → Organisation
- [ ] tokenAcces journal public : ajouter expiration ou nonce (risque fuite lien)
- [ ] APIDAE_IDDJ_API_KEY ?? '' : throw au démarrage si vide (admin.service.ts)
- [ ] OG tag "649 centres référencés" à supprimer (Option A validée, pas appliquée)
- [ ] JWT_SECRET=dev-secret-2024 en production → changer avant déploiement majeur

---

## LEÇONS RETENUES

- DTOs NestJS : décorateurs class-validator OBLIGATOIRES si whitelist:true global
- Routes NestJS : statiques AVANT paramétriques
- Prompts CC longs : découper en parties numérotées
- StorageService.upload(file, folder) — génère le nom de fichier automatiquement
- DevisLibre.statut : String → BROUILLON/ENVOYE/ACCEPTE/REFUSE/PAYE
- Floating point : toujours round2() avant affichage/PDF montants
- Email fromName : 4e arg optionnel sur sendGenericNotification()
- str_replace non fiable Windows → utiliser write_file
- Railway/Cloudflare R2 : RÉSILIÉS
- EmailModule @Global() → injectable partout sans import dans le module consommateur
- Prisma Json? → utiliser ?? undefined (pas ?? null)
- useSearchParams Next.js → nécessite Suspense boundary
- fire-and-forget : try/catch non-bloquant, jamais dans le chemin critique
- brochureUrl : colonne sur CentreHebergement, pas var env
- PowerShell : && non supporté → deux commandes séparées
- accompagnateurTokenPending : liaison automatique à verifyEmail (Option C)
- layout.tsx hébergeur : guard /login + sidebar ici, pas dans chaque page
- useHebergeurCounts : hook partagé pour sidebar — ne retourne que counts + centre, pas les listes complètes
- Constructeur de devis : DUPLIQUÉ 3x — refactoring DevisBuilder à faire
- Variable locale qui shadowe un state React = bug silencieux difficile à détecter
- Client.organisationId existe mais jamais rempli automatiquement — dette CRM
- Invitation acceptée ne relie pas le User au Client CRM existant — à corriger
- InvitationDirecteur : pas de @relation Prisma sur devisId → requête séparée obligatoire dans findByToken()
- Flux direction : signature non bloquante (option A), 3 chemins vers SIGNE_DIRECTION
- Facturation : hébergeur valide réception paiement (pas signataire), email auto à organisateur+signataire
- Page publique signature : utiliser fetch() pas axios (pas de JWT)
- Terminologie UI : "direction" jamais "directeur" — sauf modèle Prisma interne
- nombreEleves : sejour.placesTotales = source de vérité unique, synchronisé par updateDevis
- Audit qualité : toujours tracer la chaîne complète données→base→API→frontend avant de patcher
- select Prisma User : motDePasse UNIQUEMENT dans login/reinitialiserMotDePasse — jamais dans les retours client
- Catch silencieux sur mutations : toujours setErreur + rechargement données pour resynchroniser l'UI
- buildAuthResponse : ne jamais passer User complet — utiliser un type structurel minimal
- Saisie devis : toujours TTC en entrée, HT calculé. L'hébergeur pense en TTC. round2(puTTC / (1 + tva/100)) pour le HT.
- Conditions annulation : champ centre, fallback hardcodé si NULL. Toujours vérifier en base avant de supposer un bug.
- Tables PostgreSQL : TOUJOURS snake_case. Prisma model PascalCase ≠ nom de table. Vérifier avec la table de correspondance.
- Ne JAMAIS supprimer du code sans vérifier que toutes les fonctionnalités sont couvertes par le nouveau flux. Le contrat PDF Sauvageon (370 lignes, clauses juridiques, eIDAS) a été supprimé par erreur lors du nettoyage DevisLibres — régression critique rattrapée en session.
- Badge sidebar sans destination = UX cassée. Toujours penser le parcours clic par clic avant de coder un indicateur visuel.
- Couleurs planning : convention marché PMS = couleur par statut (pas par identité séjour). La PALETTE 8 couleurs est instable (change à chaque ajout/suppression de séjour).
- Un événement (mariage) et un séjour scolaire n'ont pas les mêmes besoins d'interface même s'ils partagent le même modèle de données. Unifier le modèle = bien, unifier l'UX = à challenger.
- Le CRM est la vue transversale (tous clients), la page séjour est le centre de gestion (un dossier). Ne pas obliger l'hébergeur à naviguer entre les deux pour gérer un même client/séjour.
- Volume Sauvageon : 60 séjours + 35 mariages/an. L'interface doit supporter ce volume sans friction.
