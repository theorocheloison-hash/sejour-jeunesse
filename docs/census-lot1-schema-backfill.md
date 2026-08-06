# Census/Design Lot 1 — schéma + backfill « abonnement porté par l'Organisation »

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier modifié, aucune migration écrite ni appliquée, SQL prod en SELECT count uniquement. Code au commit `cc7945c`. Ce document CONÇOIT la migration du Lot 1 ; il ne l'écrit pas.

---

## 1. Le miroir à répliquer — champs abonnement de `CentreHebergement` (schema.prisma:596-605)

| Champ Prisma | Ligne | Colonne SQL | Type SQL | Default | Nullable |
|---|---|---|---|---|---|
| `abonnement` | :596 | `abonnement` | `"TypeAbonnement"` (enum) | — | OUI |
| `abonnementActifJusquAu` | :597 | `abonnement_actif_jusqua` | `DATE` (`@db.Date`) | — | OUI |
| `abonnementStatut` | :598 | `abonnement_statut` | `"StatutAbonnement"` (enum) | `'INACTIF'` | NON |
| `planAbonnement` | :599 | `plan_abonnement` | `"PlanAbonnement"` (enum) | `'DECOUVERTE'` | NON |
| `mollieCustomerId` | :600 | `mollie_customer_id` | `VARCHAR(50)` | — | OUI |
| `mollieSubscriptionId` | :601 | `mollie_subscription_id` | `VARCHAR(50)` | — | OUI |
| `mollieMandatId` | :602 | `mollie_mandat_id` | `VARCHAR(50)` | — | OUI |
| `trialStartedAt` | :603 | `trial_started_at` | `TIMESTAMP(3)` | — | OUI |
| `dernierEmailAlerteAt` | :604 | `dernier_email_alerte_at` | `TIMESTAMP(3)` | — | OUI |
| `modePaiement` | :605 | `mode_paiement` | `"ModePaiement"` (enum) | — | OUI |

**Enums (définitions complètes)** — les 4 types PostgreSQL existent déjà, AUCUN `CREATE TYPE` à faire :
- `TypeAbonnement` (schema:502-505) : `MENSUEL | ANNUEL`.
- `StatutAbonnement` (schema:510-514) : `INACTIF | ACTIF | SUSPENDU`. Nom PG confirmé : `CREATE TYPE "StatutAbonnement"` (migration `20260304112135_add_abonnement_demandes_devis/migration.sql:5`, colonne :16).
- `PlanAbonnement` (schema:516-521) : `DECOUVERTE | ESSENTIEL | COMPLET | PILOTAGE`. Nom PG confirmé (migration `20260402_add_plan_abonnement/migration.sql:5`).
- `ModePaiement` (schema:525-528) : `MOLLIE | VIREMENT`. Nom PG confirmé (`20260708_add_mode_paiement/migration.sql:2,5`).
- Les colonnes `mollie_*` VARCHAR(50) confirmées par `20260625_add_pilotage_mollie/migration.sql:6`.
- ⚠️ Seul `"TypeAbonnement"` n'a pas été revu dans un fichier de migration (antérieur) — **vérifier via `\dT` en Phase 2** avant d'écrire le SQL (attendu : `"TypeAbonnement"`, casse Pascal quotée comme les 3 autres).

## 2. `Organisation` actuelle (schema.prisma:1544-1579)

Champs existants : `id, siren, siret, rna, uai, nom, raisonSociale, adresse, codePostal, ville, departement, emailContact, telephoneContact, siteWeb, typeStructure, academie, source, sourceId, createdAt, updatedAt` + relations (`memberships, centresHebergement, clients, relationsCliente, relationsHebergeur, invitationsDirecteur`). **Aucune collision** avec les 10 noms du §1 — le miroir s'ajoute tel quel. Table `organisations` (schema:1578).

## 3. Les deux tables à re-parenter

**`FactureLiavo`** (schema:676-696) — table `factures_liavo` : `id, centreId (@db.Uuid, NOT NULL), numero (@unique VarChar(20)), dateEmission, montantHT/TVA/TTC (Int, centimes), description, planAbonnement (VarChar(20) — un VARCHAR, PAS l'enum, cf. `20260625_add_facture_liavo/migration.sql:13`), typeAbonnement (VarChar(20)), molliePaymentId (VarChar(50)), pdfUrl, createdAt`. FK : `centre … onDelete: Cascade` (schema:691) — **supprimer un centre supprime ses factures LIAVO**, indéfendable légalement. Index `[centreId]`, `[dateEmission]` (schema:693-694).

