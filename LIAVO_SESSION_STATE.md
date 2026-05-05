# LIAVO — État session dev
> Dernière mise à jour : 05/05/2026 (SC4ter + SC9 terminés)

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

### Colonnes supprimées (SC8 — 04/05/2026) — ne plus utiliser
Les colonnes suivantes n'existent plus sur `utilisateurs` :
- etablissement_uai, etablissement_nom, etablissement_adresse
- etablissement_ville, etablissement_email, etablissement_telephone, type_structure
→ Données portées par `organisations` via `memberships`

### InvitationHebergement — champs enrichis (SC5bis — 04/05/2026)
10 nouveaux champs sur `invitations_hebergement` :
- centre_existant_id (FK → centres_hebergement, nullable)
- centre_precreer_nom, centre_precreer_adresse, centre_precreer_ville
- centre_precreer_code_postal, centre_precreer_capacite, centre_precreer_siret
- centre_precreer_departement, email_envoye, email_envoye_at

---

## REGLE ABSOLUE — VISIO LMDJ
**Aucune visio LMDJ, aucun onboarding tant que le refactor complet n'est pas finalisé. Si LMDJ voit des incohérences lors de la visio, pas de signature.**

---

## REGLE ABSOLUE — PROCESS CC
**L'analyse cascade et le grep de vérification finale font partie intégrante de la conception de chaque prompt CC — pas une étape optionnelle. Chaque prompt CC doit inclure : npx tsc --noEmit + grep des patterns à risque.**

**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**

---

## STACK TECHNIQUE — ÉTAT ACTUEL

| Composant | Technologie | URL / Détail |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| Base de données | PostgreSQL 17.9 | Scalingo Paris, managé |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net, bucket liavo-uploads |
| Emails | Brevo | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |

**Repo :** `theorocheloison-hash/sejour-jeunesse`
**Local :** `C:\Users\Roche-Loison\Desktop\sejour-jeunesse` (copie UNIQUE)
**Déploiement :** push main → Scalingo auto (backend + frontend) via CC
**Procfile backend :** `web: npx prisma migrate deploy && npm run start:prod`
**Scalingo CLI :** dans PATH Windows — taper `scalingo` directement

> URGENT : Railway et Cloudflare R2 = OBSOLÈTES. Résilier maintenant (deadline dépassée ~06/05).

---

## COMMANDES SCALINGO FRÉQUENTES

```bash
# Console SQL (PowerShell uniquement)
scalingo --app liavo-backend --region osc-fr1 pgsql-console

# Variables d'env
scalingo --app liavo-backend --region osc-fr1 env

# Logs
scalingo --app liavo-backend --region osc-fr1 logs --lines 100

# Changer une variable
scalingo --app liavo-backend --region osc-fr1 env-set NOM_VAR=valeur
```

---

## COMPTES ET IDs DE RÉFÉRENCE

| Email | Rôle | Mot de passe |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |
| enseignant@test.fr | ORGANISATEUR | Test1234! |
| directeur@test.fr | SIGNATAIRE | Test1234! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154

> INTERDIT : contact@chalet-sauvageon.fr = adresse INEXISTANTE.

---

## ÉTAT DES SOUS-CHANTIERS — 05/05/2026

| SC | Nom | Statut |
|---|---|---|
| SC0 | Migration Railway → Scalingo | TERMINE |
| SC1 | Schéma Prisma + backfill Organisations/Memberships | TERMINE |
| SC1bis | findOrCreateOrganisation / findOrCreateMembership / helpers | TERMINE |
| SC2 | Endpoint autocomplete SIREN | TERMINE |
| SC3 | Composant StructureSearch frontend | TERMINE |
| SC4 | Refactor backend services + rôles français | TERMINE |
| SC4bis | Claim hébergeur + Kbis + validation admin | TERMINE |
| SC4ter | Flow invitation signataire + visibilité séjours signataire | TERMINE — getAllSejoursSignataire() via Membership+email, champs etablissement* supprimés |
| SC5 | Refactor frontend dashboards + routes françaises | TERMINE |
| SC5bis | Routes d'entrée hébergeur (6 routes) + page claim catalogue | TERMINE — /centre/[id]/claim livré 04/05 |
| SC6 | Flow public catalogue + magic link + appel d'offres | TERMINE |
| SC7 | Notification centres APIDAE non inscrits | SUSPENDU — validation commerciale LMDJ/IDDJ |
| SC8 | Suppression colonnes etablissement* legacy sur User | TERMINE |
| SC9 | Refactor StatutDevis — cycle de vie cohérent BDD | TERMINE — SIGNE_DIRECTION ajouté, guards facturerAcompte/Solde, champs etablissement* supprimés devis.ts |

### Prochains chantiers dans l'ordre (avant visio LMDJ)
1. **CRM legacy** — migration `Client`/`ContactClient`/`Rappel` → `RelationCommerciale`
2. **`typeContexte HORS_SCOLAIRE`** dans `soumettreDemandePublique()` — hardcodé SCOLAIRE
3. **`DECLARE_TAM`** dans `StatutSejour` — flow colo non implémenté

---

## LEÇONS RETENUES

- **SQL Scalingo** : toujours utiliser les vrais noms de tables snake_case
- **Arrays Prisma** : toujours `{ set: [...] }` pour les mises à jour
- **Routes NestJS** : statiques AVANT paramétriques (:id)
- **SC8** : getOrganisationPrincipale() = helper central
- **SC5bis** : checkInvitation() retourne `cas: 1|2|3`
- **Matching APIDAE** : 2 passes — email d'abord, fallback nom+ville insensitive
- **searchPublic()** : retourne `_source: 'BASE' | 'API_EN'`
- **SC4ter** : getAllSejoursSignataire() — Source 1 via Membership, Source 2 via InvitationDirecteur.emailDirecteur (pas de FK userId)
- **SC9** : StatutDevis = EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU. typeDocument ('DEVIS'|'FACTURE_ACOMPTE'|'FACTURE_SOLDE') reste séparé — ne pas fusionner les deux
- **Bugs URLs** : grep systématique `/register/venue`, `/dashboard/venue`, `/dashboard/rector` dans chaque passe
- **Process CC** : analyse cascade + grep vérification = obligatoires dans chaque prompt
- **Git** : commit par passe thématique via CC, PowerShell = SQL uniquement
- **Railway** : OBSOLÈTE depuis 29/04 — ignorer les emails de crash
