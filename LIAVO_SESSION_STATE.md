# LIAVO — État session dev
> Dernière mise à jour : 05/05/2026 — tous les chantiers pré-visio LMDJ terminés

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
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |

### Colonnes supprimées (SC8) — ne plus utiliser
- etablissement_uai, etablissement_nom, etablissement_adresse
- etablissement_ville, etablissement_email, etablissement_telephone, type_structure
→ Données portées par organisations via memberships

### InvitationHebergement — champs enrichis (SC5bis)
10 nouveaux champs : centre_existant_id, centre_precreer_*, email_envoye, email_envoye_at

### StatutDevis — valeurs actuelles
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU
(ACCEPTE et REFUSE existent dans l'enum Prisma mais ne sont plus utilisés)

### StatutSejour — valeurs actuelles
DRAFT | SUBMITTED | APPROVED | REJECTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM

### typeContexte — déduction depuis typeStructure
HORS_SCOLAIRE : MAIRIE, COLLECTIVITE_TERRITORIALE, CENTRE_LOISIRS, ASSOCIATION, COMITE_ENTREPRISE, ENTREPRISE, MICRO_ENTREPRISE
SCOLAIRE : tout le reste (défaut)

---

## REGLE ABSOLUE — VISIO LMDJ
**Tous les chantiers pré-visio sont terminés. La visio peut être calée.**

---

## REGLE ABSOLUE — PROCESS CC
**L'analyse cascade et le grep de vérification finale font partie intégrante de chaque prompt CC.**
**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**

---

## STACK TECHNIQUE

| Composant | Technologie | URL |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| BDD | PostgreSQL 17.9 | Scalingo Paris |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net |
| Emails | Brevo | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |

**Repo :** theorocheloison-hash/sejour-jeunesse
**Local :** C:\Users\Roche-Loison\Desktop\sejour-jeunesse (copie UNIQUE)
**Déploiement :** push main → Scalingo auto via CC
**Scalingo CLI :** dans PATH Windows

> URGENT : Railway + Cloudflare R2 OBSOLÈTES — résilier maintenant.

---

## COMMANDES SCALINGO

```bash
scalingo --app liavo-backend --region osc-fr1 pgsql-console
scalingo --app liavo-backend --region osc-fr1 env
scalingo --app liavo-backend --region osc-fr1 logs --lines 100
scalingo --app liavo-backend --region osc-fr1 env-set NOM_VAR=valeur
```

---

## COMPTES DE RÉFÉRENCE

| Email | Rôle | MDP |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |
| enseignant@test.fr | ORGANISATEUR | Test1234! |
| directeur@test.fr | SIGNATAIRE | Test1234! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154
INTERDIT : contact@chalet-sauvageon.fr = adresse INEXISTANTE

---

## ÉTAT DES SOUS-CHANTIERS — 05/05/2026

| SC | Nom | Statut |
|---|---|---|
| SC0 | Migration Railway → Scalingo | TERMINE |
| SC1 | Schéma Prisma + backfill Organisations/Memberships | TERMINE |
| SC1bis | findOrCreateOrganisation / helpers | TERMINE |
| SC2 | Endpoint autocomplete SIREN | TERMINE |
| SC3 | Composant StructureSearch frontend | TERMINE |
| SC4 | Refactor backend services + rôles français | TERMINE |
| SC4bis | Claim hébergeur + Kbis + validation admin | TERMINE |
| SC4ter | Flow signataire via Membership+email | TERMINE |
| SC5 | Refactor frontend dashboards + routes françaises | TERMINE |
| SC5bis | Routes d'entrée hébergeur + page claim catalogue | TERMINE |
| SC6 | Flow public catalogue + magic link | TERMINE |
| SC7 | Notification centres APIDAE non inscrits | SUSPENDU — post-visio |
| SC8 | Suppression colonnes etablissement* legacy | TERMINE |
| SC9 | SIGNE_DIRECTION dans StatutDevis | TERMINE |
| CRM | Client.organisationId + CA calculé + pipeline Kanban | TERMINE |
| HORS_SCOLAIRE | typeContexte déduit + champs ACM + formulaire bifurqué + libellés conditionnels | TERMINE |
| DECLARE_TAM | StatutSejour + route declarer-tam | TERMINE |

**TOUS LES CHANTIERS PRÉ-VISIO LMDJ SONT TERMINÉS.**

### Chantiers en cours

#### SC-TRIAL — Essai 30 jours (PRIORITAIRE)
Objectif : tout hébergeur qui s'inscrit a 30 jours d'accès complet, puis bascule en fonctionnalités Découverte.

Backend :
1. `auth.service.ts` `registerHebergeur()` : après création centre, setter `planAbonnement=COMPLET`, `abonnementStatut=ACTIF`, `abonnementActifJusquAu=now+30j`
2. Helper `getStatutAbonnement(centreId)` → `{ actif, joursRestants, plan }` — actif = ACTIF ET date non dépassée
3. `demande.service.ts` `findOpen()` : si essai expiré OU plan DECOUVERTE → masquer `enseignant.email` (null)

Frontend :
4. `/dashboard/hebergeur/page.tsx` : bannière ocre si essai actif (X jours restants + lien abonnement), bannière rouge si expiré
5. `/dashboard/hebergeur/abonnement/page.tsx` : remplacer mailto par TODO propre 'Bientôt disponible' (sera branché Stripe dans SC-STRIPE)

#### SC-STRIPE — Paiement abonnement (après SC-TRIAL)
Pré-requis : créer compte Stripe + 4 produits (Essentiel 29€/mois, 290€/an — Complet 59€/mois, 590€/an)

1. Backend : `AbonnementModule` — `POST /abonnement/checkout` → session Stripe Checkout → retourne URL
2. Backend : `POST /abonnement/webhook` → events Stripe → mise à jour `planAbonnement` + `abonnementStatut` + `abonnementActifJusquAu`
3. Frontend : `handleUpgrade` appelle API checkout → redirect Stripe
4. Portail client Stripe pour gérer/résilier

### Chantiers suspendus post-visio
- SC7 : notifications APIDAE (prompt CC prêt)
- Refactoring DashboardShell (teacher/director/venue → composant unique)
- JWT httpOnly cookie migration
- Chorus Pro production (habilitation AIFE)
- Intégration APIDAE LMDJ (1 ligne dès réception credentials)
- Flow complet TAM (formulaire déclaration, documents)
- Backfill Client.organisationId pour 270 clients Sauvageon
- RC Pro Hiscox (~500-700€/an)
- Résilier Railway + Cloudflare R2

---

## LEÇONS RETENUES

- SQL Scalingo : noms de tables snake_case
- Arrays Prisma : toujours { set: [...] }
- Routes NestJS : statiques AVANT paramétriques
- SC4ter : getAllSejoursSignataire() via Membership + InvitationDirecteur.emailDirecteur (pas de FK userId)
- SC9 : StatutDevis et typeDocument sont deux axes indépendants — ne pas les fusionner
- CRM : Client.statut est un String libre, pas l'enum StatutRelation
- typeContexte : déduire depuis typeStructure — jamais hardcoder SCOLAIRE
- Process CC : analyse cascade + grep vérification = obligatoires
- Git : commit par passe thématique via CC, PowerShell = SQL uniquement
- Railway : OBSOLÈTE depuis 29/04 — ignorer les emails de crash
