# LIAVO — État session dev

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Railway.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
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

---

## COMPTES ET IDs DE RÉFÉRENCE

### Compte réseau LMDJ
- Email : demo-lmdj@liavo.fr / LMDJ2026!
- reseauNom : LMDJ / reseauNomComplet : La Montagne des Juniors

### Compte hébergeur Sauvageon
- Email : resa@lesauvageon.com / Test1234!
- Centre ID : 3a710674-d580-4ffd-9d9a-f739bae82154
- Plan : COMPLET / abonnementStatut : ACTIF (mis à jour via SQL Railway)
- reseau : LMDJ ✅

### Comptes test génériques
- enseignant@test.fr / directeur@test.fr / contact@chalet-sauvageon.fr → Test1234!
- admin@sejour-jeunesse.fr → Admin2026!

---

## SESSION 02-03/04/2026 — Planning IA + Groupes + Devis

### Ce qui a été livré et déployé

**Backend :**
- Migrations planning/groupes/contraintes
- Nouveaux modèles : GroupeSejour, EleveGroupe, ContrainteCentre, ContrainteSejour
- collaboration.service.ts : CRUD groupes, proposerGroupes (algo pertinence + distribution surplus), affecterEleve, cloturerInscriptions, genererPlanningIA (Anthropic fire-and-forget + deleteMany avant insertion), getPlanningGenerationStatus
- Modèle Anthropic : `claude-sonnet-4-5`

**Frontend — pages devis (nouveau + modifier) :**
- Autocomplétion sur le champ description de chaque ligne (dès 2 caractères → suggestions catalogue → met à jour description + prix + TVA en un clic)
- Bouton "Depuis le catalogue" avec recherche inline
- Total TTC par ligne (remplace Total HT)
- SIRET pré-rempli depuis le centre en fallback (`devis.siretEntreprise ?? c.siret ?? ''`)
- Correction type DemandeInfo.centre : `siret?: string | null` ajouté
- Correction type local state `centre` dans modifier/page.tsx : `siret?: string | null` ajouté

**Frontend — espace collaboratif sejour/[id]/page.tsx :**
- Onglet Devis : PDF inline via DevisPDFInline (iframe) + bouton télécharger + lien modifier (VENUE)
- Onglet Groupes, Contraintes, Planning IA

**Algorithme groupes :**
- Algo pertinence : teste toutes les tailles t de 2 à nombreEleves/2, filtre les tailles pertinentes (diviseur ou multiple d'une capacité d'activité), choisit celle minimisant les pertes, à égalité prend la plus petite
- Distribution surplus : Math.floor + surplus ajouté au dernier groupe → 50 élèves / taille 7 = 6×7 + 1×8 ✓
- deleteMany avant insertion planning IA → régénération propre

### Fix en attente — À pousser en priorité (prompt CC prêt)

Aucun fix en attente. Tout est déployé.

---

## ROADMAP POST-DÉMO LMDJ

### Éditeur de devis — colonnes configurables (PRIORITÉ POST-DÉMO)
**Contexte :** Un hébergeur professionnel (ex. Sauvageon avec Henri) a besoin de colonnes personnalisées sur ses devis : PU HT, PU TTC, % Remise, Montant TTC, colonne TVA détaillée, régime TVA sur marge, etc. La structure de colonnes varie selon le type de prestation et le logiciel de facturation utilisé.

**Ce qui existe aujourd'hui :** Description, Quantité, PU HT, TVA%, Total TTC par ligne. C'est suffisant pour la démo.

**Ce qu'il faut construire post-démo :**
- Config des colonnes stockée par centre (JSON sur CentreHebergement ou table dédiée)
- LigneForm étendu avec champs dynamiques (remise%, PU TTC calculé, note)
- PDF DevisPDF.tsx adapté dynamiquement aux colonnes configurées
- Récapitulatif TVA par taux en bas de devis (comme Senghor : taux 10%, 20%, 0% séparés)
- Option "régime TVA sur marge" (hébergements de loisirs)
- Colonne PU TTC (= PU HT × (1 + TVA/100)) affichable en lecture seule
- Colonnes optionnelles : % Remise, Code produit, Référence interne

**Estimation :** 3-4 jours dev. À déclencher après validation commerciale post-démo.

**Référence visuelle :** Devis Sauvageon Henri (DEVIS N° I-25-05-15) = modèle cible.

### Chat IA support utilisateur (onboarding hébergeurs)
- Widget flottant sur dashboards VENUE et TEACHER
- System prompt dynamique via connecteur filesystem (toujours synchronisé avec le code réel)
- Max 500 tokens, stateless
- À faire APRÈS démo : le system prompt doit décrire les fonctionnalités finales

### Tech debt post-démo LMDJ
- Refactoring dashboards → DashboardShell (4-6j, risque moyen)
- Transaction Prisma atomique sur affecterEleve
- Supprimer encadrementParGroupe du formulaire UI catalogue

### Freemium hébergeur
- abonnementStatut existe, TODO dans findOpen() à décommenter

### Notifier centres APIDAE non inscrits
- Rate limit 7j via dernierEmailDemandeAt — après validation commerciale

---

## STACK TECHNIQUE
- Frontend : Next.js 15 / React 19 / TypeScript / Tailwind 4 → liavo.fr (Railway)
- Backend : NestJS 11 / Prisma / PostgreSQL 16 → sejour-jeunesse-production.up.railway.app
- Stockage : Cloudflare R2 (bucket liavo-uploads)
- Email : Brevo (contact@liavo.fr)
- IA : Anthropic claude-sonnet-4-5 (planning IA, futur chat support)
- Repo : theorocheloison-hash/sejour-jeunesse
- Local : C:\Users\Roche-Loison\Desktop\sejour-jeunesse

## LEÇONS RETENUES
- SQL Railway : toujours utiliser les vrais noms de tables snake_case
- Arrays Prisma : toujours { set: [...] } pour les mises à jour
- Routes NestJS : statiques AVANT paramétriques (:id)
- Fire-and-forget Anthropic : catch silencieux → vérifier le nom exact du modèle
- Modèle Anthropic correct : `claude-sonnet-4-5` (pas de date dans le string)
- Algorithme LCM groupes : algo pertinence + Math.floor + surplus sur dernier groupe
- PDF inline via iframe : OK desktop Chrome/Firefox, limité Safari mobile
- encadrementParGroupe : non pertinent pour le planning → ignorer dans tous les calculs
- Chat IA support : system prompt dynamique via filesystem = doc toujours à jour
- Autocomplétion devis : onMouseDown preventDefault() sur les boutons suggestion pour éviter que le onBlur se déclenche avant le onClick
- DemandeInfo.centre : ajouter siret si besoin de fallback côté modifier/page.tsx