**`AcceptationCgv`** (schema:698-711) — table `acceptations_cgv` : `id, centreId (NOT NULL), userId (NOT NULL), plan, frequence, ipAddress, acceptedAt`. FKs `centre` et `user` **sans `onDelete` explicite** (schema:707-708) → défaut Prisma pour une relation requise = `Restrict` (la suppression du centre est déjà bloquée par une acceptation — comportement sain, à conserver).

## 4. Convention de migration du repo — ⚠️ le cadrage de ce prompt est PÉRIMÉ sur un point

**État des lieux vérifié** :
- `prisma/migrations/` = migrations Prisma standard : dossier `<YYYYMMDDHHMMSS>_nom/` contenant **exactement** `migration.sql` (8 dernières : de `20260718120000_multi_photos_catalogue` à `20260805193821_backfill_demande_directe_option`). SQL écrit **à la main** (jamais `prisma migrate dev`), y compris les backfills UPDATE dans le même fichier (ex. `20260731140000_relance_hebergeur_at` : ALTER + UPDATE ; `20260805193821` : UPDATE pur).
- `prisma/manual-migrations/` = **1 seul fichier legacy** (`planning-groupes-m2m.sql`, session 07/07) — **ce n'est PAS la convention** (LIAVO_SESSION_STATE.md:173). Ne rien y mettre.
- Interdits : sous-dossier non standard dans `migrations/` (P3015 au boot, incident 07/07, SESSION_STATE:625-628) ; `BEGIN;`/`COMMIT;` dans un `migration.sql` (Prisma enveloppe déjà chaque migration dans sa propre transaction, SESSION_STATE:173).
- Procfile : `web: npx prisma migrate deploy && npm run start:prod` — les migrations committées s'appliquent **automatiquement au boot Scalingo, AVANT le démarrage du nouveau code**.

**Comment `_prisma_migrations` est renseignée : on ne la touche JAMAIS à la main.** `prisma migrate deploy` applique chaque dossier absent de `_prisma_migrations` et l'y enregistre lui-même. **La règle « exécuter le SQL en prod à la main AVANT le push » (décision §9 du 07/07) a été invalidée le 31/07** (LIAVO_SESSION_STATE.md:6) : appliquer le SQL à la main d'abord ferait planter le boot suivant (« column already exists ») puisque `migrate deploy` rejouerait une migration non enregistrée. `_prisma_migrations` est propre (aucun drift constaté au 31/07).

**Recette exacte pour la Phase 2** :
1. Créer `backend/prisma/migrations/<timestamp>_abonnement_organisation/migration.sql` (SQL manuel, additive, sans BEGIN/COMMIT).
2. Éditer `schema.prisma` dans le **même commit** (les `@map` doivent correspondre exactement aux colonnes du SQL).
3. Gates locaux : `npx tsc --noEmit` backend + frontend, `npm run build` (fait `prisma generate`), `npm test`.
4. **Ne PAS exécuter le SQL en prod à la main.** Commit + push (après confirmation Théo) → le boot Scalingo applique la migration seule, l'enregistre dans `_prisma_migrations`, puis démarre le code qui la suppose.
5. Vérifier les logs Scalingo (« migration applied ») + SELECT de contrôle post-deploy.

## 5. Colonnes à ajouter sur `organisations` (proposition — toutes additives, aucun DROP, aucun NOT NULL sans DEFAULT)

| Colonne | Type SQL | Default | Nullable | Remarque |
|---|---|---|---|---|
| `abonnement` | `"TypeAbonnement"` | — | OUI | fréquence MENSUEL/ANNUEL |
| `abonnement_statut` | `"StatutAbonnement"` | `'INACTIF'` | NON (safe : NOT NULL + DEFAULT) | miroir exact du centre |
| `abonnement_actif_jusqua` | `DATE` | — | OUI | |
| `plan_abonnement` | `"PlanAbonnement"` | `'DECOUVERTE'` | NON (safe : NOT NULL + DEFAULT) | |
| `mollie_customer_id` | `VARCHAR(50)` | — | OUI | envisager `UNIQUE` (résolution webhook par customerId → 1 org) — index unique partiel possible plus tard, pas bloquant Lot 1 |
| `mollie_subscription_id` | `VARCHAR(50)` | — | OUI | |
| `mollie_mandat_id` | `VARCHAR(50)` | — | OUI | |
| `trial_started_at` | `TIMESTAMP(3)` | — | OUI | (si décision Q4 = trial reste par user, la colonne sert quand même de cache d'affichage — à trancher avant Phase 2, sinon l'omettre) |
| `dernier_email_alerte_at` | `TIMESTAMP(3)` | — | OUI | tampon anti-répétition du cron |
| `mode_paiement` | `"ModePaiement"` | — | OUI | |

