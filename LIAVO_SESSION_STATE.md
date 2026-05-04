# LIAVO — État session dev
> Dernière mise à jour : 04/05/2026 (session complète — post-SC8, SC5bis, audit bugs)

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

## RÈGLE ABSOLUE — VISIO LMDJ
**Aucune visio LMDJ, aucun onboarding tant que le refactor complet n'est pas finalisé (intégralité de ARCHITECTURE_ORGANISATIONS.md). Si LMDJ voit des incohérences lors de la visio, pas de signature. L'objectif de la visio = valider leur volonté d'intégrer leurs centres — ils doivent voir un outil fini.**

---

## RÈGLE ABSOLUE — PROCESS CC
**L'analyse cascade et le grep de vérification finale font partie intégrante de la conception de chaque prompt CC — pas une étape optionnelle. Chaque prompt CC doit inclure : npx tsc --noEmit + grep des patterns à risque (URLs obsolètes, imports cassés, etc.).**

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
| IA | Anthropic claude-sonnet-4-5 | planning IA, futur chat support |

**Repo :** `theorocheloison-hash/sejour-jeunesse`
**Local :** `C:\Users\Roche-Loison\Desktop\sejour-jeunesse` (copie UNIQUE)
**Déploiement :** push main → Scalingo auto (backend + frontend) via CC
**Procfile backend :** `web: npx prisma migrate deploy && npm run start:prod`
**Scalingo CLI :** dans PATH Windows — taper `scalingo` directement
**GitHub auth :** OAuth via Git Credential Manager. Ne JAMAIS hardcoder de token dans .git/config.

> ⚠️ Railway et Cloudflare R2 = OBSOLÈTES. À résilier (délai 1 semaine post-migration 29/04 — soit ~06/05).

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

### Compte réseau LMDJ
- Email : demo-lmdj@liavo.fr / LMDJ2026!
- reseauNom : LMDJ / reseauNomComplet : La Montagne des Juniors

### Compte hébergeur Sauvageon
- Email : resa@lesauvageon.com / Test1234!
- Centre ID : 3a710674-d580-4ffd-9d9a-f739bae82154
- Plan : COMPLET / abonnementStatut : ACTIF
- reseau : LMDJ ✅

### Comptes test génériques
- enseignant@test.fr / directeur@test.fr → Test1234!
- contact@liavo.fr (ADMIN) → Admin2026!

> ⚠️ contact@chalet-sauvageon.fr = adresse INEXISTANTE. Ne jamais utiliser.

---

## ÉTAT DES SOUS-CHANTIERS — 04/05/2026

| SC | Nom | Statut |
|---|---|---|
| SC0 | Migration Railway → Scalingo (souveraineté France) | ✅ TERMINÉ |
| SC1 | Schéma Prisma + backfill Organisations/Memberships | ✅ TERMINÉ |
| SC1bis | findOrCreateOrganisation / findOrCreateMembership / helpers | ✅ TERMINÉ |
| SC2 | Endpoint autocomplete SIREN | ✅ TERMINÉ |
| SC3 | Composant `<StructureSearch>` frontend | ✅ TERMINÉ |
| SC4 | Refactor backend services + rôles français | ✅ TERMINÉ |
| SC4bis | Claim hébergeur + Kbis + validation admin | ✅ TERMINÉ |
| SC4ter | Flow invitation signataire + visibilité séjours signataire | ⚠️ PARTIEL — getAllSejoursSignataire() à adapter via Membership |
| SC5 | Refactor frontend dashboards + routes françaises | ✅ TERMINÉ |
| SC5bis | Routes d'entrée hébergeur (6 routes) + page claim catalogue | 🔄 EN COURS — page /centre/[id]/claim manquante |
| SC6 | Flow public catalogue + magic link + appel d'offres | ✅ TERMINÉ |
| SC7 | Notification centres APIDAE non inscrits | ⏸ SUSPENDU — validation commerciale LMDJ/IDDJ |
| SC8 | Suppression colonnes etablissement* legacy sur User | ✅ TERMINÉ — déployé prod 04/05 |
| SC9 | Refactor StatutDevis — cycle de vie cohérent BDD | ❌ À FAIRE — après SC4ter |

### Prochains chantiers dans l'ordre (avant visio LMDJ)
1. **SC5bis /centre/[id]/claim** — page claim catalogue (Routes 3b/5)
2. **SC4ter complétion** — `getAllSejoursSignataire()` via Membership + `InvitationCollaboration.organisationCibleId`
3. **SC9** — `StatutDevis` étendu (`SIGNE_DIRECTION`, `FACTURE_ACOMPTE`, `FACTURE_SOLDE`) + backfill + simplification `matchesOnglet()`
4. **CRM legacy** — migration `Client`/`ContactClient`/`Rappel` → `RelationCommerciale`
5. **`typeContexte HORS_SCOLAIRE`** dans `soumettreDemandePublique()` — hardcodé SCOLAIRE
6. **`DECLARE_TAM`** dans `StatutSejour` — flow colo non implémenté

---

## BUGS CORRIGÉS CETTE SESSION (04/05/2026)
11 corrections déployées en prod (commit 4925557) :
- `/register/venue` → `/register/hebergeur` (invitation-collaboration, hebergements.service)
- `/dashboard/venue` → `/dashboard/hebergeur` (email.service ×2, notifications.service)
- `/dashboard/venue/demandes` → `/dashboard/hebergeur/demandes` (invitation-collaboration, email.service)
- `/dashboard/rector` → `/dashboard/autorite` (email.service)
- `/dashboard/hebergeur/devis` corrigé (devis.service)
- Guard `soumettreAuRectorat()` : `&&` → `||`
- Filtre géographique notifications : 54 emails → centres de la bonne zone uniquement

---

## LEÇONS RETENUES

- **SQL Scalingo** : toujours utiliser les vrais noms de tables snake_case
- **Arrays Prisma** : toujours `{ set: [...] }` pour les mises à jour
- **Routes NestJS** : statiques AVANT paramétriques (:id)
- **Modèle Anthropic correct** : `claude-sonnet-4-5` (pas de date dans le string)
- **Algorithme groupes** : algo pertinence + Math.floor + surplus sur dernier groupe
- **PDF inline via iframe** : OK desktop Chrome/Firefox, limité Safari mobile
- **Autocomplétion devis** : `onMouseDown preventDefault()` sur les boutons suggestion
- **SC8** : getOrganisationPrincipale() = helper central — jamais accès direct User.etablissement*
- **SC5bis** : checkInvitation() retourne `cas: 1|2|3` — toujours lire ce champ avant bifurcation
- **Matching APIDAE** : 2 passes — email d'abord, fallback nom+ville insensitive
- **searchPublic()** : retourne `_source: 'BASE' | 'API_EN'` — les ids API_EN sont des strings non-UUID
- **Bugs URLs** : grep systématique `/register/venue`, `/dashboard/venue`, `/dashboard/rector` dans chaque passe
- **Process CC** : analyse cascade + grep vérification = obligatoires dans chaque prompt
- **Git** : commit par passe thématique via CC, PowerShell = SQL uniquement
