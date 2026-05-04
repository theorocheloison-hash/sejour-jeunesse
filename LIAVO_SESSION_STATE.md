# LIAVO — État session dev
> Dernière mise à jour : 04/05/2026 (post-SC8)

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
| Organisation              | organisations                   |
| Membership                | memberships                     |
| CentreHebergement         | centres_hebergement             |
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
| ContrainteCentre          | contraintes_centre              |
| ContrainteSejour          | contraintes_sejour              |
| DocumentSejour            | documents_sejour                |
| AutorisationParentale     | autorisations_parentales        |
| AccompagnateurMission     | accompagnateurs_missions        |
| InvitationHebergement     | invitations_hebergement         |
| Client                    | clients                         |
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |

### Colonnes clés fréquemment utilisées (snake_case en SQL)
- ProduitCatalogue.capaciteParGroupe → capacite_par_groupe
- ProduitCatalogue.simultaneitePossible → simultaneite_possible
- ProduitCatalogue.dureeMinutes → duree_minutes
- Sejour.inscriptionsCloturees → inscriptions_cloturees
- GroupeSejour.sejourId → sejour_id
- EleveGroupe.autorisationId → autorisation_id

### Colonnes supprimées (SC8 — 04/05/2026) — ne plus utiliser
Les colonnes suivantes n'existent plus sur `utilisateurs` :
- etablissement_uai, etablissement_nom, etablissement_adresse
- etablissement_ville, etablissement_email, etablissement_telephone, type_structure
→ Données portées par `organisations` via `memberships`

---

## RÈGLE ABSOLUE — VISIO LMDJ
**Aucune visio LMDJ, aucun onboarding tant que le refactor complet n’est pas finalisé (intégralité de ARCHITECTURE_ORGANISATIONS.md). Si LMDJ voit des incohérences lors de la visio, pas de signature. L’objectif de la visio = valider leur volonté d’intégrer leurs centres — ils doivent voir un outil fini.**

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
**Déploiement :** push main → Scalingo auto (backend + frontend)
**Procfile backend :** `web: npx prisma migrate deploy && npm run start:prod`
**Scalingo CLI :** `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**GitHub auth :** OAuth via Git Credential Manager. Ne JAMAIS hardcoder de token dans .git/config.

> ⚠️ Railway et Cloudflare R2 sont OBSOLÈTES. Ne plus utiliser ces références.
> À résilier dès que Scalingo+OVH est stable (1 semaine minimum après migration 29/04).

---

## COMMANDES SCALINGO FRÉQUENTES

```bash
# Console SQL
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

## ÉTAT DES SOUS-CHANTIERS

| SC | Nom | Statut |
|---|---|---|
| SC4 | Refactor backend services + routes françaises | ✅ TERMINÉ (passe A+B) |
| SC5 | Refactor frontend dashboards + StructureSearch | 🔄 PARTIEL (SC3 composant créé, SC5 non commencé) |
| SC6 | Flow public catalogue + magic link + appel d'offres | ✅ TERMINÉ |
| SC7 | Notification centres APIDAE non inscrits | ⏸ SUSPENDU — validation commerciale LMDJ/IDDJ |
| SC8 | Suppression colonnes etablissement* legacy sur User | ✅ CODE TERMINÉ — ⚠️ EN ATTENTE COMMIT+PUSH |

### SC8 — À déployer en premier
**Build backend :** exit 0, 0 erreur TypeScript ✅
**Build frontend :** exit 0 ✅
**Migration SQL :** prête dans `migrations/20260504_sc8_drop_etablissement_columns/migration.sql`
**Action requise :**
```bash
cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse
git add -A
git commit -m "SC8 : suppression colonnes etablissement* legacy sur User"
git push origin main
```
Puis vérifier en prod :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'utilisateurs'
AND column_name LIKE 'etablissement%';
-- doit retourner 0 lignes
```

---

## ROADMAP POST-DÉMO LMDJ (ne déclencher qu'après validation commerciale)

### Priorité 1 — Visio suivi LMDJ
- Résultat démo 28/04 : LMDJ intéressée, IDDJ attentiste (CA à consulter)
- Adapter le pitch : LIAVO = couche post-mise-en-relation. L'hébergeur invite l'enseignant.
- Isabelle/Marie conservent leur rôle de mise en relation. Dashboard réseau = visibilité post-dispatch.
- Tagline pitch : "La plateforme développée par les hébergeurs, pour les hébergeurs."

### Priorité 2 — Sécurité
- JWT_SECRET=dev-secret-2024 encore en prod Scalingo → **à changer avant tout déploiement sensible**
  ```bash
  scalingo --app liavo-backend --region osc-fr1 env-set JWT_SECRET=$(openssl rand -hex 32)
  ```

### Fonctionnalités post-démo
- **Éditeur de devis colonnes configurables** : 3-4j dev. Config colonnes par centre (JSON), PDF dynamique, récapitulatif TVA par taux.
- **Notification centres APIDAE non inscrits** (SC7) : rate limit 7j via `dernierEmailDemandeAt`. Prompt CC préparé.
- **Freemium hébergeur** : infrastructure abonnementStatut en place, TODO dans findOpen() à décommenter.
- **Refactoring DashboardShell** : 4-6j, risque moyen. Après validation commerciale.
- **Chorus Pro production** : finaliser habilitation AIFE, créer ChorusProService NestJS.
- **Intégration APIDAE LMDJ** : une ligne dans syncApidae() une fois credentials reçus.
- **RC Pro** : ~500-700€/an Hiscox, différé post-démo.

---

## LEÇONS RETENUES

- **SQL Scalingo** : toujours utiliser les vrais noms de tables snake_case
- **Arrays Prisma** : toujours `{ set: [...] }` pour les mises à jour
- **Routes NestJS** : statiques AVANT paramétriques (:id)
- **Fire-and-forget Anthropic** : catch silencieux → vérifier le nom exact du modèle
- **Modèle Anthropic correct** : `claude-sonnet-4-5` (pas de date dans le string)
- **Algorithme groupes** : algo pertinence + Math.floor + surplus sur dernier groupe
- **PDF inline via iframe** : OK desktop Chrome/Firefox, limité Safari mobile
- **encadrementParGroupe** : non pertinent pour le planning → ignorer dans tous les calculs
- **Autocomplétion devis** : `onMouseDown preventDefault()` sur les boutons suggestion (évite onBlur avant onClick)
- **DemandeInfo.centre** : ajouter `siret?: string | null` si besoin de fallback côté modifier/page.tsx
- **SC8** : getOrganisationPrincipale() = helper central — toujours passer par lui, jamais accès direct User.etablissement*
- **str_replace non fiable sur Windows** → utiliser write_file ou edit_file
- **Infographies LinkedIn underperform** vs posts texte (203 impressions S3 vs 52 réactions S1)