Côté `schema.prisma` : mêmes noms/décorateurs que sur `CentreHebergement` (`@map`, `@db.Date`, `@db.VarChar(50)`), ajoutés au modèle `Organisation`. Les colonnes des centres **ne sont PAS supprimées au Lot 1** (double-lecture possible pendant la transition ; leur dépréciation est un lot ultérieur).

## 6. Règle de backfill centre → organisation (déterministe)

**Principe : 1 centre « référence » par organisation, choisi par un classement total ; on copie TOUT l'état de ce centre** (pas de mélange champ par champ, sauf les deux exceptions notées). Périmètre : organisations ayant ≥ 1 centre avec `organisation_id` non null (toutes en prod : 0 orphelin, SUSPENDED compris — census Lot 0).

Classement (SQL type `DISTINCT ON (organisation_id) … ORDER BY organisation_id, <rangs>`), du plus prioritaire au moins :
1. `mollie_mandat_id IS NOT NULL` d'abord — un centre réellement abonné Mollie fait toujours foi (0 en prod, mais la règle doit exister) ;
2. `mode_paiement = 'VIREMENT'` ensuite — client payé manuellement (Choucas) ;
3. **plan le plus avancé** : `PILOTAGE > COMPLET > ESSENTIEL > DECOUVERTE` (CASE → rang) ;
4. **`abonnement_actif_jusqua` la plus lointaine** (`DESC NULLS LAST`) ;
5. `statut <> 'SUSPENDED'` avant SUSPENDED (un centre suspendu ne fait foi qu'à défaut d'autre) ;
6. `created_at ASC` puis `id ASC` — départage final, déterminisme absolu.

Exceptions au « tout copier depuis la référence » :
- **`mollie_*`** : rien à copier en prod (**0 mandat**, vérifié au census initial) — le SQL peut les copier quand même (ils sont NULL), aucun cas divergent possible.
- **`dernier_email_alerte_at`** : prendre le **`MAX()` sur tous les centres de l'org**, pas la valeur de la référence. Tranché : le laisser NULL serait *presque* inoffensif (une ré-alerte unique par palier du cron — un doublon d'email, pas un prélèvement), mais le MAX coûte une sous-requête et supprime totalement le risque de spam au premier cron post-migration. → **MAX**.

**Cas divergent multi-centres** : n'existe pas en prod (les 2 orgs multi — Pôle Montagne, PULSE SPORTS CAMPUS — ont leurs 2 centres strictement alignés, PILOTAGE/ACTIF/même trial, vérifié au census initial), mais la règle ci-dessus le couvre sans planter : le classement est total, un seul centre gagne, le résultat est rejouable à l'identique. Ajouter au SQL de Phase 2 un **SELECT de contrôle pré-backfill** listant les orgs dont les centres divergent (comparaison des tuples plan/statut/expiration) — attendu : 0 ligne ; si > 0, s'arrêter et arbitrer.

## 7. FactureLiavo + AcceptationCgv : re-parentage

**Volumes prod : le re-parentage est À BLANC** (cf. §8 — 0 facture, 0 acceptation). On conçoit pour l'avenir, on ne migre aucune donnée.

- **`factures_liavo`** : ajouter `organisation_id UUID NULL` + FK vers `organisations(id)` + index ; backfill `organisation_id = (SELECT organisation_id FROM centres_hebergement WHERE id = centre_id)` — no-op aujourd'hui (0 ligne).
  **`onDelete` — recommandation** : le vrai destinataire légal de la facture devient l'organisation → **FK `organisation_id … ON DELETE RESTRICT`** (une organisation qui a des factures LIAVO ne doit pas être supprimable — la facture doit survivre ET rester rattachable à son débiteur) ; et **`centre_id` passe NULLABLE avec `ON DELETE SET NULL`** en remplacement du `Cascade` actuel (le centre n'est plus qu'une trace d'origine, sa suppression ne doit ni détruire la facture ni être bloquée par elle). Implication légale : une facture émise est un document comptable immuable (le PDF est déjà figé sur OVH) — `Cascade` actuel = destruction de pièce comptable, à éliminer quoi qu'on décide d'autre. L'alternative `centre_id NOT NULL + Restrict` est écartée : elle bloquerait à jamais la suppression d'un centre pour un lien devenu non-légal.
- **`acceptations_cgv`** : ajouter `organisation_id UUID NULL` + FK `ON DELETE RESTRICT` + backfill identique (no-op). `centre_id` : conserver NOT NULL + Restrict implicite actuel (schema:707) — une acceptation CGV est une preuve de consentement, personne ne supprime un centre avec des CGV acceptées aujourd'hui, et le passage à SetNull pourra se décider quand le cas se présentera. Position minimale : **additif seulement** sur cette table au Lot 1.
- Prisma : `organisation Organisation? @relation(...)` sur les deux modèles + relations inverses `facturesLiavo FactureLiavo[]` / `acceptationsCgv AcceptationCgv[]` sur `Organisation`.
- Nommage SQL : le DROP/ADD de la FK `factures_liavo_centre_id_fkey` (rename du comportement Cascade→SetNull) nécessite `ALTER TABLE … DROP CONSTRAINT … ; ALTER COLUMN centre_id DROP NOT NULL ; ADD CONSTRAINT … ON DELETE SET NULL` — vérifier le nom exact de la contrainte via `\d factures_liavo` en Phase 2 (convention Prisma : `factures_liavo_centre_id_fkey`).

## 8. SQL prod (SELECT read-only, pgsql-console, 06/08/2026) — résultats bruts

```
 nb_factures_liavo   : 0
 nb_acceptations_cgv : 0
 orgs_multi          : 2
 fl_orphelines  (factures liées à un centre sans org)     : 0
 cgv_orphelines (acceptations liées à un centre sans org) : 0
```

Lecture : **aucune FactureLiavo ni AcceptationCgv n'existe en prod** (Choucas est facturé par virement mais aucune facture n'est passée par la table — cohérent avec 0 mandat Mollie et 0 souscription self-service à ce jour). Le backfill de re-parentage est donc un no-op ; le backfill d'état org (§6) porte sur ~134 organisations mono-centre alignées + 2 multi alignées.

## 9. Cascades / risques

- **Drift Prisma** : le SQL manuel et `schema.prisma` doivent partir dans le **même commit** — un `@map` qui ne correspond pas à la colonne = crash runtime silencieux au premier SELECT (leçon `relance_hebergeur_at`, vérif (d) du 31/07). La checklist = le tableau du §5, colonne par colonne.
- **Ordre d'application** : géré par le Procfile (`migrate deploy` AVANT `start:prod`) — le nouveau code ne démarre jamais sur une base sans les colonnes. **Ne pas appliquer le SQL à la main avant le push** (casserait le boot : « column already exists » — erreur déjà documentée et corrigée le 31/07, ne pas la reproduire).
- **Enum `"TypeAbonnement"`** : seul type non revu dans un fichier de migration — confirmer le nom PG (`\dT`) avant d'écrire le SQL.
- **Colonnes oubliées** : le miroir fait 10 colonnes ; `dernier_email_alerte_at` et `abonnement` (fréquence) sont les deux qu'on oublie facilement (la fréquence pilote la prolongation du webhook, le tampon pilote le cron). Le tableau §1 est la source.
- **`trial_started_at` sur l'org** : dépend de la décision Q4 (trial par user vs par org) — à trancher AVANT la Phase 2 pour ne pas créer une colonne morte ou, pire, deux sources de vérité de l'essai.
- **Double état transitoire** : après le Lot 1, l'état existe sur le centre ET sur l'org ; tant que le code (Lots 2-3) n'a pas basculé, **seul le centre fait foi**. Interdire tout write applicatif sur les colonnes org avant la bascule (sinon divergence dès le premier webhook). La dépréciation/suppression des colonnes centre est un lot ultérieur, jamais dans cette migration (non destructive).
- **Rollback** : migration purement additive → un rollback applicatif (revert du code) laisse des colonnes inertes, sans danger. Aucun chemin de retour destructif à prévoir.

---

*Design Lot 1 réalisé en lecture seule le 06/08/2026. SQL prod : SELECT count uniquement. STOP — zéro écriture, zéro migration.*
